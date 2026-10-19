import { Badge } from "@crm/ui/components/badge";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatDate } from "@/components/pancake/format";
import { TaskToggle } from "@/components/pancake/task-actions";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, shopFilters } from "@/components/shop/params";
import {
	MetricRow,
	ReportCard,
	ReportEmpty,
	ReportPage,
} from "@/components/shop/report";
import { REPORTS } from "@/components/shop/reports/config";
import { ShopTrendChart } from "@/components/shop/shop-trend-chart";

export default function TasksReportPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Tasks {...props} />
		</Suspense>
	);
}

async function Tasks({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "week", ctx.shop.timezone);
	const [all, summary] = await Promise.all([
		ctx.api.tasks.query({ ...filter.input, taskView: "all" }),
		ctx.api.taskReport.query({
			shopId: ctx.shopId,
			from: filter.input.from,
			to: filter.input.to,
		}),
	]);
	const doneRate = summary.created
		? Math.round((REPORTS.percentScale * summary.done) / summary.created)
		: 0;
	const hasTrend = summary.days.some(
		(day) => day.created || day.done || day.overdue,
	);

	return (
		<ReportPage title="Báo cáo nhiệm vụ" timeZone={filter.timeZone}>
			<ReportCard title="Tổng quan">
				<MetricRow
					metrics={[
						{ label: "Nhiệm vụ tạo mới", value: summary.created },
						{ label: "Nhiệm vụ hoàn thành", value: summary.done },
						{ label: "Nhiệm vụ quá hạn", value: summary.overdue },
						{ label: "Tỷ lệ hoàn thành", value: `${doneRate}%` },
					]}
				/>
			</ReportCard>
			<ReportCard
				title="Xu hướng nhiệm vụ theo thời gian"
				description={
					summary.truncated
						? `Chỉ tính ${summary.limit.toLocaleString("vi-VN")} nhiệm vụ mới nhất trong khoảng thời gian này`
						: "Di chuột lên biểu đồ để xem chi tiết"
				}
			>
				{hasTrend ? (
					<ShopTrendChart
						height={REPORTS.trendHeight}
						data={summary.days}
						xKey="date"
						config={{
							overdue: { label: "Quá hạn", color: "var(--chart-2)" },
							done: { label: "Hoàn thành", color: "var(--chart-3)" },
							created: { label: "Tạo mới", color: "var(--chart-1)" },
						}}
					/>
				) : (
					<ReportEmpty label="Không có nhiệm vụ trong khoảng thời gian này." />
				)}
			</ReportCard>
			<ReportCard title="Danh sách nhiệm vụ">
				<ListTable
					selectable={false}
					columns={[
						{ key: "title", label: "Nhiệm vụ" },
						{ key: "order", label: "Đơn hàng" },
						{ key: "assignee", label: "Người phụ trách" },
						{ key: "due", label: "Hạn xử lý" },
						{ key: "status", label: "Trạng thái" },
						{ key: "action", label: "Thao tác" },
					]}
					rows={all.rows.map((task) => ({
						key: task.id,
						cells: [
							<span key="title">
								{task.title}
								{task.note ? (
									<span className="block text-muted-foreground">
										{task.note}
									</span>
								) : null}
							</span>,
							<Link
								key="order"
								href={`${ctx.base}/orders?orderId=${task.orderId}`}
								className="text-primary hover:underline"
							>
								#{task.orderId} · {task.order.customerName}
							</Link>,
							task.assignee.name,
							formatDate(task.dueAt),
							<Badge
								key="status"
								variant={
									task.status === "DONE"
										? "green"
										: task.overdue
											? "red"
											: "blue"
								}
							>
								{task.status === "DONE"
									? "Hoàn tất"
									: task.overdue
										? "Quá hạn"
										: "Đang mở"}
							</Badge>,
							task.canUpdate ? (
								<TaskToggle
									key="toggle"
									id={task.id}
									updatedAt={task.updatedAt}
									done={task.status === "DONE"}
								/>
							) : (
								"—"
							),
						],
					}))}
				/>
			</ReportCard>
		</ReportPage>
	);
}
