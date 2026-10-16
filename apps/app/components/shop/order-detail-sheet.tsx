"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { useRouter } from "next/navigation";

export function OrderDetailSheet({
	title,
	closeHref,
	children,
}: {
	title: string;
	closeHref: string;
	children: React.ReactNode;
}) {
	const router = useRouter();
	return (
		<Sheet open onOpenChange={(open) => !open && router.push(closeHref)}>
			<SheetContent side="right" size="lg" className="gap-0 p-0">
				<SheetHeader className="border-b px-5 py-4">
					<SheetTitle className="text-base">{title}</SheetTitle>
				</SheetHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
					{children}
				</div>
			</SheetContent>
		</Sheet>
	);
}
