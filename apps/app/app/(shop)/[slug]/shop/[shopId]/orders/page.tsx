import { PANCAKE } from "@crm/pancake/config";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmount, formatDate } from "@/components/pancake/format";
import { TaskCreate } from "@/components/pancake/task-actions";
import { COLLECTIONS } from "@/components/shop/collections";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	QuickViewChip,
	RangeChip,
	SearchBox,
	SortButton,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { LIST_CONFIG } from "@/components/shop/lists/config";
import { loadSavedFilters } from "@/components/shop/lists/saved-filters-server";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { OrderDetailSheet } from "@/components/shop/order-detail-sheet";
import {
	ORDER_STATUS_OPTIONS,
	orderStatusName,
	orderStatusTone,
} from "@/components/shop/order-status";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import {
	type SearchValues,
	shopFilters,
	withParams,
} from "@/components/shop/params";
import { CreateRecordButton } from "@/components/shop/record-sheet";

export default function OrdersPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Orders {...props} />
		</Suspense>
	);
}

async function Orders({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId, undefined, ctx.shop.timezone);
	const page = `${ctx.base}/orders`;
	const [purchases, orders, sellers, detail, saved] = await Promise.all([
		filter.customerId
			? ctx.api.purchases.query({
					shopId: ctx.shopId,
					customerId: filter.customerId,
					filters: filter.input,
				})
			: Promise.resolve(null),
		filter.customerId
			? Promise.resolve(null)
			: ctx.api.orders.query(filter.input),
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		filter.orderId
			? ctx.api.detail
					.query({ shopId: ctx.shopId, orderId: filter.orderId })
					.catch(() => null)
			: Promise.resolve(null),
		loadSavedFilters(ctx.shopId, "orders"),
	]);
	const assignees = detail?.canCreateTask
		? await ctx.api.taskAssignees.query({
				shopId: ctx.shopId,
				orderId: detail.orderId,
			})
		: [];
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const collection = COLLECTIONS.order;
	const columns = collection.fields
		.filter((field) => field.list)
		.map((field) => ({ key: field.key, label: field.label }));
	const list = purchases ?? orders ?? { rows: [], total: 0 };

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<>
						<Button asChild variant="outline">
							<Link href={`${ctx.base}/settings/tools/fields/order`}>
								Giao diện
							</Link>
						</Button>
						<CreateRecordButton
							collection="order"
							users={staff}
							disabledReason={LIST_CONFIG.oneWayReason}
							menu={[
								{ label: "Nhập từ Excel" },
								{ label: "Đồng bộ từ Pancake POS" },
							]}
						/>
					</>
				}
			/>
			<ShopPageBody>
				{purchases ? (
					<Alert>
						<AlertTitle>Lịch sử mua: {purchases.customer.name}</AlertTitle>
						<AlertDescription className="flex flex-wrap items-center gap-2">
							{purchases.customer.phone} · {purchases.total} đơn theo số điện
							thoại.
							<Button asChild variant="link" size="sm" className="px-0">
								<Link href={page}>Xem tất cả đơn</Link>
							</Button>
						</AlertDescription>
					</Alert>
				) : null}
				<FilterBar
					toolbar={
						<>
							<SearchBox
								placeholder="Mã đơn, tên khách, điện thoại, vận đơn"
								className="w-64"
							/>
							<SortButton
								options={[
									{ value: "newest", label: "Mới nhất" },
									{ value: "updated", label: "Cập nhật gần nhất" },
									{ value: "oldest", label: "Cũ nhất" },
								]}
							/>
							<FilterButton
								saved={saved}
								fields={[
									{
										param: "status",
										label: "Trạng thái",
										options: ORDER_STATUS_OPTIONS,
									},
									{
										param: "sellerId",
										label: "Phân công",
										options: [
											{
												value: PANCAKE.unassignedValue,
												label: "Chưa phân công",
											},
											...staff,
										],
									},
								]}
							/>
							<MoreMenu
								exportRequest={{
									kind: "orders",
									shopId: ctx.shopId,
									filters: filter.input,
								}}
							/>
						</>
					}
				>
					<QuickViewChip
						options={[{ value: "all", label: "Tất cả đơn hàng" }]}
						saved={saved}
					/>
					<FilterChip
						label="Phân công"
						param="sellerId"
						searchable
						options={staff}
					/>
					<FilterChip
						label="Trạng thái"
						param="status"
						options={ORDER_STATUS_OPTIONS}
					/>
					<RangeChip />
				</FilterBar>
				<ListTable
					columns={columns}
					rows={list.rows.map((order) => {
						const itemsSummary =
							"itemsSummary" in order ? order.itemsSummary : "";
						const discount = "discount" in order ? order.discount : "0";
						const source = "source" in order ? order.source : null;
						const note = "note" in order ? order.note : null;
						return {
							key: order.orderId,
							href: withParams(page, values, { orderId: order.orderId }),
							cells: [
								`#${order.orderId}`,
								order.customerId ? (
									<Link
										key="customer"
										href={`${ctx.base}/contacts?customerId=${order.customerId}`}
										className="hover:text-primary"
									>
										{order.customerName}
									</Link>
								) : (
									order.customerName
								),
								order.customerPhone ?? <Dash />,
								<Link
									key="items"
									href={withParams(page, values, { orderId: order.orderId })}
									className="text-primary hover:underline"
								>
									{itemsSummary || "Xem sản phẩm"}
								</Link>,
								formatAmount(order.totalPrice, order.currency),
								Number(discount) > 0 ? (
									formatAmount(discount, order.currency)
								) : (
									<Dash key="discount" />
								),
								formatAmount(order.totalPrice, order.currency),
								source ?? <Dash key="source" />,
								note ?? order.returnReason ?? <Dash />,
								<Badge key="status" variant={orderStatusTone(order.status)}>
									{orderStatusName(order.status)}
								</Badge>,
							],
						};
					})}
				/>
				<ListFooter
					total={list.total}
					page={filter.input.page}
					pageSize={filter.input.pageSize}
					unit="đơn hàng"
					pageHref={(next) => withParams(page, values, { page: String(next) })}
				/>
			</ShopPageBody>

			{detail ? (
				<OrderDetailSheet
					title={`Đơn hàng #${detail.orderId} · ${detail.customerName}`}
					closeHref={withParams(page, values, { orderId: "" })}
				>
					<section className="flex flex-col gap-2">
						<h3 className="font-semibold text-sm">Sản phẩm</h3>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Sản phẩm / mẫu</TableHead>
									<TableHead>Số lượng</TableHead>
									<TableHead>Đã hoàn</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{detail.items.map((item) => (
									<TableRow key={item.lineNumber}>
										<TableCell>
											{item.name}
											<span className="ml-1 text-muted-foreground">
												/ {item.variationId}
											</span>
										</TableCell>
										<TableCell>{item.quantity}</TableCell>
										<TableCell>{item.returnedCount}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</section>
					<section className="flex flex-col gap-2">
						<h3 className="font-semibold text-sm">Lịch sử trạng thái</h3>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Thời điểm</TableHead>
									<TableHead>Trạng thái</TableHead>
									<TableHead>Người xử lý</TableHead>
									<TableHead>Vận đơn / giao hàng</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{detail.history.map((event) => (
									<TableRow key={event.id}>
										<TableCell>{formatDate(event.occurredAt)}</TableCell>
										<TableCell className="flex items-center gap-1">
											{event.oldStatus === null
												? "—"
												: orderStatusName(event.oldStatus)}
											<span className="text-muted-foreground">→</span>
											<Badge variant={orderStatusTone(event.status)}>
												{orderStatusName(event.status)}
											</Badge>
										</TableCell>
										<TableCell>{event.actorName ?? "—"}</TableCell>
										<TableCell>
											{event.trackingCode ?? "—"} /{" "}
											{event.deliveryStatus ?? "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</section>
					{detail.shippingHistory.length > 0 ? (
						<section className="flex flex-col gap-2">
							<h3 className="font-semibold text-sm">Vận chuyển</h3>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Thời điểm</TableHead>
										<TableHead>Trạng thái</TableHead>
										<TableHead>Vận đơn</TableHead>
										<TableHead>Ghi chú</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.shippingHistory.map((event) => (
										<TableRow
											key={`${event.key}:${event.updatedAt}:${event.status}`}
										>
											<TableCell>{formatDate(event.updatedAt)}</TableCell>
											<TableCell>{event.status}</TableCell>
											<TableCell>{event.trackingId}</TableCell>
											<TableCell>{event.note}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</section>
					) : null}
					{detail.returns.map((entry) => (
						<p key={entry.returnId} className="text-xs">
							Phiếu hoàn #{entry.returnId} · Trạng thái {entry.status} · Phí
							hoàn {entry.returnedFee ?? "Chưa có"} ·{" "}
							{formatDate(entry.sourceUpdatedAt)}
						</p>
					))}
					{assignees.length > 0 ? (
						<section className="flex flex-col gap-2 rounded-lg border p-4">
							<h3 className="font-semibold text-sm">
								Tạo nhiệm vụ cho đơn này
							</h3>
							<TaskCreate
								shopId={detail.shopId}
								orderId={detail.orderId}
								assignees={assignees}
							/>
						</section>
					) : null}
				</OrderDetailSheet>
			) : null}
		</ShopPage>
	);
}
