import ShoppingCart from "@carbon/icons-react/es/ShoppingCart";
import { shopTimezone } from "@crm/pancake/config";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DonutStat } from "@crm/ui/components/dashboard-chart";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
} from "@/components/page-shell";
import {
	formatAmount,
	formatAmounts,
	formatDate,
} from "@/components/pancake/format";
import { EmptyChart } from "@/components/shop/empty-state";
import {
	orderStatusName,
	orderStatusTone,
} from "@/components/shop/order-status";
import {
	type SearchValues,
	shopFilters,
	withParams,
} from "@/components/shop/params";
import { formatRange } from "@/components/shop/range";
import { RangeToggle, RefreshButton } from "@/components/shop/range-picker";
import { ReportCard } from "@/components/shop/report";
import { shopInitial, shopProfile } from "@/components/shop/shop-profile";
import { ShopTrendChart } from "@/components/shop/shop-trend-chart";
import { initials } from "@/lib/initials";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";
import {
	OverviewGreeting,
	OverviewGreetingFallback,
} from "./overview-greeting";

export default function OverviewPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<Suspense fallback={<OverviewGreetingFallback />}>
						<OverviewGreeting />
					</Suspense>
				</PageShellHeading>
				<PageShellActions>
					<RefreshButton />
					<Suspense
						fallback={
							<div className="h-8 w-80 animate-pulse rounded-md bg-muted" />
						}
					>
						<RangeToggle
							quick={["today", "week", "month", "30d"]}
							defaultRange="30d"
							timeZone={shopTimezone()}
						/>
					</Suspense>
					<Button asChild size="sm">
						<Link href="/crm/shop">
							<Icon icon={ShoppingCart} />
							Chọn Shop Workspace
						</Link>
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<MultiShopDashboard params={params} searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function MultiShopDashboard({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<SearchValues>;
}) {
	const [, { slug }, values] = await Promise.all([
		requireSession(),
		params,
		searchParams,
	]);
	const api = getServerTrpcClient().pancake;
	const baseFilter = shopFilters(values, "all", "30d");
	const globalInput = { ...baseFilter.input, shopId: undefined };

	const [shops, overview, report] = await Promise.all([
		api.status.query(),
		api.overview.query(globalInput),
		api.report.query(globalInput),
	]);

	const perShopReports = await Promise.all(
		shops.map(async (shop) => {
			const shopInput = shopFilters(
				values,
				shop.id,
				"30d",
				shop.timezone,
			).input;
			const [shopOverview, shopReport] = await Promise.all([
				api.overview.query(shopInput),
				api.report.query(shopInput),
			]);
			return {
				shop,
				overview: shopOverview,
				report: shopReport,
			};
		}),
	);

	const totalRate = report.orders
		? Math.round((100 * report.delivered) / report.orders)
		: 0;
	const inProgress = Math.max(
		0,
		report.orders - report.delivered - report.cancelled - report.returned,
	);
	const periodLabel =
		baseFilter.from && baseFilter.to
			? formatRange(baseFilter.from, baseFilter.to)
			: "";

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-4 sm:col-span-2">
					<span className="text-muted-foreground text-xs">
						Doanh thu theo tiền tệ
					</span>
					{report.revenue.length === 0 ? (
						<span className="font-semibold text-2xl tabular-nums">0</span>
					) : (
						<div className="flex flex-col gap-1">
							{report.revenue.map((row) => (
								<div
									key={row.currency}
									className="flex flex-wrap items-baseline gap-x-3"
								>
									<span className="font-semibold text-2xl tabular-nums">
										{formatAmount(row.amount, row.currency)}
									</span>
									<span className="text-muted-foreground text-[11px] tabular-nums">
										Đã thu:{" "}
										{formatAmount(
											report.receivedRevenue.find(
												(item) => item.currency === row.currency,
											)?.amount ?? "0",
											row.currency,
										)}
									</span>
								</div>
							))}
						</div>
					)}
					<span className="text-muted-foreground text-[11px]">
						Không cộng gộp các loại tiền. Khoảng ngày theo giờ Việt Nam (GMT
						+7:00); thẻ từng shop dùng giờ địa phương của shop.
					</span>
				</div>
				{[
					{
						label: "Tổng đơn các shop",
						value: report.orders.toLocaleString("en-US"),
						sub: periodLabel || "Trong kỳ đã chọn",
					},
					{
						label: "Đơn thành công",
						value: report.delivered.toLocaleString("en-US"),
						sub: `Tỷ lệ giao: ${totalRate}%`,
					},
					{
						label: "Đang xử lý / chờ",
						value: overview.pending.toLocaleString("en-US"),
						sub: `${overview.unassigned} đơn chưa gán sale`,
					},
					{
						label: "Đang vận chuyển",
						value: overview.shipping.toLocaleString("en-US"),
						sub: "Đang giao trên toàn hệ thống",
					},
					{
						label: "Đơn hoàn",
						value: report.returned.toLocaleString("en-US"),
						sub: `${report.cancelled} đơn đã hủy`,
					},
					{
						label: "Nhiệm vụ quá hạn",
						value: overview.overdue.toLocaleString("en-US"),
						sub: `${shops.length} shop đang kết nối`,
					},
				].map((card) => (
					<div
						key={card.label}
						className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-4"
					>
						<span className="text-muted-foreground text-xs">{card.label}</span>
						<span className="font-semibold text-2xl tabular-nums">
							{card.value}
						</span>
						<span className="text-muted-foreground text-[11px]">
							{card.sub}
						</span>
					</div>
				))}
			</div>

			<div className="flex flex-col gap-3">
				<div>
					<h2 className="font-semibold text-base">
						Thông số riêng từng Shop Pancake ({shops.length})
					</h2>
					<p className="text-muted-foreground text-xs">
						Doanh thu và vận hành của mỗi thị trường theo đơn vị tiền tệ bản địa
					</p>
				</div>

				<div className="grid gap-4 lg:grid-cols-3">
					{perShopReports.map(
						({ shop, overview: sOverview, report: sReport }) => {
							const profile = shopProfile(shop.id);
							const rate = sReport.orders
								? ((100 * sReport.delivered) / sReport.orders).toFixed(1)
								: "0.0";
							return (
								<div
									key={shop.id}
									className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-2xs"
								>
									<div>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-center gap-3">
												<div className="flex size-10 items-center justify-center rounded-lg bg-[#e5533d] font-bold text-base text-white">
													{shopInitial(shop.name)}
												</div>
												<div>
													<div className="flex items-center gap-2">
														<Link
															href={withParams(
																`/${slug}/shop/${shop.id}`,
																values,
																{},
															)}
															className="font-semibold text-base hover:text-primary"
														>
															{shop.name}
														</Link>
														<Badge variant="secondary" className="text-[10px]">
															{shop.currency}
														</Badge>
													</div>
													<div className="text-muted-foreground text-xs">
														#{shop.id} · {profile.country} ({profile.timezone})
													</div>
												</div>
											</div>
											<Badge variant={shop.syncEnabled ? "green" : "orange"}>
												{shop.syncEnabled ? "Live" : "Tạm dừng"}
											</Badge>
										</div>

										<div className="mt-4 rounded-lg bg-muted/50 p-3.5">
											<div className="text-muted-foreground text-xs">
												Doanh thu ({shop.currency})
											</div>
											<div className="mt-1 font-bold text-xl tabular-nums">
												{formatAmounts(sReport.revenue, shop.currency)}
											</div>
											<div className="mt-1 text-muted-foreground text-[11px] tabular-nums">
												Đã thu:{" "}
												{formatAmounts(sReport.receivedRevenue, shop.currency)}
											</div>
											<div className="mt-1 text-muted-foreground text-[11px]">
												Tỷ lệ giao thành công: <strong>{rate}%</strong> (
												{sReport.delivered}/{sReport.orders} đơn)
											</div>
										</div>

										<div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
											<div className="rounded-md border p-2">
												<div className="text-muted-foreground text-[11px]">
													Chờ xử lý
												</div>
												<div className="mt-0.5 font-semibold tabular-nums">
													{sOverview.pending}
												</div>
											</div>
											<div className="rounded-md border p-2">
												<div className="text-muted-foreground text-[11px]">
													Đang giao
												</div>
												<div className="mt-0.5 font-semibold tabular-nums">
													{sOverview.shipping}
												</div>
											</div>
											<div className="rounded-md border p-2">
												<div className="text-muted-foreground text-[11px]">
													Hoàn / Hủy
												</div>
												<div className="mt-0.5 font-semibold tabular-nums">
													{sReport.returned + sReport.cancelled}
												</div>
											</div>
										</div>
									</div>

									<div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
										<span className="text-muted-foreground">
											Tổng kho dữ liệu:{" "}
											<strong>
												{shop.ordersCount.toLocaleString("en-US")}
											</strong>{" "}
											đơn ·{" "}
											<strong>
												{shop.customersCount.toLocaleString("en-US")}
											</strong>{" "}
											khách
										</span>
										<Button
											asChild
											variant="link"
											size="sm"
											className="h-auto p-0"
										>
											<Link
												href={withParams(
													`/${slug}/shop/${shop.id}`,
													values,
													{},
												)}
											>
												Vào shop →
											</Link>
										</Button>
									</div>
								</div>
							);
						},
					)}
				</div>
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<ReportCard title="Xu hướng số lượng đơn hàng tổng hợp theo ngày">
					{report.dailySeries.length > 0 ? (
						<ShopTrendChart
							height={220}
							data={report.dailySeries}
							xKey="date"
							config={{
								orders: {
									label: "Tổng đơn phát sinh",
									color: "var(--chart-1)",
								},
								delivered: {
									label: "Đơn đã nhận",
									color: "var(--chart-3)",
								},
							}}
						/>
					) : (
						<EmptyChart label="Không có đơn hàng phát sinh trong khoảng thời gian đã chọn." />
					)}
				</ReportCard>

				<ReportCard title="Tỷ trọng trạng thái đơn toàn hệ thống">
					{report.orders ? (
						<DonutStat
							height={200}
							centerValue={`${totalRate}%`}
							centerLabel="Thành công"
							data={[
								{
									key: "delivered",
									label: "Đã nhận / thu tiền",
									value: report.delivered,
									color: "var(--chart-3)",
								},
								{
									key: "inProgress",
									label: "Đang xử lý / giao",
									value: inProgress,
									color: "var(--chart-1)",
								},
								{
									key: "returned",
									label: "Đơn hoàn",
									value: report.returned,
									color: "var(--chart-2)",
								},
								{
									key: "cancelled",
									label: "Đã hủy",
									value: report.cancelled,
									color: "var(--muted-foreground)",
								},
							]}
						/>
					) : (
						<EmptyChart />
					)}
				</ReportCard>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<ReportCard title="Hiệu suất nhân viên bán hàng nổi bật (Pancake POS)">
					{report.performance.length === 0 ? (
						<EmptyChart label="Chưa có dữ liệu nhân viên trong khoảng thời gian này." />
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="border-b text-muted-foreground">
										<th className="pb-2 font-medium">Nhân viên</th>
										<th className="pb-2 font-medium">Shop</th>
										<th className="pb-2 text-right font-medium">Tổng đơn</th>
										<th className="pb-2 text-right font-medium">Thành công</th>
										<th className="pb-2 text-right font-medium">Doanh thu</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{[...report.performance]
										.sort((a, b) => b.delivered - a.delivered)
										.slice(0, 10)
										.map((row) => {
											const shopName =
												shops.find((s) => s.id === row.shopId)?.name ??
												row.shopId;
											return (
												<tr key={`${row.shopId}:${row.sellerId ?? "none"}`}>
													<td className="py-2.5">
														<div className="flex items-center gap-2">
															<Avatar size="xs">
																{row.sellerAvatarUrl ? (
																	<AvatarImage
																		src={row.sellerAvatarUrl}
																		alt={row.sellerName}
																	/>
																) : null}
																<AvatarFallback>
																	{initials(row.sellerName)}
																</AvatarFallback>
															</Avatar>
															<span className="font-medium">
																{row.sellerName}
															</span>
														</div>
													</td>
													<td className="py-2.5">{shopName}</td>
													<td className="py-2.5 text-right tabular-nums">
														{row.orders}
													</td>
													<td className="py-2.5 text-right tabular-nums">
														{row.delivered} ({row.deliveredRate})
													</td>
													<td className="py-2.5 text-right font-medium tabular-nums">
														{formatAmount(row.revenue, row.currency)}
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
					)}
				</ReportCard>

				<ReportCard title="Đơn hàng cập nhật mới nhất trên toàn hệ thống">
					{overview.recent.length === 0 ? (
						<EmptyChart label="Chưa có đơn hàng nào trong khoảng thời gian này." />
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="border-b text-muted-foreground">
										<th className="pb-2 font-medium">Mã đơn</th>
										<th className="pb-2 font-medium">Khách hàng</th>
										<th className="pb-2 font-medium">Trạng thái</th>
										<th className="pb-2 text-right font-medium">Giá trị</th>
										<th className="pb-2 text-right font-medium">Cập nhật</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{overview.recent.slice(0, 10).map((ord) => {
										const shopName =
											shops.find((s) => s.id === ord.shopId)?.name ??
											ord.shopId;
										return (
											<tr key={`${ord.shopId}:${ord.orderId}`}>
												<td className="py-2.5">
													<Link
														href={`/${slug}/shop/${ord.shopId}/orders?orderId=${ord.orderId}`}
														className="font-medium text-primary hover:underline"
													>
														#{ord.orderId}
													</Link>
													<div className="text-[10px] text-muted-foreground">
														{shopName}
													</div>
												</td>
												<td className="py-2.5">
													<div className="font-medium">{ord.customerName}</div>
													<div className="text-[10px] text-muted-foreground">
														{ord.customerPhone ?? "—"}
													</div>
												</td>
												<td className="py-2.5">
													<Badge variant={orderStatusTone(ord.status)}>
														{orderStatusName(ord.status)}
													</Badge>
												</td>
												<td className="py-2.5 text-right font-medium tabular-nums">
													{formatAmount(ord.totalPrice, ord.currency)}
												</td>
												<td className="py-2.5 text-right text-muted-foreground tabular-nums">
													{formatDate(ord.sourceUpdatedAt)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</ReportCard>
			</div>
		</div>
	);
}
