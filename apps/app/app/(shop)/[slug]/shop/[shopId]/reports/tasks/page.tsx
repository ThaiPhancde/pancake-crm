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
	const filter = shopFilters(values, ctx.shopId, "week");
	const [all, done] = await Promise.all([
		ctx.api.tasks.query({ ...filter.input, taskView: "all", pageSize: 25 }),
		ctx.api.tasks.query({ ...filter.input, taskView: "done", pageSize: 1 }),
	]);
	const onTime = all.total ? Math.round((100 * done.total) / all.total) : 0;

	return (
		<ReportPage title="Báo cáo nhiệm vụ">
			<ReportCard title="Tổng quan">
				<MetricRow
					metrics={[
						{ label: "Tổng số nhiệm vụ", value: all.total },
						{ label: "Nhiệm vụ hoàn thành", value: done.total },
						{ label: "Nhiệm vụ quá hạn", value: all.overdue },
						{ label: "Tỷ lệ hoàn thành đúng hạn", value: `${onTime}%` },
					]}
				/>
			</ReportCard>
			<ReportCard
				title="Xu hướng nhiệm vụ theo thời gian"
				description="Hover để xem chi tiết"
			>
				<ReportEmpty label="Chưa có chuỗi nhiệm vụ theo ngày." />
				<div className="flex justify-center gap-4 text-muted-foreground text-xs">
					<span>● Quá hạn</span>
					<span className="text-success">● Hoàn thành</span>
					<span className="text-primary">● Tạo mới</span>
				</div>
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard title="Danh mục">
					<ReportEmpty />
				</ReportCard>
				<ReportCard title="Mức độ ưu tiên">
					<ReportEmpty />
				</ReportCard>
			</div>
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
