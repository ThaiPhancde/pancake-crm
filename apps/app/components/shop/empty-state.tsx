import { cn } from "@crm/ui/lib/utils";

function TrayIllustration() {
	return (
		<svg
			aria-hidden
			role="presentation"
			viewBox="0 0 64 48"
			className="h-12 w-16 text-muted-foreground/40"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M8 26l6-14h36l6 14v14H8z" strokeLinejoin="round" />
			<path d="M8 26h16l3 6h10l3-6h16" strokeLinejoin="round" />
		</svg>
	);
}

function ChartIllustration() {
	return (
		<svg
			aria-hidden
			role="presentation"
			viewBox="0 0 120 90"
			className="h-24 w-32 text-muted-foreground/35"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<rect x="10" y="20" width="58" height="48" rx="4" />
			<path d="M18 58V38M28 58V30M38 58V44M48 58V34" strokeLinecap="round" />
			<rect x="52" y="8" width="58" height="48" rx="4" fill="var(--card)" />
			<circle cx="70" cy="32" r="10" />
			<path d="M70 22v10l7 7" strokeLinecap="round" />
			<path d="M86 24h18M86 32h18M86 40h12" strokeLinecap="round" />
		</svg>
	);
}

function BoxIllustration() {
	return (
		<svg
			aria-hidden
			role="presentation"
			viewBox="0 0 120 100"
			className="h-28 w-32 text-muted-foreground/35"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M30 46l30-14 30 14v34l-30 14-30-14z" strokeLinejoin="round" />
			<path d="M30 46l30 14 30-14M60 60v34" strokeLinejoin="round" />
			<path d="M26 40l12-10 22 10M94 40l-12-10-22 10" strokeLinejoin="round" />
			<path d="M60 10v14M46 18l6 8M74 18l-6 8" strokeLinecap="round" />
		</svg>
	);
}

export function EmptyRows({
	label = "Trống",
	className,
}: {
	label?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground text-xs",
				className,
			)}
		>
			<TrayIllustration />
			<span>{label}</span>
		</div>
	);
}

export function EmptyChart({
	label = "Chưa có dữ liệu để hiển thị",
	className,
}: {
	label?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground text-xs",
				className,
			)}
		>
			<ChartIllustration />
			<span>{label}</span>
		</div>
	);
}

export function EmptyBox({
	title,
	description,
	action,
	className,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 py-16 text-center",
				className,
			)}
		>
			<BoxIllustration />
			<p className="mt-2 font-medium text-sm">{title}</p>
			{description ? (
				<p className="text-muted-foreground text-xs">{description}</p>
			) : null}
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	);
}
