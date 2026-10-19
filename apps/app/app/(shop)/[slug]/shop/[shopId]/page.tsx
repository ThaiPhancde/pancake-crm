import Maximize from "@carbon/icons-react/es/Maximize";
import { PANCAKE } from "@crm/pancake/config";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DonutStat } from "@crm/ui/components/dashboard-chart";
import { Icon } from "@crm/ui/components/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	formatAmount,
	formatAmounts,
	formatDate,
} from "@/components/pancake/format";
import { CalendarGrid } from "@/components/shop/calendar-week";
import { EmptyChart, EmptyRows } from "@/components/shop/empty-state";
import { HomeViewSelect } from "@/components/shop/home-controls";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import {
	type SearchValues,
	shopFilters,
	text,
	withParams,
} from "@/components/shop/params";
import {
	formatRange,
	rangeBounds,
	zonedDateTime,
} from "@/components/shop/range";
import { RangeToggle, RefreshButton } from "@/components/shop/range-picker";
import { HorizontalBars, ReportCard } from "@/components/shop/report";
import { shopProfile } from "@/components/shop/shop-profile";
import { ShopTrendChart } from "@/components/shop/shop-trend-chart";

export default function HomePage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Home {...props} />
		</Suspense>
	);
}

function Tile({
	label,
	value,
	emoji,
	sub,
}: {
	label: string;
	value: React.ReactNode;
	emoji: string;
	sub?: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<span className="flex size-11 items-center justify-center rounded-lg bg-muted text-xl">
				{emoji}
			</span>
			<div className="flex flex-col">
				<span className="text-muted-foreground text-xs">{label}</span>
				<span className="font-semibold text-base tabular-nums">{value}</span>
				{sub ? (
					<span className="text-muted-foreground text-xs tabular-nums">
						{sub}
					</span>
				) : null}
			</div>
		</div>
	);
}

function Greeting({
	name,
	children,
}: {
	name: string;
	children?: React.ReactNode;
}) {
	const today = formatDate(new Date().toISOString()).split(" ").pop();
	return (
		<div className="relative flex flex-col justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#e9f2ff] via-card to-[#dbe9ff] p-6 dark:from-[#1c2f4a] dark:via-card dark:to-[#1c2f4a]">
			<span className="text-muted-foreground text-xs">📅 {today}</span>
			<h2 className="font-semibold text-2xl">Xin chào, {name}!</h2>
			<p className="text-muted-foreground text-xs">
				Chào ngày mới thật hiệu quả. Đây là tổng quan hôm nay.
			</p>
			{children}
		</div>
	);
}

