"use client";

import Notification from "@carbon/icons-react/es/Notification";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Search from "@carbon/icons-react/es/Search";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/pancake/format";
import { useTRPC } from "@/lib/trpc/client";
import { INBOX, NOTIFICATION_TABS, type NotificationTab } from "./inbox/config";

export function NotificationPanel({
	shopId,
	base,
}: {
	shopId: string;
	base: string;
}) {
	const api = useTRPC();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<NotificationTab>("all");
	const [q, setQ] = useState("");
	const [search, changeSearch] = useSearchInput(
		q,
		setQ,
		INBOX.search.debounceMs,
	);
	const [sort, setSort] = useState<"newest" | "oldest">("newest");
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [pageSize, setPageSize] = useState<number>(
		INBOX.notifications.pageSize,
	);
	const counts = useQuery({
		...api.pancakeInbox.counts.queryOptions({ shopId }),
		refetchInterval: INBOX.notifications.pollMs,
	});
	const list = useQuery({
		...api.pancakeInbox.notifications.queryOptions({
			shopId,
			tab,
			q: q.trim(),
			sort,
			unreadOnly,
			page: 1,
			pageSize,
		}),
		enabled: open,
	});
	const refresh = () => {
		queryClient.invalidateQueries({
			queryKey: api.pancakeInbox.notifications.pathKey(),
		});
		queryClient.invalidateQueries({
			queryKey: api.pancakeInbox.counts.pathKey(),
		});
	};
	const markAll = useMutation(
		api.pancakeInbox.markAllRead.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Đã đánh dấu ${data.updated} thông báo là đã đọc`);
				refresh();
			},
			onError: () => toast.error("Không thể đánh dấu đã đọc."),
		}),
	);
	const markRead = useMutation(
		api.pancakeInbox.markRead.mutationOptions({ onSettled: refresh }),
	);
	const unread = counts.data?.all ?? 0;
	const rows = list.data?.rows ?? [];
	const total = list.data?.total ?? 0;

	function openPanel(next: boolean) {
		setOpen(next);
		if (next) counts.refetch();
	}

	function select(row: (typeof rows)[number]) {
		if (!row.readAt) markRead.mutate({ shopId, id: row.id });
		if (row.link) {
			setOpen(false);
			router.push(`${base}/${row.link}`);
		}
	}

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
				title="Thông báo"
				onClick={() => openPanel(true)}
				className="relative text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
			>
				<Icon icon={Notification} />
				{unread ? (
					<Badge
						variant="red"
						className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]"
					>
						{unread > 99 ? "99+" : unread}
					</Badge>
				) : null}
			</Button>
			<Sheet open={open} onOpenChange={openPanel}>
				<SheetContent side="right" size="md" className="gap-0 p-0">
					<SheetHeader className="flex-row items-center justify-between border-b px-5 py-4 pr-12">
						<SheetTitle className="text-lg">Thông báo</SheetTitle>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="sm"
								disabled={!unread || markAll.isPending}
								onClick={() => markAll.mutate({ shopId, tab: "all" })}
							>
								✓✓ Đánh dấu đã đọc tất cả
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon-sm" aria-label="Thêm">
										<Icon icon={OverflowMenuVertical} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										disabled={!unread || markAll.isPending}
										onSelect={() => markAll.mutate({ shopId, tab: "all" })}
									>
										Đánh dấu đã đọc tất cả
									</DropdownMenuItem>
									<DropdownMenuCheckboxItem
										checked={unreadOnly}
										onCheckedChange={(value) => setUnreadOnly(value === true)}
									>
										Chỉ hiện chưa đọc
									</DropdownMenuCheckboxItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</SheetHeader>
					<div className="flex gap-4 border-b px-5">
						{NOTIFICATION_TABS.map((item) => (
							<button
								key={item.value}
								type="button"
								onClick={() => {
									setTab(item.value);
									setPageSize(INBOX.notifications.pageSize);
								}}
								className={cn(
									"-mb-px flex items-center gap-1.5 border-b-2 border-transparent py-3 text-sm",
									tab === item.value
										? "border-primary text-primary"
										: "text-muted-foreground",
								)}
							>
								{item.label}
								<span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
									{counts.data?.[item.value] ?? 0}
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
							<Input
								value={search}
								onChange={(event) => changeSearch(event.target.value)}
								maxLength={INBOX.search.maxLength}
								placeholder="Tìm kiếm"
								aria-label="Tìm kiếm thông báo"
								className="pl-8"
							/>
						</div>
						<Button
							variant="outline"
							onClick={() =>
								setSort((value) => (value === "newest" ? "oldest" : "newest"))
							}
						>
							Sắp xếp: {sort === "newest" ? "Mới nhất" : "Cũ nhất"}
						</Button>
					</div>
					{rows.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
							<Icon icon={Notification} className="size-12 opacity-30" />
							{list.isLoading
								? "Đang tải thông báo…"
								: list.isError
									? "Không tải được thông báo."
									: "Chưa có thông báo nào"}
						</div>
					) : (
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							{rows.map((row) => (
								<button
									key={row.id}
									type="button"
									onClick={() => select(row)}
									className={cn(
										"flex flex-col gap-1 border-b px-5 py-3 text-left hover:bg-accent/40",
										!row.readAt && "bg-accent/20",
									)}
								>
									<span className="flex items-center gap-2">
										{row.readAt ? null : (
											<span className="size-2 shrink-0 rounded-full bg-primary" />
										)}
										<span
											className={cn(
												"min-w-0 flex-1 truncate text-sm",
												!row.readAt && "font-semibold",
											)}
										>
											{row.title}
										</span>
										<span className="shrink-0 text-muted-foreground text-xs">
											{formatDate(row.createdAt)}
										</span>
									</span>
									{row.body ? (
										<span className="line-clamp-2 text-muted-foreground text-xs">
											{row.body}
										</span>
									) : null}
								</button>
							))}
							{total > rows.length &&
							pageSize < INBOX.notifications.maxPageSize ? (
								<div className="flex justify-center p-3">
									<Button
										variant="outline"
										size="sm"
										disabled={list.isFetching}
										onClick={() =>
											setPageSize((value) =>
												Math.min(
													value + INBOX.notifications.pageSize,
													INBOX.notifications.maxPageSize,
												),
											)
										}
									>
										Xem thêm
									</Button>
								</div>
							) : null}
						</div>
					)}
				</SheetContent>
			</Sheet>
		</>
	);
}
