import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Email from "@carbon/icons-react/es/Email";
import Events from "@carbon/icons-react/es/Events";
import Folder from "@carbon/icons-react/es/Folder";
import Phone from "@carbon/icons-react/es/Phone";
import Search from "@carbon/icons-react/es/Search";
import WarningAltFilled from "@carbon/icons-react/es/WarningAltFilled";
import { approveEmployeeInput, roleInput } from "@crm/pancake/contracts";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
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

type Role = "MANAGER" | "TELESALE" | "VIEWER";

type ProfileDef = {
	key: string;
	label: string;
	role: Role;
	description: string;
};

const PROFILES: ProfileDef[] = [
	{
		key: "ceo",
		label: "CEO",
		role: "MANAGER",
		description:
			"Toàn quyền quản trị hệ thống, cấu hình bảng, phân quyền nhân sự và xem báo cáo toàn doanh nghiệp.",
	},
	{
		key: "admin",
		label: "Admin",
		role: "MANAGER",
		description:
			"Quản trị viên hệ thống, được phép cấu hình bảng dữ liệu, quản lý chi nhánh và xuất dữ liệu.",
	},
	{
		key: "sale-manager",
		label: "Sale Manager",
		role: "MANAGER",
		description:
			"Trưởng nhóm kinh doanh, quản lý toàn bộ đơn hàng, liên hệ, tiềm năng và hiệu suất đội ngũ sale.",
	},
	{
		key: "telesale",
		label: "Telesale",
		role: "TELESALE",
		description:
			"Nhân viên tư vấn & chốt đơn, xử lý các đơn hàng, tiềm năng và liên hệ được phân công.",
	},
	{
		key: "viewer",
		label: "Người xem",
		role: "VIEWER",
		description:
			"Chỉ có quyền xem dữ liệu trên shop, không được chỉnh sửa hoặc xóa bản ghi.",
	},
];

const TABLES = [
	{ key: "task", label: "Nhiệm vụ", icon: "📋", configurable: false },
	{ key: "ticket", label: "Vấn đề", icon: "🎫", configurable: false },
	{ key: "opportunity", label: "Cơ hội", icon: "🎯", configurable: true },
	{ key: "order", label: "Đơn hàng", icon: "🛒", configurable: true },
	{ key: "appointment", label: "Lịch hẹn", icon: "📅", configurable: false },
	{ key: "contract", label: "Hợp đồng", icon: "📄", configurable: false },
	{ key: "lead", label: "Tiềm năng", icon: "🧩", configurable: true },
	{ key: "contact", label: "Liên hệ", icon: "👥", configurable: true },
	{ key: "company", label: "Công ty", icon: "🏢", configurable: true },
];

const ACTIONS = [
	"Cấu hình",
	"Xem",
	"Chỉnh sửa",
	"Xóa",
	"Tạo mới",
	"Xuất dữ liệu",
];

const FALLBACK_PROFILE: ProfileDef = {
	key: "viewer",
	label: "Người xem",
	role: "VIEWER",
	description:
		"Chỉ có quyền xem dữ liệu trên shop, không được chỉnh sửa hoặc xóa bản ghi.",
};

function profileAt(index: number): ProfileDef {
	return PROFILES[index] ?? PROFILES[0] ?? FALLBACK_PROFILE;
}

function allowed(
	profileKey: string,
	role: Role,
	action: string,
	configurable: boolean,
): boolean {
	if (action === "Cấu hình") {
		if (!configurable) return false;
		return (
			role === "MANAGER" &&
			["ceo", "admin", "sale-manager"].includes(profileKey)
		);
	}
	if (role === "MANAGER") {
		if (profileKey === "sale-manager" && action === "Xóa") return false;
		return true;
	}
	if (role === "TELESALE") {
		return ["Xem", "Chỉnh sửa", "Tạo mới"].includes(action);
	}
	return action === "Xem";
}

