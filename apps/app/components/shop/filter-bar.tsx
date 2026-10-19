"use client";

import Add from "@carbon/icons-react/es/Add";
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FieldOption } from "./collections";
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
	savedFilters,
}: {
	options: FieldOption[];
	savedFilters?: string;
}) {
	const search = useSearchParams();
	const write = useParamWriter();
	const [open, setOpen] = useState(false);
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
				{savedFilters ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem disabled>{savedFilters}</DropdownMenuItem>
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

export function SortButton({ fields }: { fields: FieldOption[] }) {
	const search = useSearchParams();
	const write = useParamWriter();
	const [field, direction] = (search.get("orderBy") ?? ":").split(":");
	return (
		<Popover>
			<PopoverTrigger asChild>
				<span>
					<ToolbarIcon icon={ArrowsVertical} label="Sắp xếp" active={!!field} />
				</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[520px] max-w-[90vw] p-0">
				<div className="border-b px-4 py-3 font-semibold text-sm">Sắp xếp</div>
				<div className="flex flex-col gap-2 p-4">
					<div className="flex items-center gap-2">
						<Select
							value={field || undefined}
							onValueChange={(value) =>
								write({ orderBy: `${value}:${direction || "desc"}` })
							}
						>
							<SelectTrigger className="flex-1">
								<SelectValue placeholder="Chọn trường" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{fields.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<Select
							value={direction || undefined}
							onValueChange={(value) =>
								write({ orderBy: field ? `${field}:${value}` : null })
							}
						>
							<SelectTrigger className="flex-1">
								<SelectValue placeholder="Thứ tự" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="asc">Tăng dần</SelectItem>
									<SelectItem value="desc">Giảm dần</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Xoá sắp xếp"
							onClick={() => write({ orderBy: null })}
						>
							<Icon icon={Close} />
						</Button>
					</div>
					<Button variant="link" size="sm" className="w-fit px-0">
						<Icon icon={Add} data-icon="inline-start" />
						Thêm sắp xếp
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

const OPERATORS: FieldOption[] = [
	{ value: "is", label: "Bằng" },
	{ value: "contains", label: "Chứa" },
	{ value: "empty", label: "Trống" },
	{ value: "not-empty", label: "Không trống" },
	{ value: "gt", label: "Lớn hơn" },
	{ value: "lt", label: "Nhỏ hơn" },
];

export function FilterButton({ fields }: { fields: FieldOption[] }) {
	const search = useSearchParams();
	const write = useParamWriter();
	const [field, operator, value] = (search.get("where") ?? "::").split(":");
	const [draft, setDraft] = useState(value ?? "");
	return (
		<Popover>
			<PopoverTrigger asChild>
				<span>
					<ToolbarIcon icon={Filter} label="Bộ lọc" active={!!field} />
				</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[700px] max-w-[92vw] p-0">
				<div className="flex items-center gap-2 border-b px-4 py-3 font-semibold text-sm">
					Bộ lọc
					<span className="font-normal text-muted-foreground">
						Đáp ứng tất cả điều kiện ▾
					</span>
				</div>
				<div className="flex flex-col gap-2 p-4">
					<div className="flex items-center gap-2">
						<Select
							value={field || undefined}
							onValueChange={(next) =>
								write({ where: `${next}:${operator || "is"}:${draft}` })
							}
						>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Chọn trường" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{fields.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<Select
							value={operator || undefined}
							onValueChange={(next) =>
								write({ where: field ? `${field}:${next}:${draft}` : null })
							}
						>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Chọn kiểu lọc" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{OPERATORS.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<Input
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							onBlur={() =>
								field &&
								write({ where: `${field}:${operator || "is"}:${draft}` })
							}
							placeholder="Nhập giá trị"
							className="flex-1"
						/>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Xoá điều kiện"
							onClick={() => {
								setDraft("");
								write({ where: null });
							}}
						>
							<Icon icon={Close} />
						</Button>
					</div>
					<Button variant="link" size="sm" className="w-fit px-0">
						<Icon icon={Add} data-icon="inline-start" />
						Thêm lọc
					</Button>
				</div>
				<div className="flex items-center justify-between border-t px-4 py-3 text-xs">
					<button
						type="button"
						className="hover:underline"
						onClick={() => {
							setDraft("");
							write({ where: null });
						}}
					>
						Xóa tất cả
					</button>
					<span className="text-muted-foreground">
						Lưu thành bộ lọc mặc định
					</span>
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

export function MoreMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" aria-label="Thêm thao tác">
					<Icon icon={OverflowMenuVertical} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem disabled>
					<Icon icon={Download} />
					Xuất excel
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
