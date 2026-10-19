import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, type Prisma } from "@crm/db";
import type { PageRequest, PancakeReader } from "../src/client";
import { listInput, pageEnvelope } from "../src/contracts";
import {
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	orderDetail,
	setMembership,
} from "../src/queries";
import { storeRecord } from "../src/store";
import { syncResource, syncShop } from "../src/sync";
import { queueWebhook } from "../src/webhook";
import {
	sampleCustomer,
	sampleEmployee,
	sampleOrder,
	sampleProduct,
	sampleReturn,
} from "./fixtures";

const run = crypto.randomUUID();
const shopA = `81${Date.now()}`;
const shopB = `82${Date.now()}`;
const userA = `sample-a-${run}`;
const userB = `sample-b-${run}`;
const now = new Date("2026-10-14T03:00:00Z");

async function expectRejected<T>(
	action: Promise<T>,
	message: string,
): Promise<void> {
	let rejected = false;
	try {
		await action;
	} catch (error) {
		expect(error).toBeInstanceOf(Error);
		expect(String(error)).toContain(message);
		rejected = true;
	}
	expect(rejected).toBe(true);
}

class FixtureReader implements PancakeReader {
	calls: PageRequest[] = [];
	failPage: number | null = null;
	constructor(
		private readonly values: Prisma.InputJsonObject[],
		private readonly size = 2,
	) {}
	async readPage(request: PageRequest) {
		this.calls.push(request);
		if (request.page === this.failPage) throw new Error("Synthetic failure");
		return pageEnvelope.parse({
			success: true,
			data: this.values.slice(
				(request.page - 1) * this.size,
				request.page * this.size,
			),
			page_number: request.page,
			page_size: this.size,
			total_entries: this.values.length,
		});
	}
}

