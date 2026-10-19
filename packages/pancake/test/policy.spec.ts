import { describe, expect, test } from "bun:test";
import { canWrite, orderScope, PancakeAccessError } from "../src/access";
import { assertCrmDatabase, PANCAKE, shopTimezone } from "../src/config";
import {
	employeeWire,
	isNewer,
	orderWire,
	roleInput,
	sourceDate,
} from "../src/contracts";
import { fillDays, splitList, zonedDay, zonedMidnight } from "../src/queries";
import { assertLiveAllowed } from "../src/sync";
import { webhookTokenValid } from "../src/webhook";
import { sampleOrder } from "./fixtures";

describe("data safety", () => {
	test("source variants retain staff identity and custom order lines", () => {
		expect(
			employeeWire.parse({ user_id: "sample-staff", user: { name: "Sample" } })
				.user_id,
		).toBe("sample-staff");
		expect(employeeWire.safeParse({ user: { name: "Sample" } }).success).toBe(
			false,
		);
		const order = orderWire.parse({
			...sampleOrder("1"),
			partner: { partner_id: "sample-carrier" },
			items: [{ product_id: null, variation_id: null, quantity: 1 }],
		});
		expect(order.partner?.partner_id).toBe("sample-carrier");
		expect(order.items[0]?.variation_id).toBeNull();
	});
	const latest = new Date("2026-10-14T02:00:00Z");
	test("old and equal source versions never overwrite current data", () => {
		const current = { sourceUpdatedAt: latest, fetchedAt: latest };
		expect(isNewer(current, new Date("2026-10-13T00:00:00Z"), new Date())).toBe(
			false,
		);
		expect(isNewer(current, latest, new Date())).toBe(false);
		expect(isNewer(current, new Date("2026-10-15T00:00:00Z"), latest)).toBe(
			true,
		);
	});
	test("untimestamped snapshots cannot overwrite timestamped records", () =>
		expect(
			isNewer({ sourceUpdatedAt: latest, fetchedAt: latest }, null, new Date()),
		).toBe(false));
	test("untimestamped records use fetch start time", () => {
		expect(
			isNewer(
				{ sourceUpdatedAt: null, fetchedAt: latest },
				null,
				new Date("2026-10-13T00:00:00Z"),
			),
		).toBe(false);
		expect(
			isNewer(
				{ sourceUpdatedAt: null, fetchedAt: latest },
				null,
				new Date("2026-10-15T00:00:00Z"),
			),
		).toBe(true);
	});
	test("naive source timestamps use UTC independent of Windows timezone", () =>
		expect(sourceDate("2026-10-14T02:00:00").toISOString()).toBe(
			"2026-10-14T02:00:00.000Z",
		));
	test("ToolSpy and unnamed databases are refused", () => {
		expect(() =>
			assertCrmDatabase("postgresql://user@localhost/toolspy"),
		).toThrow();
		expect(() =>
			assertCrmDatabase("postgresql://user@localhost/postgres"),
		).toThrow();
		expect(() =>
			assertCrmDatabase("postgresql://user@localhost/comp_ai_crm"),
		).not.toThrow();
	});
	test("live sync remains locked without all four approvals", () => {
		const old = process.env.PANCAKE_LIVE_SYNC_ENABLED;
		process.env.PANCAKE_LIVE_SYNC_ENABLED = "0";
		expect(() =>
			assertLiveAllowed({
				enabled: true,
				fixtureVerifiedAt: latest,
				liveApprovedAt: latest,
			}),
		).toThrow("LIVE_SYNC_LOCKED");
		process.env.PANCAKE_LIVE_SYNC_ENABLED = "1";
		expect(() =>
			assertLiveAllowed({
				enabled: true,
				fixtureVerifiedAt: null,
				liveApprovedAt: latest,
			}),
		).toThrow();
		expect(() =>
			assertLiveAllowed({
				enabled: true,
				fixtureVerifiedAt: latest,
				liveApprovedAt: null,
			}),
		).toThrow();
		expect(() =>
			assertLiveAllowed({
				enabled: false,
				fixtureVerifiedAt: latest,
				liveApprovedAt: latest,
			}),
		).toThrow();
		expect(() =>
			assertLiveAllowed({
				enabled: true,
				fixtureVerifiedAt: latest,
				liveApprovedAt: latest,
			}),
		).not.toThrow();
		if (old === undefined) delete process.env.PANCAKE_LIVE_SYNC_ENABLED;
		else process.env.PANCAKE_LIVE_SYNC_ENABLED = old;
	});
	test("unassigned telesale mappings fail closed", () => {
		expect(
			roleInput.safeParse({ shopId: "1", userId: "u", role: "TELESALE" })
				.success,
		).toBe(false);
		expect(
			orderScope([{ shopId: "1", role: "TELESALE", employeeId: null }]),
		).toEqual({ OR: [{ shopId: "1", sellerId: "__unmapped__" }] });
	});
	test("shop filters cannot broaden granted permissions", () =>
		expect(() =>
			orderScope([{ shopId: "1", role: "VIEWER", employeeId: null }], "2"),
		).toThrow(PancakeAccessError));
	test("webhook token uses a separate secret and refuses short or missing tokens", () => {
		const token = "sample-webhook-token-that-is-32-characters";
		expect(webhookTokenValid(token, token)).toBe(true);
		expect(webhookTokenValid(token, "wrong")).toBe(false);
		expect(webhookTokenValid(undefined, token)).toBe(false);
		expect(webhookTokenValid("short", "short")).toBe(false);
	});
});

describe("reporting rules", () => {
	test("viewers cannot write and other roles can", () => {
		expect(
			canWrite([{ shopId: "1", role: "VIEWER", employeeId: null }], "1"),
		).toBe(false);
		expect(
			canWrite([{ shopId: "1", role: "TELESALE", employeeId: "e" }], "1"),
		).toBe(true);
		expect(
			canWrite([{ shopId: "1", role: "MANAGER", employeeId: null }], "2"),
		).toBe(false);
	});
	test("booked sales exclude cancelled, deleted and returned orders", () => {
		expect([...PANCAKE.bookedExcludedStatuses].sort((a, b) => a - b)).toEqual([
			4, 5, 6, 7, 15,
		]);
		expect(PANCAKE.receivedStatuses).toEqual([3, 16]);
	});
	test("multi-value filters split commas and drop the any value", () =>
		expect(splitList("a, b,,all,a,none")).toEqual(["a", "b", "none"]));
	test("days are bucketed in the shop time zone", () => {
		expect(shopTimezone("1635200759")).toBe("Asia/Dubai");
		expect(shopTimezone("unknown")).toBe(PANCAKE.timezone);
		expect(zonedDay(new Date("2026-10-18T21:30:00Z"), "Asia/Dubai")).toBe(
			"2026-10-19",
		);
		expect(zonedMidnight("2026-10-19", "Asia/Riyadh").toISOString()).toBe(
			"2026-10-18T21:00:00.000Z",
		);
	});
	test("every day in the range gets a bucket, ending today", () => {
		const days = fillDays(
			new Map([["2026-10-17", { date: "2026-10-17", orders: 2 }]]),
			{ from: "2026-10-16T00:00:00+04:00", to: "2026-10-30T00:00:00+04:00" },
			new Date("2026-10-19T10:00:00Z"),
			"Asia/Dubai",
			(date) => ({ date, orders: 0 }),
		);
		expect(days.map((day) => [day.date, day.orders])).toEqual([
			["2026-10-16", 0],
			["2026-10-17", 2],
			["2026-10-18", 0],
			["2026-10-19", 0],
		]);
	});
});
