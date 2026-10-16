import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Email from "@carbon/icons-react/es/Email";
import Events from "@carbon/icons-react/es/Events";
import Folder from "@carbon/icons-react/es/Folder";
import Search from "@carbon/icons-react/es/Search";
import { roleInput } from "@crm/pancake/contracts";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Avatar, AvatarFallback } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { cn } from "@crm/ui/lib/utils";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { SettingsFrame } from "@/components/shop/settings-frame";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

const ROLE_LABEL = {
	MANAGER: "Quản lý",
	TELESALE: "Telesale",
	VIEWER: "Người xem",
} as const;
type Role = keyof typeof ROLE_LABEL;

const TABLES = [
	{ key: "task", label: "Nhiệm vụ", icon: "📋", configurable: false },
	{ key: "ticket", label: "Vấn đề", icon: "🎫", configurable: false },
	{ key: "appointment", label: "Lịch hẹn", icon: "📅", configurable: false },
	{ key: "contract", label: "Hợp đồng", icon: "📄", configurable: false },
	{ key: "lead", label: "Tiềm năng", icon: "🧩", configurable: true },
	{ key: "contact", label: "Liên hệ", icon: "👥", configurable: true },
	{ key: "order", label: "Đơn hàng", icon: "🛒", configurable: true },
];
const ACTIONS = [
	"Cấu hình",
	"Xem",
	"Chỉnh sửa",
	"Xóa",
	"Tạo mới",
	"Xuất dữ liệu",
];

function allowed(role: Role, action: string, configurable: boolean): boolean {
	if (action === "Cấu hình") return role === "MANAGER" && configurable;
	if (role === "MANAGER") return true;
	if (role === "TELESALE")
		return ["Xem", "Chỉnh sửa", "Tạo mới"].includes(action);
	return action === "Xem";
}

export default function PermissionsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Permissions {...props} />
		</Suspense>
	);
}

async function Permissions({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const page = `${ctx.base}/settings/permissions`;
	const options = await ctx.api.options
		.query({ shopId: ctx.shopId })
		.catch(() => null);
	if (!options)
		return (
			<SettingsFrame current="Phân quyền" className="p-5">
				<Alert>
					<AlertTitle>Chỉ quản lý shop mới xem được phân quyền</AlertTitle>
					<AlertDescription>
						Tài khoản của bạn là Telesale hoặc Người xem trên shop này.
					</AlertDescription>
				</Alert>
			</SettingsFrame>
		);
	const members = options.members.map((member) => ({
		...member,
		user: options.users.find((user) => user.id === member.userId),
	}));
	const selectedId = text(values, "user") || members[0]?.userId || "";
	const selected = members.find((member) => member.userId === selectedId);
	const selectedUser =
		selected?.user ?? options.users.find((user) => user.id === selectedId);
	const role: Role = selected?.role ?? "VIEWER";
	const shopId = ctx.shopId;

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
		revalidatePath(page);
	}

	return (
		<SettingsFrame current="Phân quyền">
			<div className="flex gap-6 border-b px-5">
				<span className="-mb-px flex items-center gap-2 border-primary border-b-2 py-3 font-medium text-primary text-sm">
					<Icon icon={Events} className="size-4" />
					Danh sách nhân viên
					<Badge variant="soft-blue">{members.length}</Badge>
				</span>
				<span className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
					<Icon icon={Folder} className="size-4" />
					Hồ sơ
					<Badge variant="secondary">3</Badge>
				</span>
			</div>
			<div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
				<aside className="flex flex-col gap-2 border-r p-4">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Icon
								icon={Search}
								className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
							/>
							<Input placeholder="Tìm kiếm" className="pl-8" />
						</div>
						<Button asChild size="icon" aria-label="Thêm nhân viên">
							<Link href={withParams(page, {}, { user: "new" })}>
								<Icon icon={Add} />
							</Link>
						</Button>
					</div>
					<ul className="flex flex-col gap-1">
						{members.map((member) => (
							<li key={member.userId}>
								<Link
									href={withParams(page, {}, { user: member.userId })}
									className={cn(
										"flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent/40",
										member.userId === selectedId &&
											"bg-accent text-accent-foreground",
									)}
								>
									<Avatar className="size-7">
										<AvatarFallback className="text-xs">
											{(member.user?.name ?? "?").charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="truncate">
										{member.user?.name ?? member.userId}
									</span>
								</Link>
							</li>
						))}
						{members.length === 0 ? (
							<li className="px-2 py-4 text-muted-foreground text-xs">
								Chưa có nhân viên nào được cấp quyền trên shop này.
							</li>
						) : null}
					</ul>
				</aside>
				<div className="flex flex-col gap-4 p-5">
					{selectedId === "new" || !selectedUser ? (
						<form action={save} className="max-w-xl">
							<FieldGroup>
								<h2 className="font-semibold text-sm">
									Thêm nhân viên vào shop
								</h2>
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
								<RoleFields employees={options.employees} />
								<div>
									<Button type="submit">Thêm nhân viên</Button>
								</div>
							</FieldGroup>
						</form>
					) : (
						<>
							<div className="flex items-center gap-4 border-b pb-4">
								<Avatar className="size-12">
									<AvatarFallback className="text-base">
										{selectedUser.name.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className="flex flex-col gap-1">
									<h2 className="font-semibold text-lg">{selectedUser.name}</h2>
									<div className="flex flex-wrap gap-2 text-xs">
										<Badge variant="secondary" className="gap-1">
											<Icon icon={Email} className="size-3" />
											{selectedUser.email}
										</Badge>
										<Badge variant="secondary">
											Mã NV Pancake: {selected?.employeeId ?? "Chưa ánh xạ"}
										</Badge>
									</div>
								</div>
							</div>
							<form action={save} className="rounded-lg border p-4">
								<input type="hidden" name="userId" value={selectedUser.id} />
								<div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
									<RoleFields
										employees={options.employees}
										role={role}
										employeeId={selected?.employeeId ?? undefined}
									/>
									<Button type="submit">Chỉnh sửa</Button>
								</div>
							</form>
							<table className="w-full text-xs">
								<thead className="bg-muted text-left text-muted-foreground uppercase">
									<tr>
										<th className="px-3 py-2 font-medium">Bảng</th>
										{ACTIONS.map((action) => (
											<th
												key={action}
												className="px-3 py-2 text-center font-medium"
											>
												{action}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y">
									{TABLES.map((table) => (
										<tr key={table.key}>
											<td className="flex items-center gap-2 px-3 py-2.5 font-medium">
												<span>{table.icon}</span>
												{table.label}
											</td>
											{ACTIONS.map((action) => (
												<td key={action} className="px-3 py-2.5 text-center">
													{allowed(role, action, table.configurable) ? (
														<Icon
															icon={Checkmark}
															className="inline size-4 text-success"
														/>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</>
					)}
				</div>
			</div>
		</SettingsFrame>
	);
}

function RoleFields({
	employees,
	role = "VIEWER",
	employeeId = "none",
}: {
	employees: { employeeId: string; name: string }[];
	role?: Role;
	employeeId?: string;
}) {
	return (
		<>
			<Field>
				<FieldLabel>Hồ sơ</FieldLabel>
				<Select name="role" defaultValue={role}>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{(Object.keys(ROLE_LABEL) as Role[]).map((key) => (
								<SelectItem key={key} value={key}>
									{ROLE_LABEL[key]}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Nhân viên Pancake tương ứng</FieldLabel>
				<Select name="employeeId" defaultValue={employeeId}>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="none">Chưa ánh xạ</SelectItem>
							{employees.map((employee) => (
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
		</>
	);
}
