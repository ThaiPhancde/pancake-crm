import { createHash, timingSafeEqual } from "node:crypto";
import type { Db } from "@crm/db";
import { z } from "zod";
import { sourceId } from "./contracts";

const webhookPayload = z.union([
	z
		.object({
			id: sourceId,
			shop_id: sourceId.optional(),
			status: z.number(),
			items: z.array(z.json()),
		})
		.transform((value) => ({ resource: "orders", shopId: value.shop_id })),
	z
		.object({
			data: z.object({
				record: z.object({ name: z.string() }).passthrough(),
				success: z.boolean(),
			}),
		})
		.transform(() => ({ resource: "products", shopId: undefined })),
	z
		.object({
			id: sourceId,
			name: z.string().nullish(),
			phone_numbers: z.array(z.string()).nullish(),
			emails: z.array(z.string()).nullish(),
			shop_id: sourceId.optional(),
		})
		.transform((value) => ({ resource: "customers", shopId: value.shop_id })),
]);

export function webhookTokenValid(
	expected: string | undefined,
	supplied: string | undefined,
): boolean {
	if (!expected || expected.length < 32 || !supplied) return false;
	const left = Buffer.from(expected);
	const right = Buffer.from(supplied);
	return left.length === right.length && timingSafeEqual(left, right);
}

export async function queueWebhook(
	db: Db,
	shopId: string,
	rawBody: string,
): Promise<void> {
	const event = webhookPayload.parse(JSON.parse(rawBody));
	if (event.shopId && event.shopId !== shopId) throw new Error("SHOP_MISMATCH");
	const dedupeKey = createHash("sha256").update(rawBody).digest("hex");
	await db.$transaction([
		db.pancakeWebhookJob.upsert({
			where: {
				shopId_resource_dedupeKey: {
					shopId,
					resource: event.resource,
					dedupeKey,
				},
			},
			create: { shopId, resource: event.resource, dedupeKey },
			update: {},
		}),
		db.pancakeShop.update({
			where: { id: shopId },
			data: { lastWebhookAt: new Date() },
		}),
	]);
}
