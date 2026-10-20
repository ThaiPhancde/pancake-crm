import { describe, expect, test } from "bun:test";
import { contactPeriodBounds } from "../src/queries";
import { storePage } from "../src/sync";

describe("contactPeriodBounds", () => {
	test("Riyadh midweek: day, Monday and first of month in local time", () => {
		const bounds = contactPeriodBounds(
			new Date("2026-10-20T01:30:00Z"),
			"Asia/Riyadh",
		);
		expect(bounds.day.toISOString()).toBe("2026-10-19T21:00:00.000Z");
		expect(bounds.week.toISOString()).toBe("2026-10-18T21:00:00.000Z");
		expect(bounds.month.toISOString()).toBe("2026-09-30T21:00:00.000Z");
	});

	test("a Sunday belongs to the week that started the previous Monday", () => {
		const bounds = contactPeriodBounds(
			new Date("2026-10-18T10:00:00Z"),
			"Asia/Riyadh",
		);
		expect(bounds.day.toISOString()).toBe("2026-10-17T21:00:00.000Z");
		expect(bounds.week.toISOString()).toBe("2026-10-11T21:00:00.000Z");
		expect(bounds.month.toISOString()).toBe("2026-09-30T21:00:00.000Z");
	});

	test("the local day rolls over before UTC does in Ho Chi Minh", () => {
		const bounds = contactPeriodBounds(
			new Date("2026-10-19T20:00:00Z"),
			"Asia/Ho_Chi_Minh",
		);
		expect(bounds.day.toISOString()).toBe("2026-10-19T17:00:00.000Z");
		expect(bounds.week.toISOString()).toBe("2026-10-18T17:00:00.000Z");
		expect(bounds.month.toISOString()).toBe("2026-09-30T17:00:00.000Z");
	});

	test("the periods nest: day is within week, week within month or equal", () => {
		const bounds = contactPeriodBounds(
			new Date("2026-10-20T01:30:00Z"),
			"Asia/Kuwait",
		);
		expect(bounds.day.getTime()).toBeGreaterThanOrEqual(bounds.week.getTime());
		expect(bounds.week.getTime()).toBeGreaterThanOrEqual(
			bounds.month.getTime() - 7 * 86_400_000,
		);
	});
});

describe("customer creation time is stored on sync", () => {
	type Upsert = {
		create: { sourceCreatedAt: Date | null };
		update: { sourceCreatedAt: Date | null };
	};

	function fakeTx(captured: Upsert[]) {
		return {
			$queryRaw: async () => [],
			pancakeCustomer: {
				findUnique: async () => null,
				upsert: async (args: Upsert) => {
					captured.push(args);
					return {};
				},
			},
		};
	}

	test("inserted_at without a zone is read as UTC", async () => {
		const captured: Upsert[] = [];
		await storePage(
			fakeTx(captured) as never,
			"shop-1",
			"customers",
			[{ id: "c1", name: "A", inserted_at: "2026-10-19T08:00:00" }],
			new Date(),
		);
		expect(captured[0]?.create.sourceCreatedAt?.toISOString()).toBe(
			"2026-10-19T08:00:00.000Z",
		);
		expect(captured[0]?.update.sourceCreatedAt?.toISOString()).toBe(
			"2026-10-19T08:00:00.000Z",
		);
	});

	test("a zone in inserted_at is respected", async () => {
		const captured: Upsert[] = [];
		await storePage(
			fakeTx(captured) as never,
			"shop-1",
			"customers",
			[{ id: "c1", name: "A", inserted_at: "2026-10-19T11:00:00+03:00" }],
			new Date(),
		);
		expect(captured[0]?.create.sourceCreatedAt?.toISOString()).toBe(
			"2026-10-19T08:00:00.000Z",
		);
	});

	test("a customer without inserted_at keeps a null creation time", async () => {
		const captured: Upsert[] = [];
		await storePage(
			fakeTx(captured) as never,
			"shop-1",
			"customers",
			[{ id: "c2", name: "B" }],
			new Date(),
		);
		expect(captured[0]?.create.sourceCreatedAt).toBeNull();
	});
});
