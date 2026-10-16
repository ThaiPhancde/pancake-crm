import Filter from "@carbon/icons-react/es/Filter";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { EmptyChart } from "./empty-state";
import { RangeToggle, RefreshButton } from "./range-picker";

export function ReportPage({
	title,
	children,
	actions,
}: {
	title: string;
	children: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex min-h-full flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-5 py-3">
				<h1 className="text-lg font-semibold tracking-tight">{title}</h1>
				<div className="flex flex-wrap items-center gap-2">
					<RefreshButton />
					<RangeToggle defaultRange="week" showDefault={false} />
					<Button variant="outline">
						<Icon icon={Filter} data-icon="inline-start" />
						Bộ lọc
					</Button>
					{actions}
				</div>
			</div>
			{children}
		</div>
	);
}

export function ReportCard({
	title,
	description,
	action,
	children,
	className,
}: {
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn("flex flex-col gap-4 rounded-lg bg-card p-5", className)}
		>
			{title || action ? (
				<div className="flex items-start justify-between gap-3">
					<div>
						{title ? <h2 className="font-semibold text-sm">{title}</h2> : null}
						{description ? (
							<p className="text-muted-foreground text-xs">{description}</p>
						) : null}
					</div>
					{action}
				</div>
			) : null}
			{children}
		</section>
	);
}

export type Metric = { label: string; value: React.ReactNode };

export function MetricRow({
	metrics,
	columns,
}: {
	metrics: Metric[];
	columns?: number;
}) {
	return (
		<div
			className="grid gap-4"
			style={{
				gridTemplateColumns: `repeat(${columns ?? metrics.length}, minmax(0, 1fr))`,
			}}
		>
			{metrics.map((metric) => (
				<div key={metric.label} className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">{metric.label}</span>
					<span className="font-semibold text-base tabular-nums">
						{metric.value}
					</span>
				</div>
			))}
		</div>
	);
}

export function ReportEmpty({ label }: { label?: string }) {
	return <EmptyChart label={label} className="py-10" />;
}

export function Breakdown({
	rows,
	columns = ["Tỷ lệ", "Số lượng"],
	title,
}: {
	rows: { label: string; color?: string; count: number; share: string }[];
	columns?: [string, string];
	title?: string;
}) {
	const total = rows.reduce((sum, row) => sum + row.count, 0);
	return (
		<div className="flex flex-col gap-3">
			<div className="flex h-2 overflow-hidden rounded-full bg-muted">
				{rows.map((row) =>
					row.count ? (
						<div
							key={row.label}
							style={{
								width: `${(row.count / total) * 100}%`,
								background: row.color ?? "var(--primary)",
							}}
						/>
					) : null,
				)}
			</div>
			<table className="w-full text-xs">
				<thead className="text-muted-foreground">
					<tr>
						<th className="py-1 text-left font-normal">{title ?? ""}</th>
						<th className="py-1 text-right font-normal">{columns[0]}</th>
						<th className="py-1 text-right font-normal">{columns[1]}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.label}>
							<td className="flex items-center gap-2 py-1.5">
								<span
									className="size-2 rounded-full"
									style={{ background: row.color ?? "var(--muted-foreground)" }}
								/>
								{row.label}
							</td>
							<td className="py-1.5 text-right tabular-nums">{row.share}</td>
							<td className="py-1.5 text-right tabular-nums">{row.count}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function HorizontalBars({
	items,
}: {
	items: { label: string; value: number; display: string }[];
}) {
	if (items.length === 0) {
		return <EmptyChart />;
	}
	const max = Math.max(1, ...items.map((i) => i.value));
	return (
		<div className="flex flex-col gap-3">
			{items.map((item) => (
				<div key={item.label} className="space-y-1 text-xs">
					<div className="flex items-center justify-between gap-2">
						<span className="truncate font-medium">{item.label}</span>
						<span className="shrink-0 text-muted-foreground tabular-nums">
							{item.display}
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary"
							style={{
								width: `${Math.max(4, Math.round((100 * item.value) / max))}%`,
							}}
						/>
					</div>
				</div>
			))}
		</div>
	);
}
