import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import {
	MetricRow,
	ReportCard,
	ReportEmpty,
	ReportPage,
} from "@/components/shop/report";

export default function TicketsReportPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Tickets params={params} />
		</Suspense>
	);
}

async function Tickets({ params }: { params: Promise<ShopRoute> }) {
	await loadShop(params);
	return (
		<ReportPage title="Báo cáo khiếu nại">
			<ReportCard title="Báo cáo khiếu nại">
				<MetricRow
					metrics={[
						{ label: "Tổng số khiếu nại", value: 0 },
						{ label: "Khiếu nại đang mở", value: 0 },
						{ label: "Khiếu nại quá hạn", value: 0 },
						{ label: "Thời gian phản hồi trung bình", value: "--" },
						{ label: "Tỷ lệ hoàn thành đúng hạn", value: "0%" },
						{ label: "Khiếu nại hoàn thành", value: 0 },
					]}
				/>
			</ReportCard>
			<ReportCard title="Thống kê theo trạng thái">
				<ReportEmpty />
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard title="Nguồn khiếu nại">
					<ReportEmpty />
				</ReportCard>
				<ReportCard title="Mức độ ưu tiên">
					<ReportEmpty />
				</ReportCard>
			</div>
			<ReportCard
				title="Xu hướng khiếu nại theo tháng"
				description="Hover để xem chi tiết"
			>
				<ReportEmpty />
			</ReportCard>
		</ReportPage>
	);
}
