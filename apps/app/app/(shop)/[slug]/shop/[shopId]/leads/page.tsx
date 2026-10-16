import Column from "@carbon/icons-react/es/Column";
import DataTable from "@carbon/icons-react/es/DataTable";
import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	COLLECTIONS,
	LEAD_STATUSES,
	SOURCE_OPTIONS,
} from "@/components/shop/collections";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	QuickViewChip,
	RangeChip,
	SortButton,
	StatsToggle,
	ViewSwitch,
} from "@/components/shop/filter-bar";
import { ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import { type SearchValues, text } from "@/components/shop/params";
import { CreateRecordButton } from "@/components/shop/record-sheet";

const TONE_BAR = new Map<string, string>([
	["blue", "border-b-[#1677ff]"],
	["orange", "border-b-[#fa8c16]"],
	["purple", "border-b-[#9254de]"],
	["green", "border-b-[#22c55e]"],
	["gray", "border-b-[#9ca3af]"],
]);

export default function LeadsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Leads {...props} />
		</Suspense>
	);
}

async function Leads({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const sellers = await ctx.api.sellers.query({ shopId: ctx.shopId });
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const collection = COLLECTIONS.lead;
	const view = text(values, "view") === "table" ? "table" : "pipeline";
	const stats = text(values, "stats") === "1";
	const listFields = collection.fields.filter((field) => field.list);
	const columns = listFields.map((field) => ({
		key: field.key,
		label: field.label,
	}));
	const stages = LEAD_STATUSES.filter(
		(status) => status.value !== "disqualified",
	);

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<>
						<Button variant="outline">
							<Icon icon={SettingsAdjust} data-icon="inline-start" />
							Tùy chỉnh
						</Button>
						<CreateRecordButton
							collection="lead"
							users={staff}
							menu={[
								{ label: "Nhập từ Excel" },
								{ label: "Nhập từ Pancake POS" },
							]}
						/>
					</>
				}
			/>
			<ShopPageBody>
				<FilterBar
					toolbar={
						<>
							<SortButton
								fields={columns.map((c) => ({ value: c.key, label: c.label }))}
							/>
							<FilterButton
								fields={collection.fields.map((f) => ({
									value: f.key,
									label: f.label,
								}))}
							/>
							<StatsToggle />
							<ViewSwitch
								options={[
									{
										value: "pipeline",
										label: "Pipeline",
										icon: <Icon icon={Column} />,
									},
									{
										value: "table",
										label: "Bảng",
										icon: <Icon icon={DataTable} />,
									},
								]}
							/>
							<MoreMenu />
						</>
					}
				>
					<QuickViewChip
						options={[
							{ value: "all", label: "Tất cả tiềm năng" },
							{ value: "mine-new", label: "Tiềm năng mới của tôi" },
							{ value: "mine-week", label: "Tiềm năng tuần này của tôi" },
						]}
						savedFilters="⚙ Bộ lọc đã lưu (0/10)"
					/>
					<FilterChip
						label="Phân công"
						param="assignee"
						multiple
						searchable
						options={[
							{ value: "none", label: "Chưa được phân công" },
							...staff,
						]}
					/>
					{view === "table" ? (
						<FilterChip
							label="Trạng thái"
							param="status"
							multiple
							options={LEAD_STATUSES}
						/>
					) : null}
					<RangeChip />
					<FilterChip
						label="Người tạo"
						param="creator"
						multiple
						searchable
						options={staff}
					/>
					<FilterChip
						label="Nguồn khách hàng"
						param="source"
						multiple
						options={SOURCE_OPTIONS}
					/>
				</FilterBar>

				{stats ? (
					<div className="grid gap-3 md:grid-cols-4">
						{[
							"Số Lead mới",
							"Số điện thoại mới",
							"Số lead đã chuyển đổi",
							"Tỷ lệ chuyển đổi",
						].map((label) => (
							<div
								key={label}
								className="flex flex-col gap-2 rounded-lg border p-4"
							>
								<span className="font-medium text-xs">{label}</span>
								<span className="text-muted-foreground text-xs">
									Chưa có dữ liệu để hiển thị
								</span>
							</div>
						))}
					</div>
				) : null}

				{view === "pipeline" ? (
					<div className="grid min-h-[480px] flex-1 gap-2 md:grid-cols-4">
						{stages.map((stage) => (
							<section key={stage.value} className="flex min-h-0 flex-col">
								<header
									className={`flex items-center justify-between border-b-[3px] bg-muted px-3 py-2 ${TONE_BAR.get(stage.color ?? "gray") ?? ""}`}
								>
									<span className="font-semibold text-sm">{stage.label}</span>
									<span className="text-muted-foreground text-xs">0</span>
								</header>
								<div className="flex-1 bg-muted/60" />
							</section>
						))}
					</div>
				) : (
					<>
						<ListTable columns={columns} rows={[]} />
						<ListFooter
							total={0}
							page={1}
							pageSize={25}
							unit="tiềm năng"
							pageHref={() => "#"}
						/>
					</>
				)}
			</ShopPageBody>
		</ShopPage>
	);
}
