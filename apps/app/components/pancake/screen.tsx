import "server-only";
import { PANCAKE, STATUS_NAMES } from "@crm/pancake/config";
import { listInput } from "@crm/pancake/contracts";
import type {
	connectionStatus,
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	listProducts,
	orderDetail,
} from "@crm/pancake/queries";
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
import { z } from "zod";
import { PancakeFilters } from "./filters";

export type SearchValues = { [key: string]: string | string[] | undefined };
export type PancakeData = {
	shops: Awaited<ReturnType<typeof connectionStatus>>;
	orders?: Awaited<ReturnType<typeof listOrders>>;
	customers?: Awaited<ReturnType<typeof listCustomers>>;
	purchases?: Awaited<ReturnType<typeof customerPurchases>>;
	detail?: Awaited<ReturnType<typeof orderDetail>>;
	report?: Awaited<ReturnType<typeof dashboardReport>>;
	products?: Awaited<ReturnType<typeof listProducts>>;
};

export function parseFilters(values: SearchValues) {
	const text = (key: string) =>
		typeof values[key] === "string" ? values[key] : "";
	const from = text("from");
	const to = text("to");
	if (from) z.iso.date().parse(from);
	if (to) z.iso.date().parse(to);
	const end = to ? new Date(`${to}T00:00:00+07:00`) : undefined;
	if (end) end.setTime(end.getTime() + 86_400_000);
	const input = listInput.parse({
		shopId:
			text("shopId") && text("shopId") !== "all" ? text("shopId") : undefined,
		q: text("q"),
		status:
			text("status") && text("status") !== "all"
				? Number(text("status"))
				: undefined,
		sellerId: text("sellerId") || undefined,
		from: from ? new Date(`${from}T00:00:00+07:00`).toISOString() : undefined,
		to: end?.toISOString(),
		page: text("page") ? Number(text("page")) : 1,
		pageSize: 25,
	});
	const tab = [
		"orders",
		"customers",
		"products",
		"report",
		"connections",
	].includes(text("tab"))
		? text("tab")
		: "orders";
	return {
		input,
		tab,
		from,
		to,
		customerId: text("customerId"),
		orderId: text("orderId"),
	};
}

function amount(value: string, currency: string): string {
	return new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency,
		maximumFractionDigits: currency === "VND" ? 0 : 2,
	}).format(Number(value));
}

function date(value: string | null): string {
	return value
		? new Intl.DateTimeFormat("vi-VN", {
				dateStyle: "short",
				timeStyle: "short",
				timeZone: PANCAKE.timezone,
			}).format(new Date(value))
		: "Chưa có";
}

function url(
	base: string,
	values: SearchValues,
	change: { [key: string]: string },
): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(values))
		if (typeof value === "string" && value) params.set(key, value);
	for (const [key, value] of Object.entries(change)) {
		if (value) params.set(key, value);
		else params.delete(key);
	}
	return `${base}?${params}`;
}

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
	return (
		<main className="flex min-h-0 min-w-0 flex-1 flex-col [&>*]:shrink-0 gap-(--spacing-page-gap) overflow-auto px-(--spacing-page-inline) py-(--spacing-page-top)">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-medium">
					Khách hàng và đơn hàng Pancake POS
				</h1>
				<p className="text-muted-foreground">
					Quản lý bán hàng theo shop, nhân viên và lịch sử giao hàng.
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
			<nav aria-label="Pancake POS" className="flex flex-wrap gap-2">
				{[
					{ id: "orders", name: "Đơn hàng" },
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
				statuses={Object.entries(STATUS_NAMES).map(([id, name]) => ({
					id,
					name,
				}))}
			/>
			<Separator />
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
								<TableHead>Giá trị sản phẩm</TableHead>
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
											{order.shopId} / #{order.orderId}
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
											{STATUS_NAMES[order.status] ??
												`Trạng thái ${order.status}`}
										</Badge>
									</TableCell>
									<TableCell>
										{amount(order.totalPrice, order.currency)}
									</TableCell>
									<TableCell>
										{order.sellerName ?? "Chưa phân công"}
										<div>{order.sellerId}</div>
									</TableCell>
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
								<TableRow key={`${item.productId}:${item.variationId}`}>
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
											: STATUS_NAMES[event.oldStatus]}{" "}
										→ {STATUS_NAMES[event.status] ?? event.status}
									</TableCell>
									<TableCell>
										{event.actorId ?? "Không được cung cấp"}
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
									<TableCell>{customer.shopId}</TableCell>
									<TableCell>{customer.name}</TableCell>
									<TableCell>{customer.phone}</TableCell>
									<TableCell>{customer.email}</TableCell>
									<TableCell>
										{customer.assignedEmployeeId ?? "Chưa phân công"}
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
						<AlertTitle>Giá trị sản phẩm của đơn đã nhận / thu tiền</AlertTitle>
						<AlertDescription>
							{data.report.revenue.map((row) => (
								<div key={row.currency}>{amount(row.amount, row.currency)}</div>
							))}
							Báo cáo gồm đơn đã nhận hàng hoặc đã thu tiền. Mỗi loại tiền tệ có
							tổng riêng. Báo cáo chưa trừ phí, thuế và tiền hoàn một phần.
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
								<TableHead>Doanh thu sản phẩm</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.report.performance.map((row) => (
								<TableRow key={`${row.shopId}:${row.sellerId}:${row.currency}`}>
									<TableCell>
										{row.shopId} / {row.sellerName}
										<div>{row.sellerId}</div>
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
									{shop.enabled ? "Đã bật" : "Đang dừng"} ·{" "}
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
									<TableCell>{product.shopId}</TableCell>
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
