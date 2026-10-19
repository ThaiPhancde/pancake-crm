import { type Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopManager,
	assertShopReader,
	canManage,
	PancakeAccessError,
} from "./access";
import { writeAudit } from "./admin";
import { PANCAKE, shopTimezone } from "./config";
import { parseSavedFilterParams, savedFilterParams } from "./contracts";

export class PancakeSavedFilterLimit extends Error {
	constructor() {
		super("SAVED_FILTER_LIMIT");
	}
}

const shopId = z.string().min(1);
const currency = z.string().regex(/^[A-Z]{3}$/);
const timezone = z
	.string()
	.min(1)
	.max(64)
	.refine((value) => {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: value });
			return true;
		} catch {
			return false;
		}
	}, "Invalid IANA time zone");

export const settingsFields = z.object({
	displayName: z.string().trim().max(160).nullable(),
	currency,
	timezone,
	countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(50),
	dialCode: z
		.string()
		.regex(/^\d{1,4}$/)
		.nullable(),
	showSamePhoneOnConversation: z.boolean(),
	mergeOrdersByPhone: z.boolean(),
	customerSources: z.array(z.string().trim().min(1).max(120)).max(100),
});
export const updateSettingsInput = settingsFields.partial().extend({ shopId });
export const copySettingsInput = z
	.object({ sourceShopId: shopId, targetShopId: shopId })
	.refine((v) => v.sourceShopId !== v.targetShopId, "Same shop");

export type ShopSettings = z.infer<typeof settingsFields>;

export function defaultSettings(id: string): ShopSettings {
	return {
		displayName: null,
		currency: PANCAKE.shopCurrency.get(id) ?? PANCAKE.defaultCurrency,
		timezone: shopTimezone(id),
		countries: [],
		dialCode: PANCAKE.shopDialCode.get(id) ?? null,
		showSamePhoneOnConversation: false,
		mergeOrdersByPhone: false,
		customerSources: [],
	};
}

type EffectiveSettings = ShopSettings & {
	saved: boolean;
	updatedAt: string | null;
};

const settingsCache = new Map<
	string,
	{ at: number; value: Promise<EffectiveSettings> }
>();

function forgetSettings(id: string) {
	settingsCache.delete(id);
}

export function effectiveSettings(
	db: Db,
	id: string,
): Promise<EffectiveSettings> {
	const hit = settingsCache.get(id);
	if (hit && Date.now() - hit.at < PANCAKE.settingsCacheMs) return hit.value;
	const value = loadSettings(db, id).catch((error) => {
		settingsCache.delete(id);
		throw error;
	});
	settingsCache.set(id, { at: Date.now(), value });
	return value;
}

