import { describe, expect, test } from "bun:test";
import { rangeBounds } from "./range";

const now = new Date("2026-10-15T04:30:00Z");

describe("rangeBounds", () => {
	test("today uses the Vietnam calendar day", () => {
		expect(rangeBounds("today", now)).toEqual({
			from: "2026-10-15",
			to: "2026-10-15",
		});
	});
	test("week starts on Monday", () => {
		expect(rangeBounds("week", now)).toEqual({
			from: "2026-10-12",
			to: "2026-10-18",
		});
	});
	test("last month covers the whole previous month", () => {
		expect(rangeBounds("last-month", now)).toEqual({
			from: "2026-09-01",
			to: "2026-09-30",
		});
	});
	test("30d counts back 29 days", () => {
		expect(rangeBounds("30d", now)).toEqual({
			from: "2026-09-16",
			to: "2026-10-15",
		});
	});
	test("late evening UTC still lands on the next Vietnam day", () => {
		expect(rangeBounds("today", new Date("2026-10-15T20:00:00Z")).from).toBe(
			"2026-10-16",
		);
	});
});
