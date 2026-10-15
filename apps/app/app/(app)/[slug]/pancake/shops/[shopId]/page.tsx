import { roleInput } from "@crm/pancake/contracts";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

export default function ShopPermissions(props: {
	params: Promise<{ slug: string; shopId: string }>;
}) {
	return (
		<Suspense fallback={<p>Đang tải phân quyền…</p>}>
			<Permissions {...props} />
		</Suspense>
	);
}

async function Permissions({
	params,
}: {
	params: Promise<{ slug: string; shopId: string }>;
}) {
	await requireSession();
	const { slug, shopId } = await params;
	const options = await getServerTrpcClient().pancake.options.query({ shopId });
	const path = `/${slug}/pancake/shops/${shopId}`;
	async function save(form: FormData) {
		"use server";
		await requireSession();
		const employeeId = form.get("employeeId");
		const input = roleInput.parse({
			shopId,
			userId: form.get("userId"),
			role: form.get("role"),
			employeeId: employeeId === "none" ? undefined : employeeId,
		});
		await getServerTrpcClient().pancake.setMembership.mutate(input);
		revalidatePath(path);
	}
	return (
		<main className="flex flex-1 flex-col gap-(--spacing-page-gap) overflow-auto p-(--spacing-page-inline)">
			<h1 className="text-2xl font-medium">Phân quyền shop {shopId}</h1>
			<Button asChild variant="outline">
				<Link href={`/${slug}/pancake?tab=connections`}>Về danh sách shop</Link>
			</Button>
			<p>
				Quản lý xem toàn shop và cấp quyền. Telesale xem đơn được phân công.
				Người xem đọc toàn shop.
			</p>
			<form action={save}>
				<FieldGroup>
					<Field>
						<FieldLabel>Tài khoản CRM</FieldLabel>
						<Select name="userId" required>
							<SelectTrigger>
								<SelectValue placeholder="Chọn nhân viên" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{options.users.map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name} / {user.email}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel>Vai trò</FieldLabel>
						<Select name="role" defaultValue="VIEWER">
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="MANAGER">Quản lý</SelectItem>
									<SelectItem value="TELESALE">Telesale</SelectItem>
									<SelectItem value="VIEWER">Người xem</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel>Nhân viên Pancake tương ứng</FieldLabel>
						<Select name="employeeId" defaultValue="none">
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="none">Chưa ánh xạ</SelectItem>
									{options.employees.map((employee) => (
										<SelectItem
											key={employee.employeeId}
											value={employee.employeeId}
										>
											{employee.name} / {employee.employeeId}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Button type="submit">Lưu phân quyền</Button>
				</FieldGroup>
			</form>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Tài khoản</TableHead>
						<TableHead>Vai trò</TableHead>
						<TableHead>Mã nhân viên Pancake</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{options.members.map((member) => (
						<TableRow key={member.userId}>
							<TableCell>
								{options.users.find((user) => user.id === member.userId)
									?.email ?? member.userId}
							</TableCell>
							<TableCell>{member.role}</TableCell>
							<TableCell>{member.employeeId ?? "Chưa ánh xạ"}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</main>
	);
}
