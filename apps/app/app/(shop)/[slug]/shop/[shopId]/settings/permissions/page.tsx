import Add from "@carbon/icons-react/es/Add";
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
import type { MemberRef } from "@/components/shop/admin/branch-manager";
import { MemberAccess } from "@/components/shop/admin/member-access";
import {
	PermissionGrid,
	ProfileManager,
	ProfilesNotEnforced,
} from "@/components/shop/admin/profile-manager";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { SettingsFrame } from "@/components/shop/settings-frame";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

type Role = "MANAGER" | "TELESALE" | "VIEWER";

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
	const settings = getServerTrpcClient().pancakeSettings;
	const [profiles, branches] = await Promise.all([
		settings.profiles.query({ shopId }),
		settings.branches.query({ shopId }),
	]);
	const profileByUser = new Map(
		profiles.flatMap((profile) =>
			profile.memberUserIds.map((userId) => [userId, profile] as const),
		),
	);
	const shopUserIds = new Set(options.members.map((member) => member.userId));
	const employeeIds = new Set(
		options.employees.map((employee) => employee.employeeId),
	);
	const accessBranches = branches.map((branch) => ({
		id: branch.id,
		name: branch.name,
		isDefault: branch.isDefault,
		members: branch.members.flatMap((member): MemberRef[] =>
			member.userId
				? shopUserIds.has(member.userId)
					? [{ userId: member.userId }]
					: []
				: member.employeeId && employeeIds.has(member.employeeId)
					? [{ employeeId: member.employeeId }]
					: [],
		),
	}));
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
			approved: Boolean(mappedMember),
		};
	});

	for (const member of options.members) {
		if (member.employeeId && memberByEmployeeId.has(member.employeeId))
			continue;
		const u = userById.get(member.userId);
		if (!u) continue;
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
	const selectedProfile =
		selectedStaff?.approved && selectedStaff.userId
			? profileByUser.get(selectedStaff.userId)
			: undefined;

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
						{profiles.length}
					</Badge>
				</Link>
			</div>

			{activeTab === "profiles" ? (
				<ProfileManager
					shopId={shopId}
					profiles={profiles.map((profile) => ({
						id: profile.id,
						name: profile.name,
						matrix: profile.matrix,
						memberCount: profile.memberUserIds.length,
					}))}
				/>
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
									<div className="grid items-end gap-4 md:grid-cols-[1fr_auto]">
										<Field>
											<FieldLabel>Vai trò</FieldLabel>
											<Select name="role" defaultValue={selectedStaff.role}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectItem value="MANAGER">
															Quản lý (CEO / Admin / Sale Manager)
														</SelectItem>
														<SelectItem value="TELESALE">Telesale</SelectItem>
														<SelectItem value="VIEWER">Người xem</SelectItem>
													</SelectGroup>
												</SelectContent>
											</Select>
										</Field>
										<Button type="submit" variant="outline">
											{selectedStaff.approved ? "Chỉnh sửa" : "Xét duyệt & Lưu"}
										</Button>
									</div>
								</form>

								<div className="rounded-lg border p-4">
									<MemberAccess
										key={selectedStaff.key}
										shopId={shopId}
										userId={
											selectedStaff.approved ? selectedStaff.userId : null
										}
										employeeId={selectedStaff.employeeId || null}
										profiles={profiles.map((profile) => ({
											id: profile.id,
											name: profile.name,
										}))}
										profileId={selectedProfile?.id ?? null}
										branches={accessBranches}
									/>
								</div>

								<ProfilesNotEnforced />
								{selectedProfile ? (
									<PermissionGrid matrix={selectedProfile.matrix} />
								) : (
									<p className="text-muted-foreground text-xs">
										{selectedStaff.approved
											? "Nhân viên chưa được gán hồ sơ quyền."
											: "Cần xét duyệt nhân viên vào CRM trước khi gán hồ sơ quyền."}
									</p>
								)}
							</>
						)}
					</div>
				</div>
			)}
		</SettingsFrame>
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
