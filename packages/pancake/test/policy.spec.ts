import { describe, expect, test } from "bun:test";
import { orderScope, PancakeAccessError } from "../src/access";
import { assertCrmDatabase } from "../src/config";
import {
	employeeWire,
	isNewer,
	orderWire,
	roleInput,
	sourceDate,
} from "../src/contracts";
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
