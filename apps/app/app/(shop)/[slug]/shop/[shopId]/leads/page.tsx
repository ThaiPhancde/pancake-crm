import Column from "@carbon/icons-react/es/Column";
import DataTable from "@carbon/icons-react/es/DataTable";
import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatDate } from "@/components/pancake/format";
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
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { CreateRecordButton } from "@/components/shop/record-sheet";
import { initials } from "@/lib/initials";

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
	const pageNum = Math.max(1, Number(text(values, "page") || "1"));
	const [sellers, leads] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.leads.query({
			shopId: ctx.shopId,
			q: text(values, "q"),
			status: text(values, "status") || undefined,
			assigneeId: text(values, "assignee") || undefined,
			page: pageNum,
			pageSize: 25,
		}),
	]);
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const sellerMap = new Map(sellers.map((s) => [s.employeeId, s]));
	const collection = COLLECTIONS.lead;
	const view = text(values, "view") === "table" ? "table" : "pipeline";
	const stats = text(values, "stats") === "1";
	const listFields = collection.fields.filter(
		(field) => field.list && !field.hidden,
	);
	const columns = listFields.map((field) => ({
		key: field.key,
		label: field.label,
	}));
	const stages = LEAD_STATUSES.filter(
		(status) => status.value !== "disqualified",
	);
	const convertedCount = leads.rows.filter(
		(l) => l.status === "converted",
	).length;
	const phonesCount = leads.rows.filter((l) => Boolean(l.phone)).length;

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<>
						<Button asChild variant="outline">
							<Link href={`${ctx.base}/settings/tools/fields/lead`}>
								<Icon icon={SettingsAdjust} data-icon="inline-start" />
								Giao diện
							</Link>
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
								fields={collection.fields
									.filter((f) => !f.hidden)
									.map((f) => ({
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
							{ label: "Số Lead mới", value: leads.total },
							{ label: "Số điện thoại mới", value: phonesCount },
							{ label: "Số lead đã chuyển đổi", value: convertedCount },
							{
								label: "Tỷ lệ chuyển đổi",
								value: leads.total
									? `${Math.round((100 * convertedCount) / leads.total)}%`
									: "0%",
							},
						].map((card) => (
							<div
								key={card.label}
								className="flex flex-col gap-2 rounded-lg border p-4"
							>
								<span className="font-medium text-xs">{card.label}</span>
								<span className="font-semibold text-xl tabular-nums">
									{card.value}
								</span>
							</div>
						))}
					</div>
				) : null}

				{view === "pipeline" ? (
					<div className="grid min-h-[480px] flex-1 gap-2 md:grid-cols-4">
						{stages.map((stage) => {
							const stageItems = leads.rows.filter(
								(item) => item.status === stage.value,
							);
							return (
								<section key={stage.value} className="flex min-h-0 flex-col">
									<header
										className={`flex items-center justify-between border-b-[3px] bg-muted px-3 py-2 ${TONE_BAR.get(stage.color ?? "gray") ?? ""}`}
									>
										<span className="font-semibold text-sm">{stage.label}</span>
										<span className="text-muted-foreground text-xs">
											{stageItems.length}
										</span>
									</header>
									<div className="flex flex-1 flex-col gap-2 bg-muted/60 p-2">
										{stageItems.map((lead) => {
											const assignee = lead.assigneeId
												? sellerMap.get(lead.assigneeId)
												: undefined;
											return (
												<div
													key={lead.id}
													className="rounded-lg border bg-card p-3 shadow-2xs"
												>
													<div className="font-semibold text-sm">
														{lead.name}
													</div>
													<div className="mt-1 text-muted-foreground text-xs">
														{lead.phone ?? lead.email ?? "Chưa có SĐT"}
													</div>
													<div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
														<span>{formatDate(lead.createdAt)}</span>
														{assignee ? (
															<span className="flex items-center gap-1">
																<Avatar size="xs">
																	{assignee.avatarUrl ? (
																		<AvatarImage
																			src={assignee.avatarUrl}
																			alt={assignee.name}
																		/>
																	) : null}
																	<AvatarFallback>
																		{initials(assignee.name)}
																	</AvatarFallback>
																</Avatar>
																{assignee.name}
															</span>
														) : null}
													</div>
												</div>
											);
										})}
									</div>
								</section>
							);
						})}
					</div>
				) : (
					<>
						<ListTable
							columns={columns}
							rows={leads.rows.map((lead) => {
								const assignee = lead.assigneeId
									? sellerMap.get(lead.assigneeId)
									: undefined;
								const statusOpt = LEAD_STATUSES.find(
									(s) => s.value === lead.status,
								);
								return {
									key: lead.id,
									cells: [
										lead.name,
										lead.phone ?? <Dash />,
										lead.email ?? <Dash />,
										assignee ? (
											<span
												key="assignee"
												className="inline-flex items-center gap-1.5"
											>
												<Avatar size="xs">
													{assignee.avatarUrl ? (
														<AvatarImage
															src={assignee.avatarUrl}
															alt={assignee.name}
														/>
													) : null}
													<AvatarFallback>
														{initials(assignee.name)}
													</AvatarFallback>
												</Avatar>
												<span>{assignee.name}</span>
											</span>
										) : (
											<Dash key="assignee-none" />
										),
										<Dash key="bday" />,
										lead.source ? (
											<span key="source">{lead.source}</span>
										) : (
											<Dash key="source-none" />
										),
										<Badge key="status" variant="blue">
											{statusOpt?.label ?? lead.status}
										</Badge>,
									],
								};
							})}
						/>
						<ListFooter
							total={leads.total}
							page={pageNum}
							pageSize={25}
							unit="tiềm năng"
							pageHref={(next) =>
								withParams(`${ctx.base}/leads`, values, { page: String(next) })
							}
						/>
					</>
				)}
			</ShopPageBody>
		</ShopPage>
	);
}
