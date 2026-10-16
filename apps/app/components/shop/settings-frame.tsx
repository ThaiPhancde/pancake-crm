import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";

export function SettingsFrame({
	current,
	children,
	className,
	trail,
}: {
	current: string;
	children: React.ReactNode;
	className?: string;
	trail?: { label: string; href: string }[];
}) {
	return (
		<div className="flex min-h-full flex-col gap-3">
			<nav
				aria-label="Breadcrumb"
				className="rounded-lg bg-card px-5 py-3 text-sm"
			>
				<span className="text-primary">Cấu hình</span>
				{trail?.map((item) => (
					<span key={item.href}>
						<span className="mx-1.5 text-muted-foreground">›</span>
						<Link href={item.href} className="text-primary hover:underline">
							{item.label}
						</Link>
					</span>
				))}
				<span className="mx-1.5 text-muted-foreground">›</span>
				<span className="font-medium">{current}</span>
			</nav>
			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col rounded-lg bg-card",
					className,
				)}
			>
				{children}
			</div>
		</div>
	);
}

export function SettingsTabs({
	tabs,
	current,
	href,
}: {
	tabs: { value: string; label: string }[];
	current: string;
	href: (value: string) => string;
}) {
	return (
		<div className="flex gap-6 border-b px-5">
			{tabs.map((tab) => (
				<Link
					key={tab.value}
					href={href(tab.value)}
					aria-current={tab.value === current ? "page" : undefined}
					className={cn(
						"-mb-px border-b-2 border-transparent py-3 text-sm hover:text-primary",
						tab.value === current && "border-primary font-medium text-primary",
					)}
				>
					{tab.label}
				</Link>
			))}
		</div>
	);
}