beforeAll(async () => {
	const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://invalid");
	if (url.pathname !== "/comp_ai_crm_test" || url.hostname !== "127.0.0.1")
		throw new Error("Requires an isolated local comp_ai_crm_test database");
	await db.organization.upsert({
		where: { id: "workspace" },
		create: {
			id: "workspace",
			name: "Test fixture",
			slug: "sample-fixture",
			createdAt: new Date(),
		},
		update: {},
	});
	for (const [id, email] of [
		[userA, `a-${run}@example.invalid`],
		[userB, `b-${run}@example.invalid`],
	]) {
		if (!id || !email) throw new Error("Invalid fixture");
		await db.user.create({ data: { id, email, name: "Nhân viên mẫu" } });
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
	for (const id of [shopA, shopB])
		await db.pancakeShop.create({
			data: {
				id,
				name: "Shop kiểm thử",
				apiKeyEnv: "PANCAKE_API_KEY_SAMPLE",
				webhookTokenEnv: "PANCAKE_WEBHOOK_TOKEN_SAMPLE",
			},
		});
	await db.pancakeShopMember.create({
		data: {
			shopId: shopA,
			userId: userA,
			role: "TELESALE",
			employeeId: "sample-seller-a",
		},
	});
	await db.pancakeShopMember.create({
		data: { shopId: shopB, userId: userB, role: "VIEWER" },
	});
}, 30_000);
afterAll(async () => {
	await db.$disconnect();
});

describe("safe PostgreSQL integration", () => {
	test("paginated history resumes from its committed checkpoint after failure", async () => {
		const reader = new FixtureReader([
			sampleOrder(shopA, "1", 0),
			sampleOrder(shopA, "2", 6),
			sampleOrder(shopA, "3", 5),
		]);
		reader.failPage = 2;
		await expect(
			syncResource(db, shopA, "orders", reader, false, now),
		).rejects.toThrow("Synthetic failure");
		const cursor = await db.pancakeSyncCursor.findUniqueOrThrow({
			where: { shopId_resource: { shopId: shopA, resource: "orders" } },
		});
		expect(cursor.nextPage).toBe(2);
		expect(cursor.watermark).toBeNull();
		expect(cursor.windowEnd?.toISOString()).toBe(now.toISOString());
		expect(await db.pancakeOrder.count({ where: { shopId: shopA } })).toBe(2);
		reader.failPage = null;
		reader.calls = [];
		const result = await syncResource(
			db,
			shopA,
			"orders",
			reader,
			false,
			new Date("2026-10-15T00:00:00Z"),
		);
		expect(reader.calls[0]?.page).toBe(2);
		expect(result.complete).toBe(true);
		expect(
			(
				await db.pancakeSyncCursor.findUniqueOrThrow({
					where: { shopId_resource: { shopId: shopA, resource: "orders" } },
				})
			).watermark?.toISOString(),
		).toBe(now.toISOString());
		expect(await db.pancakeOrder.count({ where: { shopId: shopA } })).toBe(3);
	});
	test("incremental reads use a five-minute overlap after complete history", async () => {
		const reader = new FixtureReader([]);
		await syncResource(
			db,
			shopA,
			"orders",
			reader,
			false,
			new Date("2026-10-14T04:00:00Z"),
		);
		expect(reader.calls[0]?.start?.toISOString()).toBe(
			"2026-10-14T02:55:00.000Z",
		);
	});
	test("a bad record rolls back both page data and checkpoint", async () => {
		const reader = new FixtureReader([
			sampleOrder(shopB, "1"),
			{ id: "bad", status: 3 },
		]);
		await expect(
			syncResource(db, shopB, "orders", reader, false, now),
		).rejects.toThrow();
		expect(await db.pancakeOrder.count({ where: { shopId: shopB } })).toBe(0);
		expect(
			(
				await db.pancakeSyncCursor.findUniqueOrThrow({
					where: { shopId_resource: { shopId: shopB, resource: "orders" } },
				})
			).nextPage,
		).toBe(1);
	});
	test("duplicate deliveries and cross-shop order IDs stay unique", async () => {
		const item = sampleOrder(shopA, "1", 3, "2026-10-14T04:00:00Z");
		for (let i = 0; i < 2; i++)
			await db.$transaction((tx) =>
				storeRecord(tx, shopA, "orders", item, new Date()),
			);
		await db.$transaction((tx) =>
			storeRecord(tx, shopB, "orders", sampleOrder(shopB, "1", 3), new Date()),
		);
		expect(
			await db.pancakeOrder.count({
				where: { shopId: { in: [shopA, shopB] }, orderId: "1" },
			}),
		).toBe(2);
		const row = await db.pancakeOrder.findUniqueOrThrow({
			where: { shopId_orderId: { shopId: shopA, orderId: "1" } },
		});
		expect(row.status).toBe(3);
		expect(
			await db.pancakeOrderHistory.count({
				where: { shopId: shopA, orderId: "1", source: "poll-snapshot" },
			}),
		).toBe(2);
	});
	test("out-of-order payloads cannot regress order status or append a false transition", async () => {
		const before = await db.pancakeOrderHistory.count({
			where: { shopId: shopA, orderId: "1" },
		});
		expect(
			await db.$transaction((tx) =>
				storeRecord(
					tx,
					shopA,
					"orders",
					sampleOrder(shopA, "1", 6, "2026-10-14T01:00:00Z"),
					new Date(),
				),
			),
		).toBe(false);
		expect(
			(
				await db.pancakeOrder.findUniqueOrThrow({
					where: { shopId_orderId: { shopId: shopA, orderId: "1" } },
				})
			).status,
		).toBe(3);
		expect(
			await db.pancakeOrderHistory.count({
				where: { shopId: shopA, orderId: "1" },
			}),
		).toBe(before);
	});
	test("parallel writers serialize and retain the latest source version", async () => {
		await Promise.all([
			db.$transaction((tx) =>
				storeRecord(
					tx,
					shopA,
					"orders",
					sampleOrder(shopA, "4", 3, "2026-10-14T06:00:00Z"),
					new Date(),
				),
			),
			db.$transaction((tx) =>
				storeRecord(
					tx,
					shopA,
					"orders",
					sampleOrder(shopA, "4", 6, "2026-10-14T05:00:00Z"),
					new Date(),
				),
			),
		]);
		expect(
			(
				await db.pancakeOrder.findUniqueOrThrow({
					where: { shopId_orderId: { shopId: shopA, orderId: "4" } },
				})
			).status,
		).toBe(3);
	});
	test("customers, variations, returns and employees persist without AI tasks", async () => {
		const tasks = await db.agentTask.count();
		for (const [resource, value] of [
			["customers", sampleCustomer],
			["products", sampleProduct],
			["employees", sampleEmployee],
			["returns", sampleReturn(shopA)],
		] as const) {
			await db.$transaction((tx) =>
				storeRecord(tx, shopA, resource, value, new Date()),
			);
		}
		expect(await db.pancakeCustomer.count({ where: { shopId: shopA } })).toBe(
			1,
		);
		expect(await db.pancakeProduct.count({ where: { shopId: shopA } })).toBe(1);
		expect(await db.pancakeEmployee.count({ where: { shopId: shopA } })).toBe(
			1,
		);
		expect(await db.pancakeReturn.count({ where: { shopId: shopA } })).toBe(1);
		expect(await db.agentTask.count()).toBe(tasks);
	});
	test("foreign-shop payloads are rejected before any write", async () => {
		await expect(
			db.$transaction((tx) =>
				storeRecord(tx, shopA, "orders", sampleOrder(shopB, "999"), new Date()),
			),
		).rejects.toThrow("SHOP_MISMATCH");
		expect(
			await db.pancakeOrder.count({ where: { shopId: shopA, orderId: "999" } }),
		).toBe(0);
	});
	test("shop and telesale permissions cover lists, detail, history and reporting", async () => {
		const input = listInput.parse({ shopId: shopA });
		expect((await listOrders(db, userA, input)).total).toBe(4);
		await expectRejected(
			listOrders(db, userA, listInput.parse({ shopId: shopB })),
			"access denied",
		);
		await expectRejected(orderDetail(db, userA, shopB, "1"), "access denied");
		expect(
			(await customerPurchases(db, userA, shopA, "sample-customer-a", input))
				.total,
		).toBe(4);
		expect((await listCustomers(db, userA, input)).total).toBe(1);
		const hidden = {
			...sampleOrder(shopA, "5", 3),
			assigning_seller: { id: "sample-other", name: "Telesale khác" },
		};
		await db.$transaction((tx) =>
			storeRecord(tx, shopA, "orders", hidden, new Date()),
		);
		expect((await listOrders(db, userA, input)).total).toBe(4);
		await expectRejected(orderDetail(db, userA, shopA, "5"), "access denied");
		const report = await dashboardReport(db, userA, input);
		expect(report.delivered).toBe(2);
		expect(report.cancelled).toBe(1);
		expect(report.returned).toBe(1);
		expect(report.revenue).toEqual([{ currency: "VND", amount: "1000000" }]);
		expect(report.receivedRevenue).toEqual([
			{ currency: "VND", amount: "1000000" },
		]);
		await expectRejected(
			setMembership(db, userA, {
				shopId: shopA,
				userId: userB,
				role: "MANAGER",
			}),
			"access denied",
		);
	});
	test("webhook replay stays durable and deduplicated without trusting its payload", async () => {
		const body = JSON.stringify(sampleOrder(shopA, "999", 6));
		await queueWebhook(db, shopA, body);
		await queueWebhook(db, shopA, body);
		expect(
			await db.pancakeWebhookJob.count({
				where: { shopId: shopA, resource: "orders" },
			}),
		).toBe(1);
		expect(
			await db.pancakeOrder.count({ where: { shopId: shopA, orderId: "999" } }),
		).toBe(0);
		expect(
			(await db.pancakeShop.findUniqueOrThrow({ where: { id: shopA } }))
				.lastWebhookAt,
		).not.toBeNull();
	});
	test("one failed resource does not prevent orders and customers from syncing", async () => {
		const previousFlag = process.env.PANCAKE_LIVE_SYNC_ENABLED;
		const previousKey = process.env.PANCAKE_API_KEY_SAMPLE;
		const previousDatabase = process.env.DATABASE_URL;
		process.env.PANCAKE_LIVE_SYNC_ENABLED = "1";
		process.env.PANCAKE_API_KEY_SAMPLE = "SAFE_SAMPLE_KEY";
		process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
		const shop = await db.pancakeShop.update({
			where: { id: shopA },
			data: {
				enabled: true,
				liveApprovedAt: new Date(),
				fixtureVerifiedAt: new Date(),
			},
		});
		const called: string[] = [];
		const reader: PancakeReader = {
			readPage: async (request) => {
				called.push(request.resource);
				if (request.resource === "products")
					throw new Error("Synthetic product failure");
				return {
					success: true,
					data: [],
					page_number: request.page,
					total_pages: 0,
				};
			},
		};
		try {
			const outcome = await syncShop(db, shop, reader);
			expect(outcome.errorCode).toContain("products:");
			expect(called).toContain("orders");
			expect(called).toContain("customers");
			expect(called).toContain("returns");
		} finally {
			await db.pancakeShop.update({
				where: { id: shopA },
				data: { enabled: false, liveApprovedAt: null },
			});
			for (const [key, value] of [
				["PANCAKE_LIVE_SYNC_ENABLED", previousFlag],
				["PANCAKE_API_KEY_SAMPLE", previousKey],
				["DATABASE_URL", previousDatabase],
			] as const) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}
	});
});
