import Download from "@carbon/icons-react/es/Download";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmount, formatAmounts } from "@/components/pancake/format";
import { EmptyChart } from "@/components/shop/empty-state";
import { FilterChip } from "@/components/shop/filter-bar";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, shopFilters } from "@/components/shop/params";
import { formatRange } from "@/components/shop/range";
import { MetricRow, ReportCard, ReportPage } from "@/components/shop/report";
import { shopProfile } from "@/components/shop/shop-profile";
import { ShopTrendChart } from "@/components/shop/shop-trend-chart";
import { initials } from "@/lib/initials";

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
	const shopCurrency = shopProfile(ctx.shopId).currency;
	const currency = report.seriesCurrency;
	const closed = report.orders - report.cancelled;
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));

	return (
		<ReportPage title="Báo cáo kinh doanh" timeZone={filter.timeZone}>
			<ReportCard title="Tổng quan">
				<MetricRow
					metrics={[
						{
							label: "Doanh thu",
							value: formatAmounts(report.revenue, shopCurrency),
						},
						{
							label: "Đã thu",
							value: formatAmounts(report.receivedRevenue, currency),
						},
						{ label: "Số đơn chốt", value: closed },
						{
							label: "Giá trị trung bình đơn",
							value: formatAmounts(report.averageOrderValue, shopCurrency),
						},
						{ label: "Đơn thành công", value: report.delivered },
						{ label: "Đơn hoàn", value: report.returned },
						{ label: "Đơn đã hủy", value: report.cancelled },
					]}
				/>
			</ReportCard>
			<ReportCard
				title="Biểu đồ doanh thu theo ngày"
				action={
					<Button variant="outline" size="sm">
						Ngày ▾
					</Button>
				}
			>
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
					<EmptyChart label="Không có dữ liệu doanh thu trong khoảng thời gian này." />
				)}
				{filter.from && filter.to ? (
					<p className="text-center text-muted-foreground text-xs">
						— {formatRange(filter.from, filter.to)}
					</p>
				) : null}
			</ReportCard>
			<ReportCard
				title="Thống kê đơn hàng theo nhân viên"
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
						{ key: "returned", label: "SL Đơn hoàn" },
						{ key: "cancelled", label: "SL Đơn hủy" },
						{ key: "rate", label: "Tỷ lệ chốt" },
						{ key: "revenue", label: "Doanh thu" },
					]}
					rows={report.performance.map((row) => ({
						key: `${row.sellerId}:${row.currency}`,
						cells: [
							<span key="seller" className="flex items-center gap-2">
								<Avatar size="xs">
									{row.sellerAvatarUrl ? (
										<AvatarImage
											src={row.sellerAvatarUrl}
											alt={row.sellerName}
										/>
									) : null}
									<AvatarFallback>{initials(row.sellerName)}</AvatarFallback>
								</Avatar>
								<span className="font-medium">{row.sellerName}</span>
							</span>,
							row.orders,
							row.orders - row.cancelled,
							row.delivered,
							row.returned,
							row.cancelled,
							row.deliveredRate,
							formatAmount(row.revenue, row.currency),
						],
					}))}
				/>
				<p className="text-muted-foreground text-xs">
					Theo ngày tạo đơn và trạng thái hiện tại. Doanh thu tính trên mọi đơn
					trừ đơn hủy, xóa và hoàn; đã thu chỉ gồm đơn đã nhận / thu tiền. Chưa
					trừ phí và thuế.
				</p>
			</ReportCard>
		</ReportPage>
	);
}
