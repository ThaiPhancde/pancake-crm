import Column from "@carbon/icons-react/es/Column";
import DataTable from "@carbon/icons-react/es/DataTable";
import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
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
	StatsToggle,
	ViewSwitch,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { ConvertLeadButton } from "@/components/shop/lists/convert-lead-button";
import { DetailFields } from "@/components/shop/lists/detail-fields";
import { loadSavedFilters } from "@/components/shop/lists/saved-filters-server";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { OrderDetailSheet } from "@/components/shop/order-detail-sheet";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import {
	type SearchValues,
	shopFilters,
	text,
	withParams,
} from "@/components/shop/params";
import { RecordQuickEdit } from "@/components/shop/record-quick-edit";
import { CreateRecordButton } from "@/components/shop/record-sheet";
import { initials } from "@/lib/initials";

const LEAD_FIELDS = z.record(z.string(), z.coerce.string()).catch({});

const TONE_BAR = new Map<string, string>([
	["blue", "border-b-[#1677ff]"],
	["orange", "border-b-[#fa8c16]"],
	["purple", "border-b-[#9254de]"],
	["green", "border-b-[#22c55e]"],
	["gray", "border-b-[#9ca3af]"],
]);

type LeadDetail = {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	status: string;
	source: string | null;
	note: string;
	assigneeId: string | null;
	creatorName: string | null;
	createdAt: string;
	updatedAt: string;
	converted: boolean;
	canWrite: boolean;
	fields: Record<string, string>;
};

function toLeadDetail(
	row: Omit<LeadDetail, "fields"> & { fields: unknown },
): LeadDetail {
	return { ...row, fields: LEAD_FIELDS.parse(row.fields) };
}

type LeadList = {
	total: number;
	canWrite: boolean;
	rows: {
		id: string;
		name: string;
		phone: string | null;
		email: string | null;
		status: string;
		source: string | null;
		assigneeId: string | null;
		createdAt: string;
	}[];
};

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
	const filter = shopFilters({ ...values, status: undefined }, ctx.shopId);
	const page = `${ctx.base}/leads`;
	const leadId = text(values, "leadId");
	const recordInput = {
		shopId: ctx.shopId,
		q: text(values, "q"),
		status: text(values, "status") || undefined,
		assigneeId: text(values, "assignee") || undefined,
		creatorId: text(values, "creator") || undefined,
		source: text(values, "source") || undefined,
		quick: text(values, "quick") || undefined,
		from: filter.input.from,
		to: filter.input.to,
	};
	const sellersQuery = ctx.api.sellers.query({ shopId: ctx.shopId });
	const savedQuery = loadSavedFilters(ctx.shopId, "leads");
	const detailQuery: Promise<LeadDetail | null> = leadId
		? ctx.api.leadDetail
				.query({ shopId: ctx.shopId, id: leadId })
				.then(toLeadDetail)
				.catch(() => null)
		: Promise.resolve(null);
	const leads: LeadList = await ctx.api.leads.query({
		...recordInput,
		page: pageNum,
		pageSize: 25,
	});
	const sellers = await sellersQuery;
	const saved = await savedQuery;
	const detail = await detailQuery;
	const leadHref = (id: string) => withParams(page, values, { leadId: id });
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
							<FilterButton
								saved={saved}
								fields={[
									{
										param: "status",
										label: "Trạng thái",
										options: LEAD_STATUSES,
									},
									{
										param: "assignee",
										label: "Phân công",
										options: [
											{ value: "none", label: "Chưa được phân công" },
											...staff,
										],
									},
									{ param: "creator", label: "Người tạo", options: staff },
									{
										param: "source",
										label: "Nguồn khách hàng",
										options: SOURCE_OPTIONS,
									},
								]}
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
							<MoreMenu
								exportRequest={{
									kind: "leads",
									shopId: ctx.shopId,
									filters: recordInput,
								}}
							/>
						</>
					}
				>
					<QuickViewChip
						options={[
							{ value: "all", label: "Tất cả tiềm năng" },
							{ value: "mine-new", label: "Tiềm năng mới của tôi" },
							{ value: "mine-week", label: "Tiềm năng tuần này của tôi" },
						]}
						saved={saved}
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
													<Link
														href={leadHref(lead.id)}
														scroll={false}
														className="font-semibold text-sm hover:text-primary"
													>
														{lead.name}
													</Link>
													<div className="mt-1 text-muted-foreground text-xs">
														{lead.phone ?? lead.email ?? "Chưa có SĐT"}
													</div>
													<div className="mt-2">
														<RecordQuickEdit
															kind="lead"
															field="status"
															id={lead.id}
															shopId={ctx.shopId}
															value={lead.status}
															options={LEAD_STATUSES}
															disabled={!leads.canWrite}
														/>
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
							bulk={{
								shopId: ctx.shopId,
								entity: "lead",
								statuses: LEAD_STATUSES,
								staff,
								canWrite: leads.canWrite,
							}}
							rows={leads.rows.map((lead) => {
								return {
									key: lead.id,
									href: leadHref(lead.id),
									cells: [
										lead.name,
										lead.phone ?? <Dash />,
										lead.email ?? <Dash />,
										<RecordQuickEdit
											key="assignee"
											kind="lead"
											field="assigneeId"
											id={lead.id}
											shopId={ctx.shopId}
											value={lead.assigneeId}
											options={staff}
											disabled={!leads.canWrite}
										/>,
										<Dash key="bday" />,
										lead.source ? (
											<span key="source">{lead.source}</span>
										) : (
											<Dash key="source-none" />
										),
										<RecordQuickEdit
											key="status"
											kind="lead"
											field="status"
											id={lead.id}
											shopId={ctx.shopId}
											value={lead.status}
											options={LEAD_STATUSES}
											disabled={!leads.canWrite}
										/>,
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
								withParams(page, values, { page: String(next) })
							}
						/>
					</>
				)}
			</ShopPageBody>
			{detail ? (
				<OrderDetailSheet
					title={`Tiềm năng · ${detail.name}`}
					closeHref={withParams(page, values, { leadId: "" })}
				>
					<DetailFields
						items={[
							{ label: "Tên", value: detail.name },
							{ label: "Số điện thoại", value: detail.phone },
							{ label: "Email", value: detail.email },
							{
								label: "Trạng thái",
								value: (
									<RecordQuickEdit
										kind="lead"
										field="status"
										id={detail.id}
										shopId={ctx.shopId}
										value={detail.status}
										options={LEAD_STATUSES}
										disabled={!detail.canWrite}
									/>
								),
							},
							{
								label: "Phân công",
								value: (
									<RecordQuickEdit
										kind="lead"
										field="assigneeId"
										id={detail.id}
										shopId={ctx.shopId}
										value={detail.assigneeId}
										options={staff}
										disabled={!detail.canWrite}
									/>
								),
							},
							{ label: "Nguồn", value: detail.source },
							{ label: "Người tạo", value: detail.creatorName },
							{ label: "Ngày tạo", value: formatDate(detail.createdAt) },
							{ label: "Cập nhật", value: formatDate(detail.updatedAt) },
							{ label: "Ghi chú", value: detail.note || null },
							...Object.entries(detail.fields).map(([label, value]) => ({
								label,
								value,
							})),
						]}
					/>
					<ConvertLeadButton
						shopId={ctx.shopId}
						id={detail.id}
						converted={detail.converted}
						canWrite={detail.canWrite}
					/>
				</OrderDetailSheet>
			) : null}
		</ShopPage>
	);
}
