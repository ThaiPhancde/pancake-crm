import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	COLLECTIONS,
	CONTACT_STATUSES,
	SOURCE_OPTIONS,
} from "@/components/shop/collections";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	RangeChip,
	SearchBox,
	SortButton,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import {
	type SearchValues,
	shopFilters,
	withParams,
} from "@/components/shop/params";
import { CreateRecordButton } from "@/components/shop/record-sheet";

export default function ContactsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Contacts {...props} />
		</Suspense>
	);
}

async function Contacts({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId);
	const [customers, sellers] = await Promise.all([
		ctx.api.customers.query(filter.input),
		ctx.api.sellers.query({ shopId: ctx.shopId }),
	]);
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const collection = COLLECTIONS.contact;
	const columns = collection.fields
		.filter((field) => field.list)
		.map((field) => ({ key: field.key, label: field.label }));
	const page = `${ctx.base}/contacts`;

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
						<CreateRecordButton collection="contact" users={staff} />
					</>
				}
			/>
			<ShopPageBody>
				<FilterBar
					toolbar={
						<>
							<SearchBox
								placeholder="Tên, điện thoại, email"
								className="w-56"
							/>
							<SortButton
								fields={columns.map((c) => ({ value: c.key, label: c.label }))}
							/>
							<FilterButton
								fields={collection.fields.map((f) => ({
									value: f.key,
									label: f.label,
								}))}
							/>
							<MoreMenu />
						</>
					}
				>
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
					<FilterChip
						label="Trạng thái"
						param="contactStatus"
						multiple
						options={CONTACT_STATUSES}
					/>
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
				<ListTable
					columns={columns}
					rows={customers.rows.map((customer) => ({
						key: customer.customerId,
						href: withParams(
							`${ctx.base}/orders`,
							{},
							{ customerId: customer.customerId },
						),
						cells: [
							customer.name,
							customer.phone ?? <Dash />,
							customer.email ?? <Dash />,
							customer.assignedEmployeeName ?? <Dash />,
							<Dash key="tags" />,
							<Dash key="birthday" />,
							<Badge key="pancake" variant="soft-blue">
								#{customer.customerId}
							</Badge>,
							<Dash key="source" />,
							<Badge key="status" variant="blue">
								Mới
							</Badge>,
						],
					}))}
				/>
				<ListFooter
					total={customers.total}
					page={filter.input.page}
					pageSize={filter.input.pageSize}
					unit="liên hệ"
					pageHref={(next) => withParams(page, values, { page: String(next) })}
				/>
			</ShopPageBody>
		</ShopPage>
	);
}
