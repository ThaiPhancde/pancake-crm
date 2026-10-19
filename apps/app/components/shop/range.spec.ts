import { describe, expect, test } from "bun:test";
import { PANCAKE } from "@crm/pancake/config";
import { rangeBounds, zonedMidnight } from "./range";

const now = new Date("2026-10-15T04:30:00Z");

describe("rangeBounds", () => {
	test("today uses the Vietnam calendar day", () => {
		expect(rangeBounds("today", now, PANCAKE.timezone)).toEqual({
			from: "2026-10-15",
			to: "2026-10-15",
		});
	});
	test("week starts on Monday", () => {
		expect(rangeBounds("week", now, PANCAKE.timezone)).toEqual({
			from: "2026-10-12",
			to: "2026-10-18",
		});
	});
	test("last month covers the whole previous month", () => {
		expect(rangeBounds("last-month", now, PANCAKE.timezone)).toEqual({
			from: "2026-09-01",
			to: "2026-09-30",
		});
	});
	test("30d counts back 29 days", () => {
		expect(rangeBounds("30d", now, PANCAKE.timezone)).toEqual({
			from: "2026-09-16",
			to: "2026-10-15",
		});
	});
	test("today follows the shop time zone", () => {
		const late = new Date("2026-10-15T20:30:00Z");
		expect(rangeBounds("today", late, "Asia/Dubai").from).toBe("2026-10-16");
		expect(rangeBounds("today", late, "Asia/Riyadh").from).toBe("2026-10-15");
	});
	test("zonedMidnight returns the local midnight instant", () => {
		expect(zonedMidnight("2026-10-15", "Asia/Riyadh").toISOString()).toBe(
			"2026-10-14T21:00:00.000Z",
		);
	});
	test("late evening UTC still lands on the next Vietnam day", () => {
		expect(
			rangeBounds("today", new Date("2026-10-15T20:00:00Z"), PANCAKE.timezone)
				.from,
		).toBe("2026-10-16");
	});
});
