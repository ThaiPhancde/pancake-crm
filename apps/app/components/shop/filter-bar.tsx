"use client";

import ArrowsVertical from "@carbon/icons-react/es/ArrowsVertical";
import ChartBar from "@carbon/icons-react/es/ChartBar";
import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronUp from "@carbon/icons-react/es/ChevronUp";
import Close from "@carbon/icons-react/es/Close";
import DataTable from "@carbon/icons-react/es/DataTable";
import Download from "@carbon/icons-react/es/Download";
import Filter from "@carbon/icons-react/es/Filter";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Search from "@carbon/icons-react/es/Search";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { cn } from "@crm/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "api/app-router";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { FieldOption } from "./collections";
import type { FilterField, SavedFilterState } from "./lists/config";
import {
	SavedFilterItems,
	SaveFilterActions,
	useDefaultSavedFilter,
} from "./lists/saved-filters";
import { RANGES } from "./range";

function useParamWriter() {
	const router = useRouter();
	const pathname = usePathname();
	const search = useSearchParams();
	return (change: { [key: string]: string | null }) => {
		const params = new URLSearchParams(search.toString());
		for (const [key, value] of Object.entries(change)) {
			if (value) params.set(key, value);
			else params.delete(key);
		}
		params.delete("page");
		const query = params.toString();
		router.push(query ? `${pathname}?${query}` : pathname);
	};
}

function ChipTrigger({
	label,
	active,
	open,
	...props
}: {
	label: string;
	active: boolean;
	open: boolean;
} & React.ComponentProps<"button">) {
	return (
		<button
			{...props}
			type="button"
			className={cn(
				"inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
				(active || open) && "bg-accent text-accent-foreground",
			)}
		>
			{label}
			<Icon icon={open ? ChevronUp : ChevronDown} className="size-3.5" />
		</button>
	);
}

