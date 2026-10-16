import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import {
	MetricRow,
	ReportCard,
	ReportEmpty,
	ReportPage,
} from "@/components/shop/report";

export default function AppointmentsReportPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Appointments params={params} />
		</Suspense>
	);
}

async function Appointments({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	const sellers = await ctx.api.sellers.query({ shopId: ctx.shopId });
	return (
		<ReportPage title="Báo cáo lịch hẹn">
			<ReportCard title="Báo cáo lịch hẹn">
				<MetricRow
					metrics={[
						{ label: "Tổng số lịch hẹn", value: 0 },
						{ label: "Lịch hẹn hoàn thành", value: 0 },
						{ label: "Tỷ lệ hoàn thành", value: "0%" },
						{ label: "Lịch hẹn bị hủy", value: 0 },
					]}
				/>
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard title="Lịch hẹn theo nguồn">
					<ReportEmpty />
				</ReportCard>
				<ReportCard title="Lịch hẹn theo trạng thái">
					<ReportEmpty />
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
					rows={sellers.map((seller) => ({
						key: seller.employeeId,
						cells: [seller.name, "Telesale", 0, 0, 0, "0%"],
					}))}
				/>
			</ReportCard>
		</ReportPage>
	);
}
