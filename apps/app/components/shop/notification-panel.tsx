"use client";

import Notification from "@carbon/icons-react/es/Notification";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Search from "@carbon/icons-react/es/Search";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { cn } from "@crm/ui/lib/utils";
import { useState } from "react";

const TABS = ["Tất cả", "Phân công cho tôi", "Nhắc nhở", "Hệ thống"];

export function NotificationPanel() {
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState(0);
	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Thông báo"
				title="Thông báo"
				onClick={() => setOpen(true)}
				className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
			>
				<Icon icon={Notification} />
			</Button>
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent side="right" size="md" className="gap-0 p-0">
					<SheetHeader className="flex-row items-center justify-between border-b px-5 py-4 pr-12">
						<SheetTitle className="text-lg">Thông báo</SheetTitle>
						<div className="flex items-center gap-1">
							<Button variant="outline" size="sm" disabled>
								✓✓ Đánh dấu đã đọc tất cả
							</Button>
							<Button variant="ghost" size="icon-sm" aria-label="Thêm">
								<Icon icon={OverflowMenuVertical} />
							</Button>
						</div>
					</SheetHeader>
					<div className="flex gap-4 border-b px-5">
						{TABS.map((label, index) => (
							<button
								key={label}
								type="button"
								onClick={() => setTab(index)}
								className={cn(
									"-mb-px flex items-center gap-1.5 border-b-2 border-transparent py-3 text-sm",
									tab === index
										? "border-primary text-primary"
										: "text-muted-foreground",
								)}
							>
								{label}
								<span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
									0
								</span>
							</button>
						))}
					</div>
					<div className="flex items-center gap-2 px-5 py-3">
						<div className="relative flex-1">
							<Icon
								icon={Search}
								className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
							/>
							<Input placeholder="Tìm kiếm" className="pl-8" />
						</div>
						<Button variant="outline">Sắp xếp</Button>
					</div>
					<div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
						<Icon icon={Notification} className="size-12 opacity-30" />
						Chưa có thông báo nào
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
