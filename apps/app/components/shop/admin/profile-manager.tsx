"use client";

import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Search from "@carbon/icons-react/es/Search";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Alert, AlertDescription } from "@crm/ui/components/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import {
	PERMISSION_ACTION_LABELS,
	PERMISSION_ENTITY_LABELS,
	type PermissionAction,
	type PermissionEntity,
	type PermissionMatrix,
	type PermissionRights,
} from "./config";

export type ProfileItem = {
	id: string;
	name: string;
	matrix: PermissionMatrix;
	memberCount: number;
};

const ENTITIES = Object.keys(PERMISSION_ENTITY_LABELS) as PermissionEntity[];
const ACTIONS = Object.keys(PERMISSION_ACTION_LABELS) as PermissionAction[];

function emptyRights(): PermissionRights {
	return {
		configure: false,
		view: false,
		edit: false,
		delete: false,
		create: false,
		export: false,
	};
}

function fullMatrix(matrix: PermissionMatrix): PermissionMatrix {
	return Object.fromEntries(
		ENTITIES.map((entity) => [entity, matrix[entity] ?? emptyRights()]),
	);
}

export function ProfilesNotEnforced() {
	return (
		<Alert>
			<AlertDescription>
				Hồ sơ quyền đang được lưu nhưng chưa được áp dụng để giới hạn quyền truy
				cập. Quyền thực tế vẫn theo vai trò Quản lý / Telesale / Người xem.
			</AlertDescription>
		</Alert>
	);
}

