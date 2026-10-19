"use client";

import Search from "@carbon/icons-react/es/Search";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@crm/ui/components/popover";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAmount } from "@/components/pancake/format";
import { useTRPC } from "@/lib/trpc/client";
import { INBOX } from "./config";

type Hit = { key: string; href: string; title: string; detail: string };

export function GlobalSearch({
	shopId,
	base,
}: {
	shopId: string;
	base: string;
}) {
	const api = useTRPC();
	const router = useRouter();
	const [term, setTerm] = useState("");
	const [query, changeQuery] = useSearchInput(
		term,
		setTerm,
		INBOX.search.debounceMs,
	);
	const [open, setOpen] = useState(false);
	const q = term.trim();
	const search = useQuery({
		...api.pancake.search.queryOptions({ shopId, q }),
		enabled: q.length > 0,
	});
	const data = search.data;
	const groups: { title: string; hits: Hit[] }[] = data
		? [
				{
					title: "Liên hệ",
					hits: data.customers.map((row) => ({
						key: row.customerId,
						href: `${base}/contacts?customerId=${encodeURIComponent(row.customerId)}`,
						title: row.name ?? row.phone ?? row.customerId,
						detail: row.phone ?? "",
					})),
				},
				{
					title: "Đơn hàng",
					hits: data.orders.map((row) => ({
						key: row.orderId,
						href: `${base}/orders?orderId=${encodeURIComponent(row.orderId)}`,
						title: `#${row.orderId} · ${row.customerName ?? row.customerPhone ?? ""}`,
						detail: formatAmount(row.totalPrice, row.currency),
					})),
				},
				{
					title: "Tiềm năng",
					hits: data.leads.map((row) => ({
						key: row.id,
						href: `${base}/leads?leadId=${encodeURIComponent(row.id)}`,
						title: row.name,
						detail: row.phone ?? "",
					})),
				},
				{
					title: "Vấn đề",
					hits: data.tickets.map((row) => ({
						key: row.id,
						href: `${base}/tickets?ticketId=${encodeURIComponent(row.id)}`,
						title: row.title,
						detail: row.contactName ?? "",
					})),
				},
			].filter((group) => group.hits.length > 0)
		: [];

	function close() {
		setOpen(false);
	}

	return (
		<Popover open={open && q.length > 0} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<form
					className="relative hidden w-full max-w-xl sm:block"
					onSubmit={(event) => {
						event.preventDefault();
						const value = query.trim();
						if (!value) return;
						close();
						router.push(`${base}/contacts?q=${encodeURIComponent(value)}`);
					}}
				>
					<Icon
						icon={Search}
						className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-sidebar-foreground/70"
					/>
					<input
						value={query}
						onChange={(event) => {
							changeQuery(event.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onKeyDown={(event) => {
							if (event.key === "Escape") close();
						}}
						maxLength={INBOX.search.maxLength}
						placeholder="Tìm kiếm"
						aria-label="Tìm kiếm liên hệ, đơn hàng, tiềm năng, vấn đề"
						className="h-8 w-full rounded-full bg-white/10 pr-4 pl-9 text-sidebar-foreground text-sm outline-none placeholder:text-sidebar-foreground/60 focus:bg-white/15"
					/>
				</form>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				className="w-(--radix-popover-trigger-width) max-w-xl"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (
						event.target instanceof Element &&
						event.target.closest("form")?.contains(event.target)
					)
						event.preventDefault();
				}}
			>
				{search.isLoading ? (
					<p className="py-3 text-center text-muted-foreground">
						Đang tìm kiếm…
					</p>
				) : search.isError ? (
					<p className="py-3 text-center text-muted-foreground">
						Không tìm kiếm được.
					</p>
				) : groups.length === 0 ? (
					<p className="py-3 text-center text-muted-foreground">
						Không có kết quả
					</p>
				) : (
					groups.map((group) => (
						<div key={group.title} className="flex flex-col gap-0.5">
							<p className="px-2 pt-1 font-medium text-muted-foreground">
								{group.title}
							</p>
							{group.hits.map((hit) => (
								<Link
									key={hit.key}
									href={hit.href}
									prefetch={false}
									onClick={close}
									className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
								>
									<span className="min-w-0 truncate">{hit.title}</span>
									<span className="shrink-0 text-muted-foreground">
										{hit.detail}
									</span>
								</Link>
							))}
						</div>
					))
				)}
				<p className="border-t px-2 pt-2 text-muted-foreground">
					Nhấn Enter để tìm trong Liên hệ
				</p>
			</PopoverContent>
		</Popover>
	);
}
