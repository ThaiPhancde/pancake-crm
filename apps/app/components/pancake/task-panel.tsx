import type { listTasks } from "@crm/pancake/tasks";
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
import { pancakeUrl, type SearchValues } from "./filter-state";
import { formatDate } from "./format";
import { TaskToggle } from "./task-actions";

export function TaskPanel({
	base,
	values,
	tasks,
	taskView,
	demo,
}: {
	base: string;
	values: SearchValues;
	tasks: Awaited<ReturnType<typeof listTasks>>;
	taskView: string;
	demo: boolean;
}) {
	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				{[
					{ id: "open", label: "Đang mở" },
					{ id: "overdue", label: "Quá hạn" },
					{ id: "mine", label: "Của tôi" },
					{ id: "done", label: "Hoàn tất" },
					{ id: "all", label: "Tất cả" },
				].map((view) => (
					<Button
						key={view.id}
						asChild
						size="sm"
						variant={view.id === taskView ? "default" : "outline"}
					>
						<Link
							aria-current={view.id === taskView ? "page" : undefined}
							href={pancakeUrl(base, values, { taskView: view.id, page: "" })}
						>
							{view.label}
						</Link>
					</Button>
				))}
				<span>
					{tasks.total} công việc · {tasks.overdue} quá hạn
				</span>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Công việc / ghi chú</TableHead>
						<TableHead>Shop / đơn</TableHead>
						<TableHead>Người phụ trách</TableHead>
						<TableHead>Hạn xử lý</TableHead>
						<TableHead>Trạng thái</TableHead>
						<TableHead>Thao tác</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{tasks.rows.map((task) => (
						<TableRow key={task.id}>
							<TableCell>
								<div>{task.title}</div>
								<div className="max-w-sm whitespace-pre-wrap text-muted-foreground">
									{task.note}
								</div>
							</TableCell>
							<TableCell>
								<Link
									href={pancakeUrl(
										base,
										{},
										{
											tab: "orders",
											shopId: task.shopId,
											orderId: task.orderId,
										},
									)}
								>
									{task.order.shop.name} / #{task.orderId}
								</Link>
								<div>{task.order.customerName}</div>
							</TableCell>
							<TableCell>{task.assignee.name}</TableCell>
							<TableCell>{formatDate(task.dueAt)}</TableCell>
							<TableCell>
								<Badge variant={task.overdue ? "destructive" : "outline"}>
									{task.status === "DONE"
										? "Hoàn tất"
										: task.overdue
											? "Quá hạn"
											: "Đang mở"}
								</Badge>
							</TableCell>
							<TableCell>
								{task.canUpdate && !demo ? (
									<TaskToggle
										id={task.id}
										updatedAt={task.updatedAt}
										done={task.status === "DONE"}
									/>
								) : (
									"—"
								)}
							</TableCell>
						</TableRow>
					))}
					{!tasks.rows.length && (
						<TableRow>
							<TableCell colSpan={6}>
								Không có công việc phù hợp. Mở chi tiết đơn hàng để tạo công
								việc mới.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</>
	);
}