async function loadSettings(db: Db, id: string): Promise<EffectiveSettings> {
	const fallback = defaultSettings(id);
	const row = await db.pancakeShopSettings.findUnique({
		where: { shopId: id },
	});
	if (!row) return { ...fallback, saved: false, updatedAt: null };
	return {
		displayName: row.displayName,
		currency: row.currency ?? fallback.currency,
		timezone: row.timezone ?? fallback.timezone,
		countries: row.countries,
		dialCode: row.dialCode ?? fallback.dialCode,
		showSamePhoneOnConversation: row.showSamePhoneOnConversation,
		mergeOrdersByPhone: row.mergeOrdersByPhone,
		customerSources: row.customerSources,
		saved: true,
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function shopCurrencyOf(db: Db, id: string) {
	return (await effectiveSettings(db, id)).currency;
}

export async function shopTimezoneOf(db: Db, id?: string) {
	if (!id) return shopTimezone();
	return (await effectiveSettings(db, id)).timezone;
}

export async function getSettings(db: Db, userId: string, id: string) {
	const grants = await assertShopReader(db, userId, id);
	return {
		shopId: id,
		...(await effectiveSettings(db, id)),
		canManage: canManage(grants, id),
	};
}

function changedKeys(patch: Partial<ShopSettings>) {
	return Object.entries(patch)
		.filter(([, value]) => value !== undefined)
		.map(([key]) => key);
}

export async function updateSettings(
	db: Db,
	userId: string,
	input: z.infer<typeof updateSettingsInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const { shopId: id, ...patch } = input;
	await db.$transaction(async (tx) => {
		await tx.pancakeShopSettings.upsert({
			where: { shopId: id },
			create: { ...defaultSettings(id), ...patch, shopId: id },
			update: patch,
		});
		await writeAudit(tx, {
			shopId: id,
			userId,
			area: "settings",
			action: "update",
			summary: `Cập nhật cài đặt: ${changedKeys(patch).join(", ") || "không đổi"}`,
		});
	});
	forgetSettings(id);
	return getSettings(db, userId, id);
}

export async function copySettings(
	db: Db,
	userId: string,
	input: z.infer<typeof copySettingsInput>,
) {
	await Promise.all([
		assertShopManager(db, userId, input.sourceShopId),
		assertShopManager(db, userId, input.targetShopId),
	]);
	const { displayName, saved, updatedAt, ...copied } = await effectiveSettings(
		db,
		input.sourceShopId,
	);
	await db.$transaction(async (tx) => {
		await tx.pancakeShopSettings.upsert({
			where: { shopId: input.targetShopId },
			create: { ...copied, shopId: input.targetShopId },
			update: copied,
		});
		await writeAudit(tx, {
			shopId: input.targetShopId,
			userId,
			area: "settings",
			action: "copy",
			summary: `Sao chép cấu hình từ shop ${input.sourceShopId}`,
		});
	});
	forgetSettings(input.targetShopId);
	return getSettings(db, userId, input.targetShopId);
}

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const revenueTargetsInput = z.object({
	shopId,
	year: z.number().int().min(2000).max(2100).optional(),
});
export const setRevenueTargetInput = z.object({
	shopId,
	month,
	currency,
	amount: z
		.string()
		.regex(/^\d{1,18}(\.\d{1,4})?$/)
		.nullable(),
});

export async function revenueTargets(
	db: Db,
	userId: string,
	input: z.infer<typeof revenueTargetsInput>,
) {
	await assertShopReader(db, userId, input.shopId);
	const rows = await db.pancakeRevenueTarget.findMany({
		where: {
			shopId: input.shopId,
			month: input.year ? { startsWith: `${input.year}-` } : undefined,
		},
		select: { month: true, currency: true, amount: true },
		orderBy: [{ month: "asc" }, { currency: "asc" }],
	});
	return rows.map((row) => ({ ...row, amount: row.amount.toString() }));
}

export async function setRevenueTarget(
	db: Db,
	userId: string,
	input: z.infer<typeof setRevenueTargetInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const key = {
		shopId_month_currency: {
			shopId: input.shopId,
			month: input.month,
			currency: input.currency,
		},
	};
	await db.$transaction(async (tx) => {
		if (input.amount === null)
			await tx.pancakeRevenueTarget.deleteMany({
				where: {
					shopId: input.shopId,
					month: input.month,
					currency: input.currency,
				},
			});
		else
			await tx.pancakeRevenueTarget.upsert({
				where: key,
				create: {
					shopId: input.shopId,
					month: input.month,
					currency: input.currency,
					amount: new Prisma.Decimal(input.amount),
				},
				update: { amount: new Prisma.Decimal(input.amount) },
			});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "settings",
			action: "revenue_target",
			summary:
				input.amount === null
					? `Xóa mục tiêu doanh thu ${input.month} ${input.currency}`
					: `Đặt mục tiêu doanh thu ${input.month}: ${input.amount} ${input.currency}`,
		});
	});
	return {
		month: input.month,
		currency: input.currency,
		amount: input.amount,
	};
}

export const preferenceFields = z.object({
	disableAppNotifications: z.boolean(),
	browserNotifications: z.boolean(),
	sound: z
		.string()
		.refine((value) => PANCAKE.notificationSounds.includes(value), "Sound"),
});
export const updatePreferenceInput = preferenceFields
	.partial()
	.extend({ shopId });

