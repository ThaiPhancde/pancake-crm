import { db } from "@crm/db";
import { PancakeAccessError, shopGrants } from "@crm/pancake/access";
import {
	ASSISTANT_TOOLS,
	plainReply,
	runAssistantTool,
} from "@crm/pancake/assistant";
import { PANCAKE } from "@crm/pancake/config";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";

export const maxDuration = 30;

const ASSISTANT = PANCAKE.assistant;

const requestBody = z.object({
	shopId: z.string().min(1).optional(),
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().trim().min(1).max(ASSISTANT.messageMaxChars),
			}),
		)
		.min(1)
		.max(100),
});

const completion = z.object({
	choices: z
		.array(
			z.object({
				message: z.object({
					content: z.string().nullish(),
					tool_calls: z
						.array(
							z.object({
								id: z.string(),
								type: z.literal("function"),
								function: z.object({
									name: z.string(),
									arguments: z.string(),
								}),
							}),
						)
						.nullish(),
				}),
			}),
		)
		.min(1),
});

type ChatMessage =
	| { role: "system" | "user"; content: string }
	| {
			role: "assistant";
			content: string | null;
			tool_calls?: z.infer<
				typeof completion
			>["choices"][number]["message"]["tool_calls"];
	  }
	| { role: "tool"; tool_call_id: string; content: string };

function systemPrompt(shopNames: string[], today: string) {
	return [
		"Bạn là trợ lý bán hàng Pancake POS của CRM. Trả lời bằng tiếng Việt, ngắn gọn, đúng số liệu.",
		`Hôm nay là ${today}. Shop người dùng đang xem: ${shopNames.join(", ")}.`,
		"Luôn gọi công cụ để lấy dữ liệu thật trước khi trả lời về đơn hàng, khách hàng, số điện thoại, doanh thu hoặc tỉ lệ hoàn. Không tự bịa số liệu.",
		"Định dạng: văn bản thuần. Không dùng markdown, không dùng dấu * hoặc **, không dùng tiêu đề #. Liệt kê bằng dòng bắt đầu với '- '. Ngày ghi dạng dd/mm/yyyy. Số tiền luôn kèm đơn vị tiền tệ.",
		"Khi không có dữ liệu, nói rõ là không tìm thấy và gợi ý kiểm tra lại số điện thoại hoặc mã đơn.",
		"Tỉ lệ hoàn = đơn hoàn / (đơn đã nhận + đơn hoàn). Cảnh báo rủi ro COD khi khách có đơn hoàn.",
	].join("\n");
}

async function complete(
	apiKey: string,
	messages: ChatMessage[],
	withTools: boolean,
) {
	const response = await fetch(ASSISTANT.gatewayUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: ASSISTANT.model,
			messages,
			tools: withTools ? ASSISTANT_TOOLS : undefined,
			max_tokens: ASSISTANT.maxTokens,
		}),
		signal: AbortSignal.timeout(ASSISTANT.timeoutMs),
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message = z
			.object({ error: z.object({ message: z.string() }) })
			.safeParse(json);
		throw new Error(
			message.success
				? message.data.error.message
				: `AI Gateway ${response.status}`,
		);
	}
	const parsed = completion.safeParse(json);
	if (!parsed.success)
		throw new Error("AI Gateway trả về dữ liệu không hợp lệ.");
	return parsed.data.choices[0]?.message;
}

export async function POST(req: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
	}
	const apiKey = process.env.AI_GATEWAY_API_KEY;
	if (!apiKey) {
		return NextResponse.json(
			{ error: "Chưa cấu hình AI_GATEWAY_API_KEY." },
			{ status: 503 },
		);
	}
	const body = requestBody.safeParse(await req.json().catch(() => null));
	if (!body.success) {
		return NextResponse.json(
			{ error: "Yêu cầu không hợp lệ." },
			{ status: 400 },
		);
	}

	let grants: Awaited<ReturnType<typeof shopGrants>>;
	try {
		grants = await shopGrants(db, session.user.id);
	} catch (error) {
		if (error instanceof PancakeAccessError) {
			return NextResponse.json({ error: error.message }, { status: 403 });
		}
		throw error;
	}
	if (body.data.shopId) {
		grants = grants.filter((grant) => grant.shopId === body.data.shopId);
		if (grants.length === 0) {
			return NextResponse.json(
				{ error: "Bạn không có quyền xem shop này." },
				{ status: 403 },
			);
		}
	}
	const shops = await db.pancakeShop.findMany({
		where: { id: { in: grants.map((grant) => grant.shopId) } },
		select: { name: true },
	});

	const messages: ChatMessage[] = [
		{
			role: "system",
			content: systemPrompt(
				shops.map((shop) => shop.name),
				new Date().toISOString().slice(0, 10),
			),
		},
		...body.data.messages.slice(-ASSISTANT.historyMessages),
	];
	const toolsCalled: string[] = [];

	try {
		for (let round = 0; round < ASSISTANT.maxRounds; round++) {
			const last = round === ASSISTANT.maxRounds - 1;
			const reply = await complete(apiKey, messages, !last);
			const calls = last ? [] : (reply?.tool_calls ?? []);
			if (calls.length === 0) {
				return NextResponse.json({
					reply:
						plainReply(reply?.content ?? "") ||
						"Tôi chưa có câu trả lời cho câu hỏi này.",
					toolsCalled,
				});
			}
			messages.push({
				role: "assistant",
				content: reply?.content ?? null,
				tool_calls: calls,
			});
			const results = await Promise.all(
				calls.map(async (call) => {
					toolsCalled.push(call.function.name);
					const result = await runAssistantTool(
						db,
						grants,
						call.function.name,
						call.function.arguments,
					);
					return {
						role: "tool" as const,
						tool_call_id: call.id,
						content: JSON.stringify(result),
					};
				}),
			);
			messages.push(...results);
		}
	} catch (error) {
		console.error("[pancake-ai-chat]", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Trợ lý AI đang gặp lỗi.",
			},
			{ status: 502 },
		);
	}
	return NextResponse.json({ reply: "", toolsCalled });
}
