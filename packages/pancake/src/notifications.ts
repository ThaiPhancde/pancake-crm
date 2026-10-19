import type { Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopManager,
	assertShopReader,
	canManage,
	PancakeAccessError,
} from "./access";
import { writeAudit } from "./admin";
import { PANCAKE } from "./config";
import {
	AUTOMATION_ENTITIES,
	AUTOMATION_TRIGGERS,
	automationRule,
} from "./contracts";
import { shopTimezoneOf } from "./settings";

export const NOTIFICATION_KINDS = ["assignment", "reminder", "system"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type RecordEntity = "lead" | "appointment" | "ticket" | "task";

const ENTITY_LABELS = {
	lead: "tiềm năng",
	appointment: "lịch hẹn",
	ticket: "vấn đề",
	task: "nhiệm vụ",
} as const satisfies Record<RecordEntity, string>;

export function recordLink(entity: RecordEntity, id: string, orderId?: string) {
	if (entity === "lead") return `leads?leadId=${encodeURIComponent(id)}`;
	if (entity === "appointment")
		return `calendar?appointmentId=${encodeURIComponent(id)}`;
	if (entity === "ticket") return `tickets?ticketId=${encodeURIComponent(id)}`;
	return `orders?orderId=${encodeURIComponent(orderId ?? "")}`;
}

type Draft = {
	userId: string;
	shopId: string;
	kind: NotificationKind;
	title: string;
	body: string;
	link: string | null;
	dedupeKey?: string;
};

export type RecordEvent = {
	shopId: string;
	entity: RecordEntity;
	trigger: "record_created" | "record_updated" | "converted";
	id: string;
	title: string;
	link: string;
	assigneeEmployeeId: string | null;
	assigneeUserId?: string | null;
	assignedNow: boolean;
};

export function assignmentDrafts(
	event: RecordEvent,
	userIds: string[],
	actorId: string,
): Draft[] {
	return userIds
		.filter((userId) => userId !== actorId)
		.map((userId) => ({
			userId,
			shopId: event.shopId,
			kind: "assignment",
			title: `Bạn được phân công ${ENTITY_LABELS[event.entity]}`,
			body: event.title,
			link: event.link,
		}));
}

export async function employeeUsers(
	db: Db,
	shopId: string,
	employeeId: string | null,
) {
	if (!employeeId) return [];
	const members = await db.pancakeShopMember.findMany({
		where: { shopId, employeeId },
		select: { userId: true },
	});
	return members.map((member) => member.userId);
}

async function eventAssignees(db: Db, event: RecordEvent) {
	if (event.entity === "task")
		return event.assigneeUserId ? [event.assigneeUserId] : [];
	return employeeUsers(db, event.shopId, event.assigneeEmployeeId);
}

type AutomationRow = {
	id: string;
	name: string;
	trigger: string;
	entity: string;
	action: string;
	config: Prisma.JsonValue;
	enabled: boolean;
	archivedAt: Date | null;
};

export function matchesAutomation(
	automation: Pick<
		AutomationRow,
		"trigger" | "entity" | "enabled" | "archivedAt"
	>,
	event: Pick<RecordEvent, "trigger" | "entity">,
) {
	return (
		automation.enabled &&
		!automation.archivedAt &&
		automation.trigger === event.trigger &&
		automation.entity === event.entity
	);
}

export function automationSupported(action: string) {
	return PANCAKE.automationInternalActions.includes(action);
}

async function reassign(
	db: Db,
	event: RecordEvent,
	assigneeId: string,
): Promise<boolean> {
	const employee = await db.pancakeEmployee.findUnique({
		where: {
			shopId_employeeId: { shopId: event.shopId, employeeId: assigneeId },
		},
		select: { employeeId: true },
	});
	if (!employee) return false;
	const where = { id: event.id, shopId: event.shopId };
	const data = { assigneeId };
	if (event.entity === "lead") await db.pancakeLead.updateMany({ where, data });
	else if (event.entity === "appointment")
		await db.pancakeAppointment.updateMany({ where, data });
	else if (event.entity === "ticket")
		await db.pancakeTicket.updateMany({ where, data });
	else return false;
	return true;
}

export async function recordEffects(
	db: Db,
	actorId: string,
	event: RecordEvent,
) {
	const drafts: Draft[] = event.assignedNow
		? assignmentDrafts(event, await eventAssignees(db, event), actorId)
		: [];
	const candidates =
		event.entity === "task"
			? []
			: await db.pancakeAutomation.findMany({
					where: { shopId: event.shopId, enabled: true, archivedAt: null },
					orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				});
	const results: { id: string; status: string }[] = [];
	let current = event;
	for (const automation of candidates.filter((row) =>
		matchesAutomation(row, event),
	)) {
		const rule = automationRule.safeParse({
			action: automation.action,
			config: automation.config,
		});
		let status: string = PANCAKE.automationStatus.unsupported;
		if (!rule.success) status = PANCAKE.automationStatus.invalid;
		else if (rule.data.action === "assign_to") {
			const assigneeId = rule.data.config.assigneeId;
			if (await reassign(db, current, assigneeId)) {
				current = { ...current, assigneeEmployeeId: assigneeId };
				drafts.push(
					...assignmentDrafts(
						current,
						await employeeUsers(db, event.shopId, assigneeId),
						actorId,
					),
				);
				status = PANCAKE.automationStatus.ok;
			} else status = PANCAKE.automationStatus.invalid;
		} else if (rule.data.action === "notify_assignee") {
			const config = rule.data.config;
			drafts.push(
				...(await eventAssignees(db, current)).map((userId) => ({
					userId,
					shopId: event.shopId,
					kind: "system" as const,
					title: config.title || automation.name,
					body: config.body || current.title,
					link: current.link,
				})),
			);
			status = PANCAKE.automationStatus.ok;
		}
		await db.pancakeAutomation.update({
			where: { id: automation.id },
			data: { lastRunAt: new Date(), lastStatus: status },
		});
		results.push({ id: automation.id, status });
	}
	if (drafts.length)
		await db.pancakeNotification.createMany({
			data: drafts,
			skipDuplicates: true,
		});
	return { notifications: drafts.length, automations: results };
}

type ReminderSource = {
	appointments: {
		id: string;
		title: string;
		startAt: Date;
		status: string;
	}[];
	tickets: { id: string; title: string; dueAt: Date | null; status: string }[];
	tasks: { id: string; title: string; dueAt: Date; orderId: string }[];
};

export function reminderDrafts(
	now: Date,
	source: ReminderSource,
	timeZone: string,
): Omit<Draft, "userId" | "shopId">[] {
	const time = (at: Date) =>
		new Intl.DateTimeFormat("vi-VN", {
			timeZone,
			hour: "2-digit",
			minute: "2-digit",
			day: "2-digit",
			month: "2-digit",
		}).format(at);
	const windowEnd = now.getTime() + PANCAKE.reminderWindowMs;
	return [
		...source.appointments
			.filter(
				(row) =>
					row.startAt.getTime() >= now.getTime() &&
					row.startAt.getTime() <= windowEnd &&
					!PANCAKE.appointmentDoneStatuses.includes(row.status) &&
					!PANCAKE.appointmentCancelledStatuses.includes(row.status),
			)
			.map((row) => ({
				kind: "reminder" as const,
				title: `Lịch hẹn sắp diễn ra lúc ${time(row.startAt)}`,
				body: row.title,
				link: recordLink("appointment", row.id),
				dedupeKey: `appointment:${row.id}:${row.startAt.getTime()}`,
			})),
		...source.tickets.flatMap((row) =>
			row.dueAt &&
			row.dueAt < now &&
			!PANCAKE.ticketDoneStatuses.includes(row.status)
				? [
						{
							kind: "reminder" as const,
							title: `Vấn đề quá hạn từ ${time(row.dueAt)}`,
							body: row.title,
							link: recordLink("ticket", row.id),
							dedupeKey: `ticket:${row.id}:${row.dueAt.getTime()}`,
						},
					]
				: [],
		),
		...source.tasks
			.filter((row) => row.dueAt < now)
			.map((row) => ({
				kind: "reminder" as const,
				title: `Nhiệm vụ quá hạn từ ${time(row.dueAt)}`,
				body: row.title,
				link: recordLink("task", row.id, row.orderId),
				dedupeKey: `task:${row.id}:${row.dueAt.getTime()}`,
			})),
	];
}

async function syncReminders(
	db: Db,
	userId: string,
	shopId: string,
	employeeId: string | null,
	timeZone: string,
	now = new Date(),
) {
	const mine = {
		OR: [
			{ assigneeId: null, createdById: userId },
			...(employeeId ? [{ assigneeId: employeeId }] : []),
		],
	};
	const [appointments, tickets, tasks] = await Promise.all([
		db.pancakeAppointment.findMany({
			where: {
				AND: [
					mine,
					{
						shopId,
						startAt: {
							gte: now,
							lte: new Date(now.getTime() + PANCAKE.reminderWindowMs),
						},
						status: {
							notIn: [
								...PANCAKE.appointmentDoneStatuses,
								...PANCAKE.appointmentCancelledStatuses,
							],
						},
					},
				],
			},
			select: { id: true, title: true, startAt: true, status: true },
			orderBy: { startAt: "asc" },
			take: PANCAKE.reminderBatch,
		}),
		db.pancakeTicket.findMany({
			where: {
				AND: [
					mine,
					{
						shopId,
						dueAt: { lt: now },
						status: { notIn: [...PANCAKE.ticketDoneStatuses] },
					},
				],
			},
			select: { id: true, title: true, dueAt: true, status: true },
			orderBy: { dueAt: "desc" },
			take: PANCAKE.reminderBatch,
		}),
		db.pancakeTask.findMany({
			where: { shopId, assigneeId: userId, status: "OPEN", dueAt: { lt: now } },
			select: { id: true, title: true, dueAt: true, orderId: true },
			orderBy: { dueAt: "desc" },
			take: PANCAKE.reminderBatch,
		}),
	]);
	const drafts = reminderDrafts(
		now,
		{ appointments, tickets, tasks },
		timeZone,
	);
	if (drafts.length)
		await db.pancakeNotification.createMany({
			data: drafts.map((draft) => ({ ...draft, userId, shopId })),
			skipDuplicates: true,
		});
}

const shopId = z.string().min(1);
const NOTIFICATION_TABS = {
	all: undefined,
	assigned: "assignment",
	reminder: "reminder",
	system: "system",
} as const;
export const notificationListInput = z.object({
	shopId,
	tab: z.enum(["all", "assigned", "reminder", "system"]).default("all"),
	q: z.string().max(120).default(""),
	sort: z.enum(["newest", "oldest"]).default("newest"),
	unreadOnly: z.boolean().default(false),
	page: z.number().int().min(1).max(100_000).default(1),
	pageSize: z.number().int().min(1).max(PANCAKE.maxListSize).default(20),
});
export const notificationShopInput = z.object({ shopId });
export const markReadInput = z.object({ shopId, id: z.string().min(1) });
export const markAllReadInput = z.object({
	shopId,
	tab: z.enum(["all", "assigned", "reminder", "system"]).default("all"),
});

async function readerContext(db: Db, userId: string, id: string) {
	const grants = await assertShopReader(db, userId, id);
	const employeeId =
		grants.find((grant) => grant.shopId === id)?.employeeId ?? null;
	await syncReminders(db, userId, id, employeeId, await shopTimezoneOf(db, id));
}

export async function listNotifications(
	db: Db,
	userId: string,
	input: z.infer<typeof notificationListInput>,
) {
	await readerContext(db, userId, input.shopId);
	const where: Prisma.PancakeNotificationWhereInput = {
		userId,
		shopId: input.shopId,
		kind: NOTIFICATION_TABS[input.tab],
		readAt: input.unreadOnly ? null : undefined,
		OR: input.q
			? [
					{ title: { contains: input.q, mode: "insensitive" } },
					{ body: { contains: input.q, mode: "insensitive" } },
				]
			: undefined,
	};
	const [rows, total, unread] = await Promise.all([
		db.pancakeNotification.findMany({
			where,
			select: {
				id: true,
				kind: true,
				title: true,
				body: true,
				link: true,
				readAt: true,
				createdAt: true,
			},
			orderBy: [
				{ createdAt: input.sort === "oldest" ? "asc" : "desc" },
				{ id: "asc" },
			],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeNotification.count({ where }),
		db.pancakeNotification.count({ where: { ...where, readAt: null } }),
	]);
	return {
		total,
		unread,
		rows: rows.map((row) => ({
			...row,
			readAt: row.readAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
		})),
	};
}

export async function notificationCounts(db: Db, userId: string, id: string) {
	await readerContext(db, userId, id);
	const groups = await db.pancakeNotification.groupBy({
		by: ["kind"],
		where: { userId, shopId: id, readAt: null },
		_count: { _all: true },
	});
	const unread = (kind: string) =>
		groups.find((group) => group.kind === kind)?._count._all ?? 0;
	return {
		all: groups.reduce((sum, group) => sum + group._count._all, 0),
		assigned: unread("assignment"),
		reminder: unread("reminder"),
		system: unread("system"),
	};
}

export async function markNotificationRead(
	db: Db,
	userId: string,
	input: z.infer<typeof markReadInput>,
) {
	const { count } = await db.pancakeNotification.updateMany({
		where: { id: input.id, userId, shopId: input.shopId, readAt: null },
		data: { readAt: new Date() },
	});
	return { updated: count };
}

export async function markAllNotificationsRead(
	db: Db,
	userId: string,
	input: z.infer<typeof markAllReadInput>,
) {
	await assertShopReader(db, userId, input.shopId);
	const { count } = await db.pancakeNotification.updateMany({
		where: {
			userId,
			shopId: input.shopId,
			kind: NOTIFICATION_TABS[input.tab],
			readAt: null,
		},
		data: { readAt: new Date() },
	});
	return { updated: count };
}

const automationFields = z.object({
	name: z.string().trim().min(1).max(160),
	description: z.string().trim().max(1000).default(""),
	trigger: z.enum(AUTOMATION_TRIGGERS),
	entity: z.enum(AUTOMATION_ENTITIES),
	rule: automationRule,
	enabled: z.boolean().default(true),
});
const assignableEntity = (v: { entity?: string; rule?: { action: string } }) =>
	v.rule?.action !== "assign_to" ||
	v.entity === undefined ||
	["lead", "appointment", "ticket"].includes(v.entity);
export const automationListInput = z.object({
	shopId,
	q: z.string().max(120).default(""),
	enabled: z.boolean().optional(),
});
export const createAutomationInput = automationFields
	.extend({ shopId })
	.refine(assignableEntity, "assign_to needs lead, appointment or ticket");
export const updateAutomationInput = automationFields
	.partial()
	.extend({ shopId, id: z.string().min(1) })
	.refine(assignableEntity, "assign_to needs lead, appointment or ticket");
export const toggleAutomationInput = z.object({
	shopId,
	id: z.string().min(1),
	enabled: z.boolean(),
});
export const automationRefInput = z.object({ shopId, id: z.string().min(1) });

export class PancakeAutomationInvalid extends Error {
	constructor() {
		super("AUTOMATION_INVALID");
	}
}

function automationView(row: {
	id: string;
	name: string;
	description: string;
	trigger: string;
	entity: string;
	action: string;
	config: Prisma.JsonValue;
	enabled: boolean;
	lastRunAt: Date | null;
	lastStatus: string | null;
	createdAt: Date;
	updatedAt: Date;
	createdBy: { id: string; name: string };
}) {
	const rule = automationRule.safeParse({
		action: row.action,
		config: row.config,
	});
	const supported = automationSupported(row.action);
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		trigger: row.trigger,
		entity: row.entity,
		action: row.action,
		config: rule.success ? rule.data.config : null,
		enabled: row.enabled,
		supported,
		status: !rule.success
			? PANCAKE.automationStatus.invalid
			: supported
				? (row.lastStatus ?? null)
				: PANCAKE.automationStatus.unsupported,
		lastRunAt: row.lastRunAt?.toISOString() ?? null,
		createdBy: row.createdBy,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

const automationSelect = {
	id: true,
	name: true,
	description: true,
	trigger: true,
	entity: true,
	action: true,
	config: true,
	enabled: true,
	lastRunAt: true,
	lastStatus: true,
	createdAt: true,
	updatedAt: true,
	createdBy: { select: { id: true, name: true } },
} as const;

export async function listAutomations(
	db: Db,
	userId: string,
	input: z.infer<typeof automationListInput>,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const where: Prisma.PancakeAutomationWhereInput = {
		shopId: input.shopId,
		archivedAt: null,
		enabled: input.enabled,
		OR: input.q
			? [
					{ name: { contains: input.q, mode: "insensitive" } },
					{ description: { contains: input.q, mode: "insensitive" } },
				]
			: undefined,
	};
	const [rows, total, active] = await Promise.all([
		db.pancakeAutomation.findMany({
			where,
			select: automationSelect,
			orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		}),
		db.pancakeAutomation.count({
			where: { shopId: input.shopId, archivedAt: null },
		}),
		db.pancakeAutomation.count({
			where: { shopId: input.shopId, archivedAt: null, enabled: true },
		}),
	]);
	return {
		total,
		active,
		canManage: canManage(grants, input.shopId),
		rows: rows.map(automationView),
	};
}

async function ownedAutomation(db: Db, shop: string, id: string) {
	const row = await db.pancakeAutomation.findFirst({
		where: { id, shopId: shop, archivedAt: null },
		select: { id: true, name: true, entity: true, action: true },
	});
	if (!row) throw new PancakeAccessError();
	return row;
}

export async function createAutomation(
	db: Db,
	userId: string,
	input: z.infer<typeof createAutomationInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	return db.$transaction(async (tx) => {
		const row = await tx.pancakeAutomation.create({
			data: {
				shopId: input.shopId,
				name: input.name,
				description: input.description,
				trigger: input.trigger,
				entity: input.entity,
				action: input.rule.action,
				config: input.rule.config,
				enabled: input.enabled,
				createdById: userId,
			},
			select: automationSelect,
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "automation",
			action: "create",
			summary: `Tạo tự động hoá ${input.name}`,
		});
		return automationView(row);
	});
}

export async function updateAutomation(
	db: Db,
	userId: string,
	input: z.infer<typeof updateAutomationInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const current = await ownedAutomation(db, input.shopId, input.id);
	if (
		!assignableEntity({
			entity: input.entity ?? current.entity,
			rule: input.rule ?? { action: current.action },
		})
	)
		throw new PancakeAutomationInvalid();
	return db.$transaction(async (tx) => {
		const row = await tx.pancakeAutomation.update({
			where: { id: current.id },
			data: {
				name: input.name,
				description: input.description,
				trigger: input.trigger,
				entity: input.entity,
				action: input.rule?.action,
				config: input.rule?.config,
				enabled: input.enabled,
			},
			select: automationSelect,
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "automation",
			action: "update",
			summary: `Cập nhật tự động hoá ${row.name}`,
		});
		return automationView(row);
	});
}

export async function toggleAutomation(
	db: Db,
	userId: string,
	input: z.infer<typeof toggleAutomationInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const current = await ownedAutomation(db, input.shopId, input.id);
	return db.$transaction(async (tx) => {
		const row = await tx.pancakeAutomation.update({
			where: { id: current.id },
			data: { enabled: input.enabled },
			select: automationSelect,
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "automation",
			action: input.enabled ? "enable" : "disable",
			summary: `${input.enabled ? "Bật" : "Tắt"} tự động hoá ${current.name}`,
		});
		return automationView(row);
	});
}

export async function archiveAutomation(
	db: Db,
	userId: string,
	input: z.infer<typeof automationRefInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const current = await ownedAutomation(db, input.shopId, input.id);
	await db.$transaction(async (tx) => {
		await tx.pancakeAutomation.update({
			where: { id: current.id },
			data: { archivedAt: new Date(), enabled: false },
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "automation",
			action: "archive",
			summary: `Lưu trữ tự động hoá ${current.name}`,
		});
	});
	return { id: current.id };
}
