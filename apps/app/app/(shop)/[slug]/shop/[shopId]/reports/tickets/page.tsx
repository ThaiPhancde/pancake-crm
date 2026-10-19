import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	SOURCE_OPTIONS,
	TICKET_PRIORITIES,
	TICKET_STATUSES,
} from "@/components/shop/collections";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, shopFilters } from "@/components/shop/params";
import {
	HorizontalBars,
	MetricRow,
	ReportCard,
	ReportEmpty,
	ReportPage,
} from "@/components/shop/report";
import { countBars } from "@/components/shop/report-bars";
import { ShopTrendChart } from "@/components/shop/shop-trend-chart";

export default function TicketsReportPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Tickets {...props} />
		</Suspense>
	);
}

async function Tickets({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "week");
	const report = await ctx.api.ticketReport.query({
		shopId: ctx.shopId,
		from: filter.input.from,
		to: filter.input.to,
	});
	return (
		<ReportPage title="Báo cáo khiếu nại" timeZone={filter.timeZone}>
			<ReportCard title="Báo cáo khiếu nại">
				<MetricRow
					metrics={[
						{ label: "Tổng số khiếu nại", value: report.total },
						{ label: "Khiếu nại đang mở", value: report.open },
						{ label: "Khiếu nại quá hạn", value: report.overdue },
						{ label: "Thời gian phản hồi trung bình", value: "--" },
						{
							label: "Tỷ lệ hoàn thành đúng hạn",
							value: `${report.onTimeRate}%`,
						},
						{ label: "Khiếu nại hoàn thành", value: report.completed },
					]}
				/>
			</ReportCard>
			<ReportCard title="Thống kê theo trạng thái">
				<HorizontalBars
					items={countBars(
						report.byStatus.map((row) => ({
							value: row.status,
							count: row.count,
						})),
						TICKET_STATUSES,
						"Chưa có trạng thái",
					)}
				/>
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard title="Nguồn khiếu nại">
					<HorizontalBars
						items={countBars(
							report.bySource.map((row) => ({
								value: row.source,
								count: row.count,
							})),
							SOURCE_OPTIONS,
							"Chưa có nguồn",
						)}
					/>
				</ReportCard>
				<ReportCard title="Mức độ ưu tiên">
					<HorizontalBars
						items={countBars(
							report.byPriority.map((row) => ({
								value: row.priority,
								count: row.count,
							})),
							TICKET_PRIORITIES,
							"Chưa có mức ưu tiên",
						)}
					/>
				</ReportCard>
			</div>
			<ReportCard
				title="Xu hướng khiếu nại theo tháng"
				description="Hover để xem chi tiết"
			>
				{report.monthly.length ? (
					<ShopTrendChart
						data={report.monthly}
						xKey="month"
						config={{
							total: { label: "Khiếu nại", color: "var(--chart-1)" },
							completed: { label: "Hoàn thành", color: "var(--chart-3)" },
						}}
					/>
				) : (
					<ReportEmpty />
				)}
			</ReportCard>
		</ReportPage>
	);
}
