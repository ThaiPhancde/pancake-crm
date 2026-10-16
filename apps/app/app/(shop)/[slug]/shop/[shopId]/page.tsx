import Maximize from "@carbon/icons-react/es/Maximize";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DonutStat } from "@crm/ui/components/dashboard-chart";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmount, formatDate } from "@/components/pancake/format";
import { CalendarGrid, todayIso } from "@/components/shop/calendar-week";
import { EmptyChart, EmptyRows } from "@/components/shop/empty-state";
import { HomeViewSelect } from "@/components/shop/home-controls";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import {
	type SearchValues,
	shopFilters,
	text,
	withParams,
} from "@/components/shop/params";
import { formatRange } from "@/components/shop/range";
import { RangeToggle, RefreshButton } from "@/components/shop/range-picker";
import { ReportCard } from "@/components/shop/report";
import { shopProfile } from "@/components/shop/shop-profile";

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
}: {
	label: string;
	value: React.ReactNode;
	emoji: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<span className="flex size-11 items-center justify-center rounded-lg bg-muted text-xl">
				{emoji}
			</span>
			<div className="flex flex-col">
				<span className="text-muted-foreground text-xs">{label}</span>
				<span className="font-semibold text-base tabular-nums">{value}</span>
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
	const view = text(values, "view") === "personal" ? "personal" : "manager";
	const taskView = text(values, "tasks") === "overdue" ? "overdue" : "open";
	const [overview, report, customers, tasks] = await Promise.all([
		ctx.api.overview.query(filter.input),
		ctx.api.report.query(filter.input),
		ctx.api.customers.query({ ...filter.input, pageSize: 1 }),
		ctx.api.tasks.query({ ...filter.input, taskView, pageSize: 8 }),
	]);
	const currency =
		report.revenue[0]?.currency ?? shopProfile(ctx.shopId).currency;
	const revenue = report.revenue.reduce(
		(sum, row) => sum + Number(row.amount),
		0,
	);
	const rate = report.orders
		? Math.round((100 * report.delivered) / report.orders)
		: 0;
	const other =
		report.orders - report.delivered - report.cancelled - report.returned;
	const name = ctx.session.user.name.split(" ").slice(-2).join(" ");
	const periodLabel =
		filter.from && filter.to ? formatRange(filter.from, filter.to) : "";

	return (
		<div className="flex min-h-full flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-5 py-3">
				<div>
					<h1 className="text-lg font-semibold tracking-tight">Tổng quan</h1>
					<p className="text-muted-foreground text-xs">
						Tổng quan nhanh số liệu và hoạt động trong CRM
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<RefreshButton />
					<HomeViewSelect value={view} />
					<RangeToggle quick={["today", "week", "month"]} defaultRange="30d" />
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
										value={formatAmount(String(revenue), currency)}
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
							<div className="font-semibold text-lg tabular-nums">
								{formatAmount(String(revenue), currency)}
							</div>
							<EmptyChart label="Chưa có chuỗi doanh thu theo ngày. Số tổng ở trên lấy từ đơn đã nhận / thu tiền." />
							{periodLabel ? (
								<div className="flex justify-center gap-6 text-muted-foreground text-xs">
									<span>— {periodLabel}</span>
								</div>
							) : null}
						</ReportCard>
						<ReportCard title="Mục tiêu doanh thu">
							<div className="rounded-md border-primary border-l-2 bg-muted px-4 py-6 text-muted-foreground text-xs">
								Chưa đặt mục tiêu cho shop này.
								<Button variant="link" size="sm" className="ml-1 px-0">
									Thiết lập mục tiêu
								</Button>
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
						<ReportCard title="Doanh thu theo nguồn">
							<EmptyChart />
						</ReportCard>
						<ReportCard title="Tổng số liên hệ theo nguồn">
							<EmptyChart />
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
											0
										</span>
										Ticket đang chờ
									</Badge>
								</div>
							</Greeting>
							<div className="grid gap-3 sm:grid-cols-2">
								{[
									{ label: "Tiềm năng mới", value: 0 },
									{ label: "Liên hệ mới", value: customers.total },
									{
										label: "Doanh thu",
										value: formatAmount(String(revenue), currency),
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
									</div>
								))}
							</div>
						</div>
						<ReportCard
							title="Danh sách nhiệm vụ"
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
											taskView === key
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
								{todayIso().split("-").reverse().join("/")}
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
							date={todayIso()}
							mode="week"
							today={todayIso()}
							compact
						/>
					</ReportCard>
				</div>
			)}
		</div>
	);
}
