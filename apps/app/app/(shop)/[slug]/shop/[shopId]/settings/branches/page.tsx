import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	type BranchItem,
	BranchManager,
	type BranchPerson,
} from "@/components/shop/admin/branch-manager";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { SettingsFrame } from "@/components/shop/settings-frame";
import { shopProfile } from "@/components/shop/shop-profile";
import { getServerTrpcClient } from "@/lib/trpc/server";

export default function BranchesPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Branches params={params} />
		</Suspense>
	);
}

function memberKey(member: {
	userId: string | null;
	employeeId: string | null;
}) {
	return member.userId ? `u:${member.userId}` : `e:${member.employeeId}`;
}

async function Branches({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	const settings = getServerTrpcClient().pancakeSettings;
	const [options, branches] = await Promise.all([
		ctx.api.options.query({ shopId: ctx.shopId }).catch(() => null),
		settings.branches.query({ shopId: ctx.shopId }).catch(() => null),
	]);
	if (!options || !branches) {
		return (
			<SettingsFrame current="Chi nhánh" className="p-5">
				<Alert>
					<AlertTitle>Chỉ quản lý shop mới quản lý được chi nhánh</AlertTitle>
					<AlertDescription>
						Tài khoản của bạn là Telesale hoặc Người xem trên shop này.
					</AlertDescription>
				</Alert>
			</SettingsFrame>
		);
	}

	const userById = new Map(options.users.map((user) => [user.id, user]));
	const employeeById = new Map(
		options.employees.map((employee) => [employee.employeeId, employee]),
	);
	const mappedEmployees = new Set(
		options.members.flatMap((member) =>
			member.employeeId ? [member.employeeId] : [],
		),
	);
	const people: BranchPerson[] = [
		...options.members.flatMap((member) => {
			const user = userById.get(member.userId);
			const employee = member.employeeId
				? employeeById.get(member.employeeId)
				: undefined;
			const name = user?.name ?? employee?.name;
			return name
				? [
						{
							key: memberKey({ userId: member.userId, employeeId: null }),
							name,
							detail: user?.email ?? "Tài khoản CRM",
							ref: { userId: member.userId },
						},
					]
				: [];
		}),
		...options.employees
			.filter((employee) => !mappedEmployees.has(employee.employeeId))
			.map((employee) => ({
				key: memberKey({ userId: null, employeeId: employee.employeeId }),
				name: employee.name,
				detail: employee.email ?? `Mã NV ${employee.employeeId}`,
				ref: { employeeId: employee.employeeId },
			})),
	];
	const knownKeys = new Set(people.map((person) => person.key));
	for (const branch of branches)
		for (const member of branch.members) {
			const key = memberKey(member);
			const employee = member.employeeId
				? employeeById.get(member.employeeId)
				: undefined;
			if (knownKeys.has(key) || member.userId || !employee) continue;
			knownKeys.add(key);
			people.push({
				key,
				name: employee.name,
				detail: employee.email ?? `Mã NV ${employee.employeeId}`,
				ref: { employeeId: employee.employeeId },
			});
		}
	const items: BranchItem[] = branches.map((branch) => ({
		id: branch.id,
		name: branch.name,
		phone: branch.phone,
		email: branch.email,
		address: branch.address,
		isDefault: branch.isDefault,
		memberKeys: branch.members.map(memberKey),
	}));
	const profile = shopProfile(ctx.shopId);

	return (
		<SettingsFrame current="Chi nhánh" className="bg-transparent">
			<BranchManager
				shopId={ctx.shopId}
				branches={items}
				people={people}
				phonePlaceholder={`+${profile.dialCode} …`}
			/>
		</SettingsFrame>
	);
}
