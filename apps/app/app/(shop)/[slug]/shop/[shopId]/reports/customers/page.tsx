import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { LEAD_STATUSES } from "@/components/shop/collections";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import {
	type SearchValues,
	shopFilters,
	text,
	withParams,
} from "@/components/shop/params";
import {
	Breakdown,
	HorizontalBars,
	MetricRow,
	ReportCard,
	ReportEmpty,
	ReportPage,
} from "@/components/shop/report";
import { countBars } from "@/components/shop/report-bars";
import { SettingsTabs } from "@/components/shop/settings-frame";

export default function CustomersReportPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Customers {...props} />
		</Suspense>
	);
}

const AGES = [
	"Dưới 18 tuổi",
	"Từ 18 đến 24 tuổi",
	"Từ 25 đến 34 tuổi",
	"Từ 35 đến 44 tuổi",
	"Từ 45 đến 54 tuổi",
	"Trên 55 tuổi",
];

async function Customers({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "week");
	const tab = text(values, "tab") === "leads" ? "leads" : "contacts";
	const [customers, leads] = await Promise.all([
		ctx.api.customers.query({
			...filter.input,
			pageSize: 1,
		}),
		tab === "leads"
			? ctx.api.leadReport.query({
					shopId: ctx.shopId,
					from: filter.input.from,
					to: filter.input.to,
				})
			: undefined,
	]);
	const leadCount = (status: string) =>
		leads?.byStatus.find((row) => row.status === status)?.count ?? 0;
	const statusItems = (leads?.byStatus ?? []).map((row) => ({
		value: row.status,
		count: row.count,
	}));
	const page = `${ctx.base}/reports/customers`;

	return (
		<ReportPage title="Báo cáo khách hàng" timeZone={filter.timeZone}>
			<div className="rounded-lg bg-card px-5 py-2">
				<SettingsTabs
					tabs={[
						{ value: "leads", label: "Tiềm năng" },
						{ value: "contacts", label: "Liên hệ" },
					]}
					current={tab}
					href={(value) =>
						withParams(page, values, { tab: value === "contacts" ? "" : value })
					}
				/>
			</div>
			<ReportCard
				title={tab === "leads" ? "Tổng quan tiềm năng" : "Tổng quan liên hệ"}
			>
				<MetricRow
					metrics={
						tab === "leads"
							? [
									{ label: "Số tiềm năng", value: leads?.total ?? 0 },
									{ label: "SL đang chăm sóc", value: leadCount("nurturing") },
									{ label: "SL đã chuyển đổi", value: leadCount("converted") },
									{
										label: "SL không tiềm năng",
										value: leadCount("disqualified"),
									},
								]
							: [
									{ label: "Số liên hệ", value: customers.total },
									{ label: "LH có tương tác", value: "—" },
									{ label: "LH lần đầu mua", value: "—" },
									{ label: "LH mua lại", value: "—" },
								]
					}
				/>
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard title="Giới tính">
					<Breakdown
						title="Giới tính"
						rows={[
							{ label: "Nam", color: "#1d4ed8", count: 0, share: "0 %" },
							{ label: "Nữ", color: "#ef4444", count: 0, share: "0 %" },
							{
								label: "Chưa có thông tin",
								color: "#9ca3af",
								count: tab === "contacts" ? customers.total : 0,
								share: tab === "contacts" && customers.total ? "100 %" : "0 %",
							},
						]}
					/>
				</ReportCard>
				<ReportCard title="Độ tuổi">
					<div className="h-2 rounded-full bg-muted" />
					<ul className="flex flex-col gap-2 text-xs">
						{AGES.map((age) => (
							<li key={age} className="flex items-center justify-between">
								<span>{age}</span>
								<span className="text-success tabular-nums">0</span>
							</li>
						))}
					</ul>
				</ReportCard>
			</div>
			{tab === "leads" ? (
				<div className="grid gap-3 lg:grid-cols-2">
					<ReportCard title="Phễu chuyển đổi tiềm năng">
						{leads?.total ? (
							<HorizontalBars
								items={LEAD_STATUSES.filter(
									(status) => status.value !== "disqualified",
								).map((status) => ({
									label: status.label,
									value: leadCount(status.value),
									display: leadCount(status.value).toLocaleString("vi-VN"),
								}))}
							/>
						) : (
							<ReportEmpty />
						)}
					</ReportCard>
					<ReportCard title="Thống kê theo trạng thái tiềm năng">
						<HorizontalBars
							items={countBars(
								statusItems,
								LEAD_STATUSES,
								"Chưa có trạng thái",
							)}
						/>
					</ReportCard>
				</div>
			) : (
				<ReportCard title="Phân tích khách đã mua hàng">
					<ListTable
						selectable={false}
						columns={[
							{ key: "times", label: "Số lần mua" },
							{
								key: "customers",
								label: "Số khách hàng",
								className: "text-right",
							},
							{ key: "share", label: "Tỷ lệ KH", className: "text-right" },
							{ key: "revenue", label: "Doanh thu", className: "text-right" },
							{ key: "revenueShare", label: "Tỷ lệ", className: "text-right" },
						]}
						rows={["1", "2", "3", "4", "> 4"].map((times) => ({
							key: times,
							cells: [times, 0, "0 %", "—", "0 %"],
						}))}
					/>
					<p className="text-muted-foreground text-xs">
						Phân tích số lần mua cần backend gộp đơn theo số điện thoại.
					</p>
				</ReportCard>
			)}
		</ReportPage>
	);
}
