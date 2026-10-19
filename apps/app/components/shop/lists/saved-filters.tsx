"use client";

import Settings from "@carbon/icons-react/es/Settings";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { LIST_CONFIG, type SavedFilterState } from "./config";

const TRANSIENT = new Set<string>(LIST_CONFIG.transientParams);

function currentParams(search: URLSearchParams) {
	return Object.fromEntries(
		[...search.entries()].filter(
			([key, value]) => !TRANSIENT.has(key) && value,
		),
	);
}

function useApply() {
	const router = useRouter();
	const pathname = usePathname();
	return (params: Record<string, string>, replace = false) => {
		const query = new URLSearchParams(params).toString();
		const href = query ? `${pathname}?${query}` : pathname;
		if (replace) router.replace(href);
		else router.push(href);
	};
}

export function useDefaultSavedFilter(saved?: SavedFilterState) {
	const search = useSearchParams();
	const apply = useApply();
	const done = useRef(false);
	useEffect(() => {
		if (done.current || !saved) return;
		done.current = true;
		if (search.toString()) return;
		const preset = saved.rows.find((row) => row.isDefault);
		if (preset && Object.keys(preset.params).length > 0)
			apply(preset.params, true);
	}, [saved, search, apply]);
}

function useSavedFilterMutations() {
	const api = useTRPC();
	const router = useRouter();
	const onError = (error: { message: string }) =>
		toast.error(error.message || "Không thể lưu bộ lọc. Vui lòng thử lại.");
	const done = (message: string) => () => {
		toast.success(message);
		router.refresh();
	};
	return {
		create: useMutation(
			api.pancakeSettings.createSavedFilter.mutationOptions({
				onSuccess: done("Đã lưu bộ lọc"),
				onError,
			}),
		),
		remove: useMutation(
			api.pancakeSettings.deleteSavedFilter.mutationOptions({
				onSuccess: done("Đã xoá bộ lọc"),
				onError,
			}),
		),
		setDefault: useMutation(
			api.pancakeSettings.setDefaultSavedFilter.mutationOptions({
				onSuccess: done("Đã cập nhật bộ lọc mặc định"),
				onError,
			}),
		),
	};
}

export function SavedFilterItems({ saved }: { saved: SavedFilterState }) {
	const apply = useApply();
	const { remove, setDefault } = useSavedFilterMutations();
	return (
		<>
			<DropdownMenuLabel className="flex items-center gap-1.5 text-muted-foreground text-xs">
				<Icon icon={Settings} className="size-3.5" />
				Bộ lọc đã lưu ({saved.rows.length}/{saved.max})
			</DropdownMenuLabel>
			{saved.rows.length === 0 ? (
				<DropdownMenuItem disabled>Chưa có bộ lọc đã lưu</DropdownMenuItem>
			) : null}
			{saved.rows.map((row) => (
				<DropdownMenuSub key={row.id}>
					<DropdownMenuSubTrigger className="gap-2">
						<span className="truncate">{row.name}</span>
						{row.isDefault ? <Badge variant="blue">Mặc định</Badge> : null}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem onSelect={() => apply(row.params)}>
							Áp dụng
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={setDefault.isPending}
							onSelect={() =>
								setDefault.mutate({
									shopId: saved.shopId,
									id: row.id,
									isDefault: !row.isDefault,
								})
							}
						>
							{row.isDefault ? "Bỏ mặc định" : "Đặt làm mặc định"}
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							disabled={remove.isPending}
							onSelect={() =>
								remove.mutate({ shopId: saved.shopId, id: row.id })
							}
						>
							Xoá
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			))}
		</>
	);
}

export function SaveFilterActions({ saved }: { saved: SavedFilterState }) {
	const search = useSearchParams();
	const { create } = useSavedFilterMutations();
	const [name, setName] = useState("");
	const params = currentParams(search);
	const full = saved.rows.length >= saved.max;
	const empty = Object.keys(params).length === 0;
	const reason = full
		? `Đã đạt tối đa ${saved.max} bộ lọc`
		: empty
			? "Chưa có điều kiện lọc nào"
			: undefined;
	const save = (filterName: string, isDefault: boolean) =>
		create.mutate(
			{
				shopId: saved.shopId,
				page: saved.page,
				name: filterName,
				params,
				isDefault,
			},
			{ onSuccess: () => setName("") },
		);
	const blocked = Boolean(reason) || create.isPending;
	return (
		<div className="flex flex-wrap items-center gap-2" title={reason}>
			<Input
				value={name}
				onChange={(event) => setName(event.target.value)}
				placeholder="Tên bộ lọc"
				className="h-7 w-40"
				disabled={blocked}
			/>
			<Button
				variant="outline"
				size="sm"
				disabled={blocked || !name.trim()}
				onClick={() => save(name.trim(), false)}
			>
				Lưu bộ lọc
			</Button>
			<Button
				variant="link"
				size="sm"
				className="px-0"
				disabled={blocked}
				onClick={() => save(name.trim() || LIST_CONFIG.defaultFilterName, true)}
			>
				Lưu thành bộ lọc mặc định
			</Button>
		</div>
	);
}
