export const RANGES = {
	today: "Hôm nay",
	yesterday: "Hôm qua",
	week: "Tuần này",
	"last-week": "Tuần trước",
	month: "Tháng này",
	"last-month": "Tháng trước",
	"30d": "30 ngày qua",
	"week-to-date": "Đầu tuần đến nay",
	"month-to-date": "Đầu tháng đến nay",
} as const;

export type RangeKey = keyof typeof RANGES;

export type RangeBounds = { from: string; to: string };

export function isRangeKey(value: string | undefined): value is RangeKey {
	return value !== undefined && value in RANGES;
}

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

function vnDay(now: Date): Date {
	const shifted = new Date(now.getTime() + VN_OFFSET_MS);
	return new Date(
		Date.UTC(
			shifted.getUTCFullYear(),
			shifted.getUTCMonth(),
			shifted.getUTCDate(),
		),
	);
}

function iso(day: Date): string {
	return day.toISOString().slice(0, 10);
}

function addDays(day: Date, count: number): Date {
	return new Date(day.getTime() + count * DAY_MS);
}

function startOfWeek(day: Date): Date {
	const weekday = (day.getUTCDay() + 6) % 7;
	return addDays(day, -weekday);
}

function startOfMonth(day: Date): Date {
	return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

export function rangeBounds(range: RangeKey, now = new Date()): RangeBounds {
	const today = vnDay(now);
	switch (range) {
		case "today":
			return { from: iso(today), to: iso(today) };
		case "yesterday": {
			const day = addDays(today, -1);
			return { from: iso(day), to: iso(day) };
		}
		case "week":
			return {
				from: iso(startOfWeek(today)),
				to: iso(addDays(startOfWeek(today), 6)),
			};
		case "week-to-date":
			return { from: iso(startOfWeek(today)), to: iso(today) };
		case "last-week": {
			const start = addDays(startOfWeek(today), -7);
			return { from: iso(start), to: iso(addDays(start, 6)) };
		}
		case "month": {
			const start = startOfMonth(today);
			const end = addDays(startOfMonth(addDays(start, 35)), -1);
			return { from: iso(start), to: iso(end) };
		}
		case "month-to-date":
			return { from: iso(startOfMonth(today)), to: iso(today) };
		case "last-month": {
			const end = addDays(startOfMonth(today), -1);
			return { from: iso(startOfMonth(end)), to: iso(end) };
		}
		case "30d":
			return { from: iso(addDays(today, -29)), to: iso(today) };
	}
}

export function formatRange(from: string, to: string): string {
	const show = (value: string) => value.split("-").reverse().join("/");
	return `${show(from)} - ${show(to)}`;
}
