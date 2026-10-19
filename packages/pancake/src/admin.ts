import type { Db } from "@crm/db";
import { z } from "zod";
import {
	assertShopManager,
	assertShopReader,
	PancakeAccessError,
} from "./access";
import { PANCAKE, PERMISSION_DEFAULTS, PERMISSION_ENTITIES } from "./config";
import {
	type PermissionMatrix,
	parsePermissionMatrix,
	permissionMatrix,
} from "./contracts";
import { csvFile } from "./csv";

export const AUDIT_AREAS = [
	"settings",
	"automation",
	"permission",
	"branch",
	"record",
] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

export type AuditEntry = {
	shopId: string;
	userId: string;
	area: AuditArea;
	action: string;
	summary: string;
};

export async function writeAudit(
	db: Pick<Db, "pancakeAuditLog">,
	entry: AuditEntry,
) {
	await db.pancakeAuditLog.create({ data: entry });
}

export const historyListInput = z.object({
	shopId: z.string().min(1),
	tab: z.enum(["all", ...AUDIT_AREAS]).default("all"),
	page: z.number().int().min(1).max(100_000).default(1),
	pageSize: z.number().int().min(1).max(PANCAKE.historyMaxPage).default(25),
});
export const historyExportInput = historyListInput.pick({
	shopId: true,
	tab: true,
});

function historyWhere(input: { shopId: string; tab: string }) {
	return {
		shopId: input.shopId,
		area: input.tab === "all" ? undefined : input.tab,
	};
}

const historySelect = {
	id: true,
	area: true,
	action: true,
	summary: true,
	at: true,
	user: { select: { id: true, name: true } },
} as const;

export async function listHistory(
	db: Db,
	userId: string,
	input: z.infer<typeof historyListInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const where = historyWhere(input);
	const [rows, total] = await Promise.all([
		db.pancakeAuditLog.findMany({
			where,
			select: historySelect,
			orderBy: [{ at: "desc" }, { id: "desc" }],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeAuditLog.count({ where }),
	]);
	return {
		total,
		rows: rows.map((row) => ({ ...row, at: row.at.toISOString() })),
	};
}

export async function exportHistory(
	db: Db,
	userId: string,
	input: z.infer<typeof historyExportInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const rows = await db.pancakeAuditLog.findMany({
		where: historyWhere(input),
		select: historySelect,
		orderBy: [{ at: "desc" }, { id: "desc" }],
		take: PANCAKE.exportMaxRows + 1,
	});
	return csvFile(
		`lich-su-${input.shopId}`,
		["Thời điểm", "Người thực hiện", "Khu vực", "Hành động", "Nội dung"],
		rows.map((row) => [
			row.at.toISOString(),
			row.user?.name ?? "",
			row.area,
			row.action,
			row.summary,
		]),
	);
}

const optionalText = (max: number) =>
	z.string().trim().max(max).nullable().optional();
export const branchInput = z.object({
	shopId: z.string().min(1),
	name: z.string().trim().min(1).max(160),
	phone: optionalText(60),
	email: optionalText(160),
	address: optionalText(500),
	isDefault: z.boolean().optional(),
});
export const updateBranchInput = branchInput.partial().extend({
	shopId: z.string().min(1),
	id: z.string().min(1),
	isDefault: z.literal(true).optional(),
});
export const branchRefInput = z.object({
	shopId: z.string().min(1),
	id: z.string().min(1),
});
export const branchMembersInput = branchRefInput.extend({
	members: z
		.array(
			z.union([
				z.object({ userId: z.string().min(1) }),
				z.object({ employeeId: z.string().min(1) }),
			]),
		)
		.max(500),
});

const branchSelect = {
	id: true,
	name: true,
	phone: true,
	email: true,
	address: true,
	isDefault: true,
	createdAt: true,
	updatedAt: true,
	members: {
		select: {
			userId: true,
			employeeId: true,
			user: { select: { name: true } },
		},
	},
} as const;

export async function listBranches(db: Db, userId: string, shopId: string) {
	await assertShopReader(db, userId, shopId);
	const rows = await db.pancakeBranch.findMany({
		where: { shopId, archivedAt: null },
		select: branchSelect,
		orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
	});
	return rows.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		members: row.members.map((member) => ({
			userId: member.userId,
			employeeId: member.employeeId,
			name: member.user?.name ?? null,
		})),
	}));
}

