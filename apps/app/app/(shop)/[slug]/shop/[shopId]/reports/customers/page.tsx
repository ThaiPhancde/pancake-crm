import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmount } from "@/components/pancake/format";
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
import {
	AGE_ROWS,
	GENDER_ROWS,
	PURCHASE_ROWS,
	REPORTS,
} from "@/components/shop/reports/config";
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

function shareText(value: number) {
	return `${value.toLocaleString("vi-VN")} %`;
}

function percentOf(part: number, total: number) {
	return total ? Number(((REPORTS.percentScale * part) / total).toFixed(1)) : 0;
}

async function Customers({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, "week", ctx.shop.timezone);
	const tab = text(values, "tab") === "leads" ? "leads" : "contacts";
	const period = {
		shopId: ctx.shopId,
		from: filter.input.from,
		to: filter.input.to,
	};
	const [audience, leads] = await Promise.all([
		ctx.api.customerReport.query(period),
		tab === "leads" ? ctx.api.leadReport.query(period) : undefined,
	]);
	const leadCount = (status: string) =>
		leads?.byStatus.find((row) => row.status === status)?.count ?? 0;
	const statusItems = (leads?.byStatus ?? []).map((row) => ({
		value: row.status,
		count: row.count,
	}));
	const page = `${ctx.base}/reports/customers`;
	const genders = GENDER_ROWS.map((row) => {
		const found = audience.gender.find((item) => item.gender === row.key);
		return {
			label: row.label,
			color: row.color,
			count: found?.count ?? 0,
			share: shareText(found?.share ?? 0),
		};
	});
	const ages = AGE_ROWS.map((row) => {
		const found = audience.age.find((item) => item.bucket === row.key);
		return {
			label: row.label,
			color: row.color,
			count: found?.count ?? 0,
			share: shareText(found?.share ?? 0),
		};
	});
	const purchases = PURCHASE_ROWS.map((row) => ({
		row,
		found: audience.purchases.find((item) => item.bucket === row.key),
	}));
	const revenueByCurrency = new Map<string, number>();
	for (const { found } of purchases)
		for (const amount of found?.revenue ?? [])
			revenueByCurrency.set(
				amount.currency,
				(revenueByCurrency.get(amount.currency) ?? 0) + Number(amount.amount),
			);
	const firstTime =
		audience.purchases.find((item) => item.bucket === "1")?.customers ?? 0;

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
									{ label: "Tổng số liên hệ", value: audience.totalCustomers },
									{ label: "LH đã mua hàng", value: audience.buyers },
									{ label: "LH mua 1 lần", value: firstTime },
									{
										label: "LH mua từ 2 lần",
										value: Math.max(0, audience.buyers - firstTime),
									},
								]
					}
				/>
			</ReportCard>
			<div className="grid gap-3 lg:grid-cols-2">
				<ReportCard
					title="Giới tính"
					description="Trên toàn bộ liên hệ của shop"
				>
					<Breakdown title="Giới tính" rows={genders} />
				</ReportCard>
				<ReportCard title="Độ tuổi" description="Trên toàn bộ liên hệ của shop">
					<Breakdown title="Độ tuổi" rows={ages} />
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
						rows={purchases.map(({ row, found }) => ({
							key: row.key,
							cells: [
								row.label,
								found?.customers ?? 0,
								shareText(found?.share ?? 0),
								found?.revenue.length
									? found.revenue
											.map((item) => formatAmount(item.amount, item.currency))
											.join(" · ")
									: "—",
								found?.revenue.length
									? found.revenue
											.map((item) =>
												shareText(
													percentOf(
														Number(item.amount),
														revenueByCurrency.get(item.currency) ?? 0,
													),
												),
											)
											.join(" · ")
									: shareText(0),
							],
						}))}
					/>
					<p className="text-muted-foreground text-xs">
						Số lần mua tính trên đơn không hủy của liên hệ trong khoảng thời
						gian. Doanh thu tách theo tiền tệ.
					</p>
				</ReportCard>
			)}
		</ReportPage>
	);
}
