import Download from "@carbon/icons-react/es/Download";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmount } from "@/components/pancake/format";
import { EmptyChart } from "@/components/shop/empty-state";
import { FilterChip } from "@/components/shop/filter-bar";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, shopFilters } from "@/components/shop/params";
import { formatRange } from "@/components/shop/range";
import { MetricRow, ReportCard, ReportPage } from "@/components/shop/report";
import { shopProfile } from "@/components/shop/shop-profile";

export default function BusinessReportPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Business {...props} />
		</Suspense>
	);
}

async function Business({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "week");
	const [report, sellers] = await Promise.all([
		ctx.api.report.query(filter.input),
		ctx.api.sellers.query({ shopId: ctx.shopId }),
	]);
	const currency =
		report.revenue[0]?.currency ?? shopProfile(ctx.shopId).currency;
	const revenue = report.revenue.reduce(
		(sum, row) => sum + Number(row.amount),
		0,
	);
	const closed = report.orders - report.cancelled;
	const average = report.delivered ? revenue / report.delivered : 0;
	const money = (value: number) => formatAmount(String(value), currency);
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));

	return (
		<ReportPage title="Báo cáo kinh doanh">
			<ReportCard title="Tổng quan">
				<MetricRow
					metrics={[
						{ label: "Doanh thu", value: money(revenue) },
						{ label: "Số đơn chốt", value: closed },
						{ label: "Giá trị trung bình đơn", value: money(average) },
						{ label: "Lợi nhuận", value: "—" },
						{ label: "Lợi nhuận TB", value: "—" },
						{ label: "SL Sản phẩm", value: "—" },
					]}
				/>
			</ReportCard>
			<ReportCard
				action={
					<Button variant="outline" size="sm">
						Ngày ▾
					</Button>
				}
			>
				<EmptyChart label="Chưa có chuỗi doanh thu theo ngày." />
				{filter.from && filter.to ? (
					<p className="text-center text-muted-foreground text-xs">
						— {formatRange(filter.from, filter.to)}
					</p>
				) : null}
			</ReportCard>
			<ReportCard
				title="Thống kê đơn hàng"
				action={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" disabled>
							<Icon icon={Download} data-icon="inline-start" />
							Xuất excel
						</Button>
						<FilterChip
							label="Nhân viên"
							param="sellerId"
							searchable
							options={staff}
						/>
					</div>
				}
			>
				<ListTable
					selectable={false}
					columns={[
						{ key: "seller", label: "Nhân viên" },
						{ key: "created", label: "SL Đơn tạo mới" },
						{ key: "closed", label: "SL Đơn chốt" },
						{ key: "delivered", label: "SL Đơn Thành công" },
						{ key: "new", label: "SL đơn từ khách hàng mới" },
						{ key: "old", label: "SL đơn từ khách cũ" },
						{ key: "rate", label: "Tỷ lệ chốt" },
						{ key: "revenue", label: "Doanh thu" },
					]}
					rows={report.performance.map((row) => ({
						key: `${row.sellerId}:${row.currency}`,
						cells: [
							row.sellerName,
							row.orders,
							row.orders - row.cancelled,
							row.delivered,
							"—",
							"—",
							row.deliveredRate,
							formatAmount(row.revenue, row.currency),
						],
					}))}
				/>
				<p className="text-muted-foreground text-xs">
					Theo ngày tạo đơn và trạng thái hiện tại. Doanh thu lấy từ đơn đã nhận
					/ thu tiền, chưa trừ phí, thuế và tiền hoàn một phần.
				</p>
			</ReportCard>
		</ReportPage>
	);
}
