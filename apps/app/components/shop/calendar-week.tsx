import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";

const DAY_MS = 86_400_000;
const HOURS = Array.from({ length: 16 }, (_, index) => index + 7);
const WEEKDAYS = [
	"Thứ Hai",
	"Thứ Ba",
	"Thứ Tư",
	"Thứ Năm",
	"Thứ Sáu",
	"Thứ Bảy",
	"Chủ Nhật",
];
const SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export type CalendarEvent = {
	id: string;
	title: string;
	date: string;
	start: string;
	end: string;
};

function parse(date: string): Date {
	return new Date(`${date}T00:00:00Z`);
}

function iso(day: Date): string {
	return day.toISOString().slice(0, 10);
}

function addDays(day: Date, count: number): Date {
	return new Date(day.getTime() + count * DAY_MS);
}

function mondayOf(day: Date): Date {
	return addDays(day, -((day.getUTCDay() + 6) % 7));
}

function dayLabel(day: Date): string {
	return `${String(day.getUTCDate()).padStart(2, "0")}/${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function weekTitle(date: string): string {
	const day = parse(date);
	const monday = mondayOf(day);
	const week = Math.ceil((monday.getUTCDate() + 6) / 7);
	return `Tuần ${week} tháng ${monday.getUTCMonth() + 1}, ${monday.getUTCFullYear()}`;
}

export function CalendarNav({
	date,
	mode,
	today,
	href,
}: {
	date: string;
	mode: "day" | "week" | "month";
	today: string;
	href: (change: { date?: string; mode?: string }) => string;
}) {
	const day = parse(date);
	const step = mode === "day" ? 1 : mode === "week" ? 7 : 30;
	const title =
		mode === "week"
			? weekTitle(date)
			: mode === "day"
				? `${WEEKDAYS[(day.getUTCDay() + 6) % 7]}, ${dayLabel(day)}/${day.getUTCFullYear()}`
				: `Tháng ${day.getUTCMonth() + 1}, ${day.getUTCFullYear()}`;
	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center rounded-md bg-muted p-0.5">
				{(["day", "week", "month"] as const).map((item) => (
					<Link
						key={item}
						href={href({ mode: item, date: today })}
						className={cn(
							"h-7 rounded-sm px-3 text-xs leading-7",
							mode === item
								? "bg-card text-primary shadow-xs"
								: "hover:text-primary",
						)}
					>
						{item === "day" ? "Ngày" : item === "week" ? "Tuần" : "Tháng"}
					</Link>
				))}
			</div>
			<Button asChild variant="ghost" size="icon-sm" aria-label="Trước">
				<Link href={href({ date: iso(addDays(day, -step)) })}>
					<Icon icon={ChevronLeft} />
				</Link>
			</Button>
			<span className="min-w-44 text-center text-sm">{title}</span>
			<Button asChild variant="ghost" size="icon-sm" aria-label="Sau">
				<Link href={href({ date: iso(addDays(day, step)) })}>
					<Icon icon={ChevronRight} />
				</Link>
			</Button>
		</div>
	);
}

export function CalendarGrid({
	date,
	mode,
	today,
	events = [],
	compact = false,
}: {
	date: string;
	mode: "day" | "week" | "month";
	today: string;
	events?: CalendarEvent[];
	compact?: boolean;
}) {
	const day = parse(date);
	if (mode === "month")
		return <MonthGrid day={day} today={today} events={events} />;
	const days =
		mode === "day"
			? [day]
			: Array.from({ length: 7 }, (_, index) => addDays(mondayOf(day), index));
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md border">
			<div
				className="sticky top-0 z-10 grid border-b bg-card"
				style={{
					gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
				}}
			>
				<div />
				{days.map((item) => {
					const active = iso(item) === today;
					return (
						<div
							key={iso(item)}
							className={cn(
								"border-l py-2 text-center",
								active && "border-b-2 border-b-primary",
							)}
						>
							<div
								className={cn(
									"font-semibold text-sm",
									active && "text-primary",
								)}
							>
								{compact ? item.getUTCDate() : dayLabel(item)}
							</div>
							<div
								className={cn(
									"text-muted-foreground text-xs",
									active && "text-primary",
								)}
							>
								{compact
									? SHORT[(item.getUTCDay() + 6) % 7]
									: WEEKDAYS[(item.getUTCDay() + 6) % 7]}
							</div>
						</div>
					);
				})}
			</div>
			{HOURS.map((hour) => (
				<div
					key={hour}
					className="grid"
					style={{
						gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
					}}
				>
					<div className="-mt-2 h-12 pr-2 text-right text-muted-foreground text-xs">
						{String(hour).padStart(2, "0")}:00
					</div>
					{days.map((item) => (
						<div
							key={`${iso(item)}-${hour}`}
							className="relative h-12 border-t border-l"
						>
							{events
								.filter(
									(event) =>
										event.date === iso(item) &&
										Number(event.start.slice(0, 2)) === hour,
								)
								.map((event) => (
									<div
										key={event.id}
										className="absolute inset-x-1 top-0.5 rounded-sm bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground"
									>
										{event.start} {event.title}
									</div>
								))}
						</div>
					))}
				</div>
			))}
		</div>
	);
}

function MonthGrid({
	day,
	today,
	events,
}: {
	day: Date;
	today: string;
	events: CalendarEvent[];
}) {
	const first = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
	const start = mondayOf(first);
	const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
	return (
		<div className="grid grid-cols-7 overflow-hidden rounded-md border">
			{SHORT.map((label) => (
				<div
					key={label}
					className="border-b bg-muted py-1.5 text-center text-xs"
				>
					{label}
				</div>
			))}
			{cells.map((cell) => {
				const key = iso(cell);
				const inMonth = cell.getUTCMonth() === first.getUTCMonth();
				return (
					<div
						key={key}
						className={cn(
							"min-h-20 border-t border-l p-1.5 text-xs",
							!inMonth && "bg-muted/40 text-muted-foreground",
						)}
					>
						<span
							className={cn(
								"inline-flex size-6 items-center justify-center rounded-full",
								key === today && "bg-primary text-primary-foreground",
							)}
						>
							{cell.getUTCDate()}
						</span>
						{events
							.filter((event) => event.date === key)
							.map((event) => (
								<div
									key={event.id}
									className="mt-1 truncate rounded-sm bg-accent px-1 text-accent-foreground"
								>
									{event.title}
								</div>
							))}
					</div>
				);
			})}
		</div>
	);
}

export function todayIso(): string {
	return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}
