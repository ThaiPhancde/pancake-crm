import "server-only";
import { STATUS_NAMES } from "@crm/pancake/config";
import type {
	connectionStatus,
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	listProducts,
	operationsOverview,
	orderDetail,
	sellerOptions,
} from "@crm/pancake/queries";
import type { listTasks } from "@crm/pancake/tasks";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Separator } from "@crm/ui/components/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import Link from "next/link";
import {
	parseFilters,
	type SearchValues,
	pancakeUrl as url,
} from "./filter-state";
import { PancakeFilters } from "./filters";
import { formatAmount as amount, formatDate as date } from "./format";
import { OperationsPanel } from "./operations-panel";
import { TaskCreate } from "./task-actions";
import { TaskPanel } from "./task-panel";

export type PancakeData = {
	overview?: Awaited<ReturnType<typeof operationsOverview>>;
	tasks?: Awaited<ReturnType<typeof listTasks>>;
	assignees?: { id: string; name: string }[];
	sellers?: Awaited<ReturnType<typeof sellerOptions>>;
	shops: Awaited<ReturnType<typeof connectionStatus>>;
	orders?: Awaited<ReturnType<typeof listOrders>>;
	customers?: Awaited<ReturnType<typeof listCustomers>>;
	purchases?: Awaited<ReturnType<typeof customerPurchases>>;
	detail?: Awaited<ReturnType<typeof orderDetail>>;
	report?: Awaited<ReturnType<typeof dashboardReport>>;
	products?: Awaited<ReturnType<typeof listProducts>>;
};