function profileForEmployee(role: Role, roleCode: string | null): ProfileDef {
	if (role === "MANAGER") {
		if (roleCode === "1") return profileAt(0);
		if (roleCode === "2") return profileAt(1);
		return profileAt(2);
	}
	if (role === "TELESALE") return profileAt(3);
	return profileAt(4);
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
	if (!options) {
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
	}

	const shopId = ctx.shopId;
	const activeTab = text(values, "tab") === "profiles" ? "profiles" : "staff";
	const searchQ = text(values, "q").toLowerCase();

	const memberByEmployeeId = new Map(
		options.members.flatMap((m) => (m.employeeId ? [[m.employeeId, m]] : [])),
	);
	const userById = new Map(options.users.map((u) => [u.id, u]));

	const staffEntries = options.employees.map((emp) => {
		const mappedMember = memberByEmployeeId.get(emp.employeeId);
		const mappedUser = mappedMember
			? userById.get(mappedMember.userId)
			: options.users.find(
					(u) => emp.email && u.email.toLowerCase() === emp.email.toLowerCase(),
				);
		const isManager = emp.roleCode === "1" || emp.roleCode === "2";
		const effectiveRole: Role =
			mappedMember?.role ?? (isManager ? "MANAGER" : "TELESALE");
		const profile = profileForEmployee(effectiveRole, emp.roleCode);
		return {
			key: emp.employeeId,
			employeeId: emp.employeeId,
			userId: mappedMember?.userId ?? mappedUser?.id ?? null,
			name: emp.name,
			email: emp.email ?? mappedUser?.email ?? null,
			phone: emp.phone,
			fbId: emp.fbId,
			avatarUrl: emp.avatarUrl ?? mappedUser?.image ?? null,
			department: emp.department,
			role: effectiveRole,
			profile,
			approved: Boolean(mappedMember),
		};
	});

	for (const member of options.members) {
		if (member.employeeId && memberByEmployeeId.has(member.employeeId))
			continue;
		const u = userById.get(member.userId);
		if (!u) continue;
		const profile = profileForEmployee(member.role, "1");
		staffEntries.unshift({
			key: `user:${u.id}`,
			employeeId: member.employeeId ?? "",
			userId: u.id,
			name: u.name,
			email: u.email,
			phone: null,
			fbId: null,
			avatarUrl: u.image,
			department: "Quản trị",
			role: member.role,
			profile,
			approved: true,
		});
	}

	const unapprovedCount = options.employees.filter(
		(e) => !memberByEmployeeId.has(e.employeeId),
	).length;

	const filteredStaff = searchQ
		? staffEntries.filter(
				(s) =>
					s.name.toLowerCase().includes(searchQ) ||
					(s.email?.toLowerCase().includes(searchQ) ?? false),
			)
		: staffEntries;

	const selectedKey = text(values, "user") || filteredStaff[0]?.key || "";
	const selectedStaff =
		filteredStaff.find((s) => s.key === selectedKey) ?? filteredStaff[0];
	const selectedProfileKey = text(values, "profile") || profileAt(0).key;
	const activeProfile =
		PROFILES.find((p) => p.key === selectedProfileKey) ?? profileAt(0);

	async function save(form: FormData) {
		"use server";
		await requireSession();
		const userIdVal = String(form.get("userId") ?? "");
		const employeeIdVal = String(form.get("employeeId") ?? "");
		const roleVal = String(form.get("role") ?? "TELESALE") as Role;
		if (!userIdVal && employeeIdVal && employeeIdVal !== "none") {
			const input = approveEmployeeInput.parse({
				shopId,
				employeeId: employeeIdVal,
				role: roleVal,
			});
			await getServerTrpcClient().pancake.approveEmployee.mutate(input);
		} else {
			const input = roleInput.parse({
				shopId,
				userId: userIdVal,
				role: roleVal,
				employeeId:
					!employeeIdVal || employeeIdVal === "none"
						? undefined
						: employeeIdVal,
			});
			await getServerTrpcClient().pancake.setMembership.mutate(input);
		}
		revalidatePath(page);
	}

	async function approveAll() {
		"use server";
		await requireSession();
		await getServerTrpcClient().pancake.approveAllEmployees.mutate({ shopId });
		revalidatePath(page);
	}

	return (
		<SettingsFrame current="Phân quyền">
			{unapprovedCount > 0 ? (
				<div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[#fffbe6] px-5 py-2 text-xs dark:bg-amber-950/40">
					<div className="flex items-center gap-2 text-[#ad6800] dark:text-amber-300">
						<Icon icon={WarningAltFilled} className="size-4 text-[#faad14]" />
						<span>
							<strong>{unapprovedCount} nhân viên</strong> từ Pancake POS chưa
							được xét duyệt vào CRM.
						</span>
					</div>
					<form action={approveAll}>
						<button
							type="submit"
							className="font-semibold text-[#1677ff] hover:underline"
						>
							Xét duyệt ngay ({unapprovedCount})
						</button>
					</form>
				</div>
			) : null}

			<div className="flex gap-6 border-b px-5">
				<Link
					href={withParams(page, values, { tab: "", profile: "" })}
					className={cn(
						"-mb-px flex items-center gap-2 border-b-2 py-3 font-medium text-sm transition-colors",
						activeTab === "staff"
							? "border-[#1677ff] text-[#1677ff]"
							: "border-transparent text-muted-foreground hover:text-foreground",
					)}
				>
					<Icon icon={Events} className="size-4" />
					Danh sách nhân viên
					<Badge variant={activeTab === "staff" ? "soft-blue" : "secondary"}>
						{staffEntries.length}
					</Badge>
				</Link>
				<Link
					href={withParams(page, values, { tab: "profiles", user: "" })}
					className={cn(
						"-mb-px flex items-center gap-2 border-b-2 py-3 font-medium text-sm transition-colors",
						activeTab === "profiles"
							? "border-[#1677ff] text-[#1677ff]"
							: "border-transparent text-muted-foreground hover:text-foreground",
					)}
				>
					<Icon icon={Folder} className="size-4" />
					Hồ sơ
					<Badge variant={activeTab === "profiles" ? "soft-blue" : "secondary"}>
						{PROFILES.length}
					</Badge>
				</Link>
			</div>

			{activeTab === "profiles" ? (
				<div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
					<aside className="flex flex-col gap-2 border-r p-4">
						<div className="flex items-center gap-2">
							<div className="relative flex-1">
								<Icon
									icon={Search}
									className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
								/>
								<Input placeholder="Tìm kiếm hồ sơ" className="pl-8" />
							</div>
							<Button size="icon" aria-label="Thêm hồ sơ" disabled>
								<Icon icon={Add} />
							</Button>
						</div>
						<ul className="flex flex-col gap-1 pt-1">
							{PROFILES.map((prof) => (
								<li key={prof.key}>
									<Link
										href={withParams(page, values, {
											tab: "profiles",
											profile: prof.key,
										})}
										className={cn(
											"flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent/40",
											prof.key === activeProfile.key &&
												"bg-[#e8f3ff] font-semibold text-[#1677ff]",
										)}
									>
										<span>{prof.label}</span>
									</Link>
								</li>
							))}
						</ul>
					</aside>

					<div className="flex flex-col gap-4 p-5">
						<div className="flex items-start justify-between border-b pb-4">
							<div className="space-y-1">
								<h2 className="font-bold text-lg">{activeProfile.label}</h2>
								<p className="max-w-3xl text-muted-foreground text-xs">
									Hồ sơ giúp bạn định nghĩa một bộ quyền hạn để gán cho các nhân
									viên có cùng vai trò. {activeProfile.description}
								</p>
							</div>
							<Button variant="outline" size="sm" disabled>
								Chỉnh sửa
							</Button>
						</div>

						<PermissionsMatrix
							profileKey={activeProfile.key}
							role={activeProfile.role}
						/>
					</div>
				</div>
			) : (
				<div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
					<aside className="flex flex-col gap-2 border-r p-4">
						<div className="flex items-center gap-2">
							<form action={page} className="relative flex-1">
								<Icon
									icon={Search}
									className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
								/>
								<Input
									name="q"
									defaultValue={text(values, "q")}
									placeholder="Tìm kiếm"
									className="pl-8"
								/>
							</form>
							<Button asChild size="icon" aria-label="Thêm nhân viên">
								<Link href={withParams(page, values, { user: "new" })}>
									<Icon icon={Add} />
								</Link>
							</Button>
						</div>
						<ul className="flex max-h-[560px] flex-col gap-1 overflow-y-auto pr-1">
							{filteredStaff.map((staff) => (
								<li key={staff.key}>
									<Link
										href={withParams(page, values, { user: staff.key })}
										className={cn(
											"flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent/40",
											staff.key === selectedStaff?.key &&
												selectedKey !== "new" &&
												"bg-[#e8f3ff] font-medium text-[#1677ff]",
										)}
									>
										<Avatar className="size-7">
											{staff.avatarUrl ? (
												<AvatarImage src={staff.avatarUrl} alt={staff.name} />
											) : null}
											<AvatarFallback className="text-xs">
												{staff.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="flex-1 truncate">{staff.name}</span>
										{!staff.approved ? (
											<span
												className="size-2 shrink-0 rounded-full bg-amber-500"
												title="Chưa xét duyệt vào CRM"
											/>
										) : null}
									</Link>
								</li>
							))}
						</ul>
					</aside>

					<div className="flex flex-col gap-4 p-5">
						{selectedKey === "new" || !selectedStaff ? (
							<form action={save} className="max-w-xl">
								<FieldGroup>
									<h2 className="font-semibold text-sm">
										Thêm / phân quyền nhân viên vào shop
									</h2>
									<Field>
										<FieldLabel>Tài khoản CRM</FieldLabel>
										<Select name="userId">
											<SelectTrigger>
												<SelectValue placeholder="Tự động tạo từ nhân viên Pancake bên dưới" />
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
									<RoleFields
										employees={options.employees}
										shopName={ctx.shop.name}
									/>
									<div>
										<Button type="submit">Lưu phân quyền</Button>
									</div>
								</FieldGroup>
							</form>
						) : (
							<>
								<div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
									<div className="flex items-center gap-4">
										<Avatar className="size-14">
											{selectedStaff.avatarUrl ? (
												<AvatarImage
													src={selectedStaff.avatarUrl}
													alt={selectedStaff.name}
												/>
											) : null}
											<AvatarFallback className="text-base">
												{selectedStaff.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div className="flex flex-col gap-1.5">
											<div className="flex items-center gap-2">
												<h2 className="font-bold text-lg">
													{selectedStaff.name}
												</h2>
												<Badge
													variant={selectedStaff.approved ? "green" : "orange"}
												>
													{selectedStaff.approved
														? "Đã kích hoạt CRM"
														: "Đồng bộ từ POS"}
												</Badge>
											</div>
											<div className="flex flex-wrap gap-2 text-xs">
												{selectedStaff.fbId ? (
													<Badge variant="soft-blue" className="gap-1">
														FB ID: {selectedStaff.fbId}
													</Badge>
												) : null}
												{selectedStaff.email ? (
													<Badge variant="secondary" className="gap-1">
														<Icon icon={Email} className="size-3" />
														{selectedStaff.email}
													</Badge>
												) : null}
												<Badge variant="secondary" className="gap-1">
													<Icon icon={Phone} className="size-3" />
													{selectedStaff.phone ?? "Chưa cập nhật"}
												</Badge>
											</div>
										</div>
									</div>
								</div>

								<form action={save} className="rounded-lg border p-4">
									<input
										type="hidden"
										name="userId"
										value={selectedStaff.userId ?? ""}
									/>
									<input
										type="hidden"
										name="employeeId"
										value={selectedStaff.employeeId || "none"}
									/>
									<div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
										<Field>
											<FieldLabel>Hồ sơ</FieldLabel>
											<Select name="role" defaultValue={selectedStaff.role}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectItem value="MANAGER">
															{selectedStaff.profile.role === "MANAGER"
																? selectedStaff.profile.label
																: "Sale Manager / Admin"}
														</SelectItem>
														<SelectItem value="TELESALE">Telesale</SelectItem>
														<SelectItem value="VIEWER">Người xem</SelectItem>
													</SelectGroup>
												</SelectContent>
											</Select>
										</Field>
										<Field>
											<FieldLabel>Chi nhánh</FieldLabel>
											<Select defaultValue="default">
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectItem value="default">
															Chi nhánh mặc định ({ctx.shop.name})
														</SelectItem>
													</SelectGroup>
												</SelectContent>
											</Select>
										</Field>
										<Button type="submit" variant="outline">
											{selectedStaff.approved ? "Chỉnh sửa" : "Xét duyệt & Lưu"}
										</Button>
									</div>
								</form>

								<PermissionsMatrix
									profileKey={selectedStaff.profile.key}
									role={selectedStaff.role}
								/>
							</>
						)}
					</div>
				</div>
			)}
		</SettingsFrame>
	);
}

function PermissionsMatrix({
	profileKey,
	role,
}: {
	profileKey: string;
	role: Role;
}) {
	return (
		<div className="overflow-x-auto rounded-lg border">
			<table className="w-full text-xs">
				<thead className="bg-muted text-left text-muted-foreground uppercase">
					<tr>
						<th className="px-3.5 py-2.5 font-semibold">Bảng</th>
						{ACTIONS.map((action) => (
							<th
								key={action}
								className="px-3 py-2.5 text-center font-semibold"
							>
								{action}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y">
					{TABLES.map((table) => (
						<tr key={table.key} className="hover:bg-accent/20">
							<td className="flex items-center gap-2.5 px-3.5 py-3 font-medium">
								<span className="text-base">{table.icon}</span>
								{table.label}
							</td>
							{ACTIONS.map((action) => (
								<td key={action} className="px-3 py-3 text-center">
									{allowed(profileKey, role, action, table.configurable) ? (
										<Icon
											icon={Checkmark}
											className="inline size-4 text-emerald-600"
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
		</div>
	);
}

function RoleFields({
	employees,
	shopName,
	role = "TELESALE",
	employeeId = "none",
}: {
	employees: { employeeId: string; name: string }[];
	shopName: string;
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
							<SelectItem value="MANAGER">
								CEO / Admin / Sale Manager
							</SelectItem>
							<SelectItem value="TELESALE">Telesale</SelectItem>
							<SelectItem value="VIEWER">Người xem</SelectItem>
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Nhân viên Pancake POS ({shopName})</FieldLabel>
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
									{employee.name} (#{employee.employeeId})
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
		</>
	);
}
