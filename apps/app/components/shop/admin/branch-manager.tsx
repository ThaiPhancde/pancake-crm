"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import Search from "@carbon/icons-react/es/Search";
import TrashCan from "@carbon/icons-react/es/TrashCan";
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
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export type MemberRef = { userId: string } | { employeeId: string };

export type BranchPerson = {
	key: string;
	name: string;
	detail: string;
	ref: MemberRef;
};

export type BranchItem = {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	address: string | null;
	isDefault: boolean;
	memberKeys: string[];
};

function field(form: FormData, key: string) {
	return String(form.get(key) ?? "").trim();
}

function matches(text: string, query: string) {
	return text.toLowerCase().includes(query.trim().toLowerCase());
}

export function BranchManager({
	shopId,
	branches,
	people,
	phonePlaceholder,
}: {
	shopId: string;
	branches: BranchItem[];
	people: BranchPerson[];
	phonePlaceholder: string;
}) {
	const api = useTRPC();
	const router = useRouter();
	const [selectedId, setSelectedId] = useState(branches[0]?.id ?? "");
	const [branchQuery, setBranchQuery] = useState("");
	const [memberQuery, setMemberQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [adding, setAdding] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const [pickQuery, setPickQuery] = useState("");
	const fail = () => toast.error("Không thể lưu. Vui lòng thử lại.");
	const done = (message: string) => {
		toast.success(message);
		router.refresh();
	};
	const create = useMutation(
		api.pancakeSettings.createBranch.mutationOptions({
			onSuccess: (row) => {
				setCreating(false);
				setSelectedId(row.id);
				done("Đã tạo chi nhánh");
			},
			onError: fail,
		}),
	);
	const update = useMutation(
		api.pancakeSettings.updateBranch.mutationOptions({
			onSuccess: () => done("Đã lưu chi nhánh"),
			onError: fail,
		}),
	);
	const archive = useMutation(
		api.pancakeSettings.archiveBranch.mutationOptions({
			onSuccess: () => {
				setSelectedId("");
				done("Đã xoá chi nhánh");
			},
			onError: fail,
		}),
	);
	const members = useMutation(
		api.pancakeSettings.setBranchMembers.mutationOptions({
			onSuccess: () => {
				closePicker();
				done("Đã cập nhật nhân viên chi nhánh");
			},
			onError: fail,
		}),
	);

	const selected =
		branches.find((branch) => branch.id === selectedId) ?? branches[0];
	const personByKey = new Map(people.map((person) => [person.key, person]));
	const visibleBranches = branches.filter((branch) =>
		matches(branch.name, branchQuery),
	);
	const branchMembers = (selected?.memberKeys ?? []).flatMap((key) => {
		const person = personByKey.get(key);
		return person ? [person] : [];
	});
	const visibleMembers = branchMembers.filter((person) =>
		matches(`${person.name} ${person.detail}`, memberQuery),
	);
	const candidates = people.filter(
		(person) =>
			!selected?.memberKeys.includes(person.key) &&
			matches(`${person.name} ${person.detail}`, pickQuery),
	);

	function closePicker() {
		setAdding(false);
		setPicked([]);
		setPickQuery("");
	}

	function saveMembers(keys: string[]) {
		if (!selected) return;
		members.mutate({
			shopId,
			id: selected.id,
			members: keys.flatMap((key) => {
				const person = personByKey.get(key);
				return person ? [person.ref] : [];
			}),
		});
	}

	function submitCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		create.mutate({
			shopId,
			name: field(form, "name"),
			phone: field(form, "phone") || null,
			email: field(form, "email") || null,
			address: field(form, "address") || null,
			isDefault: form.get("isDefault") === "on",
		});
	}

	function submitUpdate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selected) return;
		const form = new FormData(event.currentTarget);
		update.mutate({
			shopId,
			id: selected.id,
			name: field(form, "name"),
			phone: field(form, "phone") || null,
			email: field(form, "email") || null,
			address: field(form, "address") || null,
			isDefault:
				!selected.isDefault && form.get("isDefault") === "on"
					? true
					: undefined,
		});
	}

	return (
		<div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
			<aside className="flex flex-col gap-3 rounded-lg bg-card p-4">
				<h2 className="font-semibold text-sm">Danh sách chi nhánh</h2>
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Icon
							icon={Search}
							className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
						/>
						<Input
							value={branchQuery}
							onChange={(event) => setBranchQuery(event.target.value)}
							placeholder="Tìm kiếm chi nhánh"
							className="pl-8"
						/>
					</div>
					<Button
						size="icon"
						aria-label="Thêm chi nhánh"
						onClick={() => setCreating(true)}
					>
						<Icon icon={Add} />
					</Button>
				</div>
				{visibleBranches.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-xs">
						{branches.length === 0
							? "Chưa có chi nhánh. Bấm + để tạo chi nhánh đầu tiên."
							: "Không tìm thấy chi nhánh"}
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{visibleBranches.map((branch) => (
							<li key={branch.id}>
								<button
									type="button"
									onClick={() => setSelectedId(branch.id)}
									className={cn(
										"w-full rounded-md border p-3 text-left hover:bg-accent/40",
										branch.id === selected?.id && "border-primary bg-accent/40",
									)}
								>
									<p className="font-medium text-sm">{branch.name}</p>
									{branch.isDefault ? (
										<p className="text-muted-foreground text-xs italic">
											(Chi nhánh mặc định)
										</p>
									) : null}
								</button>
							</li>
						))}
					</ul>
				)}
			</aside>

			{selected ? (
				<div className="flex flex-col gap-4 rounded-lg bg-card p-5">
					<form
						key={selected.id}
						onSubmit={submitUpdate}
						className="flex flex-col gap-4"
					>
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-base">{selected.name}</h2>
							<div className="flex items-center gap-3 text-xs">
								<label
									htmlFor="branch-default"
									className="flex items-center gap-2"
								>
									<Checkbox
										id="branch-default"
										name="isDefault"
										defaultChecked={selected.isDefault}
										disabled={selected.isDefault}
									/>
									Đặt làm mặc định
								</label>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											type="button"
											variant="outline"
											size="icon-sm"
											aria-label="Xoá chi nhánh"
											disabled={archive.isPending}
										>
											<Icon icon={TrashCan} />
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Xoá chi nhánh {selected.name}?
											</AlertDialogTitle>
											<AlertDialogDescription>
												Chi nhánh được lưu trữ và không còn hiển thị. Nhân viên
												của chi nhánh vẫn thuộc shop.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Huỷ</AlertDialogCancel>
											<AlertDialogAction
												variant="destructive"
												onClick={() =>
													archive.mutate({ shopId, id: selected.id })
												}
											>
												Xoá
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</div>
						<section className="flex flex-col gap-3 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-sm">Thông tin chung</h3>
								<Button type="submit" size="sm" disabled={update.isPending}>
									Lưu
								</Button>
							</div>
							<BranchFields
								branch={selected}
								phonePlaceholder={phonePlaceholder}
							/>
						</section>
					</form>
					<section className="flex flex-col gap-3 rounded-lg border p-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h3 className="flex items-center gap-2 font-semibold text-sm">
								Nhân viên chi nhánh
								<Badge variant="soft-blue">{branchMembers.length}</Badge>
							</h3>
							<div className="flex items-center gap-2">
								<div className="relative">
									<Icon
										icon={Search}
										className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
									/>
									<Input
										value={memberQuery}
										onChange={(event) => setMemberQuery(event.target.value)}
										placeholder="Tìm kiếm nhân viên…"
										className="w-56 pl-8"
									/>
								</div>
								<Button
									onClick={() => setAdding(true)}
									disabled={people.length === 0}
								>
									<Icon icon={Add} data-icon="inline-start" />
									Thêm nhân viên
								</Button>
							</div>
						</div>
						{visibleMembers.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground text-xs">
								Chưa có nhân viên trong chi nhánh
							</p>
						) : (
							<ul className="flex flex-col divide-y text-xs">
								{visibleMembers.map((person) => (
									<li
										key={person.key}
										className="flex items-center justify-between gap-3 py-2"
									>
										<span className="flex flex-col">
											<span className="font-medium">{person.name}</span>
											<span className="text-muted-foreground">
												{person.detail}
											</span>
										</span>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Bỏ ${person.name} khỏi chi nhánh`}
											disabled={members.isPending}
											onClick={() =>
												saveMembers(
													selected.memberKeys.filter(
														(key) => key !== person.key,
													),
												)
											}
										>
											<Icon icon={Close} />
										</Button>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>
			) : (
				<div className="flex items-center justify-center rounded-lg bg-card p-5 text-muted-foreground text-sm">
					Chọn hoặc tạo một chi nhánh
				</div>
			)}

			<Dialog open={creating} onOpenChange={setCreating}>
				<DialogContent>
					<form onSubmit={submitCreate}>
						<DialogHeader>
							<DialogTitle>Thêm chi nhánh</DialogTitle>
						</DialogHeader>
						<FieldGroup className="py-4">
							<BranchFields phonePlaceholder={phonePlaceholder} />
							<label
								htmlFor="branch-new-default"
								className="flex items-center gap-2 text-xs"
							>
								<Checkbox id="branch-new-default" name="isDefault" />
								Đặt làm mặc định
							</label>
						</FieldGroup>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreating(false)}
							>
								Huỷ
							</Button>
							<Button type="submit" disabled={create.isPending}>
								Tạo chi nhánh
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={adding}
				onOpenChange={(open) => (open ? setAdding(true) : closePicker())}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Thêm nhân viên vào {selected?.name}</DialogTitle>
					</DialogHeader>
					<Input
						value={pickQuery}
						onChange={(event) => setPickQuery(event.target.value)}
						placeholder="Tìm kiếm nhân viên…"
					/>
					<ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-xs">
						{candidates.length === 0 ? (
							<li className="py-6 text-center text-muted-foreground">
								Không còn nhân viên để thêm
							</li>
						) : (
							candidates.map((person) => (
								<li key={person.key}>
									<label
										htmlFor={`pick-${person.key}`}
										className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40"
									>
										<Checkbox
											id={`pick-${person.key}`}
											checked={picked.includes(person.key)}
											onCheckedChange={(on) =>
												setPicked((current) =>
													on
														? [...current, person.key]
														: current.filter((key) => key !== person.key),
												)
											}
										/>
										<span className="flex flex-col">
											<span className="font-medium">{person.name}</span>
											<span className="text-muted-foreground">
												{person.detail}
											</span>
										</span>
									</label>
								</li>
							))
						)}
					</ul>
					<DialogFooter>
						<Button variant="outline" onClick={closePicker}>
							Huỷ
						</Button>
						<Button
							disabled={picked.length === 0 || members.isPending}
							onClick={() =>
								saveMembers([...(selected?.memberKeys ?? []), ...picked])
							}
						>
							Thêm {picked.length || ""} nhân viên
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function BranchFields({
	branch,
	phonePlaceholder,
}: {
	branch?: BranchItem;
	phonePlaceholder: string;
}) {
	const id = branch?.id ?? "new";
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Field>
				<FieldLabel htmlFor={`branch-name-${id}`}>
					Tên chi nhánh <span className="text-destructive">*</span>
				</FieldLabel>
				<Input
					id={`branch-name-${id}`}
					name="name"
					required
					defaultValue={branch?.name}
					placeholder="Nhập tên chi nhánh"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`branch-phone-${id}`}>Số điện thoại</FieldLabel>
				<Input
					id={`branch-phone-${id}`}
					name="phone"
					defaultValue={branch?.phone ?? ""}
					placeholder={phonePlaceholder}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`branch-email-${id}`}>Email</FieldLabel>
				<Input
					id={`branch-email-${id}`}
					name="email"
					type="email"
					defaultValue={branch?.email ?? ""}
					placeholder="Nhập email"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`branch-address-${id}`}>Địa chỉ</FieldLabel>
				<Input
					id={`branch-address-${id}`}
					name="address"
					defaultValue={branch?.address ?? ""}
					placeholder="Nhập địa chỉ"
				/>
			</Field>
		</div>
	);
}
