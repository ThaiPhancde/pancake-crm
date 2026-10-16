import DataTable from "@carbon/icons-react/es/DataTable";
import { Badge } from "@crm/ui/components/badge";
import { Icon } from "@crm/ui/components/icon";
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
	SortButton,
	ViewSwitch,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { CreateRecordButton } from "@/components/shop/record-sheet";

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
	const [sellers, tickets] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.tickets.query({
			shopId: ctx.shopId,
			q: text(values, "q"),
			status: text(values, "status") || undefined,
			page: pageNum,
			pageSize: 25,
		}),
	]);
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const sellerMap = new Map(sellers.map((s) => [s.employeeId, s.name]));
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
					<CreateRecordButton collection="ticket" users={staff} size="md" />
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
							<ViewSwitch
								options={[
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
							{ value: "all", label: "Tất cả vấn đề" },
							{ value: "overdue", label: "Quá hạn" },
						]}
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
				</FilterBar>
				<ListTable
					columns={columns}
					rows={tickets.rows.map((ticket) => {
						const prioOpt = TICKET_PRIORITIES.find(
							(p) => p.value === ticket.priority,
						);
						const statusOpt = TICKET_STATUSES.find(
							(s) => s.value === ticket.status,
						);
						return {
							key: ticket.id,
							cells: [
								`#${ticket.id.slice(-6).toUpperCase()}`,
								ticket.title,
								ticket.contactName ?? <Dash />,
								ticket.phone ?? <Dash />,
								ticket.email ?? <Dash />,
								<Dash key="relatedUsers" />,
								ticket.category ?? <Dash />,
								<Badge key="prio" variant="orange">
									{prioOpt?.label ?? ticket.priority}
								</Badge>,
								<Badge key="status" variant="blue">
									{statusOpt?.label ?? ticket.status}
								</Badge>,
								ticket.assigneeId ? (
									(sellerMap.get(ticket.assigneeId) ?? ticket.assigneeId)
								) : (
									<Dash key="assignee" />
								),
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
					pageHref={(next) =>
						withParams(`${ctx.base}/tickets`, values, { page: String(next) })
					}
				/>
			</ShopPageBody>
		</ShopPage>
	);
}
