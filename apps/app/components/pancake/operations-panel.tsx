import { STATUS_NAMES } from "@crm/pancake/config";
import type { operationsOverview } from "@crm/pancake/queries";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { StatCard } from "@crm/ui/components/stat-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import Link from "next/link";
import { pancakeUrl, type SearchValues } from "./filter-state";
import { formatAmount, formatDate } from "./format";

export function OperationsPanel({
	base,
	values,
	overview,
	shops,
}: {
	base: string;
	values: SearchValues;
	overview: Awaited<ReturnType<typeof operationsOverview>>;
	shops: { id: string; name: string }[];
}) {
	const names = new Map(shops.map((shop) => [shop.id, shop.name]));
	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{[
					{ name: "Đơn trong phạm vi", value: overview.orders, view: "all" },
					{ name: "Chờ xử lý", value: overview.pending, view: "pending" },
					{ name: "Đang giao", value: overview.shipping, view: "shipping" },
					{ name: "Hoàn hàng", value: overview.returns, view: "returns" },
					{
						name: "Chưa phân công",
						value: overview.unassigned,
						view: "unassigned",
					},
					{ name: "Công việc quá hạn", value: overview.overdue, view: "tasks" },
				].map((metric) => (
					<StatCard
						key={metric.view}
						label={metric.name}
						value={
							<Link
								aria-label={`${metric.name}: ${metric.value}`}
								href={pancakeUrl(base, values, {
									tab: metric.view === "tasks" ? "tasks" : "orders",
									view: metric.view === "tasks" ? "" : metric.view,
									taskView: metric.view === "tasks" ? "overdue" : "",
									page: "",
									status: "",
									customerId: "",
									orderId: "",
								})}
							>
								{metric.value.toLocaleString("vi-VN")}
							</Link>
						}
						description={
							metric.view === "tasks"
								? "Theo shop được cấp quyền"
								: "Theo bộ lọc hiện tại"
						}
					/>
				))}
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Đơn cập nhật gần đây</CardTitle>
					<CardDescription>
						Mở đơn để xem lịch sử và tạo công việc chăm sóc.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shop / đơn</TableHead>
								<TableHead>Khách hàng</TableHead>
								<TableHead>Trạng thái</TableHead>
								<TableHead>Giá trị</TableHead>
								<TableHead>Cập nhật</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{overview.recent.map((order) => (
								<TableRow key={`${order.shopId}:${order.orderId}`}>
									<TableCell>
										<Link
											href={pancakeUrl(
												base,
												{},
												{
													tab: "orders",
													shopId: order.shopId,
													orderId: order.orderId,
												},
											)}
										>
											{names.get(order.shopId)} / #{order.orderId}
										</Link>
									</TableCell>
									<TableCell>{order.customerName}</TableCell>
									<TableCell>
										<Badge variant="outline">
											{STATUS_NAMES.get(order.status) ?? order.status}
										</Badge>
									</TableCell>
									<TableCell>
										{formatAmount(order.totalPrice, order.currency)}
									</TableCell>
									<TableCell>{formatDate(order.sourceUpdatedAt)}</TableCell>
								</TableRow>
							))}
							{!overview.recent.length && (
								<TableRow>
									<TableCell colSpan={5}>
										Chưa có đơn phù hợp. Kiểm tra bộ lọc hoặc trạng thái đồng
										bộ.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
			<div className="flex flex-wrap gap-2">
				<Button asChild variant="outline">
					<Link href={pancakeUrl(base, {}, { tab: "tasks", taskView: "mine" })}>
						Công việc của tôi
					</Link>
				</Button>
				<Button asChild variant="outline">
					<Link href={pancakeUrl(base, {}, { tab: "connections" })}>
						Kiểm tra đồng bộ
					</Link>
				</Button>
			</div>
		</>
	);
}
