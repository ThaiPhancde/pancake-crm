"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
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
import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { LIST_CONFIG } from "./config";

export type BulkConfig = {
	shopId: string;
	entity: "lead" | "appointment" | "ticket";
	statuses: { value: string; label: string }[];
	staff: { value: string; label: string }[];
	canWrite: boolean;
};

type Selection = {
	ids: string[];
	selected: Set<string>;
	toggle: (id: string, on: boolean) => void;
	setAll: (on: boolean) => void;
};

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
	const value = useContext(SelectionContext);
	if (!value) throw new Error("SelectionProvider missing");
	return value;
}

export function SelectionProvider({
	ids,
	children,
}: {
	ids: string[];
	children: React.ReactNode;
}) {
	const [picked, setPicked] = useState<Set<string>>(new Set());
	const selected = new Set(ids.filter((id) => picked.has(id)));
	const value: Selection = {
		ids,
		selected,
		toggle: (id, on) =>
			setPicked((prev) => {
				const next = new Set(prev);
				if (on) next.add(id);
				else next.delete(id);
				return next;
			}),
		setAll: (on) => setPicked(on ? new Set(ids) : new Set()),
	};
	return (
		<SelectionContext.Provider value={value}>
			{children}
		</SelectionContext.Provider>
	);
}

export function SelectAllCheckbox() {
	const { ids, selected, setAll } = useSelection();
	const all = ids.length > 0 && selected.size === ids.length;
	return (
		<Checkbox
			aria-label="Chọn tất cả"
			checked={all ? true : selected.size > 0 ? "indeterminate" : false}
			disabled={ids.length === 0}
			onCheckedChange={(checked) => setAll(checked === true)}
		/>
	);
}

export function RowCheckbox({ id }: { id: string }) {
	const { selected, toggle } = useSelection();
	return (
		<Checkbox
			aria-label="Chọn dòng"
			checked={selected.has(id)}
			onCheckedChange={(checked) => toggle(id, checked === true)}
		/>
	);
}

export function BulkBar({ config }: { config: BulkConfig }) {
	const { selected, setAll } = useSelection();
	const api = useTRPC();
	const router = useRouter();
	const mutation = useMutation(
		api.pancake.bulkUpdate.mutationOptions({
			onSuccess: (result) => {
				if (result.failed.length > 0) {
					const shown = result.failed.slice(0, LIST_CONFIG.failedIdsShown);
					const more = result.failed.length - shown.length;
					toast.warning(
						`Đã cập nhật ${result.updated.length}, lỗi ${result.failed.length}: ${shown.join(", ")}${more > 0 ? ` và ${more} bản ghi khác` : ""}`,
					);
				} else {
					toast.success(`Đã cập nhật ${result.updated.length} bản ghi`);
				}
				setAll(false);
				router.refresh();
			},
			onError: () => toast.error("Không thể cập nhật. Vui lòng thử lại."),
		}),
	);
	if (selected.size === 0) return null;
	const base = {
		shopId: config.shopId,
		entity: config.entity,
		ids: [...selected],
	};
	const disabled = !config.canWrite || mutation.isPending;
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs">
			<span className="font-medium">Đã chọn {selected.size}</span>
			<Select
				value=""
				disabled={disabled}
				onValueChange={(status) => mutation.mutate({ ...base, status })}
			>
				<SelectTrigger size="sm" aria-label="Đổi trạng thái">
					<SelectValue placeholder="Đổi trạng thái" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{config.statuses.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<Select
				value=""
				disabled={disabled}
				onValueChange={(assignee) =>
					mutation.mutate({
						...base,
						assigneeId: assignee === LIST_CONFIG.unassigned ? null : assignee,
					})
				}
			>
				<SelectTrigger size="sm" aria-label="Phân công">
					<SelectValue placeholder="Phân công" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectItem value={LIST_CONFIG.unassigned}>Bỏ phân công</SelectItem>
						{config.staff.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button variant="ghost" size="sm" onClick={() => setAll(false)}>
				Bỏ chọn
			</Button>
			{config.canWrite ? null : (
				<span className="text-muted-foreground">
					Bạn chỉ có quyền xem các bản ghi này
				</span>
			)}
		</div>
	);
}
