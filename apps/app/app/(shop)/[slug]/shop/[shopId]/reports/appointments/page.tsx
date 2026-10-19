import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	APPOINTMENT_STATUSES,
	SOURCE_OPTIONS,
} from "@/components/shop/collections";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, shopFilters } from "@/components/shop/params";
import {
	HorizontalBars,
	MetricRow,
	ReportCard,
	ReportPage,
} from "@/components/shop/report";
import { countBars } from "@/components/shop/report-bars";

export default function AppointmentsReportPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Appointments {...props} />
		</Suspense>
	);
}

async function Appointments({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "week");
	const [sellers, report] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.appointmentReport.query({
			shopId: ctx.shopId,
			from: filter.input.from,
			to: filter.input.to,
		}),
	]);
	const byAssignee = new Map(
		report.byAssignee.map((row) => [row.assigneeId ?? "", row]),
	);
	const staffRows = [
		...sellers.map((seller) => ({
			key: seller.employeeId,
			name: seller.name,
			stats: byAssignee.get(seller.employeeId),
		})),
		...report.byAssignee
			.filter(
				(row) =>
					!sellers.some((seller) => seller.employeeId === row.assigneeId),
			)
			.map((row) => ({
				key: row.assigneeId ?? "none",
				name: row.assigneeId ?? "Chưa phân công",
				stats: row,
			})),
	];
	return (
		<ReportPage title="Báo cáo lịch hẹn" timeZone={filter.timeZone}>
			<ReportCard title="Báo cáo lịch hẹn">
				<MetricRow
					metrics={[
						{ label: "Tổng số lịch hẹn", value: report.total },
						{ label: "Lịch hẹn hoàn thành", value: report.completed },
						{ label: "Tỷ lệ hoàn thành", value: `${report.completionRate}%` },
						{ label: "Lịch hẹn bị hủy", value: report.cancelled },
					]}
				/>
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard title="Lịch hẹn theo nguồn">
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
				<ReportCard title="Lịch hẹn theo trạng thái">
					<HorizontalBars
						items={countBars(
							report.byStatus.map((row) => ({
								value: row.status,
								count: row.count,
							})),
							APPOINTMENT_STATUSES,
							"Chưa có trạng thái",
						)}
					/>
				</ReportCard>
			</div>
			<ReportCard title="Báo cáo lịch hẹn theo nhân viên">
				<ListTable
					selectable={false}
					columns={[
						{ key: "name", label: "Nhân viên" },
						{ key: "department", label: "Bộ phận" },
						{ key: "assigned", label: "Được giao ↕" },
						{ key: "done", label: "Hoàn thành ↕" },
						{ key: "cancelled", label: "Đã hủy ↕" },
						{ key: "rate", label: "Tỷ lệ hoàn thành ↕" },
					]}
					rows={staffRows.map((row) => ({
						key: row.key,
						cells: [
							row.name,
							"Telesale",
							row.stats?.assigned ?? 0,
							row.stats?.completed ?? 0,
							row.stats?.cancelled ?? 0,
							`${row.stats?.completionRate ?? 0}%`,
						],
					}))}
				/>
			</ReportCard>
		</ReportPage>
	);
}