export function PermissionGrid({
	matrix,
	onChange,
}: {
	matrix: PermissionMatrix;
	onChange?: (entity: PermissionEntity, action: PermissionAction) => void;
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
								{PERMISSION_ACTION_LABELS[action]}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y">
					{ENTITIES.map((entity) => (
						<tr key={entity} className="hover:bg-accent/20">
							<td className="px-3.5 py-3 font-medium">
								{PERMISSION_ENTITY_LABELS[entity]}
							</td>
							{ACTIONS.map((action) => {
								const on = Boolean(matrix[entity]?.[action]);
								return (
									<td key={action} className="px-3 py-3 text-center">
										{onChange ? (
											<Checkbox
												checked={on}
												aria-label={`${PERMISSION_ENTITY_LABELS[entity]}: ${PERMISSION_ACTION_LABELS[action]}`}
												onCheckedChange={() => onChange(entity, action)}
											/>
										) : on ? (
											<Icon
												icon={Checkmark}
												className="inline size-4 text-emerald-600"
											/>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function ProfileManager({
	shopId,
	profiles,
}: {
	shopId: string;
	profiles: ProfileItem[];
}) {
	const api = useTRPC();
	const router = useRouter();
	const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [draft, setDraft] = useState<{
		name: string;
		matrix: PermissionMatrix;
	} | null>(null);
	const fail = () => toast.error("Không thể lưu. Vui lòng thử lại.");
	const create = useMutation(
		api.pancakeSettings.createProfile.mutationOptions({
			onSuccess: (row) => {
				setCreating(false);
				setSelectedId(row.id);
				toast.success("Đã tạo hồ sơ");
				router.refresh();
			},
			onError: fail,
		}),
	);
	const update = useMutation(
		api.pancakeSettings.updateProfile.mutationOptions({
			onSuccess: () => {
				setDraft(null);
				toast.success("Đã lưu hồ sơ");
				router.refresh();
			},
			onError: fail,
		}),
	);
	const remove = useMutation(
		api.pancakeSettings.deleteProfile.mutationOptions({
			onSuccess: () => {
				setSelectedId("");
				toast.success("Đã xoá hồ sơ");
				router.refresh();
			},
			onError: () => toast.error("Không thể xoá hồ sơ. Vui lòng thử lại."),
		}),
	);

	const visible = profiles.filter((profile) =>
		profile.name.toLowerCase().includes(query.trim().toLowerCase()),
	);
	const selected =
		profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

	function toggle(entity: PermissionEntity, action: PermissionAction) {
		setDraft((current) => {
			if (!current) return current;
			const rights = current.matrix[entity] ?? emptyRights();
			return {
				...current,
				matrix: {
					...current.matrix,
					[entity]: { ...rights, [action]: !rights[action] },
				},
			};
		});
	}

	function submitCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = String(
			new FormData(event.currentTarget).get("name") ?? "",
		).trim();
		if (!name) return;
		create.mutate({ shopId, name, matrix: fullMatrix({}) });
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="px-5 pt-4">
				<ProfilesNotEnforced />
			</div>
			<div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
				<aside className="flex flex-col gap-2 border-r p-4">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Icon
								icon={Search}
								className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
							/>
							<Input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Tìm kiếm hồ sơ"
								className="pl-8"
							/>
						</div>
						<Button
							size="icon"
							aria-label="Thêm hồ sơ"
							onClick={() => setCreating(true)}
						>
							<Icon icon={Add} />
						</Button>
					</div>
					<ul className="flex flex-col gap-1 pt-1">
						{visible.length === 0 ? (
							<li className="py-6 text-center text-muted-foreground text-xs">
								Không tìm thấy hồ sơ
							</li>
						) : (
							visible.map((profile) => (
								<li key={profile.id}>
									<button
										type="button"
										onClick={() => {
											setSelectedId(profile.id);
											setDraft(null);
										}}
										className={cn(
											"flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent/40",
											profile.id === selected?.id &&
												"bg-accent font-semibold text-primary",
										)}
									>
										<span>{profile.name}</span>
										<Badge variant="secondary">{profile.memberCount}</Badge>
									</button>
								</li>
							))
						)}
					</ul>
				</aside>

				{selected ? (
					<div className="flex flex-col gap-4 p-5">
						<div className="flex items-start justify-between gap-4 border-b pb-4">
							<div className="flex-1 space-y-1">
								{draft ? (
									<Field>
										<FieldLabel htmlFor="profile-name">Tên hồ sơ</FieldLabel>
										<Input
											id="profile-name"
											value={draft.name}
											onChange={(event) =>
												setDraft({ ...draft, name: event.target.value })
											}
										/>
									</Field>
								) : (
									<h2 className="font-bold text-lg">{selected.name}</h2>
								)}
								<p className="max-w-3xl text-muted-foreground text-xs">
									Hồ sơ giúp bạn định nghĩa một bộ quyền hạn để gán cho các nhân
									viên có cùng vai trò. {selected.memberCount} nhân viên đang
									dùng hồ sơ này.
								</p>
							</div>
							<div className="flex items-center gap-2">
								{draft ? (
									<>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setDraft(null)}
										>
											Huỷ
										</Button>
										<Button
											size="sm"
											disabled={!draft.name.trim() || update.isPending}
											onClick={() =>
												update.mutate({
													shopId,
													id: selected.id,
													name: draft.name.trim(),
													matrix: fullMatrix(draft.matrix),
												})
											}
										>
											Lưu
										</Button>
									</>
								) : (
									<>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setDraft({
													name: selected.name,
													matrix: fullMatrix(selected.matrix),
												})
											}
										>
											Chỉnh sửa
										</Button>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button
													variant="outline"
													size="icon-sm"
													aria-label="Xoá hồ sơ"
													disabled={remove.isPending}
												>
													<Icon icon={TrashCan} />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Xoá hồ sơ {selected.name}?
													</AlertDialogTitle>
													<AlertDialogDescription>
														{selected.memberCount} nhân viên đang dùng hồ sơ này
														sẽ không còn hồ sơ quyền.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Huỷ</AlertDialogCancel>
													<AlertDialogAction
														variant="destructive"
														onClick={() =>
															remove.mutate({ shopId, id: selected.id })
														}
													>
														Xoá
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</>
								)}
							</div>
						</div>
						<PermissionGrid
							matrix={draft ? draft.matrix : selected.matrix}
							onChange={draft ? toggle : undefined}
						/>
					</div>
				) : (
					<div className="flex items-center justify-center p-5 text-muted-foreground text-sm">
						Chưa có hồ sơ
					</div>
				)}
			</div>

			<Dialog open={creating} onOpenChange={setCreating}>
				<DialogContent>
					<form onSubmit={submitCreate}>
						<DialogHeader>
							<DialogTitle>Thêm hồ sơ</DialogTitle>
						</DialogHeader>
						<Field className="py-4">
							<FieldLabel htmlFor="profile-new-name">
								Tên hồ sơ <span className="text-destructive">*</span>
							</FieldLabel>
							<Input
								id="profile-new-name"
								name="name"
								required
								placeholder="Ví dụ: Trưởng nhóm sale"
							/>
						</Field>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreating(false)}
							>
								Huỷ
							</Button>
							<Button type="submit" disabled={create.isPending}>
								Tạo hồ sơ
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
