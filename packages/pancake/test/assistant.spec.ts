import { expect, test } from "bun:test";
import type { Db } from "@crm/db";
import type { ShopGrant } from "../src/access";
import {
	ASSISTANT_TOOLS,
	plainReply,
	runAssistantTool,
	shopSummary,
} from "../src/assistant";

const grants: ShopGrant[] = [
	{ shopId: "1328205226", role: "MANAGER", employeeId: null },
];

test("plainReply removes markdown emphasis and headings", () => {
	expect(
		plainReply(
			"### Kết quả\nSĐT **66464112** (khách **Abu Ahmed**) có *4* đơn:\n* **#15051** – 10.900 KWD\n\n\n`ok`",
		),
	).toBe(
		"Kết quả\nSĐT 66464112 (khách Abu Ahmed) có 4 đơn:\n- #15051 – 10.900 KWD\n\nok",
	);
	expect(plainReply("2 * 3 = 6")).toBe("2 * 3 = 6");
});

test("tool definitions expose JSON schemas and reject bad arguments", async () => {
	expect(ASSISTANT_TOOLS.map((tool) => tool.function.name)).toEqual([
		"search_orders",
		"get_customer_history",
		"get_shop_summary",
	]);
	const db = {} as Db;
	expect(await runAssistantTool(db, grants, "drop_tables", "{}")).toEqual({
		error: "Không có công cụ drop_tables.",
	});
	expect(
		await runAssistantTool(db, grants, "get_customer_history", "{"),
	).toEqual({
		error: "Tham số công cụ không phải JSON.",
	});
	const invalid = await runAssistantTool(
		db,
		grants,
		"get_customer_history",
		"{}",
	);
	expect(invalid).toHaveProperty("error");
});

test("shopSummary aggregates counts and received revenue inside granted shops", async () => {
	const calls: unknown[] = [];
	const db = {
		pancakeShop: {
			findMany: async (args: unknown) => {
				calls.push(args);
				return [{ id: "1328205226", name: "KUWAIT" }];
			},
		},
		pancakeOrder: {
			groupBy: async (args: unknown) => {
				calls.push(args);
				return [
					{
						shopId: "1328205226",
						status: 3,
						currency: "KWD",
						_count: { _all: 6 },
						_sum: { totalPrice: "60.5" },
					},
					{
						shopId: "1328205226",
						status: 16,
						currency: "KWD",
						_count: { _all: 2 },
						_sum: { totalPrice: "20" },
					},
					{
						shopId: "1328205226",
						status: 5,
						currency: "KWD",
						_count: { _all: 2 },
						_sum: { totalPrice: "22" },
					},
					{
						shopId: "1328205226",
						status: 6,
						currency: "KWD",
						_count: { _all: 1 },
						_sum: { totalPrice: "11" },
					},
					{
						shopId: "1328205226",
						status: 0,
						currency: "KWD",
						_count: { _all: 4 },
						_sum: { totalPrice: "40" },
					},
				];
			},
		},
	} as unknown as Db;
	const foreign = await shopSummary(
		db,
		grants,
		{ shopId: "1635200759", days: 30 },
		new Date("2026-10-20T00:00:00Z"),
	);
	expect(foreign.since).toBe("2026-09-20");
	expect(JSON.stringify(calls[0])).toContain('"in":[]');
	expect(JSON.stringify(calls[1])).toContain('"shopId":"1328205226"');
	const own = await shopSummary(db, grants, { days: 30 });
	expect(own.shops[0]).toEqual({
		shop: "KUWAIT",
		shopId: "1328205226",
		orders: 15,
		received: 8,
		returned: 2,
		cancelled: 1,
		inProgress: 4,
		receivedRevenue: { KWD: 80.5 },
		returnRatePercent: 20,
	});
});