async function activeBranch(db: Db, shopId: string, id: string) {
	const branch = await db.pancakeBranch.findFirst({
		where: { id, shopId, archivedAt: null },
		select: { id: true, name: true, isDefault: true },
	});
	if (!branch) throw new PancakeAccessError();
	return branch;
}

export async function createBranch(
	db: Db,
	userId: string,
	input: z.infer<typeof branchInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const id = await db.$transaction(async (tx) => {
		const existing = await tx.pancakeBranch.count({
			where: { shopId: input.shopId, archivedAt: null },
		});
		const isDefault = existing === 0 || input.isDefault === true;
		if (isDefault)
			await tx.pancakeBranch.updateMany({
				where: { shopId: input.shopId, isDefault: true },
				data: { isDefault: false },
			});
		const row = await tx.pancakeBranch.create({
			data: {
				shopId: input.shopId,
				name: input.name,
				phone: input.phone || null,
				email: input.email || null,
				address: input.address || null,
				isDefault,
			},
			select: { id: true },
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "branch",
			action: "create",
			summary: `Tạo chi nhánh ${input.name}`,
		});
		return row.id;
	});
	return { id };
}

export async function updateBranch(
	db: Db,
	userId: string,
	input: z.infer<typeof updateBranchInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const branch = await activeBranch(db, input.shopId, input.id);
	await db.$transaction(async (tx) => {
		if (input.isDefault)
			await tx.pancakeBranch.updateMany({
				where: { shopId: input.shopId, isDefault: true },
				data: { isDefault: false },
			});
		await tx.pancakeBranch.update({
			where: { id: branch.id },
			data: {
				name: input.name,
				phone: input.phone === undefined ? undefined : input.phone || null,
				email: input.email === undefined ? undefined : input.email || null,
				address:
					input.address === undefined ? undefined : input.address || null,
				isDefault: input.isDefault,
			},
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "branch",
			action: "update",
			summary: `Cập nhật chi nhánh ${input.name ?? branch.name}`,
		});
	});
	return { id: branch.id };
}

export async function archiveBranch(
	db: Db,
	userId: string,
	input: z.infer<typeof branchRefInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const branch = await activeBranch(db, input.shopId, input.id);
	await db.$transaction(async (tx) => {
		await tx.pancakeBranch.update({
			where: { id: branch.id },
			data: { archivedAt: new Date(), isDefault: false },
		});
		if (branch.isDefault) {
			const next = await tx.pancakeBranch.findFirst({
				where: { shopId: input.shopId, archivedAt: null },
				orderBy: { createdAt: "asc" },
				select: { id: true },
			});
			if (next)
				await tx.pancakeBranch.update({
					where: { id: next.id },
					data: { isDefault: true },
				});
		}
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "branch",
			action: "archive",
			summary: `Lưu trữ chi nhánh ${branch.name}`,
		});
	});
	return { id: branch.id };
}

export async function setBranchMembers(
	db: Db,
	userId: string,
	input: z.infer<typeof branchMembersInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const branch = await activeBranch(db, input.shopId, input.id);
	const userIds = [
		...new Set(
			input.members.flatMap((member) =>
				"userId" in member ? [member.userId] : [],
			),
		),
	];
	const employeeIds = [
		...new Set(
			input.members.flatMap((member) =>
				"employeeId" in member ? [member.employeeId] : [],
			),
		),
	];
	const [users, employees] = await Promise.all([
		db.pancakeShopMember.count({
			where: { shopId: input.shopId, userId: { in: userIds } },
		}),
		db.pancakeEmployee.count({
			where: { shopId: input.shopId, employeeId: { in: employeeIds } },
		}),
	]);
	if (users !== userIds.length || employees !== employeeIds.length)
		throw new PancakeAccessError();
	await db.$transaction(async (tx) => {
		await tx.pancakeBranchMember.deleteMany({ where: { branchId: branch.id } });
		await tx.pancakeBranchMember.createMany({
			data: [
				...userIds.map((id) => ({
					shopId: input.shopId,
					branchId: branch.id,
					userId: id,
				})),
				...employeeIds.map((id) => ({
					shopId: input.shopId,
					branchId: branch.id,
					employeeId: id,
				})),
			],
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "branch",
			action: "members",
			summary: `Cập nhật ${userIds.length + employeeIds.length} thành viên chi nhánh ${branch.name}`,
		});
	});
	return { count: userIds.length + employeeIds.length };
}

