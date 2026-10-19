"use client";

import { Field, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { MemberRef } from "./branch-manager";
import { ADMIN } from "./config";

export type AccessBranch = {
	id: string;
	name: string;
	isDefault: boolean;
	members: MemberRef[];
};

function same(a: MemberRef, b: MemberRef) {
	return "userId" in a && "userId" in b
		? a.userId === b.userId
		: "employeeId" in a && "employeeId" in b && a.employeeId === b.employeeId;
}

export function MemberAccess({
	shopId,
	userId,
	employeeId,
	profiles,
	profileId,
	branches,
}: {
	shopId: string;
	userId: string | null;
	employeeId: string | null;
	profiles: { id: string; name: string }[];
	profileId: string | null;
	branches: AccessBranch[];
}) {
	const api = useTRPC();
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const assign = useMutation(
		api.pancakeSettings.assignProfile.mutationOptions({
			onSuccess: () => {
				toast.success("Đã gán hồ sơ");
				router.refresh();
			},
			onError: () => toast.error("Không thể gán hồ sơ. Vui lòng thử lại."),
		}),
	);
	const setMembers = useMutation(
		api.pancakeSettings.setBranchMembers.mutationOptions(),
	);
	const refs: MemberRef[] = [
		...(userId ? [{ userId }] : []),
		...(employeeId ? [{ employeeId }] : []),
	];
	const own = refs[0];
	const isMine = (member: MemberRef) => refs.some((ref) => same(ref, member));
	const currentBranch =
		branches.find((branch) => branch.members.some(isMine))?.id ??
		ADMIN.branch.noBranch;

	async function moveTo(next: string) {
		if (!own || next === currentBranch) return;
		setSaving(true);
		try {
			for (const branch of branches) {
				const inBranch = branch.members.some(isMine);
				if (branch.id === next && !inBranch)
					await setMembers.mutateAsync({
						shopId,
						id: branch.id,
						members: [...branch.members, own],
					});
				if (branch.id !== next && inBranch)
					await setMembers.mutateAsync({
						shopId,
						id: branch.id,
						members: branch.members.filter((member) => !isMine(member)),
					});
			}
			toast.success("Đã cập nhật chi nhánh");
		} catch {
			toast.error("Không thể cập nhật chi nhánh. Vui lòng thử lại.");
		} finally {
			setSaving(false);
			router.refresh();
		}
	}

	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Field>
				<FieldLabel>Hồ sơ quyền</FieldLabel>
				<Select
					value={profileId ?? ADMIN.profile.none}
					disabled={!userId || assign.isPending}
					onValueChange={(next) =>
						userId &&
						assign.mutate({
							shopId,
							userId,
							profileId: next === ADMIN.profile.none ? null : next,
						})
					}
				>
					<SelectTrigger
						title={userId ? undefined : "Cần xét duyệt nhân viên vào CRM trước"}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value={ADMIN.profile.none}>Chưa gán hồ sơ</SelectItem>
							{profiles.map((profile) => (
								<SelectItem key={profile.id} value={profile.id}>
									{profile.name}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Chi nhánh</FieldLabel>
				<Select
					value={currentBranch}
					disabled={!own || saving || branches.length === 0}
					onValueChange={moveTo}
				>
					<SelectTrigger
						title={
							branches.length === 0
								? "Chưa có chi nhánh. Tạo chi nhánh trong Cấu hình › Chi nhánh."
								: undefined
						}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value={ADMIN.branch.noBranch}>
								Không thuộc chi nhánh
							</SelectItem>
							{branches.map((branch) => (
								<SelectItem key={branch.id} value={branch.id}>
									{branch.name}
									{branch.isDefault ? " (mặc định)" : ""}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
		</div>
	);
}
