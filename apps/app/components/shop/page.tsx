import { cn } from "@crm/ui/lib/utils";

export function ShopPage({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex min-h-full min-w-0 flex-col rounded-lg bg-card shadow-xs",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function ShopPageHeader({
	title,
	description,
	actions,
	className,
}: {
	title: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3",
				className,
			)}
		>
			<div className="flex min-w-0 flex-col gap-0.5">
				<h1 className="text-lg font-semibold tracking-tight">{title}</h1>
				{description ? (
					<p className="text-muted-foreground text-xs">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			) : null}
		</div>
	);
}

export function ShopPageBody({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("flex min-h-0 flex-1 flex-col gap-4 p-5", className)}>
			{children}
		</div>
	);
}

export function ShopPageFooter({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-3 border-t px-5 py-2 text-muted-foreground text-xs",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function Breadcrumb({
	root,
	current,
}: {
	root: string;
	current: string;
}) {
	return (
		<nav aria-label="Breadcrumb" className="px-5 py-3 text-sm">
			<span className="text-primary">{root}</span>
			<span className="mx-1.5 text-muted-foreground">›</span>
			<span className="font-medium">{current}</span>
		</nav>
	);
}

export function SettingsCard({
	title,
	children,
	className,
}: {
	title?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn("flex flex-col gap-3 rounded-lg bg-card p-5", className)}
		>
			{title ? <h2 className="font-semibold text-sm">{title}</h2> : null}
			{children}
		</section>
	);
}

export function SettingsRow({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-4 border-b py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
			<div>
				<h2 className="font-semibold text-base">{title}</h2>
				{description ? (
					<p className="mt-1 text-muted-foreground text-xs">{description}</p>
				) : null}
			</div>
			<div className="flex flex-col gap-3">{children}</div>
		</div>
	);
}

export function SettingsLine({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex items-center gap-1.5">
				<span className="font-medium text-xs">{label}</span>
				{hint ? (
					<span
						className="inline-flex size-3.5 items-center justify-center rounded-full border border-muted-foreground/50 text-[9px] text-muted-foreground"
						title={hint}
					>
						?
					</span>
				) : null}
			</div>
			<div className="flex items-center gap-2">{children}</div>
		</div>
	);
}
