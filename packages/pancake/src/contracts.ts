import type { JsonValue } from "@crm/db";
import { z } from "zod";
import { PANCAKE, PERMISSION_ENTITIES } from "./config";

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
		date_of_birth: nullableText,
		gender: nullableText,
		tags: z.array(z.string()).nullish(),
		order_count: z.number().int().nonnegative().nullish(),
		purchased_amount: z.number().finite().nullish(),
		conversation_link: nullableText,
		pages_customers: z
			.array(
				z
					.object({
						id: sourceId.optional(),
						name: nullableText,
						platform: nullableText,
					})
					.passthrough(),
			)
			.nullish(),
		shop_customer_addresses: z
			.array(
				z
					.object({
						address: nullableText,
						full_address: nullableText,
						province_id: nullableText,
						district_id: nullableText,
						commune_id: nullableText,
						country_code: z.union([z.string(), z.number()]).nullish(),
					})
					.passthrough(),
			)
			.nullish(),
	})
	.passthrough();
export const productWire = z
	.object({
		id: sourceId,
		product_id: sourceId,
		updated_at: sourceTime.nullish(),
		inserted_at: sourceTime.nullish(),
		images: z.array(z.string()).nullish(),
		product: z
			.object({
				name: z.string(),
				display_id: nullableText,
				updated_at: sourceTime.nullish(),
				image: nullableText,
				note_product: nullableText,
				categories: z
					.array(
						z
							.object({ id: sourceId.optional(), name: nullableText })
							.passthrough(),
					)
					.nullish(),
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
		role: sourceId.nullish(),
		profile_id: nullableText,
		department: z
			.object({ id: sourceId.optional(), name: nullableText })
			.passthrough()
			.nullish(),
		user: z
			.object({
				id: sourceId.optional(),
				name: z.string(),
				email: nullableText,
				avatar_url: nullableText,
				phone_number: nullableText,
				fb_id: nullableText,
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
		total_discount: money.nullish(),
		order_sources_name: nullableText,
		ads_source: nullableText,
		note: nullableText,
		page: z
			.object({
				id: sourceId.optional(),
				name: nullableText,
				platform: nullableText,
			})
			.passthrough()
			.nullish(),
		shipping_address: z
			.object({
				full_address: nullableText,
				address: nullableText,
			})
			.passthrough()
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
export const contactCountsInput = z.object({
	shopId: z.string().min(1).optional(),
});
export const listInput = z
	.object({
		view: z
			.enum(["all", "pending", "shipping", "returns", "unassigned"])
			.default("all"),
		sort: z.enum(["newest", "updated", "oldest"]).default("newest"),
		shopId: z.string().min(1).optional(),
		q: z.string().max(120).default(""),
		status: z.number().int().optional(),
		sellerId: z.string().max(2000).optional(),
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
		page: z.number().int().min(1).max(100_000).default(1),
		pageSize: z.number().int().min(1).max(PANCAKE.maxListSize).default(25),
	})
	.refine((v) => !v.from || !v.to || v.from <= v.to, "Invalid date range");
export type ListInput = z.infer<typeof listInput>;
export const GROUPINGS = ["day", "week", "month"] as const;
export type Grouping = (typeof GROUPINGS)[number];
export const businessReportInput = listInput.safeExtend({
	grouping: z.enum(GROUPINGS).default("day"),
});
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
export const approveEmployeeInput = z.object({
	shopId: z.string().min(1),
	employeeId: z.string().min(1),
	role: z.enum(["MANAGER", "TELESALE", "VIEWER"]).default("TELESALE"),
});
export const customerDetailInput = z.object({
	shopId: z.string().min(1),
	customerId: z.string().min(1),
});
const multiValue = z.string().max(2000).optional();
const assignableText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullable()
		.optional()
		.refine(
			(v) => v !== PANCAKE.unassignedValue && v !== PANCAKE.anyValue,
			"Reserved value",
		);
export const recordListInput = z
	.object({
		shopId: z.string().min(1),
		q: z.string().max(120).default(""),
		status: multiValue,
		assigneeId: multiValue,
		creatorId: multiValue,
		source: multiValue,
		priority: multiValue,
		category: multiValue,
		quick: z.string().max(40).optional(),
		customerId: z.string().max(120).optional(),
		id: z.string().max(120).optional(),
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
		page: z.number().int().min(1).max(100_000).default(1),
		pageSize: z.number().int().min(1).max(PANCAKE.maxListSize).default(25),
	})
	.refine((v) => !v.from || !v.to || v.from <= v.to, "Invalid date range");
export type RecordListInput = z.infer<typeof recordListInput>;
export const reportInput = z
	.object({
		shopId: z.string().min(1),
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
	})
	.refine((v) => !v.from || !v.to || v.from <= v.to, "Invalid date range");
export type ReportInput = z.infer<typeof reportInput>;
export const updateLeadInput = z.object({
	id: z.string().min(1),
	shopId: z.string().min(1),
	status: z.string().trim().min(1).max(80).optional(),
	assigneeId: assignableText(120),
});
export const updateAppointmentInput = z
	.object({
		id: z.string().min(1),
		shopId: z.string().min(1),
		title: z.string().trim().min(1).max(160).optional(),
		note: z.string().trim().max(2000).optional(),
		status: z.string().trim().min(1).max(80).optional(),
		startAt: z.iso.datetime({ offset: true }).optional(),
		endAt: z.iso.datetime({ offset: true }).nullable().optional(),
		assigneeId: assignableText(120),
	})
	.refine(
		(v) =>
			!v.endAt ||
			(v.startAt !== undefined && Date.parse(v.startAt) <= Date.parse(v.endAt)),
		"Invalid date range",
	);
export const updateTicketInput = z.object({
	id: z.string().min(1),
	shopId: z.string().min(1),
	status: z.string().trim().min(1).max(80).optional(),
	priority: z.string().trim().min(1).max(80).optional(),
	category: assignableText(120),
	assigneeId: assignableText(120),
	dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const bulkUpdateInput = z
	.object({
		shopId: z.string().min(1),
		entity: z.enum(["lead", "appointment", "ticket"]),
		ids: z.array(z.string().min(1)).min(1).max(PANCAKE.bulkMax),
		status: z.string().trim().min(1).max(80).optional(),
		assigneeId: assignableText(120),
	})
	.refine(
		(v) => v.status !== undefined || v.assigneeId !== undefined,
		"Nothing to update",
	);
export const recordRefInput = z.object({
	shopId: z.string().min(1),
	id: z.string().min(1),
});
export const createLeadInput = z.object({
	shopId: z.string().min(1),
	name: z.string().trim().min(1).max(160),
	phone: z.string().trim().max(60).optional(),
	email: z.string().trim().max(160).optional(),
	assigneeId: z.string().max(120).optional(),
	status: z.string().trim().max(80).default("new"),
	source: z.string().trim().max(120).optional(),
	note: z.string().trim().max(2000).default(""),
	fields: z.record(z.string(), z.string()).default({}),
});
export const createAppointmentInput = z.object({
	shopId: z.string().min(1),
	title: z.string().trim().min(1).max(160),
	customerId: z.string().max(120).optional(),
	contactName: z.string().trim().max(160).optional(),
	phone: z.string().trim().max(60).optional(),
	startAt: z.iso.datetime({ offset: true }),
	endAt: z.iso.datetime({ offset: true }).optional(),
	status: z.string().trim().max(80).default("scheduled"),
	assigneeId: z.string().max(120).optional(),
	source: z.string().trim().max(120).optional(),
	location: z.string().trim().max(240).optional(),
	note: z.string().trim().max(2000).default(""),
});
export const createTicketInput = z.object({
	shopId: z.string().min(1),
	title: z.string().trim().min(1).max(160),
	customerId: z.string().max(120).optional(),
	contactName: z.string().trim().max(160).optional(),
	phone: z.string().trim().max(60).optional(),
	email: z.string().trim().max(160).optional(),
	orderId: z.string().max(120).optional(),
	category: z.string().trim().max(120).optional(),
	priority: z.string().trim().max(80).default("low"),
	status: z.string().trim().max(80).default("new"),
	assigneeId: z.string().max(120).optional(),
	dueAt: z.iso.datetime({ offset: true }).optional(),
	source: z.string().trim().max(120).optional(),
	description: z.string().trim().max(2000).default(""),
});
export const createNoteInput = z.object({
	shopId: z.string().min(1),
	customerId: z.string().min(1),
	content: z.string().trim().min(1).max(4000),
});

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

export const permissionRights = z.object({
	configure: z.boolean(),
	view: z.boolean(),
	edit: z.boolean(),
	delete: z.boolean(),
	create: z.boolean(),
	export: z.boolean(),
});
export const permissionMatrix = z.partialRecord(
	z.enum(PERMISSION_ENTITIES),
	permissionRights,
);
export type PermissionMatrix = z.infer<typeof permissionMatrix>;

export function parsePermissionMatrix(value: JsonValue): PermissionMatrix {
	return permissionMatrix.parse(value);
}

export const AUTOMATION_TRIGGERS = [
	"record_created",
	"record_updated",
	"appointment_due",
	"birthday",
	"converted",
] as const;
export const AUTOMATION_ENTITIES = [
	"lead",
	"appointment",
	"ticket",
	"contact",
	"order",
] as const;
export const AUTOMATION_ACTIONS = [
	"notify_assignee",
	"assign_to",
	"send_email",
	"zalo_friend",
	"botcake_message",
	"json_api",
] as const;
const configText = (max: number) => z.string().trim().max(max);
export const automationRule = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("notify_assignee"),
		config: z.object({
			title: configText(160).optional(),
			body: configText(2000).optional(),
		}),
	}),
	z.object({
		action: z.literal("assign_to"),
		config: z.object({ assigneeId: z.string().trim().min(1).max(120) }),
	}),
	z.object({
		action: z.literal("send_email"),
		config: z.object({
			to: z.email().optional(),
			subject: configText(200).min(1),
			body: configText(5000),
		}),
	}),
	z.object({
		action: z.literal("zalo_friend"),
		config: z.object({ message: configText(1000).optional() }),
	}),
	z.object({
		action: z.literal("botcake_message"),
		config: z.object({
			flowId: configText(120).min(1),
			message: configText(1000).optional(),
		}),
	}),
	z.object({
		action: z.literal("json_api"),
		config: z.object({
			url: z.url({ protocol: /^https$/ }),
			method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
			headers: z.record(z.string().max(120), z.string().max(2000)).default({}),
		}),
	}),
]);
export type AutomationRule = z.infer<typeof automationRule>;

export function parseAutomationRule(action: string, config: JsonValue) {
	return automationRule.parse({ action, config });
}

export const savedFilterParams = z.record(
	z.string().min(1).max(40),
	z.string().max(2000),
);

export function parseSavedFilterParams(value: JsonValue) {
	return savedFilterParams.parse(value);
}

export const customerProfileWire = customerWire.pick({
	gender: true,
	date_of_birth: true,
});
