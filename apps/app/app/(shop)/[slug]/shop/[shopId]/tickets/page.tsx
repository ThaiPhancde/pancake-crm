import DataTable from "@carbon/icons-react/es/DataTable";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
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
import { ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import type { SearchValues } from "@/components/shop/params";
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

async function Tickets({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	const sellers = await ctx.api.sellers.query({ shopId: ctx.shopId });
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
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
				<ListTable columns={columns} rows={[]} />
				<ListFooter
					total={0}
					page={1}
					pageSize={25}
					unit="vấn đề"
					pageHref={() => `${ctx.base}/tickets`}
				/>
			</ShopPageBody>
		</ShopPage>
	);
}
