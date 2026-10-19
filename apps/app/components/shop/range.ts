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

function zoneParts(instant: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(instant);
	const part = (type: string) =>
		Number(parts.find((item) => item.type === type)?.value ?? 0);
	return {
		year: part("year"),
		month: part("month"),
		day: part("day"),
		hour: part("hour"),
		minute: part("minute"),
		second: part("second"),
	};
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
	const p = zoneParts(instant, timeZone);
	const local = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	return local - Math.floor(instant.getTime() / 1000) * 1000;
}

export function zonedMidnight(date: string, timeZone: string): Date {
	const guess = new Date(`${date}T00:00:00Z`);
	const first = guess.getTime() - zoneOffsetMs(guess, timeZone);
	return new Date(guess.getTime() - zoneOffsetMs(new Date(first), timeZone));
}

export function zonedDateTime(instant: Date, timeZone: string) {
	const p = zoneParts(instant, timeZone);
	const pad = (value: number) => String(value).padStart(2, "0");
	return {
		date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
		time: `${pad(p.hour)}:${pad(p.minute)}`,
	};
}

function localDay(now: Date, timeZone: string): Date {
	return new Date(`${zonedDateTime(now, timeZone).date}T00:00:00Z`);
}

function iso(day: Date): string {
	return day.toISOString().slice(0, 10);
}

function addDays(day: Date, count: number): Date {
	return new Date(
		Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + count),
	);
}

function startOfWeek(day: Date): Date {
	const weekday = (day.getUTCDay() + 6) % 7;
	return addDays(day, -weekday);
}

function startOfMonth(day: Date): Date {
	return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

export function rangeBounds(
	range: RangeKey,
	now: Date,
	timeZone: string,
): RangeBounds {
	const today = localDay(now, timeZone);
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
