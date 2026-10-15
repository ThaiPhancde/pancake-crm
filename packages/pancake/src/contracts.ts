import { z } from "zod";
import { PANCAKE } from "./config";

export const sourceId = z
	.union([z.string().min(1), z.number().int().safe()])
	.transform(String);
const nullableText = z.string().nullish();
export const sourceTime = z
	.string()
	.min(1)
	.refine(
		(value) =>
			Number.isFinite(
				Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`),
			),
		"Invalid source timestamp",
	);
const money = z.number().finite().nonnegative();
const actor = z.object({ id: sourceId, name: nullableText }).passthrough();
const statusEvent = z
	.object({
		id: sourceId.optional(),
		status: z.number().int(),
		old_status: z.number().int().nullish(),
		updated_at: sourceTime.optional(),
		inserted_at: sourceTime.optional(),
		editor_id: nullableText,
		name: nullableText,
	})
	.passthrough();
export const customerWire = z
	.object({
		id: sourceId,
		name: z.string().nullish(),
		phone_numbers: z.array(z.string()).nullish(),
		emails: z.array(z.string()).nullish(),
		assigned_user_id: nullableText,
		updated_at: sourceTime.nullish(),
		inserted_at: sourceTime.nullish(),
	})
	.passthrough();
export const productWire = z
	.object({
		id: sourceId,
		product_id: sourceId,
		updated_at: sourceTime.nullish(),
		inserted_at: sourceTime.nullish(),
		product: z
			.object({
				name: z.string(),
				display_id: nullableText,
				updated_at: sourceTime.nullish(),
			})
			.passthrough(),
		display_id: nullableText,
		retail_price: money.nullish(),
		remain_quantity: z.number().finite().nullish(),
		is_hidden: z.boolean().nullish(),
		fields: z
			.array(z.object({ name: z.string(), value: z.string() }).passthrough())
			.nullish(),
	})
	.passthrough();
export const employeeWire = z
	.object({
		user_id: sourceId,
		shop_id: sourceId.optional(),
		user: z
			.object({
				id: sourceId.optional(),
				name: z.string(),
				email: nullableText,
			})
			.passthrough(),
	})
	.passthrough();
export const orderWire = z
	.object({
		id: sourceId,
		shop_id: sourceId.optional(),
		updated_at: sourceTime,
		inserted_at: sourceTime,
		status: z.number().int(),
		status_name: nullableText,
		// Pancake shops here keep the product amount in shipping_fee; total_price is always 0.
		shipping_fee: money.nullish(),
		order_currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.nullish(),
		bill_full_name: nullableText,
		bill_phone_number: nullableText,
		bill_email: nullableText,
		customer: z
			.object({ id: sourceId, name: nullableText })
			.passthrough()
			.nullish(),
		assigning_seller: actor.nullish(),
		assigning_care: actor.nullish(),
		creator: actor.nullish(),
		creator_id: nullableText,
		last_editor_id: nullableText,
		sub_status: z.number().int().nullish(),
		returned_reason_name: nullableText,
		status_history: z.array(statusEvent).nullish(),
		tracking_link: nullableText,
		partner: z
			.object({
				extend_code: nullableText,
				partner_id: sourceId.nullish(),
				updated_at: sourceTime.nullish(),
				status: z.union([z.string(), z.number()]).nullish(),
				extend_update: z
					.array(
						z
							.object({
								key: nullableText,
								status: nullableText,
								tracking_id: nullableText,
								note: nullableText,
								update_at: sourceTime.nullish(),
							})
							.passthrough(),
					)
					.nullish(),
			})
			.passthrough()
			.nullish(),
		items: z.array(
			z
				.object({
					product_id: sourceId.nullish(),
					variation_id: sourceId.nullish(),
					quantity: z.number().int().nonnegative(),
					returned_count: z.number().int().nonnegative().nullish(),
					variation_info: z
						.object({ name: nullableText, retail_price: money.nullish() })
						.passthrough()
						.nullish(),
				})
				.passthrough(),
		),
	})
	.passthrough();
export const returnWire = z
	.object({
		id: sourceId,
		shop_id: sourceId.optional(),
		order_id: sourceId.nullish(),
		order_id_to_returned: sourceId.nullish(),
		updated_at: sourceTime,
		inserted_at: sourceTime,
		status: z.number().int(),
		returned_fee: money.nullish(),
		shop_customer_id: sourceId.nullish(),
		status_histories: z.array(statusEvent).nullish(),
		returned_items: z
			.array(
				z
					.object({
						product_id: sourceId.optional(),
						variation_id: sourceId,
						returned_quantity: z.number().int().nonnegative(),
					})
					.passthrough(),
			)
			.nullish(),
	})
	.passthrough();
export type IncomingCustomer = z.infer<typeof customerWire>;
export type IncomingProduct = z.infer<typeof productWire>;
export type IncomingEmployee = z.infer<typeof employeeWire>;
export type IncomingOrder = z.infer<typeof orderWire>;
export type IncomingReturn = z.infer<typeof returnWire>;

export const pageEnvelope = z.object({
	success: z.literal(true),
	data: z.array(z.json()),
	page_number: z.number().int().positive().optional(),
	page_size: z.number().int().positive().optional(),
	total_entries: z.number().int().nonnegative().optional(),
	total_pages: z.number().int().nonnegative().optional(),
});
export type SourcePage = z.infer<typeof pageEnvelope>;
export const shopConfig = z.object({
	id: z.string().regex(/^\d+$/),
	name: z.string().min(1),
	apiKeyEnv: z.string().regex(/^PANCAKE_API_KEY_[A-Z0-9_]+$/),
	webhookTokenEnv: z
		.string()
		.regex(/^PANCAKE_WEBHOOK_TOKEN_[A-Z0-9_]+$/)
		.optional(),
});
export const shopsConfig = z.array(shopConfig);
export const listInput = z
	.object({
		view: z
			.enum(["all", "pending", "shipping", "returns", "unassigned"])
			.default("all"),
		sort: z.enum(["newest", "updated", "oldest"]).default("newest"),
		shopId: z.string().min(1).optional(),
		q: z.string().max(120).default(""),
		status: z.number().int().optional(),
		sellerId: z.string().max(120).optional(),
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
		page: z.number().int().min(1).max(100_000).default(1),
		pageSize: z.number().int().min(1).max(PANCAKE.maxListSize).default(25),
	})
	.refine((v) => !v.from || !v.to || v.from <= v.to, "Invalid date range");
export type ListInput = z.infer<typeof listInput>;
export const roleInput = z
	.object({
		shopId: z.string().min(1),
		userId: z.string().min(1),
		role: z.enum(["MANAGER", "TELESALE", "VIEWER"]),
		employeeId: z.string().min(1).optional(),
	})
	.refine(
		(v) => v.role !== "TELESALE" || Boolean(v.employeeId),
		"Telesale requires a Pancake employee mapping",
	);

export function sourceDate(value: string): Date {
	return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

export function isNewer(
	current: { sourceUpdatedAt: Date | null; fetchedAt: Date } | null,
	sourceUpdatedAt: Date | null,
	fetchedAt: Date,
): boolean {
	if (!current) return true;
	if (current.sourceUpdatedAt && sourceUpdatedAt)
		return sourceUpdatedAt > current.sourceUpdatedAt;
	if (current.sourceUpdatedAt && !sourceUpdatedAt) return false;
	return fetchedAt > current.fetchedAt;
}
