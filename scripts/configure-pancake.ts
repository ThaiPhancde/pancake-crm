import "@crm/env/load";
import { resolve } from "node:path";
import { db } from "@crm/db";
import { assertCrmDatabase } from "@crm/pancake/config";
import { shopsConfig } from "@crm/pancake/contracts";
import { z } from "zod";
import { pancakeFingerprint } from "./pancake-fingerprint";

const evidenceSchema = z.object({
	passed: z.literal(true),
	checkedAt: z.iso.datetime(),
	fingerprint: z.string(),
	database: z.literal("comp_ai_crm_test"),
	outboundWrites: z.literal(0),
	aiCalls: z.literal(0),
});
const url = process.env.DATABASE_URL ?? "";
assertCrmDatabase(url);
if (!["/CRM", "/comp_ai_crm"].includes(new URL(url).pathname))
	throw new Error("Configuration requires the dedicated comp_ai_crm database.");
const root = resolve(import.meta.dir, "..");
const evidenceFile = Bun.file(
	resolve(root, ".scratch/pancake-verification.json"),
);
const evidence = evidenceSchema.parse(await evidenceFile.json());
if (evidence.fingerprint !== pancakeFingerprint(root))
	throw new Error(
		"Source has changed. Run pancake:test again before configuring live shops.",
	);
const shops = shopsConfig.parse(
	JSON.parse(process.env.PANCAKE_SHOPS_JSON ?? "[]"),
);
const approved = process.argv.includes("--approve-read-only");
const index = process.argv.indexOf("--shop");
const chosen = index >= 0 ? process.argv[index + 1] : undefined;
if (approved && (!chosen || !shops.some((shop) => shop.id === chosen)))
	throw new Error(
		"Approval requires --shop <configured shop ID> --approve-read-only.",
	);
try {
	for (const shop of shops) {
		if (approved && shop.id !== chosen) continue;
		if (approved && !process.env[shop.apiKeyEnv])
			throw new Error("Configure the shop API key before approval.");
		await db.pancakeShop.upsert({
			where: { id: shop.id },
			create: {
				...shop,
				fixtureVerifiedAt: new Date(evidence.checkedAt),
				enabled: approved,
				liveApprovedAt: approved ? new Date() : null,
			},
			update: {
				...shop,
				fixtureVerifiedAt: new Date(evidence.checkedAt),
				...(approved ? { enabled: true, liveApprovedAt: new Date() } : {}),
			},
		});
		process.stdout.write(
			`Shop ${shop.id}: ${approved ? "approved for read-only synchronization" : "configured; live state unchanged"}.\n`,
		);
	}
} finally {
	await db.$disconnect();
}
