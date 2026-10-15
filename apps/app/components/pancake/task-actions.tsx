"use client";

import { Alert, AlertDescription } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export function TaskCreate({
	shopId,
	orderId,
	assignees,
}: {
	shopId: string;
	orderId: string;
	assignees: { id: string; name: string }[];
}) {
	const api = useTRPC();
	const router = useRouter();
	const requestId = useRef<string | null>(null);
	const [saved, setSaved] = useState(false);
	const mutation = useMutation(
		api.pancake.createTask.mutationOptions({
			onSuccess: () => {
				requestId.current = null;
				setSaved(true);
				router.refresh();
			},
		}),
	);
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				setSaved(false);
				const form = new FormData(event.currentTarget);
				requestId.current ??= crypto.randomUUID();
				const assignee = String(form.get("assigneeId") ?? "self");
				mutation.mutate({
					requestId: requestId.current,
					shopId,
					orderId,
					title: String(form.get("title") ?? ""),
					note: String(form.get("note") ?? ""),
					dueAt: new Date(
						`${String(form.get("dueAt"))}:00+07:00`,
					).toISOString(),
					assigneeId: assignee === "self" ? undefined : assignee,
				});
			}}
		>
			<FieldGroup>
				<div className="grid gap-3 md:grid-cols-3">
					<Field>
						<FieldLabel htmlFor="task-title">Việc cần làm</FieldLabel>
						<Input
							id="task-title"
							name="title"
							placeholder="Gọi xác nhận hoặc kiểm tra giao hàng"
							maxLength={160}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="task-due">Hạn xử lý (giờ Việt Nam)</FieldLabel>
						<Input id="task-due" name="dueAt" type="datetime-local" required />
					</Field>
					<Field>
						<FieldLabel htmlFor="task-assignee">Người phụ trách</FieldLabel>
						<Select name="assigneeId" defaultValue="self">
							<SelectTrigger id="task-assignee">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="self">Giao cho tôi</SelectItem>
									{assignees.map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="task-note">Ghi chú chăm sóc</FieldLabel>
					<Textarea
						id="task-note"
						name="note"
						maxLength={2000}
						placeholder="Nội dung cần trao đổi và thông tin cần kiểm tra"
					/>
				</Field>
				<div>
					<Button type="submit" disabled={mutation.isPending}>
						{mutation.isPending ? "Đang lưu…" : "Tạo công việc"}
					</Button>
				</div>
				{saved && <p role="status">Đã tạo công việc. Xem tại tab Công việc.</p>}
				{mutation.isError && (
					<Alert variant="destructive">
						<AlertDescription>
							Không lưu được công việc. Kiểm tra quyền truy cập và thử lại.
						</AlertDescription>
					</Alert>
				)}
			</FieldGroup>
		</form>
	);
}

export function TaskToggle({
	id,
	updatedAt,
	done,
}: {
	id: string;
	updatedAt: string;
	done: boolean;
}) {
	const api = useTRPC();
	const router = useRouter();
	const mutation = useMutation(
		api.pancake.updateTask.mutationOptions({
			onSuccess: () => router.refresh(),
		}),
	);
	return (
		<div className="flex flex-col gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={mutation.isPending}
				onClick={() =>
					mutation.mutate({
						id,
						expectedUpdatedAt: updatedAt,
						status: done ? "OPEN" : "DONE",
					})
				}
			>
				{mutation.isPending ? "Đang lưu…" : done ? "Mở lại" : "Hoàn tất"}
			</Button>
			{mutation.isError && (
				<p role="alert">
					Không cập nhật được. Tải lại trang để kiểm tra quyền hoặc thay đổi
					mới.
				</p>
			)}
		</div>
	);
}
