import { describe, expect, test } from "bun:test";
import { defaultMatrix } from "../src/admin";
import { PANCAKE } from "../src/config";
import {
	parseAutomationRule,
	parsePermissionMatrix,
	parseSavedFilterParams,
} from "../src/contracts";
import { csvCell, csvFile, toCsv } from "../src/csv";
import {
	ageBucket,
	ageLabels,
	genderBucket,
	taskSeries,
} from "../src/insights";
import {
	assignmentDrafts,
	automationSupported,
	matchesAutomation,
	type RecordEvent,
	reminderDrafts,
} from "../src/notifications";
import { bucketStart, groupSeries } from "../src/queries";
import { settingsFields } from "../src/settings";

describe("csv", () => {
	test("escapes per RFC 4180", () => {
		expect(csvCell("plain")).toBe("plain");
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell("a,b")).toBe('"a,b"');
		expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
		expect(csvCell(null)).toBe("");
		expect(csvCell(12.5)).toBe("12.5");
		expect(csvCell("+971553409828")).toBe("+971553409828");
		expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
		expect(csvCell("-1500")).toBe("-1500");
		expect(csvCell("+84 (912) 345")).toBe("+84 (912) 345");
		expect(csvCell("-2+3")).toBe("'-2+3");
		expect(csvCell("+HYPERLINK(1)")).toBe("'+HYPERLINK(1)");
	});
	test("starts with a BOM and uses CRLF", () => {
		expect(toCsv(["A", "B"], [["1", "x,y"]])).toBe('﻿A,B\r\n1,"x,y"\r\n');
	});
	test("caps rows and reports truncation", () => {
		const rows = Array.from({ length: PANCAKE.exportMaxRows + 1 }, (_, i) => [
			i,
		]);
		const file = csvFile("x", ["n"], rows);
		expect(file.rows).toBe(PANCAKE.exportMaxRows);
		expect(file.truncated).toBe(true);
		expect(file.filename).toBe("x.csv");
	});
});

describe("json columns", () => {
	test("automation rules parse per action", () => {
		expect(
			parseAutomationRule("assign_to", { assigneeId: "e1" }).config,
		).toEqual({ assigneeId: "e1" });
		expect(() => parseAutomationRule("assign_to", {})).toThrow();
		expect(() =>
			parseAutomationRule("json_api", { url: "http://insecure.test" }),
		).toThrow();
		expect(() => parseAutomationRule("unknown", {})).toThrow();
	});
	test("permission matrix rejects unknown entities and defaults are valid", () => {
		const matrix = defaultMatrix(["view"], ["settings"]);
		expect(parsePermissionMatrix(matrix).lead?.view).toBe(true);
		expect(parsePermissionMatrix(matrix).settings?.view).toBe(false);
		expect(() =>
			parsePermissionMatrix({
				robot: {
					configure: true,
					view: true,
					edit: true,
					delete: true,
					create: true,
					export: true,
				},
			}),
		).toThrow();
	});
	test("saved filter params are string maps", () => {
		expect(parseSavedFilterParams({ status: "new,done" })).toEqual({
			status: "new,done",
		});
		expect(() => parseSavedFilterParams({ page: 2 })).toThrow();
	});
	test("settings validate time zone and currency", () => {
		const base = {
			displayName: null,
			currency: "AED",
			timezone: "Asia/Dubai",
			countries: ["AE"],
			dialCode: "971",
			showSamePhoneOnConversation: false,
			mergeOrdersByPhone: false,
			customerSources: [],
		};
		expect(settingsFields.safeParse(base).success).toBe(true);
		expect(
			settingsFields.safeParse({ ...base, timezone: "Mars/Base" }).success,
		).toBe(false);
		expect(settingsFields.safeParse({ ...base, currency: "aed" }).success).toBe(
			false,
		);
	});
});

describe("automations", () => {
	const event: RecordEvent = {
		shopId: "s",
		entity: "lead",
		trigger: "record_created",
		id: "l1",
		title: "Lead",
		link: "leads?leadId=l1",
		assigneeEmployeeId: "e1",
		assignedNow: true,
	};
	test("select by trigger, entity, enabled and archive", () => {
		const base = {
			trigger: "record_created",
			entity: "lead",
			enabled: true,
			archivedAt: null,
		};
		expect(matchesAutomation(base, event)).toBe(true);
		expect(matchesAutomation({ ...base, enabled: false }, event)).toBe(false);
		expect(matchesAutomation({ ...base, archivedAt: new Date() }, event)).toBe(
			false,
		);
		expect(matchesAutomation({ ...base, entity: "ticket" }, event)).toBe(false);
		expect(
			matchesAutomation({ ...base, trigger: "record_updated" }, event),
		).toBe(false);
	});
	test("only internal actions run", () => {
		expect(automationSupported("notify_assignee")).toBe(true);
		expect(automationSupported("assign_to")).toBe(true);
		expect(automationSupported("send_email")).toBe(false);
		expect(automationSupported("json_api")).toBe(false);
	});
	test("self assignment does not notify", () => {
		expect(assignmentDrafts(event, ["u1", "u2"], "u1")).toHaveLength(1);
		expect(assignmentDrafts(event, ["u1"], "u1")).toHaveLength(0);
	});
});

