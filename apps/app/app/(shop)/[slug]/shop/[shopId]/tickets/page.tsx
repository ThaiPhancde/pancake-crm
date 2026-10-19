import { PANCAKE } from "@crm/pancake/config";
import { Badge } from "@crm/ui/components/badge";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatDate } from "@/components/pancake/format";
import {
	COLLECTIONS,
	TICKET_CATEGORIES,
	TICKET_PRIORITIES,
	TICKET_STATUSES,
} from "@/components/shop/collections";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	QuickViewChip,
	SearchBox,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { DetailFields } from "@/components/shop/lists/detail-fields";
import { loadSavedFilters } from "@/components/shop/lists/saved-filters-server";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { OrderDetailSheet } from "@/components/shop/order-detail-sheet";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { RecordQuickEdit } from "@/components/shop/record-quick-edit";
import { CreateRecordButton } from "@/components/shop/record-sheet";
import { optionLabel } from "@/components/shop/report-bars";

export default function TicketsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Tickets {...props} />
		</Suspense>
	);
}

async function Tickets({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const pageNum = Math.max(1, Number(text(values, "page") || "1"));
	const page = `${ctx.base}/tickets`;
	const ticketId = text(values, "ticketId");
	const recordInput = {
		shopId: ctx.shopId,
		q: text(values, "q"),
		status: text(values, "status") || undefined,
		assigneeId: text(values, "assignee") || undefined,
		priority: text(values, "priority") || undefined,
		category: text(values, "category") || undefined,
		quick: text(values, "quick") || undefined,
	};
	const [sellers, tickets, customers, saved] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.tickets.query({ ...recordInput, page: pageNum, pageSize: 25 }),
		ctx.api.customers.query({
			shopId: ctx.shopId,
			pageSize: PANCAKE.maxListSize,
		}),
		loadSavedFilters(ctx.shopId, "tickets"),
	]);
	const selected = ticketId
		? (tickets.rows.find((row) => row.id === ticketId) ??
			(
				await ctx.api.tickets.query({
					shopId: ctx.shopId,
					pageSize: PANCAKE.maxListSize,
				})
			).rows.find((row) => row.id === ticketId))
		: undefined;
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const contacts = customers.rows.map((customer) => ({
		value: customer.customerId,
		label: customer.phone
			? `${customer.name ?? customer.phone} · ${customer.phone}`
			: (customer.name ?? customer.customerId),
	}));
	const collection = COLLECTIONS.ticket;
	const columns = collection.fields
		.filter((field) => field.list)
		.map((field) => ({ key: field.key, label: field.label }));
	const flagged = TICKET_PRIORITIES.map((priority) => ({
		...priority,
		label: `⚑ ${priority.label}`,
		color: undefined,
	}));

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<CreateRecordButton
						collection="ticket"
						users={staff}
						relations={{ contact: contacts }}
						size="md"
					/>
				}
			/>
			<ShopPageBody>
				<FilterBar
					toolbar={
						<>
							<SearchBox className="w-56" />
							<FilterButton
								saved={saved}
								fields={[
									{
										param: "status",
										label: "Trạng thái",
										options: TICKET_STATUSES,
									},
									{
										param: "priority",
										label: "Ưu tiên",
										options: TICKET_PRIORITIES,
									},
									{
										param: "category",
										label: "Danh mục",
										options: TICKET_CATEGORIES,
									},
									{
										param: "assignee",
										label: "Phân công",
										options: [
											{ value: "none", label: "Chưa được phân công" },
											...staff,
										],
									},
								]}
							/>
							<MoreMenu
								exportRequest={{
									kind: "tickets",
									shopId: ctx.shopId,
									filters: recordInput,
								}}
							/>
						</>
					}
				>
					<QuickViewChip
						options={[
							{ value: "all", label: "Tất cả vấn đề" },
							{ value: "overdue", label: "Quá hạn" },
						]}
						saved={saved}
					/>
					<FilterChip
						label="Ưu tiên"
						param="priority"
						multiple
						options={flagged}
					/>
					<FilterChip
						label="Danh mục"
						param="category"
						multiple
						options={TICKET_CATEGORIES.map((item) => ({
							...item,
							color: "gray" as const,
						}))}
					/>
					<FilterChip
						label="Trạng thái"
						param="status"
						multiple
						options={TICKET_STATUSES}
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
				</FilterBar>
				<ListTable
					columns={columns}
					bulk={{
						shopId: ctx.shopId,
						entity: "ticket",
						statuses: TICKET_STATUSES,
						staff,
						canWrite: tickets.canWrite,
					}}
					rows={tickets.rows.map((ticket) => {
						const prioOpt = TICKET_PRIORITIES.find(
							(p) => p.value === ticket.priority,
						);
						return {
							key: ticket.id,
							href: withParams(page, values, { ticketId: ticket.id }),
							cells: [
								`#${ticket.id.slice(-6).toUpperCase()}`,
								ticket.title,
								ticket.contactName ?? <Dash />,
								ticket.phone ?? <Dash />,
								ticket.email ?? <Dash />,
								<Dash key="relatedUsers" />,
								ticket.category ? (
									optionLabel(TICKET_CATEGORIES, ticket.category, "")
								) : (
									<Dash key="category" />
								),
								<Badge key="prio" variant="orange">
									{prioOpt?.label ?? ticket.priority}
								</Badge>,
								<RecordQuickEdit
									key="status"
									kind="ticket"
									field="status"
									id={ticket.id}
									shopId={ctx.shopId}
									value={ticket.status}
									options={TICKET_STATUSES}
									disabled={!tickets.canWrite}
								/>,
								<RecordQuickEdit
									key="assignee"
									kind="ticket"
									field="assigneeId"
									id={ticket.id}
									shopId={ctx.shopId}
									value={ticket.assigneeId}
									options={staff}
									disabled={!tickets.canWrite}
								/>,
								ticket.dueAt ? formatDate(ticket.dueAt) : <Dash key="dueAt" />,
							],
						};
					})}
				/>
				<ListFooter
					total={tickets.total}
					page={pageNum}
					pageSize={25}
					unit="vấn đề"
					pageHref={(next) => withParams(page, values, { page: String(next) })}
				/>
			</ShopPageBody>
			{selected ? (
				<OrderDetailSheet
					title={`Vấn đề #${selected.id.slice(-6).toUpperCase()} · ${selected.title}`}
					closeHref={withParams(page, values, { ticketId: "" })}
				>
					<DetailFields
						items={[
							{ label: "Tiêu đề", value: selected.title },
							{ label: "Liên hệ", value: selected.contactName },
							{ label: "Số điện thoại", value: selected.phone },
							{ label: "Email", value: selected.email },
							{
								label: "Danh mục",
								value: selected.category
									? optionLabel(TICKET_CATEGORIES, selected.category, "")
									: null,
							},
							{
								label: "Ưu tiên",
								value: optionLabel(TICKET_PRIORITIES, selected.priority, ""),
							},
							{
								label: "Trạng thái",
								value: (
									<RecordQuickEdit
										kind="ticket"
										field="status"
										id={selected.id}
										shopId={ctx.shopId}
										value={selected.status}
										options={TICKET_STATUSES}
										disabled={!tickets.canWrite}
									/>
								),
							},
							{
								label: "Phân công",
								value: (
									<RecordQuickEdit
										kind="ticket"
										field="assigneeId"
										id={selected.id}
										shopId={ctx.shopId}
										value={selected.assigneeId}
										options={staff}
										disabled={!tickets.canWrite}
									/>
								),
							},
							{
								label: "Hạn xử lý",
								value: selected.dueAt ? formatDate(selected.dueAt) : null,
							},
							{ label: "Ngày tạo", value: formatDate(selected.createdAt) },
							{ label: "Mô tả", value: selected.description || null },
						]}
					/>
				</OrderDetailSheet>
			) : null}
		</ShopPage>
	);
}
