import { beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import { listInput } from "../src/contracts";
import { listOrders, operationsOverview } from "../src/queries";
import { storeRecord } from "../src/store";
import {
	createTask,
	createTaskInput,
	listTasks,
	taskAssignees,
	taskListInput,
	updateTask,
} from "../src/tasks";
import { sampleOrder } from "./fixtures";

const run = crypto.randomUUID();
const a = `workflow-a-${run}`;
const b = `workflow-b-${run}`;
const manager = `manager-${run}`;
const seller = `seller-${run}`;
const viewer = `viewer-${run}`;
const outsider = `outsider-${run}`;

async function denied(action: Promise<unknown>, code = "access denied") {
	let failure: unknown;
	try {
		await action;
	} catch (error) {
		failure = error;
	}
	expect(failure).toBeInstanceOf(Error);
	expect(String(failure)).toContain(code);
}

beforeAll(async () => {
	const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://invalid");
	if (url.pathname !== "/comp_ai_crm_test" || url.hostname !== "127.0.0.1")
		throw new Error("Isolated test database required");
	await db.organization.upsert({
		where: { id: "workspace" },
		create: {
			id: "workspace",
			name: "Fixture",
			slug: "sample-fixture",
			createdAt: new Date(),
		},
		update: {},
	});
	for (const id of [manager, seller, viewer, outsider]) {
		await db.user.create({
			data: {
				id,
				name: id.split("-")[0] ?? "Sample",
				email: `${id}@example.invalid`,
			},
		});
		await db.member.create({
			data: {
				id: crypto.randomUUID(),
				userId: id,
				organizationId: "workspace",
				role: "member",
				createdAt: new Date(),
			},
		});
	}
	for (const id of [a, b])
		await db.pancakeShop.create({
			data: {
				id,
				name: "Workflow fixture",
				apiKeyEnv: "PANCAKE_API_KEY_SAMPLE",
			},
		});
	for (const entry of [
		{ userId: manager, shopId: a, role: "MANAGER" as const },
		{
			userId: seller,
			shopId: a,
			role: "TELESALE" as const,
			employeeId: "sample-seller-a",
		},
		{ userId: viewer, shopId: a, role: "VIEWER" as const },
		{ userId: outsider, shopId: b, role: "MANAGER" as const },
	])
		await db.pancakeShopMember.create({ data: entry });
	for (const [id, status] of [
		["1", 0],
		["2", 2],
		["3", 5],
	] as const)
		await db.$transaction((tx) =>
			storeRecord(
				tx,
				a,
				"orders",
				{
					...sampleOrder(a, id, status),
					assigning_seller:
						id === "2" ? null : { id: "sample-seller-a", name: "Sample" },
				},
				new Date(),
			),
		);
	await db.$transaction((tx) =>
		storeRecord(tx, b, "orders", sampleOrder(b), new Date()),
	);
});

describe("CRM follow-up workflow", () => {
	test("create is idempotent and creates no AI work", async () => {
		const before = await db.agentTask.count();
		const input = createTaskInput.parse({
			requestId: crypto.randomUUID(),
			shopId: a,
			orderId: "1",
			title: "Call sample customer",
			note: "Sample note",
			dueAt: "2026-01-01T00:00:00Z",
		});
		await createTask(db, seller, input);
		await createTask(db, seller, input);
		expect(await db.pancakeTask.count({ where: { id: input.requestId } })).toBe(
			1,
		);
		expect(await db.agentTask.count()).toBe(before);
	});
	test("assignment validates current shop and salesperson access", async () => {
		const options = await taskAssignees(db, manager, a, "1");
		expect(options.some((row) => row.id === seller)).toBe(true);
		expect(
			options.some((row) => row.id === outsider || row.id === viewer),
		).toBe(false);
		const input = createTaskInput.parse({
			requestId: crypto.randomUUID(),
			shopId: a,
			orderId: "1",
			title: "Sample",
			dueAt: "2026-01-01T00:00:00Z",
			assigneeId: outsider,
		});
		await denied(createTask(db, manager, input));
		await denied(createTask(db, viewer, { ...input, assigneeId: viewer }));
		await denied(
			createTask(db, seller, { ...input, shopId: b, assigneeId: seller }),
		);
		await denied(
			createTask(db, seller, { ...input, orderId: "2", assigneeId: seller }),
		);
	});
	test("state changes reject stale versions and viewer writes", async () => {
		const input = createTaskInput.parse({
			requestId: crypto.randomUUID(),
			shopId: a,
			orderId: "1",
			title: "Track shipment",
			dueAt: "2026-01-01T00:00:00Z",
			assigneeId: seller,
		});
		const { id } = await createTask(db, manager, input);
		const current = await db.pancakeTask.findUniqueOrThrow({ where: { id } });
		const update = {
			id,
			expectedUpdatedAt: current.updatedAt.toISOString(),
			status: "DONE" as const,
		};
		await denied(updateTask(db, viewer, update));
		await updateTask(db, seller, update);
		await denied(updateTask(db, seller, update), "TASK_CONFLICT");
		const done = await db.pancakeTask.findUniqueOrThrow({ where: { id } });
		expect(done.status).toBe("DONE");
		expect(done.completedAt).not.toBeNull();
		await updateTask(db, manager, {
			...update,
			status: "OPEN",
			expectedUpdatedAt: done.updatedAt.toISOString(),
		});
		expect(
			(await db.pancakeTask.findUniqueOrThrow({ where: { id } })).completedAt,
		).toBeNull();
	});
	test("task lists and overdue counts preserve shop permissions", async () => {
		const tasks = await listTasks(
			db,
			seller,
			taskListInput.parse({ shopId: a, taskView: "mine" }),
		);
		expect(tasks.total).toBe(2);
		expect(tasks.overdue).toBe(2);
		expect(
			tasks.rows.every((row) => row.assignee.id === seller && row.canUpdate),
		).toBe(true);
		expect((await listTasks(db, outsider, taskListInput.parse({}))).total).toBe(
			0,
		);
		await denied(listTasks(db, outsider, taskListInput.parse({ shopId: a })));
		expect(
			(
				await listTasks(db, viewer, taskListInput.parse({ shopId: a }))
			).rows.every((row) => !row.canUpdate),
		).toBe(true);
	});
	test("operating queues and sorting use stored orders without POS calls", async () => {
		expect(
			(
				await listOrders(db, manager, listInput.parse({ view: "shipping" }))
			).rows.map((row) => row.orderId),
		).toEqual(["2"]);
		expect(
			(await listOrders(db, manager, listInput.parse({ view: "unassigned" })))
				.total,
		).toBe(1);
		expect(
			(await listOrders(db, seller, listInput.parse({ view: "shipping" })))
				.total,
		).toBe(0);
		const overview = await operationsOverview(db, manager, listInput.parse({}));
		expect([
			overview.orders,
			overview.pending,
			overview.shipping,
			overview.returns,
			overview.unassigned,
		]).toEqual([3, 1, 1, 1, 1]);
		expect(overview.overdue).toBe(2);
	});
});
