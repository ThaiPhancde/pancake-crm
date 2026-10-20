const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  }
}

const apiKey = process.env.AI_GATEWAY_API_KEY;
if (!apiKey) {
  console.error("AI_GATEWAY_API_KEY is not set in .env!");
  process.exit(1);
}

async function auditAndSelectBestModels() {
  console.log("==================================================================");
  console.log("🔄 BẮT ĐẦU QUÉT VÀ TỐI ƯU HÓA MODEL TRÊN VERCEL AI GATEWAY");
  console.log("==================================================================");

  const res = await fetch("https://ai-gateway.vercel.sh/v1/models");
  if (!res.ok) {
    console.error("Không thể tải danh sách model từ Vercel AI Gateway.");
    return null;
  }

  const json = await res.json();
  const models = json.data || [];

  // Filter for language models that support tool calling
  const eligible = models.filter((m) => {
    return (
      m.type === "language" &&
      Array.isArray(m.tags) &&
      m.tags.includes("tool-use")
    );
  });

  console.log(`Tìm thấy ${eligible.length} model hỗ trợ Tool Calling.`);

  // Sort primarily by output pricing ascending, then input pricing
  eligible.sort((a, b) => {
    const outA = Number(a.pricing?.output ?? 999);
    const outB = Number(b.pricing?.output ?? 999);
    if (outA !== outB) return outA - outB;
    const inA = Number(a.pricing?.input ?? 999);
    const inB = Number(b.pricing?.input ?? 999);
    return inA - inB;
  });

  console.log("\n🧪 Đang kiểm tra tính sẵn sàng thực tế đối với tài khoản...");

  const verified = [];
  // Test top 15 cheapest models
  for (const m of eligible.slice(0, 15)) {
    const outPerM = (Number(m.pricing?.output || 0) * 1e6).toFixed(3);
    const inPerM = (Number(m.pricing?.input || 0) * 1e6).toFixed(3);

    try {
      const ping = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m.id,
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 16,
        }),
      });

      if (ping.ok) {
        console.log(`✅ [HOẠT ĐỘNG] ${m.id} -> Output: $${outPerM}/M | Input: $${inPerM}/M | Context: ${m.context_window}`);
        verified.push({
          id: m.id,
          name: m.name,
          contextWindow: m.context_window,
          inputPrice: Number(m.pricing?.input || 0),
          outputPrice: Number(m.pricing?.output || 0),
          inputPerM: `$${inPerM}/M`,
          outputPerM: `$${outPerM}/M`,
        });
      } else {
        const err = await ping.json();
        console.log(`❌ [BỊ CHẶN ${ping.status}] ${m.id}: ${err.error?.message?.slice(0, 60)}...`);
      }
    } catch (e) {
      console.log(`❌ [LỖI KẾT NỐI] ${m.id}: ${e.message}`);
    }
  }

  if (verified.length === 0) {
    console.error("Không có model miễn phí/giá rẻ nào khả dụng.");
    return null;
  }

  const bestFreeOrCheap = verified[0];
  console.log("\n==================================================================");
  console.log(`🏆 MODEL TỐI ƯU NHẤT CHO TÁC VỤ CRM (ĐẦU RA DÀI): ${bestFreeOrCheap.id}`);
  console.log(`   - Chi phí Output: ${bestFreeOrCheap.outputPerM}`);
  console.log(`   - Chi phí Input:  ${bestFreeOrCheap.inputPerM}`);
  console.log(`   - Context Window: ${bestFreeOrCheap.contextWindow.toLocaleString()} tokens`);
  console.log("==================================================================");

  // Update packages/db/src/settings.ts
  const settingsPath = path.resolve(__dirname, "../packages/db/src/settings.ts");
  if (fs.existsSync(settingsPath)) {
    let settingsContent = fs.readFileSync(settingsPath, "utf8");
    const replacement = `export const DEFAULT_AGENT_MODEL = {
\tid: "${bestFreeOrCheap.id}",
\tcontextWindowTokens: ${bestFreeOrCheap.contextWindow},
} as const;`;

    settingsContent = settingsContent.replace(
      /export const DEFAULT_AGENT_MODEL = \{[\s\S]*?\} as const;/,
      replacement
    );
    fs.writeFileSync(settingsPath, settingsContent, "utf8");
    console.log(`✅ Đã tự động cập nhật DEFAULT_AGENT_MODEL sang ${bestFreeOrCheap.id} trong packages/db/src/settings.ts!`);
  }

  return { best: bestFreeOrCheap, verified };
}

auditAndSelectBestModels().catch(console.error);
