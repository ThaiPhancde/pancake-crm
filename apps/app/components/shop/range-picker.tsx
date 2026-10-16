"use client";

import Calendar from "@carbon/icons-react/es/Calendar";
import Renew from "@carbon/icons-react/es/Renew";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { cn } from "@crm/ui/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { isRangeKey, RANGES, type RangeKey, rangeBounds } from "./range";

const QUICK: RangeKey[] = ["today", "week", "month"];
const PRESETS: RangeKey[] = [
	"today",
	"yesterday",
	"last-week",
	"last-month",
	"30d",
	"week-to-date",
	"month-to-date",
];

function useRangeWriter() {
	const router = useRouter();
	const pathname = usePathname();
	const search = useSearchParams();
	return (change: { range?: string; from?: string; to?: string }) => {
		const params = new URLSearchParams(search.toString());
		params.delete("range");
		params.delete("from");
		params.delete("to");
		params.delete("page");
		if (change.range) params.set("range", change.range);
		if (change.from) params.set("from", change.from);
		if (change.to) params.set("to", change.to);
		const query = params.toString();
		router.push(query ? `${pathname}?${query}` : pathname);
	};
}

export function RangeToggle({
	quick = QUICK,
	defaultRange = "30d",
	showDefault = true,
}: {
	quick?: RangeKey[];
	defaultRange?: RangeKey;
	showDefault?: boolean;
}) {
	const search = useSearchParams();
	const write = useRangeWriter();
	const explicit = search.get("from") || search.get("to");
	const current = isRangeKey(search.get("range") ?? undefined)
		? (search.get("range") as RangeKey)
		: explicit
			? undefined
			: defaultRange;
	const keys =
		showDefault && !quick.includes(defaultRange)
			? [...quick, defaultRange]
			: quick;
	return (
		<div className="flex items-center rounded-md bg-muted p-0.5">
			{keys.map((key) => (
				<button
					key={key}
					type="button"
					onClick={() => write({ range: key })}
					className={cn(
						"h-7 rounded-sm px-2.5 text-xs transition-colors",
						current === key
							? "bg-card text-primary shadow-xs"
							: "text-foreground hover:text-primary",
					)}
				>
					{RANGES[key]}
				</button>
			))}
			<RangePopover />
		</div>
	);
}

export function RangePopover() {
	const search = useSearchParams();
	const write = useRangeWriter();
	const [from, setFrom] = useState(search.get("from") ?? "");
	const [to, setTo] = useState(search.get("to") ?? "");
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label="Chọn khoảng ngày">
					<Icon icon={Calendar} />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[420px] max-w-[92vw] p-0">
				<div className="grid grid-cols-[150px_1fr]">
					<div className="flex flex-col border-r py-2">
						{PRESETS.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => write({ range: key })}
								className="px-4 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
							>
								{RANGES[key]}
							</button>
						))}
						<button
							type="button"
							onClick={() => write({})}
							className="px-4 py-1.5 text-left text-muted-foreground text-xs hover:bg-accent"
						>
							Mặc định
						</button>
					</div>
					<form
						className="flex flex-col gap-3 p-4"
						onSubmit={(event) => {
							event.preventDefault();
							write({ from, to });
						}}
					>
						<label htmlFor="range-from" className="flex flex-col gap-1 text-xs">
							Từ ngày
							<Input
								id="range-from"
								type="date"
								value={from}
								onChange={(event) => setFrom(event.target.value)}
							/>
						</label>
						<label htmlFor="range-to" className="flex flex-col gap-1 text-xs">
							Đến ngày
							<Input
								id="range-to"
								type="date"
								value={to}
								onChange={(event) => setTo(event.target.value)}
							/>
						</label>
						<Button type="submit" size="sm" className="self-end">
							Áp dụng
						</Button>
						<p className="text-muted-foreground text-xs">
							30 ngày qua: {rangeBounds("30d").from} → {rangeBounds("30d").to}
						</p>
					</form>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function RefreshButton() {
	const router = useRouter();
	return (
		<Button
			variant="outline"
			size="icon"
			aria-label="Làm mới"
			onClick={() => router.refresh()}
		>
			<Icon icon={Renew} />
		</Button>
	);
}