async function Home({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "30d");
	const view =
		text(values, "scope") === "personal" || text(values, "view") === "personal"
			? "personal"
			: "manager";
	const taskTab = text(values, "tasks") === "overdue" ? "overdue" : "open";
	const sellers = await ctx.api.sellers.query({ shopId: ctx.shopId });
	const userEmail = ctx.session.user.email.toLowerCase();
	const userName = ctx.session.user.name.trim().toLowerCase();
	const personalEmployee =
		sellers.find((s) => s.email?.toLowerCase() === userEmail) ??
		sellers.find((s) => s.name.trim().toLowerCase() === userName) ??
		null;
	const scopedInput =
		view === "personal"
			? {
					...filter.input,
					sellerId: personalEmployee?.employeeId ?? "__personal_none__",
				}
			: filter.input;
	const personalAssignee =
		view === "personal"
			? (personalEmployee?.employeeId ?? "__personal_none__")
			: undefined;
	const week = shopFilters({ range: "week" }, ctx.shopId).input;
	const [overview, report, customers, tasks, leads, tickets, appointments] =
		await Promise.all([
			ctx.api.overview.query(scopedInput),
			ctx.api.report.query(scopedInput),
			ctx.api.customers.query({ ...scopedInput, pageSize: 1 }),
			ctx.api.tasks.query({
				...filter.input,
				taskView: view === "personal" && taskTab === "open" ? "mine" : taskTab,
				pageSize: 8,
			}),
			ctx.api.leads.query({
				shopId: ctx.shopId,
				assigneeId: personalAssignee,
				pageSize: 1,
			}),
			ctx.api.tickets.query({
				shopId: ctx.shopId,
				assigneeId: personalAssignee,
				pageSize: 1,
			}),
			view === "personal"
				? ctx.api.appointments.query({
						shopId: ctx.shopId,
						assigneeId: personalAssignee,
						from: week.from,
						to: week.to,
						pageSize: PANCAKE.maxListSize,
					})
				: null,
		]);
	const today = rangeBounds("today", new Date(), filter.timeZone).from;
	const events = (appointments?.rows ?? []).map((item) => {
		const start = zonedDateTime(new Date(item.startAt), filter.timeZone);
		return {
			id: item.id,
			title: item.title,
			date: start.date,
			start: start.time,
			end: item.endAt
				? zonedDateTime(new Date(item.endAt), filter.timeZone).time
				: start.time,
		};
	});
	const shopCurrency = shopProfile(ctx.shopId).currency;
	const currency = report.seriesCurrency;
	const revenueText = formatAmounts(report.revenue, shopCurrency);
	const receivedText = `Đã thu: ${formatAmounts(report.receivedRevenue, currency)}`;
	const rate = report.orders
		? Math.round((100 * report.delivered) / report.orders)
		: 0;
	const other =
		report.orders - report.delivered - report.cancelled - report.returned;
	const name = ctx.session.user.name.split(" ").slice(-2).join(" ");
	const periodLabel =
		filter.from && filter.to ? formatRange(filter.from, filter.to) : "";
	const topPerformers = [...report.performance]
		.sort((a, b) => Number(b.revenue) - Number(a.revenue))
		.slice(0, 5);

	return (
		<div className="flex min-h-full flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-5 py-3">
				<div>
					<h1 className="text-lg font-semibold tracking-tight">Tổng quan</h1>
					<p className="text-muted-foreground text-xs">
						{view === "personal"
							? `Hiệu suất cá nhân${personalEmployee ? ` · ${personalEmployee.name}` : " (Tài khoản chưa gán nhân viên bán hàng trên Pancake POS)"}`
							: "Tổng quan nhanh số liệu và hoạt động toàn shop trong CRM"}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<RefreshButton />
					<HomeViewSelect value={view} />
					<RangeToggle
						quick={["today", "week", "month"]}
						defaultRange="30d"
						timeZone={filter.timeZone}
					/>
				</div>
			</div>

			{view === "manager" ? (
				<div className="grid gap-3 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
					<div className="flex flex-col gap-3">
						<div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
							<Greeting name={name} />
							<ReportCard>
								<div className="grid gap-5 sm:grid-cols-2">
									<Tile
										label="Doanh thu"
										value={revenueText}
										sub={receivedText}
										emoji="💰"
									/>
									<Tile
										label="Đơn hàng mới"
										value={overview.orders}
										emoji="🛒"
									/>
									<Tile
										label="Liên hệ mới"
										value={customers.total}
										emoji="👥"
									/>
									<Tile
										label="Tỷ lệ chuyển đổi"
										value={`${rate}%`}
										emoji="📣"
									/>
								</div>
							</ReportCard>
						</div>
						<ReportCard title="Báo cáo doanh thu">
							<div className="flex items-baseline justify-between">
								<div className="flex flex-col">
									<span className="font-semibold text-lg tabular-nums">
										{revenueText}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{receivedText}
									</span>
								</div>
								<span className="text-muted-foreground text-xs">
									{report.delivered} đơn thành công / {report.orders} tổng đơn
								</span>
							</div>
							{report.dailySeries.length > 0 ? (
								<ShopTrendChart
									height={220}
									data={report.dailySeries}
									xKey="date"
									currency={currency}
									config={{
										revenue: {
											label: `Doanh thu (${currency})`,
											color: "var(--chart-1)",
										},
										received: {
											label: `Đã thu (${currency})`,
											color: "var(--chart-3)",
										},
									}}
								/>
							) : (
								<EmptyChart label="Không có đơn hàng phát sinh trong khoảng thời gian đã chọn." />
							)}
							{periodLabel ? (
								<div className="flex justify-center gap-6 text-muted-foreground text-xs">
									<span>— {periodLabel}</span>
								</div>
							) : null}
						</ReportCard>
						<ReportCard title="Mục tiêu doanh thu">
							<div className="rounded-md border-primary border-l-2 bg-muted px-4 py-6 text-muted-foreground text-xs">
								Chưa đặt mục tiêu cho shop này.
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="ml-1 inline-flex">
											<Button
												variant="link"
												size="sm"
												className="px-0"
												disabled
											>
												Thiết lập mục tiêu
											</Button>
										</span>
									</TooltipTrigger>
									<TooltipContent>Sắp ra mắt</TooltipContent>
								</Tooltip>
							</div>
						</ReportCard>
					</div>
					<div className="flex flex-col gap-3">
						<ReportCard title="Tỷ lệ đơn thành công">
							{report.orders ? (
								<DonutStat
									height={180}
									centerValue={`${rate}%`}
									centerLabel="Đã nhận"
									data={[
										{
											key: "delivered",
											label: "Đã nhận / thu tiền",
											value: report.delivered,
											color: "var(--chart-3)",
										},
										{
											key: "other",
											label: "Đang xử lý / giao",
											value: Math.max(0, other),
											color: "var(--chart-1)",
										},
										{
											key: "returned",
											label: "Hoàn",
											value: report.returned,
											color: "var(--chart-2)",
										},
										{
											key: "cancelled",
											label: "Hủy",
											value: report.cancelled,
											color: "var(--muted-foreground)",
										},
									]}
								/>
							) : (
								<EmptyChart />
							)}
						</ReportCard>
						<ReportCard title="Doanh thu theo nhân viên">
							<HorizontalBars
								items={topPerformers.map((row) => ({
									label: row.sellerName,
									value: Number(row.revenue),
									display: formatAmount(row.revenue, row.currency),
								}))}
							/>
						</ReportCard>
						<ReportCard title="Số đơn theo nhân viên">
							<HorizontalBars
								items={topPerformers.map((row) => ({
									label: row.sellerName,
									value: row.orders,
									display: `${row.orders} đơn (${row.deliveredRate})`,
								}))}
							/>
						</ReportCard>
					</div>
				</div>
			) : (
				<div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
					<div className="flex flex-col gap-3">
						<div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
							<Greeting name={name}>
								<div className="mt-2 flex flex-wrap gap-2">
									<Badge variant="blue" className="h-7 px-3 text-xs">
										<span className="mr-1 rounded-full bg-white px-1.5 text-[#1677ff]">
											{tasks.total}
										</span>
										Nhiệm vụ
									</Badge>
									<Badge variant="blue" className="h-7 px-3 text-xs">
										<span className="mr-1 rounded-full bg-white px-1.5 text-[#1677ff]">
											{tickets.total}
										</span>
										Ticket đang chờ
									</Badge>
								</div>
							</Greeting>
							<div className="grid gap-3 sm:grid-cols-2">
								{[
									{ label: "Tiềm năng mới", value: leads.total },
									{ label: "Liên hệ mới", value: customers.total },
									{
										label: "Doanh thu cá nhân",
										value: revenueText,
										sub: receivedText,
									},
									{ label: "Tỷ lệ chuyển đổi", value: `${rate}%` },
								].map((item) => (
									<div
										key={item.label}
										className="flex flex-col gap-1 rounded-lg bg-card p-5"
									>
										<span className="text-muted-foreground text-xs">
											{item.label}
										</span>
										<span className="font-semibold text-xl tabular-nums">
											{item.value}
										</span>
										{"sub" in item ? (
											<span className="text-muted-foreground text-xs tabular-nums">
												{item.sub}
											</span>
										) : null}
									</div>
								))}
							</div>
						</div>
						<ReportCard
							title="Danh sách nhiệm vụ cá nhân"
							action={
								<Link
									href={`${ctx.base}/reports/tasks`}
									className="text-primary text-xs hover:underline"
								>
									Xem tất cả
								</Link>
							}
						>
							<div className="flex gap-4 border-b text-sm">
								{(["open", "overdue"] as const).map((key) => (
									<Link
										key={key}
										href={withParams(ctx.base, values, {
											tasks: key === "open" ? "" : key,
										})}
										className={
											taskTab === key
												? "-mb-px flex items-center gap-1.5 border-primary border-b-2 pb-2 text-primary"
												: "flex items-center gap-1.5 pb-2 text-muted-foreground"
										}
									>
										{key === "open" ? "Đang mở" : "Quá hạn"}
										<span className="rounded-full bg-muted px-1.5 text-[10px]">
											{key === "open" ? tasks.total : tasks.overdue}
										</span>
									</Link>
								))}
							</div>
							{tasks.rows.length === 0 ? (
								<EmptyRows label="Chưa có dữ liệu để hiển thị" />
							) : (
								<ul className="flex flex-col divide-y">
									{tasks.rows.map((task) => (
										<li
											key={task.id}
											className="flex items-center justify-between gap-3 py-2.5 text-xs"
										>
											<div className="min-w-0">
												<Link
													href={`${ctx.base}/orders?orderId=${task.orderId}`}
													className="font-medium hover:text-primary"
												>
													{task.title}
												</Link>
												<div className="text-muted-foreground">
													#{task.orderId} · {task.order.customerName} ·{" "}
													{task.assignee.name}
												</div>
											</div>
											<Badge variant={task.overdue ? "red" : "blue"}>
												{formatDate(task.dueAt)}
											</Badge>
										</li>
									))}
								</ul>
							)}
						</ReportCard>
					</div>
					<ReportCard
						title="Lịch hẹn"
						action={
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								{today.split("-").reverse().join("/")}
								<Button
									asChild
									variant="ghost"
									size="icon-xs"
									aria-label="Mở lịch hẹn"
								>
									<Link href={`${ctx.base}/calendar`}>
										<Icon icon={Maximize} />
									</Link>
								</Button>
							</div>
						}
						className="min-h-[520px]"
					>
						<CalendarGrid
							date={today}
							mode="week"
							today={today}
							events={events}
							compact
						/>
					</ReportCard>
				</div>
			)}
		</div>
	);
}