export async function getPreferences(db: Db, userId: string, id: string) {
	await assertShopReader(db, userId, id);
	const row = await db.pancakeUserPreference.findUnique({
		where: { userId_shopId: { userId, shopId: id } },
		select: {
			disableAppNotifications: true,
			browserNotifications: true,
			sound: true,
		},
	});
	return {
		shopId: id,
		...(row ?? {
			disableAppNotifications: false,
			browserNotifications: false,
			sound: PANCAKE.defaultSound,
		}),
		sounds: [...PANCAKE.notificationSounds],
	};
}

export async function updatePreferences(
	db: Db,
	userId: string,
	input: z.infer<typeof updatePreferenceInput>,
) {
	await assertShopReader(db, userId, input.shopId);
	const { shopId: id, ...patch } = input;
	await db.pancakeUserPreference.upsert({
		where: { userId_shopId: { userId, shopId: id } },
		create: { userId, shopId: id, ...patch },
		update: patch,
	});
	return getPreferences(db, userId, id);
}

export const SAVED_FILTER_PAGES = [
	"leads",
	"contacts",
	"orders",
	"appointments",
	"tickets",
	"products",
] as const;
export const savedFilterListInput = z.object({
	shopId,
	page: z.enum(SAVED_FILTER_PAGES),
});
export const createSavedFilterInput = savedFilterListInput.extend({
	name: z.string().trim().min(1).max(80),
	params: savedFilterParams,
	isDefault: z.boolean().default(false),
});
export const savedFilterRefInput = z.object({ shopId, id: z.string().min(1) });
export const setDefaultSavedFilterInput = savedFilterRefInput.extend({
	isDefault: z.boolean().default(true),
});

export async function listSavedFilters(
	db: Db,
	userId: string,
	input: z.infer<typeof savedFilterListInput>,
) {
	await assertShopReader(db, userId, input.shopId);
	const rows = await db.pancakeSavedFilter.findMany({
		where: { userId, shopId: input.shopId, page: input.page },
		select: {
			id: true,
			page: true,
			name: true,
			params: true,
			isDefault: true,
			createdAt: true,
		},
		orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
	});
	return {
		max: PANCAKE.savedFilterMax,
		rows: rows.map((row) => ({
			...row,
			params: parseSavedFilterParams(row.params),
			createdAt: row.createdAt.toISOString(),
		})),
	};
}

export async function createSavedFilter(
	db: Db,
	userId: string,
	input: z.infer<typeof createSavedFilterInput>,
) {
	await assertShopReader(db, userId, input.shopId);
	return db.$transaction(async (tx) => {
		const scope = { userId, shopId: input.shopId, page: input.page };
		if (
			(await tx.pancakeSavedFilter.count({ where: scope })) >=
			PANCAKE.savedFilterMax
		)
			throw new PancakeSavedFilterLimit();
		if (input.isDefault)
			await tx.pancakeSavedFilter.updateMany({
				where: scope,
				data: { isDefault: false },
			});
		return tx.pancakeSavedFilter.create({
			data: {
				...scope,
				name: input.name,
				params: input.params,
				isDefault: input.isDefault,
			},
			select: { id: true },
		});
	});
}

async function ownFilter(db: Db, userId: string, shop: string, id: string) {
	const row = await db.pancakeSavedFilter.findFirst({
		where: { id, userId, shopId: shop },
		select: { id: true, page: true },
	});
	if (!row) throw new PancakeAccessError();
	return row;
}

export async function deleteSavedFilter(
	db: Db,
	userId: string,
	input: z.infer<typeof savedFilterRefInput>,
) {
	const row = await ownFilter(db, userId, input.shopId, input.id);
	await db.pancakeSavedFilter.delete({ where: { id: row.id } });
	return { id: row.id };
}

export async function setDefaultSavedFilter(
	db: Db,
	userId: string,
	input: z.infer<typeof setDefaultSavedFilterInput>,
) {
	const row = await ownFilter(db, userId, input.shopId, input.id);
	await db.$transaction([
		db.pancakeSavedFilter.updateMany({
			where: { userId, shopId: input.shopId, page: row.page },
			data: { isDefault: false },
		}),
		db.pancakeSavedFilter.update({
			where: { id: row.id },
			data: { isDefault: input.isDefault },
		}),
	]);
	return { id: row.id, isDefault: input.isDefault };
}