export function FilterChip({
	label,
	param,
	options,
	multiple = false,
	searchable = false,
}: {
	label: string;
	param: string;
	options: FieldOption[];
	multiple?: boolean;
	searchable?: boolean;
}) {
	const search = useSearchParams();
	const write = useParamWriter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const current = search.get(param) ?? "";
	const selected = new Set(current ? current.split(",") : []);
	const visible = query
		? options.filter((option) =>
				option.label.toLowerCase().includes(query.toLowerCase()),
			)
		: options;
	const title =
		!multiple && current
			? (options.find((option) => option.value === current)?.label ?? label)
			: label;
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<ChipTrigger label={title} active={Boolean(current)} open={open} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56 p-1.5">
				{searchable ? (
					<div className="relative mb-1 px-1">
						<Icon
							icon={Search}
							className="-translate-y-1/2 absolute top-1/2 left-3 size-3.5 text-muted-foreground"
						/>
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Tìm kiếm"
							className="h-7 pl-7"
							onKeyDown={(event) => event.stopPropagation()}
						/>
					</div>
				) : null}
				{visible.length === 0 ? (
					<div className="flex flex-col items-center gap-1 px-6 py-5 text-muted-foreground text-xs">
						<Icon icon={DataTable} className="size-6 opacity-40" />
						Trống
					</div>
				) : multiple ? (
					visible.map((option) => (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={selected.has(option.value)}
							onSelect={(event) => event.preventDefault()}
							onCheckedChange={(checked) => {
								const next = new Set(selected);
								if (checked) next.add(option.value);
								else next.delete(option.value);
								write({ [param]: [...next].join(",") || null });
							}}
						>
							<OptionLabel option={option} />
						</DropdownMenuCheckboxItem>
					))
				) : (
					<DropdownMenuRadioGroup
						value={current}
						onValueChange={(value) =>
							write({ [param]: value === current ? null : value })
						}
					>
						{visible.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								<OptionLabel option={option} />
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OptionLabel({ option }: { option: FieldOption }) {
	return option.color ? (
		<Badge variant={option.color}>{option.label}</Badge>
	) : (
		<span>{option.label}</span>
	);
}

export function RangeChip({
	label = "Thời điểm tạo",
	keys = ["today", "yesterday", "week", "last-week", "month", "last-month"],
}: {
	label?: string;
	keys?: (keyof typeof RANGES)[];
}) {
	return (
		<FilterChip
			label={label}
			param="range"
			options={keys.map((key) => ({ value: key, label: RANGES[key] }))}
		/>
	);
}

export function QuickViewChip({
	options,
	saved,
}: {
	options: FieldOption[];
	saved?: SavedFilterState;
}) {
	const search = useSearchParams();
	const write = useParamWriter();
	const [open, setOpen] = useState(false);
	useDefaultSavedFilter(saved);
	const current = search.get("quick") ?? options[0]?.value ?? "";
	const title = options.find((option) => option.value === current)?.label;
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<ChipTrigger
					label={current === options[0]?.value ? "Tất cả" : (title ?? "Tất cả")}
					active={current !== options[0]?.value}
					open={open}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-52">
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onSelect={() =>
							write({
								quick: option.value === options[0]?.value ? null : option.value,
							})
						}
					>
						{option.label}
					</DropdownMenuItem>
				))}
				{saved ? (
					<>
						<DropdownMenuSeparator />
						<SavedFilterItems saved={saved} />
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function FilterBar({
	children,
	toolbar,
}: {
	children: React.ReactNode;
	toolbar?: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex flex-wrap items-center gap-1">{children}</div>
			{toolbar ? (
				<div className="flex items-center gap-1.5">{toolbar}</div>
			) : null}
		</div>
	);
}

function ToolbarIcon({
	icon,
	label,
	active,
	onClick,
}: {
	icon: CarbonIcon;
	label: string;
	active?: boolean;
	onClick?: () => void;
}) {
	return (
		<Button
			variant="outline"
			size="icon"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={cn(active && "border-primary text-primary")}
		>
			<Icon icon={icon} />
		</Button>
	);
}

export function SortButton({ options }: { options: FieldOption[] }) {
	const search = useSearchParams();
	const write = useParamWriter();
	const fallback = options[0]?.value ?? "";
	const current = search.get("sort") ?? fallback;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<span>
					<ToolbarIcon
						icon={ArrowsVertical}
						label="Sắp xếp"
						active={current !== fallback}
					/>
				</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 max-w-[90vw] p-0">
				<div className="border-b px-4 py-3 font-semibold text-sm">Sắp xếp</div>
				<div className="flex items-center gap-2 p-4">
					<Select
						value={current}
						onValueChange={(value) =>
							write({ sort: value === fallback ? null : value })
						}
					>
						<SelectTrigger className="flex-1">
							<SelectValue placeholder="Chọn thứ tự" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{options.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Xoá sắp xếp"
						onClick={() => write({ sort: null })}
					>
						<Icon icon={Close} />
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function FilterButton({
	fields,
	saved,
}: {
	fields: FilterField[];
	saved?: SavedFilterState;
}) {
	const search = useSearchParams();
	const write = useParamWriter();
	const active = fields.filter((item) => search.get(item.param));
	const [picked, setPicked] = useState<string | undefined>();
	const field = fields.find(
		(item) => item.param === (picked ?? active[0]?.param),
	);
	const value = field ? (search.get(field.param) ?? "") : "";
	const known = field?.options.some((option) => option.value === value);
	return (
		<Popover>
			<PopoverTrigger asChild>
				<span>
					<ToolbarIcon
						icon={Filter}
						label="Bộ lọc"
						active={active.length > 0}
					/>
				</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[620px] max-w-[92vw] p-0">
				<div className="flex items-center gap-2 border-b px-4 py-3 font-semibold text-sm">
					Bộ lọc
					<span className="font-normal text-muted-foreground text-xs">
						{active.length} điều kiện đang áp dụng
					</span>
				</div>
				<div className="flex items-center gap-2 p-4">
					<Select
						value={field?.param}
						onValueChange={(next) => {
							if (field && value && field.param !== next)
								write({ [field.param]: null });
							setPicked(next);
						}}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="Chọn trường" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{fields.map((item) => (
									<SelectItem key={item.param} value={item.param}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<span className="flex h-8 items-center rounded-md border px-3 text-muted-foreground text-xs">
						Bằng
					</span>
					<Select
						value={known ? value : undefined}
						disabled={!field}
						onValueChange={(next) => field && write({ [field.param]: next })}
					>
						<SelectTrigger className="flex-1">
							<SelectValue
								placeholder={value ? "Nhiều giá trị" : "Chọn giá trị"}
							/>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{field?.options.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Xoá điều kiện"
						disabled={!field}
						onClick={() => {
							if (field) write({ [field.param]: null });
							setPicked(undefined);
						}}
					>
						<Icon icon={Close} />
					</Button>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
					<button
						type="button"
						className="hover:underline"
						onClick={() => {
							setPicked(undefined);
							write(
								Object.fromEntries(fields.map((item) => [item.param, null])),
							);
						}}
					>
						Xóa tất cả
					</button>
					{saved ? <SaveFilterActions saved={saved} /> : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function StatsToggle({ defaultOn = false }: { defaultOn?: boolean }) {
	const search = useSearchParams();
	const write = useParamWriter();
	const stats = search.get("stats");
	const on = defaultOn ? stats !== "0" : stats === "1";
	return (
		<ToolbarIcon
			icon={ChartBar}
			label="Thống kê nhanh"
			active={on}
			onClick={() =>
				write({ stats: on === defaultOn ? (on ? "0" : "1") : null })
			}
		/>
	);
}

export function ViewSwitch({
	options,
	param = "view",
}: {
	options: { value: string; label: string; icon: React.ReactNode }[];
	param?: string;
}) {
	const search = useSearchParams();
	const write = useParamWriter();
	const current = search.get(param) ?? options[0]?.value;
	const active =
		options.find((option) => option.value === current) ?? options[0];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="default" aria-label="Kiểu hiển thị">
					{active?.icon}
					<Icon icon={ChevronDown} className="size-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onSelect={() =>
							write({
								[param]:
									option.value === options[0]?.value ? null : option.value,
							})
						}
					>
						{option.icon}
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export type ExportRequest =
	inferRouterInputs<AppRouter>["pancake"]["exportCsv"];

export function MoreMenu({ exportRequest }: { exportRequest?: ExportRequest }) {
	const api = useTRPC();
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);
	async function download(request: ExportRequest) {
		setPending(true);
		try {
			const file = await queryClient.fetchQuery({
				...api.pancake.exportCsv.queryOptions(request),
				staleTime: 0,
			});
			const url = URL.createObjectURL(
				new Blob([file.content], { type: file.mimeType }),
			);
			const link = document.createElement("a");
			link.href = url;
			link.download = file.filename;
			link.click();
			URL.revokeObjectURL(url);
			if (file.truncated)
				toast.warning(`File chỉ gồm ${file.rows} dòng đầu tiên.`);
			else toast.success(`Đã xuất ${file.rows} dòng`);
		} catch {
			toast.error("Không thể xuất file. Vui lòng thử lại.");
		} finally {
			setPending(false);
		}
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" aria-label="Thêm thao tác">
					<Icon icon={OverflowMenuVertical} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					disabled={!exportRequest || pending}
					onSelect={() => exportRequest && download(exportRequest)}
				>
					<Icon icon={Download} />
					{pending ? "Đang xuất…" : "Xuất excel"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function SearchBox({
	placeholder = "Tìm kiếm",
	className,
}: {
	placeholder?: string;
	className?: string;
}) {
	const search = useSearchParams();
	const write = useParamWriter();
	const [value, setValue] = useState(search.get("q") ?? "");
	return (
		<form
			className={cn("relative", className)}
			onSubmit={(event) => {
				event.preventDefault();
				write({ q: value.trim() || null });
			}}
		>
			<Icon
				icon={Search}
				className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
			/>
			<Input
				value={value}
				onChange={(event) => setValue(event.target.value)}
				placeholder={placeholder}
				className="h-8 pl-8"
			/>
		</form>
	);
}
