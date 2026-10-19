import type { Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopWriter,
	orderScope,
	PancakeAccessError,
	shopGrants,
} from "./access";
import { listInput } from "./contracts";

export const taskListInput = listInput.safeExtend({
	taskView: z.enum(["open", "overdue", "mine", "done", "all"]).default("open"),
});
export const createTaskInput = z.object({
	requestId: z.uuid(),
	shopId: z.string().min(1),
	orderId: z.string().min(1),
	title: z.string().trim().min(1).max(160),
	note: z.string().trim().max(2000).default(""),
	dueAt: z.iso.datetime({ offset: true }),
	assigneeId: z.string().min(1).optional(),
});
export const updateTaskInput = z.object({
	id: z.string().min(1),
	expectedUpdatedAt: z.iso.datetime({ offset: true }),
	status: z.enum(["OPEN", "DONE"]),
});

export class PancakeTaskConflict extends Error {
	constructor() {
		super("TASK_CONFLICT");
	}
}

async function writableOrder(
	db: Db,
	userId: string,
	shopId: string,
	orderId: string,
) {
	const grants = await assertShopWriter(db, userId, shopId);
	const grant = grants.find((entry) => entry.shopId === shopId);
	if (!grant) throw new PancakeAccessError();
	const order = await db.pancakeOrder.findFirst({
		where: { AND: [orderScope(grants, shopId), { shopId, orderId }] },
		select: { sellerId: true },
	});
	if (!order) throw new PancakeAccessError();
	return { grant, order };
}

export async function taskAssignees(
	db: Db,
	userId: string,
	shopId: string,
	orderId: string,
) {
	const { grant, order } = await writableOrder(db, userId, shopId, orderId);
	return db.user.findMany({
		where: {
			id: grant.role === "TELESALE" ? userId : undefined,
			members: { some: { organizationId: "workspace" } },
			OR: [
				{
					members: {
						some: {
							organizationId: "workspace",
							role: { in: ["owner", "admin"] },
						},
					},
				},
				{
					pancakeMemberships: {
						some: {
							shopId,
							OR: [
								{ role: "MANAGER" },
								{
									role: "TELESALE",
									employeeId: order.sellerId ?? "__unmapped__",
								},
							],
						},
					},
				},
			],
		},
		select: { id: true, name: true },
		orderBy: [{ name: "asc" }, { id: "asc" }],
	});
}

export async function createTask(
	db: Db,
	userId: string,
	input: z.infer<typeof createTaskInput>,
) {
	const assigneeId = input.assigneeId ?? userId;
	const options = await taskAssignees(db, userId, input.shopId, input.orderId);
	if (!options.some((option) => option.id === assigneeId))
		throw new PancakeAccessError();
	const existing = await db.pancakeTask.findUnique({
		where: { id: input.requestId },
	});
	if (
		existing &&
		(existing.createdById !== userId ||
			existing.shopId !== input.shopId ||
			existing.orderId !== input.orderId)
	)
		throw new PancakeAccessError();
	return db.pancakeTask.upsert({
		where: { id: input.requestId },
		create: {
			id: input.requestId,
			shopId: input.shopId,
			orderId: input.orderId,
			title: input.title,
			note: input.note,
			dueAt: new Date(input.dueAt),
			assigneeId,
			createdById: userId,
		},
		update: {},
		select: { id: true },
	});
}

export async function updateTask(
	db: Db,
	userId: string,
	input: z.infer<typeof updateTaskInput>,
) {
	const task = await db.pancakeTask.findUnique({ where: { id: input.id } });
	if (!task) throw new PancakeAccessError();
	const { grant } = await writableOrder(db, userId, task.shopId, task.orderId);
	if (grant.role !== "MANAGER" && task.assigneeId !== userId)
		throw new PancakeAccessError();
	const result = await db.pancakeTask.updateMany({
		where: { id: task.id, updatedAt: new Date(input.expectedUpdatedAt) },
		data: {
			status: input.status,
			completedAt: input.status === "DONE" ? new Date() : null,
			updatedAt: new Date(Math.max(Date.now(), task.updatedAt.getTime() + 1)),
		},
	});
	if (!result.count) throw new PancakeTaskConflict();
	return { updated: true };
}

export async function listTasks(
	db: Db,
	userId: string,
	input: z.infer<typeof taskListInput>,
	now = new Date(),
) {
	const grants = await shopGrants(db, userId);
	const scope = orderScope(grants, input.shopId);
	const where: Prisma.PancakeTaskWhereInput = {
		order: scope,
		status:
			input.taskView === "all"
				? undefined
				: input.taskView === "done"
					? "DONE"
					: "OPEN",
		assigneeId: input.taskView === "mine" ? userId : undefined,
		dueAt: input.taskView === "overdue" ? { lt: now } : undefined,
		OR: input.q
			? [
					{ title: { contains: input.q, mode: "insensitive" } },
					{ orderId: { contains: input.q } },
					{
						order: { customerName: { contains: input.q, mode: "insensitive" } },
					},
				]
			: undefined,
	};
	const [rows, total, overdue] = await Promise.all([
		db.pancakeTask.findMany({
			where,
			select: {
				id: true,
				shopId: true,
				orderId: true,
				title: true,
				note: true,
				dueAt: true,
				status: true,
				updatedAt: true,
				assignee: { select: { id: true, name: true } },
				order: {
					select: { customerName: true, shop: { select: { name: true } } },
				},
			},
			orderBy: [{ dueAt: "asc" }, { id: "asc" }],
			take: input.pageSize,
			skip: (input.page - 1) * input.pageSize,
		}),
		db.pancakeTask.count({ where }),
		db.pancakeTask.count({
			where: { order: scope, status: "OPEN", dueAt: { lt: now } },
		}),
	]);
	return {
		total,
		overdue,
		rows: rows.map((row) => ({
			...row,
			dueAt: row.dueAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			overdue: row.status === "OPEN" && row.dueAt < now,
			canUpdate: grants.some(
				(grant) =>
					grant.shopId === row.shopId &&
					(grant.role === "MANAGER" ||
						(grant.role === "TELESALE" && row.assignee.id === userId)),
			),
		})),
	};
}
