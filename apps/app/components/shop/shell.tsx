"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronUp from "@carbon/icons-react/es/ChevronUp";
import Close from "@carbon/icons-react/es/Close";
import Dashboard from "@carbon/icons-react/es/Dashboard";
import Help from "@carbon/icons-react/es/Help";
import Menu from "@carbon/icons-react/es/Menu";
import Search from "@carbon/icons-react/es/Search";
import SidePanelClose from "@carbon/icons-react/es/SidePanelClose";
import SidePanelOpen from "@carbon/icons-react/es/SidePanelOpen";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { type User, UserMenu } from "@/components/app-header";
import { signOutAndRedirect } from "@/lib/sign-out";
import { AutomationCenter } from "./automation-center";
import { type NavItem, SHOP_NAV } from "./nav";
import { NotificationPanel } from "./notification-panel";
import { shopInitial } from "./shop-profile";
import { shopUrl } from "./url";

export type ShopSummary = { id: string; name: string };

function isActive(item: NavItem, base: string, pathname: string): boolean {
	const href = `${base}${item.href}`;
	if (item.exact) return pathname === href;
	if (item.children)
		return item.children.some((child) =>
			pathname.startsWith(`${base}${child.href}`),
		);
	return pathname.startsWith(href);
}

function ShopSwitcher({
	slug,
	shop,
	shops,
	collapsed,
}: {
	slug: string;
	shop: ShopSummary;
	shops: ShopSummary[];
	collapsed: boolean;
}) {
	const [query, setQuery] = useState("");
	const visible = shops.filter((item) =>
		item.name.toLowerCase().includes(query.toLowerCase()),
	);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex h-12 w-full shrink-0 items-center gap-2 px-3 text-left text-sidebar-foreground hover:bg-sidebar-accent/60"
					aria-label="Chọn workspace"
				>
					<span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-[#e5533d] font-semibold text-sm text-white">
						{shopInitial(shop.name)}
					</span>
					{collapsed ? null : (
						<>
							<span className="min-w-0 flex-1 truncate font-semibold text-sm text-white">
								{shop.name}
							</span>
							<Icon icon={ChevronDown} className="size-4 opacity-70" />
						</>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64 p-2">
				<div className="relative mb-1">
					<Icon
						icon={Search}
						className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
					/>
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => event.stopPropagation()}
						placeholder="Tìm kiếm workspace"
						className="h-8 pl-8"
					/>
				</div>
				{visible.length === 0 ? (
					<p className="py-5 text-center text-muted-foreground text-xs">
						Không có dữ liệu
					</p>
				) : (
					visible.map((item) => (
						<DropdownMenuItem key={item.id} asChild>
							<Link href={shopUrl(slug, item.id)} className="gap-2">
								<span className="flex size-6 items-center justify-center rounded-sm bg-[#e5533d] font-semibold text-white text-xs">
									{shopInitial(item.name)}
								</span>
								<span className="min-w-0 flex-1 truncate">{item.name}</span>
								{item.id === shop.id ? (
									<span className="text-primary text-xs">Đang mở</span>
								) : null}
							</Link>
						</DropdownMenuItem>
					))
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={`/${slug}`} className="gap-2 font-medium">
						<Icon icon={Dashboard} />
						Bảng điều khiển
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function NavLink({
	item,
	base,
	pathname,
	collapsed,
	onNavigate,
	open,
	onToggle,
}: {
	item: NavItem;
	base: string;
	pathname: string;
	collapsed: boolean;
	onNavigate?: () => void;
	open: boolean;
	onToggle: () => void;
}) {
	const active = isActive(item, base, pathname);
	const className = cn(
		"flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-white",
		active && !item.children && "bg-sidebar-accent text-white",
		active && item.children && "text-white",
		collapsed && "justify-center px-0",
	);
	const icon = item.icon ? (
		<Icon icon={item.icon} className="size-4.5 shrink-0" />
	) : null;
	if (item.children) {
		const expanded = collapsed ? false : open;
		return (
			<div
				className={cn(
					"flex flex-col",
					expanded && "rounded-md bg-sidebar-accent/40 pb-1",
				)}
			>
				<button
					type="button"
					className={className}
					onClick={onToggle}
					aria-label={item.title}
					aria-expanded={expanded}
				>
					{icon}
					{collapsed ? null : (
						<>
							<span className="flex-1 text-left">{item.title}</span>
							<Icon
								icon={expanded ? ChevronUp : ChevronDown}
								className="size-3.5 opacity-70"
							/>
						</>
					)}
				</button>
				{expanded
					? item.children.map((child) => {
							const childActive = pathname.startsWith(`${base}${child.href}`);
							return (
								<Link
									key={child.href}
									href={`${base}${child.href}`}
									onClick={onNavigate}
									aria-current={childActive ? "page" : undefined}
									className={cn(
										"mx-1 flex h-9 items-center rounded-md pl-10 text-sidebar-foreground text-sm hover:bg-sidebar-accent/60 hover:text-white",
										childActive && "bg-sidebar-accent text-white",
									)}
								>
									{child.title}
								</Link>
							);
						})
					: null}
			</div>
		);
	}
	return (
		<Link
			href={`${base}${item.href}`}
			onClick={onNavigate}
			aria-current={active ? "page" : undefined}
			className={className}
			title={collapsed ? item.title : undefined}
		>
			{icon}
			{collapsed ? null : <span>{item.title}</span>}
		</Link>
	);
}

function SidebarNav({
	base,
	pathname,
	collapsed,
	onNavigate,
	onExpand,
}: {
	base: string;
	pathname: string;
	collapsed: boolean;
	onNavigate?: () => void;
	onExpand?: () => void;
}) {
	const [open, setOpen] = useState<Record<string, boolean>>({});
	return (
		<nav
			aria-label="Workspace"
			className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3"
		>
			{SHOP_NAV.map((item) => (
				<NavLink
					key={item.href}
					item={item}
					base={base}
					pathname={pathname}
					collapsed={collapsed}
					onNavigate={onNavigate}
					open={open[item.href] ?? isActive(item, base, pathname)}
					onToggle={() => {
						if (collapsed) onExpand?.();
						setOpen((state) => ({
							...state,
							[item.href]:
								collapsed ||
								!(state[item.href] ?? isActive(item, base, pathname)),
						}));
					}}
				/>
			))}
		</nav>
	);
}

export function ShopShell({
	slug,
	shop,
	shops,
	user,
	children,
}: {
	slug: string;
	shop: ShopSummary;
	shops: ShopSummary[];
	user: User;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const base = shopUrl(slug, shop.id);
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [query, setQuery] = useState("");

	return (
		<div className="theme-shop flex h-svh bg-background text-foreground">
			<aside
				className={cn(
					"hidden shrink-0 flex-col bg-sidebar md:flex",
					collapsed ? "w-14" : "w-[200px]",
				)}
			>
				<ShopSwitcher
					slug={slug}
					shop={shop}
					shops={shops}
					collapsed={collapsed}
				/>
				<SidebarNav
					base={base}
					pathname={pathname}
					collapsed={collapsed}
					onExpand={() => setCollapsed(false)}
				/>
				<button
					type="button"
					onClick={() => setCollapsed((value) => !value)}
					aria-label={collapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"}
					className={cn(
						"flex h-11 shrink-0 items-center gap-3 border-sidebar-border border-t px-4 text-sidebar-foreground text-sm hover:text-white",
						collapsed && "justify-center px-0",
					)}
				>
					<Icon
						icon={collapsed ? SidePanelOpen : SidePanelClose}
						className="size-4.5"
					/>
					{collapsed ? null : "Thu gọn"}
				</button>
			</aside>

			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetContent
					side="left"
					showCloseButton={false}
					className="w-[260px] gap-0 bg-sidebar p-0 text-sidebar-foreground"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Điều hướng</SheetTitle>
					</SheetHeader>
					<div className="flex items-center justify-between pr-2">
						<ShopSwitcher
							slug={slug}
							shop={shop}
							shops={shops}
							collapsed={false}
						/>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Đóng"
							className="text-sidebar-foreground"
							onClick={() => setMobileOpen(false)}
						>
							<Icon icon={Close} />
						</Button>
					</div>
					<SidebarNav
						base={base}
						pathname={pathname}
						collapsed={false}
						onNavigate={() => setMobileOpen(false)}
					/>
				</SheetContent>
			</Sheet>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-12 shrink-0 items-center gap-3 bg-sidebar px-3 md:px-4">
					<Button
						variant="ghost"
						size="icon"
						className="text-sidebar-foreground md:hidden"
						aria-label="Mở điều hướng"
						onClick={() => setMobileOpen(true)}
					>
						<Icon icon={Menu} />
					</Button>
					<form
						className="relative hidden w-full max-w-xl sm:block"
						onSubmit={(event) => {
							event.preventDefault();
							if (query.trim())
								router.push(
									`${base}/contacts?q=${encodeURIComponent(query.trim())}`,
								);
						}}
					>
						<Icon
							icon={Search}
							className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-sidebar-foreground/70"
						/>
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Tìm kiếm"
							aria-label="Tìm kiếm liên hệ, đơn hàng"
							className="h-8 w-full rounded-full bg-white/10 pr-4 pl-9 text-sidebar-foreground text-sm outline-none placeholder:text-sidebar-foreground/60 focus:bg-white/15"
						/>
					</form>
					<div className="ml-auto flex items-center gap-1">
						<AutomationCenter />
						<NotificationPanel />
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									asChild
									variant="ghost"
									size="icon"
									className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
								>
									<a
										href="https://docs.pancake.biz/crm/intro"
										target="_blank"
										rel="noreferrer"
										aria-label="Trợ giúp"
									>
										<Icon icon={Help} />
									</a>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Trợ giúp</TooltipContent>
						</Tooltip>
						<UserMenu
							user={user}
							onSignOut={() => {
								signOutAndRedirect().catch(() =>
									toast.error("Không đăng xuất được."),
								);
							}}
						/>
					</div>
				</header>
				<main className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
					{children}
				</main>
			</div>
		</div>
	);
}

export function ShopShellFallback() {
	return (
		<div className="theme-shop flex h-svh bg-background" aria-busy="true">
			<aside className="hidden w-[200px] shrink-0 bg-sidebar md:block" />
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="h-12 shrink-0 bg-sidebar" />
				<main className="flex-1 p-3">
					<div className="h-full rounded-lg bg-card" />
				</main>
			</div>
			<span role="status" className="sr-only">
				Đang tải workspace…
			</span>
		</div>
	);
}
