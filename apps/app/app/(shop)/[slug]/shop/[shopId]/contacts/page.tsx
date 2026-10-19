import Phone from "@carbon/icons-react/es/Phone";
import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import { PANCAKE } from "@crm/pancake/config";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmounts } from "@/components/pancake/format";
import { COLLECTIONS } from "@/components/shop/collections";
import {
	CustomerDetailDrawer,
	CustomerDetailFullView,
} from "@/components/shop/customer-detail-view";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	RangeChip,
	SearchBox,
	SortButton,
	StatsToggle,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import {
	type SearchValues,
	shopFilters,
	text,
	withParams,
} from "@/components/shop/params";
import { CreateRecordButton } from "@/components/shop/record-sheet";
import { initials } from "@/lib/initials";

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
	const selectedCustomerId = text(values, "customerId");
	const fullView = text(values, "full") === "1";
	const statsShown = text(values, "stats") !== "0";
	const page = `${ctx.base}/contacts`;
	const sellersQuery = ctx.api.sellers.query({ shopId: ctx.shopId });
	const detailQuery = selectedCustomerId
		? ctx.api.customerDetail
				.query({ shopId: ctx.shopId, customerId: selectedCustomerId })
				.catch(() => null)
		: Promise.resolve(null);
	const staffOf = (sellers: Awaited<typeof sellersQuery>) => ({
		users: sellers.map((seller) => ({
			value: seller.employeeId,
			label: seller.name,
		})),
		currentEmployeeId:
			sellers.find(
				(seller) =>
					seller.email &&
					seller.email.toLowerCase() === ctx.session.user.email.toLowerCase(),
			)?.employeeId ?? null,
	});

	if (selectedCustomerId && fullView) {
		const [detail, sellers] = await Promise.all([detailQuery, sellersQuery]);
		if (detail) {
			return (
				<CustomerDetailFullView
					detail={detail}
					backHref={withParams(page, values, { customerId: "", full: "" })}
					base={ctx.base}
					staff={staffOf(sellers)}
				/>
			);
		}
	}

	const [customers, sellers, activeDetail] = await Promise.all([
		ctx.api.customers.query(filter.input),
		sellersQuery,
		detailQuery,
	]);
	const detailStaff = staffOf(sellers);
	const staff = detailStaff.users;
	const collection = COLLECTIONS.contact;
	const columns = collection.fields
		.filter((field) => field.list)
		.map((field) => ({ key: field.key, label: field.label }));

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<>
						<Button asChild variant="outline">
							<Link href={`${ctx.base}/settings/tools/fields/contact`}>
								<Icon icon={SettingsAdjust} data-icon="inline-start" />
								Giao diện
							</Link>
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
								fields={collection.fields
									.filter((f) => !f.hidden)
									.map((f) => ({
										value: f.key,
										label: f.label,
									}))}
							/>
							<StatsToggle defaultOn />
							<MoreMenu />
						</>
					}
				>
					<FilterChip
						label="Phân công"
						param="sellerId"
						multiple
						searchable
						options={[
							{ value: PANCAKE.unassignedValue, label: "Chưa phân công" },
							...staff,
						]}
					/>
					<RangeChip />
				</FilterBar>

				{statsShown ? (
					<div className="grid gap-3 md:grid-cols-3">
						<div className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-4">
							<span className="font-semibold text-xs">Số liên hệ mới</span>
							<div className="flex items-baseline justify-between">
								<span className="font-bold text-2xl tabular-nums">
									{customers.summary.newContacts.toLocaleString("en-US")}
								</span>
								<Badge variant="green" className="text-[11px]">
									↑ 100%
								</Badge>
							</div>
							<span className="text-muted-foreground text-[11px]">
								Đồng bộ từ Pancake POS
							</span>
						</div>
						<div className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-4">
							<span className="font-semibold text-xs">Tổng số tiền đã chi</span>
							<div className="flex items-baseline justify-between">
								<span className="font-bold text-2xl tabular-nums">
									{formatAmounts(
										customers.summary.totalSpent,
										customers.summary.currency,
									)}
								</span>
								<Badge variant="green" className="text-[11px]">
									↑ 100%
								</Badge>
							</div>
							<span className="text-muted-foreground text-[11px]">
								Đơn {customers.summary.spendWindowDays} ngày gần nhất, trừ đơn
								hủy / hoàn
							</span>
						</div>
						<div className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-4">
							<span className="font-semibold text-xs">Tỷ lệ quay lại</span>
							<div className="flex items-baseline justify-between">
								<span className="font-bold text-2xl tabular-nums">
									{customers.summary.returningRate}%
								</span>
							</div>
							<span className="text-muted-foreground text-[11px]">
								Khách hàng có từ 2 đơn hàng trở lên
							</span>
						</div>
					</div>
				) : null}

				<ListTable
					columns={columns}
					rows={customers.rows.map((customer) => {
						const statusBadge =
							customer.orderCount > 1
								? { label: "Khách mua lại", variant: "green" as const }
								: customer.orderCount === 1
									? { label: "Đang mua", variant: "blue" as const }
									: { label: "Mới", variant: "blue" as const };
						return {
							key: customer.customerId,
							href: withParams(page, values, {
								customerId: customer.customerId,
								full: "",
							}),
							cells: [
								customer.name,
								customer.phone ? (
									<span
										key="phone"
										className="inline-flex items-center gap-1.5 font-medium"
									>
										<span>{customer.phone}</span>
										<Icon icon={Phone} className="size-3.5 text-[#1677ff]" />
									</span>
								) : (
									<Dash key="phone-none" />
								),
								customer.email ? (
									<span key="email">{customer.email}</span>
								) : (
									<Dash key="email-none" />
								),
								customer.source ? (
									<span key="source">{customer.source}</span>
								) : (
									<Dash key="source-none" />
								),
								customer.assignedEmployeeName ? (
									<span
										key="assignee"
										className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-2.5 py-0.5"
									>
										<Avatar size="xs">
											{customer.assignedEmployeeAvatarUrl ? (
												<AvatarImage
													src={customer.assignedEmployeeAvatarUrl}
													alt={customer.assignedEmployeeName}
												/>
											) : null}
											<AvatarFallback>
												{initials(customer.assignedEmployeeName)}
											</AvatarFallback>
										</Avatar>
										<span className="truncate">
											{customer.assignedEmployeeName}
										</span>
									</span>
								) : (
									<Dash key="assignee-none" />
								),
								<Badge key="status" variant={statusBadge.variant}>
									{statusBadge.label}
								</Badge>,
							],
						};
					})}
				/>
				<ListFooter
					total={customers.total}
					page={filter.input.page}
					pageSize={filter.input.pageSize}
					unit="liên hệ"
					pageHref={(next) => withParams(page, values, { page: String(next) })}
				/>

				{activeDetail ? (
					<CustomerDetailDrawer
						detail={activeDetail}
						closeHref={withParams(page, values, { customerId: "", full: "" })}
						fullHref={withParams(page, values, {
							customerId: activeDetail.customerId,
							full: "1",
						})}
						base={ctx.base}
						staff={detailStaff}
					/>
				) : null}
			</ShopPageBody>
		</ShopPage>
	);
}