describe("reminders", () => {
	const now = new Date("2026-10-19T10:00:00Z");
	test("pick due records with stable keys", () => {
		const drafts = reminderDrafts(
			now,
			{
				appointments: [
					{
						id: "a1",
						title: "Soon",
						startAt: new Date("2026-10-19T10:30:00Z"),
						status: "scheduled",
					},
					{
						id: "a2",
						title: "Later",
						startAt: new Date(now.getTime() + PANCAKE.reminderWindowMs + 1),
						status: "scheduled",
					},
					{
						id: "a3",
						title: "Cancelled",
						startAt: new Date("2026-10-19T10:30:00Z"),
						status: "cancelled",
					},
				],
				tickets: [
					{
						id: "t1",
						title: "Late",
						dueAt: new Date("2026-10-18T10:00:00Z"),
						status: "new",
					},
					{
						id: "t2",
						title: "Done",
						dueAt: new Date("2026-10-18T10:00:00Z"),
						status: "done",
					},
					{ id: "t3", title: "No due", dueAt: null, status: "new" },
				],
				tasks: [
					{
						id: "k1",
						title: "Call",
						dueAt: new Date("2026-10-19T09:00:00Z"),
						orderId: "o1",
					},
					{
						id: "k2",
						title: "Future",
						dueAt: new Date("2026-10-20T09:00:00Z"),
						orderId: "o1",
					},
				],
			},
			"Asia/Dubai",
		);
		expect(drafts.map((draft) => draft.dedupeKey)).toEqual([
			`appointment:a1:${Date.parse("2026-10-19T10:30:00Z")}`,
			`ticket:t1:${Date.parse("2026-10-18T10:00:00Z")}`,
			`task:k1:${Date.parse("2026-10-19T09:00:00Z")}`,
		]);
		expect(drafts[2]?.link).toBe("orders?orderId=o1");
	});
});

describe("reports", () => {
	const now = new Date("2026-10-19T10:00:00Z");
	test("gender buckets", () => {
		expect(genderBucket("Male")).toBe("male");
		expect(genderBucket("nữ")).toBe("female");
		expect(genderBucket("x")).toBe("other");
		expect(genderBucket(null)).toBe("unknown");
	});
	test("age buckets", () => {
		expect(ageLabels()).toEqual([
			"<18",
			"18-24",
			"25-34",
			"35-44",
			"45-54",
			"55+",
			"unknown",
		]);
		expect(ageBucket("2010-01-01", now)).toBe("<18");
		expect(ageBucket("2001-10-20", now)).toBe("18-24");
		expect(ageBucket("2001-10-19", now)).toBe("25-34");
		expect(ageBucket("1950-05-05", now)).toBe("55+");
		expect(ageBucket("not a date", now)).toBe("unknown");
		expect(ageBucket(null, now)).toBe("unknown");
	});
	test("series grouping by week and month", () => {
		expect(bucketStart("2026-10-18", "week")).toBe("2026-10-12");
		expect(bucketStart("2026-10-19", "week")).toBe("2026-10-19");
		expect(bucketStart("2026-10-19", "month")).toBe("2026-10-01");
		const days = [
			{ date: "2026-09-30", n: 1 },
			{ date: "2026-10-01", n: 2 },
			{ date: "2026-10-02", n: 3 },
		];
		expect(
			groupSeries(days, "month", (a, b) => ({ date: a.date, n: a.n + b.n })),
		).toEqual([
			{ date: "2026-09-01", n: 1 },
			{ date: "2026-10-01", n: 5 },
		]);
	});
	test("task series counts created, done and overdue", () => {
		const result = taskSeries(
			[
				{
					createdAt: new Date("2026-10-18T08:00:00Z"),
					completedAt: new Date("2026-10-19T08:00:00Z"),
					dueAt: new Date("2026-10-19T09:00:00Z"),
					status: "DONE",
				},
				{
					createdAt: new Date("2026-10-18T09:00:00Z"),
					completedAt: null,
					dueAt: new Date("2026-10-18T12:00:00Z"),
					status: "OPEN",
				},
			],
			{ from: "2026-10-18T00:00:00Z", to: "2026-10-20T00:00:00Z" },
			now,
			"UTC",
		);
		expect(result.created).toBe(2);
		expect(result.done).toBe(1);
		expect(result.overdue).toBe(1);
		expect(result.days.map((day) => day.date)).toEqual([
			"2026-10-18",
			"2026-10-19",
		]);
	});
});
