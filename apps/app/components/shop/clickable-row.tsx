"use client";

import { TableRow } from "@crm/ui/components/table";
import { cn } from "@crm/ui/lib/utils";
import { useRouter } from "next/navigation";

export function ClickableRow({
	href,
	className,
	children,
}: {
	href?: string;
	className?: string;
	children: React.ReactNode;
}) {
	const router = useRouter();
	if (!href) {
		return <TableRow className={className}>{children}</TableRow>;
	}
	return (
		<TableRow
			className={cn("cursor-pointer", className)}
			onClick={(event) => {
				const target = event.target as HTMLElement | null;
				if (
					target?.closest(
						"a,button,input,[role='checkbox'],[data-slot='checkbox']",
					)
				) {
					return;
				}
				router.push(href, { scroll: false });
			}}
		>
			{children}
		</TableRow>
	);
}