export function PancakeScreen({
	base,
	values,
	data,
	demo = false,
}: {
	base: string;
	values: SearchValues;
	data: PancakeData;
	demo?: boolean;
}) {
	const filter = parseFilters(values);
	const orders = data.purchases ?? data.orders;
	const shopNames = new Map(data.shops.map((shop) => [shop.id, shop.name]));
	return (
		<main className="flex min-h-0 min-w-0 flex-1 flex-col [&>*]:shrink-0 gap-(--spacing-page-gap) overflow-auto px-(--spacing-page-inline) py-(--spacing-page-top)">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-medium">Pancake CRM</h1>
				<p className="text-muted-foreground">
					Theo dõi đơn hàng, chăm sóc khách và xử lý công việc theo từng shop.
				</p>
			</div>
			{demo && (
				<Alert>
					<AlertTitle>Dữ liệu mẫu an toàn</AlertTitle>
					<AlertDescription>
						Hai shop và khách hàng giả lập. Đồng bộ dữ liệu thật đang khóa.
					</AlertDescription>
				</Alert>
			)}
			{!demo &&
				data.shops.length > 0 &&
				data.shops.some((shop) => !shop.historyComplete) && (
					<Alert>
						<AlertTitle>Dữ liệu lịch sử chưa đầy đủ</AlertTitle>
						<AlertDescription>
							Danh sách và báo cáo phản ánh dữ liệu đã nhập. Xem Shop và đồng bộ
							để kiểm tra tiến độ.
						</AlertDescription>
					</Alert>
				)}
			<nav aria-label="Pancake POS" className="flex flex-wrap gap-2">
				{[
					{ id: "overview", name: "Tổng quan" },
					{ id: "orders", name: "Đơn hàng" },
					{ id: "tasks", name: "Công việc" },
					{ id: "customers", name: "Khách hàng" },
					{ id: "products", name: "Sản phẩm" },
					{ id: "report", name: "Doanh thu / Telesale" },
					{ id: "connections", name: "Shop và đồng bộ" },
				].map((tab) => (
					<Button
						key={tab.id}
						asChild
						variant={filter.tab === tab.id ? "default" : "outline"}
					>
						<Link
							aria-current={filter.tab === tab.id ? "page" : undefined}
							href={url(base, values, {
								tab: tab.id,
								page: "",
								customerId: "",
								orderId: "",
							})}
						>
							{tab.name}
						</Link>
					</Button>
				))}
			</nav>
			<PancakeFilters
				key={`${filter.tab}:${JSON.stringify(filter.input)}`}
				view={filter.input.view}
				sort={filter.input.sort}
				taskView={filter.taskView}
				sellers={data.sellers ?? []}
				action={base}
				tab={filter.tab}
				q={filter.input.q}
				shopId={filter.input.shopId ?? ""}
				status={
					filter.input.status === undefined ? "" : String(filter.input.status)
				}
				sellerId={filter.input.sellerId ?? ""}
				from={filter.from}
				to={filter.to}
				shops={data.shops}
				statuses={[...STATUS_NAMES].map(([id, name]) => ({
					id: String(id),
					name,
				}))}
			/>
			<Separator />
			{filter.invalid && (
				<Alert>
					<AlertTitle>Đã đặt lại bộ lọc không hợp lệ</AlertTitle>
					<AlertDescription>
						Kiểm tra ngày và số trang trong đường dẫn.
					</AlertDescription>
				</Alert>
			)}
			{data.overview && (
				<OperationsPanel
					base={base}
					values={values}
					overview={data.overview}
					shops={data.shops}
				/>
			)}
			{data.tasks && (
				<>
					<TaskPanel
						base={base}
						values={values}
						tasks={data.tasks}
						taskView={filter.taskView}
						demo={demo}
					/>
					<Pagination
						base={base}
						values={values}
						page={filter.input.page}
						total={data.tasks.total}
					/>
				</>
			)}

			{data.purchases && (
				<Alert>
					<AlertTitle>Lịch sử mua: {data.purchases.customer.name}</AlertTitle>
					<AlertDescription>
						{data.purchases.customer.phone} · {data.purchases.total} đơn trong
						phạm vi được cấp quyền.
					</AlertDescription>
				</Alert>
			)}
			{orders && (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shop / đơn</TableHead>
								<TableHead>Khách hàng</TableHead>
								<TableHead>Trạng thái</TableHead>
								<TableHead>Giá trị đơn</TableHead>
								<TableHead>Nhân viên bán</TableHead>
								<TableHead>Vận đơn</TableHead>
								<TableHead>Cập nhật</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{orders.rows.map((order) => (
								<TableRow key={`${order.shopId}:${order.orderId}`}>
									<TableCell>
										<Link
											href={url(base, values, {
												tab: "orders",
												shopId: order.shopId,
												orderId: order.orderId,
												customerId: "",
											})}
										>
											{shopNames.get(order.shopId) ?? order.shopId} / #
											{order.orderId}
										</Link>
									</TableCell>
									<TableCell>
										{order.customerId ? (
											<Link
												href={url(base, values, {
													tab: "orders",
													shopId: order.shopId,
													customerId: order.customerId,
													orderId: "",
													page: "",
												})}
											>
												{order.customerName}
											</Link>
										) : (
											order.customerName
										)}
										<div>{order.customerPhone}</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline">
											{STATUS_NAMES.get(order.status) ??
												`Trạng thái ${order.status}`}
										</Badge>
									</TableCell>
									<TableCell>
										{amount(order.totalPrice, order.currency)}
									</TableCell>
									<TableCell>{order.sellerName ?? "Chưa phân công"}</TableCell>
									<TableCell>{order.trackingCode ?? "Chưa có"}</TableCell>
									<TableCell>{date(order.sourceUpdatedAt)}</TableCell>
								</TableRow>
							))}
							{orders.rows.length === 0 && (
								<TableRow>
									<TableCell colSpan={7}>Chưa có đơn phù hợp bộ lọc.</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
					<Pagination
						base={base}
						values={values}
						page={filter.input.page}
						total={orders.total}
					/>
				</>
			)}
			{data.detail && (
				<>
					{data.assignees && data.assignees.length > 0 && !demo && (
						<Card>
							<CardHeader>
								<CardTitle>
									Tạo công việc cho đơn #{data.detail.orderId}
								</CardTitle>
								<CardDescription>
									Giao việc và lưu ghi chú chăm sóc trong CRM.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<TaskCreate
									shopId={data.detail.shopId}
									orderId={data.detail.orderId}
									assignees={data.assignees}
								/>
							</CardContent>
						</Card>
					)}

					<h2 className="text-lg font-medium">
						Đơn #{data.detail.orderId}: sản phẩm và lịch sử trạng thái
					</h2>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Sản phẩm / mẫu</TableHead>
								<TableHead>Số lượng</TableHead>
								<TableHead>Đã hoàn</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.detail.items.map((item) => (
								<TableRow key={item.lineNumber}>
									<TableCell>
										{item.name} / {item.variationId}
									</TableCell>
									<TableCell>{item.quantity}</TableCell>
									<TableCell>{item.returnedCount}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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
							{data.detail.history.map((event) => (
								<TableRow key={event.id}>
									<TableCell>{date(event.occurredAt)}</TableCell>
									<TableCell>
										{event.oldStatus === null
											? "—"
											: STATUS_NAMES.get(event.oldStatus)}{" "}
										→ {STATUS_NAMES.get(event.status) ?? event.status}
									</TableCell>
									<TableCell>
										{event.actorName ?? "Không được cung cấp"}
									</TableCell>
									<TableCell>
										{event.trackingCode ?? "—"} / {event.deliveryStatus ?? "—"}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{data.detail.returns.map((entry) => (
						<p key={entry.returnId}>
							Phiếu hoàn #{entry.returnId} · Trạng thái {entry.status} · Phí
							hoàn {entry.returnedFee ?? "Chưa có"} ·{" "}
							{date(entry.sourceUpdatedAt)}
						</p>
					))}
				</>
			)}
			{data.customers && (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shop</TableHead>
								<TableHead>Khách hàng</TableHead>
								<TableHead>Điện thoại</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Nhân viên chăm sóc</TableHead>
								<TableHead>Lịch sử mua</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.customers.rows.map((customer) => (
								<TableRow key={`${customer.shopId}:${customer.customerId}`}>
									<TableCell>
										{shopNames.get(customer.shopId) ?? customer.shopId}
									</TableCell>
									<TableCell>{customer.name}</TableCell>
									<TableCell>{customer.phone}</TableCell>
									<TableCell>{customer.email}</TableCell>
									<TableCell>
										{customer.assignedEmployeeName ?? "Chưa phân công"}
									</TableCell>
									<TableCell>
										<Link
											href={url(base, values, {
												tab: "orders",
												shopId: customer.shopId,
												customerId: customer.customerId,
												page: "",
											})}
										>
											Xem đơn hàng
										</Link>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<Pagination
						base={base}
						values={values}
						page={filter.input.page}
						total={data.customers.total}
					/>
				</>
			)}
			{data.report && (
				<>
					<div className="grid gap-3 md:grid-cols-4">
						{[
							{ name: "Tổng đơn", value: data.report.orders },
							{ name: "Đã nhận / thu tiền", value: data.report.delivered },
							{ name: "Hủy / xóa", value: data.report.cancelled },
							{ name: "Đang hoàn / hoàn", value: data.report.returned },
						].map((metric) => (
							<Card key={metric.name}>
								<CardHeader>
									<CardTitle>{metric.name}</CardTitle>
								</CardHeader>
								<CardContent>{metric.value}</CardContent>
							</Card>
						))}
					</div>
					<Alert>
						<AlertTitle>Doanh thu (trừ đơn hủy, xóa và hoàn)</AlertTitle>
						<AlertDescription>
							{data.report.revenue.map((row) => (
								<div key={row.currency}>
									{amount(row.amount, row.currency)} · Đã thu:{" "}
									{amount(
										data.report?.receivedRevenue.find(
											(item) => item.currency === row.currency,
										)?.amount ?? "0",
										row.currency,
									)}
								</div>
							))}
							Báo cáo dùng quy ước giá trị đơn hiện tại của shop, cần đối chiếu.
							Mỗi loại tiền tệ có tổng riêng. Báo cáo chưa trừ phí, thuế và tiền
							hoàn một phần.
						</AlertDescription>
					</Alert>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shop / nhân viên</TableHead>
								<TableHead>Đơn được phân công</TableHead>
								<TableHead>Đã nhận / thu tiền</TableHead>
								<TableHead>Tỷ lệ giao thành công</TableHead>
								<TableHead>Hủy</TableHead>
								<TableHead>Hoàn</TableHead>
								<TableHead>Doanh thu tham khảo</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.report.performance.map((row) => (
								<TableRow key={`${row.shopId}:${row.sellerId}:${row.currency}`}>
									<TableCell>
										{shopNames.get(row.shopId) ?? row.shopId} / {row.sellerName}
									</TableCell>
									<TableCell>{row.orders}</TableCell>
									<TableCell>{row.delivered}</TableCell>
									<TableCell>{row.deliveredRate}</TableCell>
									<TableCell>{row.cancelled}</TableCell>
									<TableCell>{row.returned}</TableCell>
									<TableCell>{amount(row.revenue, row.currency)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<p className="text-muted-foreground">
						Báo cáo theo ngày tạo đơn và trạng thái hiện tại. Tỷ lệ này dùng đơn
						được phân công làm mẫu số.
					</p>
				</>
			)}
			{filter.tab === "connections" && (
				<div className="grid gap-3 md:grid-cols-2">
					{data.shops.map((shop) => (
						<Card key={shop.id}>
							<CardHeader>
								<CardTitle>
									{shop.name} / {shop.id}
								</CardTitle>
								<CardDescription>
									{shop.syncEnabled ? "Đã bật" : "Đang dừng"} ·{" "}
									{shop.liveApprovedAt
										? "Đã duyệt đọc dữ liệu thật"
										: "Chưa duyệt dữ liệu thật"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p>Đồng bộ gần nhất: {date(shop.lastSyncAt)}</p>
								<p>Webhook gần nhất: {date(shop.lastWebhookAt)}</p>
								<p>Lỗi gần nhất: {shop.lastError ?? "Không có"}</p>
								<p>Webhook cần xử lý lại: {shop.deadWebhooks}</p>
								{shop.cursors.map((cursor) => (
									<p key={cursor.resource}>
										{cursor.resource} · {cursor.phase} · Trang {cursor.nextPage}{" "}
										· {date(cursor.watermark)}
									</p>
								))}
								{shop.canManage && !demo && (
									<Button asChild variant="outline">
										<Link href={`${base}/shops/${shop.id}`}>
											Phân quyền nhân viên
										</Link>
									</Button>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
			{data.products && (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shop</TableHead>
								<TableHead>Sản phẩm</TableHead>
								<TableHead>Mã mẫu / SKU</TableHead>
								<TableHead>Giá bán nguồn</TableHead>
								<TableHead>Tồn bán được</TableHead>
								<TableHead>Hiển thị</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.products.rows.map((product) => (
								<TableRow key={`${product.shopId}:${product.variationId}`}>
									<TableCell>
										{shopNames.get(product.shopId) ?? product.shopId}
									</TableCell>
									<TableCell>{product.name}</TableCell>
									<TableCell>{product.sku ?? product.variationId}</TableCell>
									<TableCell>{product.price ?? "Chưa có"}</TableCell>
									<TableCell>{product.stock ?? "Chưa có"}</TableCell>
									<TableCell>{product.hidden ? "Đã ẩn" : "Đang bán"}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<Pagination
						base={base}
						values={values}
						page={filter.input.page}
						total={data.products.total}
					/>
				</>
			)}
			{data.detail && data.detail.shippingHistory.length > 0 && (
				<>
					<h2 className="text-lg font-medium">
						Lịch sử vận chuyển từ hãng giao hàng
					</h2>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Thời điểm</TableHead>
								<TableHead>Trạng thái giao hàng</TableHead>
								<TableHead>Vận đơn</TableHead>
								<TableHead>Ghi chú</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.detail.shippingHistory.map((event) => (
								<TableRow
									key={`${event.key}:${event.updatedAt}:${event.trackingId}:${event.status}`}
								>
									<TableCell>{date(event.updatedAt)}</TableCell>
									<TableCell>{event.status}</TableCell>
									<TableCell>{event.trackingId}</TableCell>
									<TableCell>{event.note}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</>
			)}
			{data.shops.length === 0 && (
				<Alert>
					<AlertTitle>Chưa có shop được cấp quyền</AlertTitle>
					<AlertDescription>
						Quản trị viên cấu hình shop và cấp quyền cho tài khoản của bạn.
					</AlertDescription>
				</Alert>
			)}
		</main>
	);
}

function Pagination({
	base,
	values,
	page,
	total,
}: {
	base: string;
	values: SearchValues;
	page: number;
	total: number;
}) {
	return (
		<div className="flex items-center gap-3">
			<span>
				{total} bản ghi · Trang {page}
			</span>
			{page > 1 && (
				<Button asChild variant="outline">
					<Link href={url(base, values, { page: String(page - 1) })}>
						Trang trước
					</Link>
				</Button>
			)}
			{page * 25 < total && (
				<Button asChild variant="outline">
					<Link href={url(base, values, { page: String(page + 1) })}>
						Trang sau
					</Link>
				</Button>
			)}
		</div>
	);
}