export function defaultMatrix(
	actions: readonly string[],
	skip: readonly string[],
): PermissionMatrix {
	return Object.fromEntries(
		PERMISSION_ENTITIES.map((entity) => {
			const on = !skip.includes(entity);
			return [
				entity,
				{
					configure: on && actions.includes("configure"),
					view: on && actions.includes("view"),
					edit: on && actions.includes("edit"),
					delete: on && actions.includes("delete"),
					create: on && actions.includes("create"),
					export: on && actions.includes("export"),
				},
			];
		}),
	);
}

export const profileInput = z.object({
	shopId: z.string().min(1),
	name: z.string().trim().min(1).max(120),
	matrix: permissionMatrix,
});
export const updateProfileInput = profileInput.partial().extend({
	shopId: z.string().min(1),
	id: z.string().min(1),
});
export const profileRefInput = z.object({
	shopId: z.string().min(1),
	id: z.string().min(1),
});
export const assignProfileInput = z.object({
	shopId: z.string().min(1),
	userId: z.string().min(1),
	profileId: z.string().min(1).nullable(),
});

export async function listProfiles(db: Db, userId: string, shopId: string) {
	await assertShopManager(db, userId, shopId);
	if (!(await db.pancakePermissionProfile.count({ where: { shopId } })))
		await db.pancakePermissionProfile.createMany({
			data: PERMISSION_DEFAULTS.map((profile) => ({
				shopId,
				name: profile.name,
				matrix: defaultMatrix(profile.actions, profile.skip),
			})),
			skipDuplicates: true,
		});
	const rows = await db.pancakePermissionProfile.findMany({
		where: { shopId },
		select: {
			id: true,
			name: true,
			matrix: true,
			createdAt: true,
			updatedAt: true,
			members: { select: { userId: true } },
		},
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
	});
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		matrix: parsePermissionMatrix(row.matrix),
		memberUserIds: row.members.map((member) => member.userId),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));
}

async function profileOf(db: Db, shopId: string, id: string) {
	const profile = await db.pancakePermissionProfile.findFirst({
		where: { id, shopId },
		select: { id: true, name: true },
	});
	if (!profile) throw new PancakeAccessError();
	return profile;
}

export async function createProfile(
	db: Db,
	userId: string,
	input: z.infer<typeof profileInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	return db.$transaction(async (tx) => {
		const row = await tx.pancakePermissionProfile.create({
			data: { shopId: input.shopId, name: input.name, matrix: input.matrix },
			select: { id: true },
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "permission",
			action: "profile_create",
			summary: `Tạo hồ sơ quyền ${input.name}`,
		});
		return row;
	});
}

export async function updateProfile(
	db: Db,
	userId: string,
	input: z.infer<typeof updateProfileInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const profile = await profileOf(db, input.shopId, input.id);
	return db.$transaction(async (tx) => {
		await tx.pancakePermissionProfile.update({
			where: { id: profile.id },
			data: { name: input.name, matrix: input.matrix },
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "permission",
			action: "profile_update",
			summary: `Cập nhật hồ sơ quyền ${input.name ?? profile.name}`,
		});
		return { id: profile.id };
	});
}

export async function deleteProfile(
	db: Db,
	userId: string,
	input: z.infer<typeof profileRefInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const profile = await profileOf(db, input.shopId, input.id);
	return db.$transaction(async (tx) => {
		await tx.pancakePermissionProfile.delete({ where: { id: profile.id } });
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "permission",
			action: "profile_delete",
			summary: `Xóa hồ sơ quyền ${profile.name}`,
		});
		return { id: profile.id };
	});
}

export async function assignProfile(
	db: Db,
	userId: string,
	input: z.infer<typeof assignProfileInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const [profile, target] = await Promise.all([
		input.profileId ? profileOf(db, input.shopId, input.profileId) : null,
		db.user.findUnique({
			where: { id: input.userId },
			select: { name: true },
		}),
	]);
	const who = target?.name ?? input.userId;
	return db.$transaction(async (tx) => {
		const { count } = await tx.pancakeShopMember.updateMany({
			where: { shopId: input.shopId, userId: input.userId },
			data: { profileId: profile?.id ?? null },
		});
		if (!count) throw new PancakeAccessError();
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "permission",
			action: "profile_assign",
			summary: profile
				? `Gán hồ sơ quyền ${profile.name} cho ${who}`
				: `Bỏ hồ sơ quyền của ${who}`,
		});
		return { userId: input.userId, profileId: profile?.id ?? null };
	});
}
