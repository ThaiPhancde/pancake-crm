"use client";

import Add from "@carbon/icons-react/es/Add";
import Calendar from "@carbon/icons-react/es/Calendar";
import Edit from "@carbon/icons-react/es/Edit";
import Flash from "@carbon/icons-react/es/Flash";
import Idea from "@carbon/icons-react/es/Idea";
import Renew from "@carbon/icons-react/es/Renew";
import Search from "@carbon/icons-react/es/Search";
import Sprout from "@carbon/icons-react/es/Sprout";
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
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Switch } from "@crm/ui/components/switch";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/pancake/format";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	type AutomationDraft,
	AutomationForm,
	EMPTY_DRAFT,
	EMPTY_FIELDS,
} from "./inbox/automation-form";
import {
	AUTOMATION_ACTIONS,
	AUTOMATION_ENTITIES,
	AUTOMATION_TRIGGERS,
	type AutomationAction,
	type AutomationEntity,
	type AutomationTrigger,
	INBOX,
	labelOf,
	UNSUPPORTED_LABEL,
} from "./inbox/config";

const MANAGER_ONLY = "Chỉ chủ sở hữu hoặc quản trị viên workspace được phép.";

type Template = {
	trigger: AutomationTrigger;
	entity: AutomationEntity;
	action: AutomationAction;
	description: string;
};

const GROUPS: {
	id: string;
	title: string;
	icon: CarbonIcon;
	templates: Template[];
}[] = [
	{
		id: "suggested",
		title: "Đề xuất",
		icon: Idea,
		templates: [
			{
				trigger: "record_created",
				entity: "lead",
				action: "notify_assignee",
				description: "Gửi thông báo cho người xử lý khi tiềm năng được tạo",
			},
			{
				trigger: "record_updated",
				entity: "contact",
				action: "zalo_friend",
				description: "Gửi lời mời kết bạn Zalo khi cập nhật liên hệ",
			},
			{
				trigger: "appointment_due",
				entity: "appointment",
				action: "notify_assignee",
				description: "Gửi thông báo cho người xử lý khi đến ngày hẹn",
			},
			{
				trigger: "birthday",
				entity: "contact",
				action: "botcake_message",
				description: "Gửi tin nhắn Botcake khi đến ngày sinh nhật",
			},
		],
	},
	{
		id: "created",
		title: "Bản ghi mới",
		icon: Add,
		templates: [
			{
				trigger: "record_created",
				entity: "ticket",
				action: "notify_assignee",
				description: "Gửi thông báo cho người xử lý khi vấn đề được tạo",
			},
			{
				trigger: "record_created",
				entity: "lead",
				action: "assign_to",
				description: "Phân công người xử lý khi tạo tiềm năng",
			},
			{
				trigger: "record_created",
				entity: "lead",
				action: "send_email",
				description: "Gửi email cho người xử lý khi tiềm năng được tạo",
			},
		],
	},
	{
		id: "updated",
		title: "Cập nhật bản ghi",
		icon: Edit,
		templates: [
			{
				trigger: "record_updated",
				entity: "order",
				action: "json_api",
				description: "Gửi JSON API khi cập nhật đơn hàng",
			},
			{
				trigger: "record_updated",
				entity: "ticket",
				action: "notify_assignee",
				description: "Gửi thông báo cho người xử lý khi cập nhật vấn đề",
			},
		],
	},
	{
		id: "due",
		title: "Ngày hẹn",
		icon: Calendar,
		templates: [
			{
				trigger: "appointment_due",
				entity: "appointment",
				action: "send_email",
				description: "Gửi email nhắc lịch khi đến ngày hẹn",
			},
		],
	},
	{
		id: "birthday",
		title: "Sinh nhật",
		icon: Sprout,
		templates: [
			{
				trigger: "birthday",
				entity: "contact",
				action: "notify_assignee",
				description: "Nhắc người phụ trách chúc mừng sinh nhật khách",
			},
		],
	},
	{
		id: "convert",
		title: "Chuyển đổi",
		icon: Renew,
		templates: [
			{
				trigger: "converted",
				entity: "lead",
				action: "notify_assignee",
				description: "Gửi thông báo khi tiềm năng được chuyển đổi",
			},
		],
	},
];

const FILTERS = [
	{ value: "all", label: "Tất cả" },
	{ value: "on", label: "Đang bật" },
	{ value: "off", label: "Đã tắt" },
] as const;

function draftOf(template: Template): AutomationDraft {
	return {
		...EMPTY_DRAFT,
		name: template.description,
		trigger: template.trigger,
		entity: template.entity,
		action: template.action,
	};
}

function TemplateCard({
	template,
	disabled,
	onPick,
}: {
	template: Template;
	disabled: boolean;
	onPick: (draft: AutomationDraft) => void;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			title={disabled ? MANAGER_ONLY : undefined}
			onClick={() => onPick(draftOf(template))}
			className="flex flex-col gap-2 rounded-lg border p-4 text-left hover:border-primary/60 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<p className="font-medium text-sm">
				<span className="mr-1 text-success">⊕</span>
				{labelOf(AUTOMATION_TRIGGERS, template.trigger)}
				<span className="mx-1 text-muted-foreground">→</span>
				<span className="text-primary">🔔</span>{" "}
				{labelOf(AUTOMATION_ACTIONS, template.action)}
			</p>
			<p className="text-muted-foreground text-xs">{template.description}</p>
		</button>
	);
}

function Templates({
	canManage,
	onPick,
}: {
	canManage: boolean;
	onPick: (draft: AutomationDraft) => void;
}) {
	const [group, setGroup] = useState("suggested");
	const visible = GROUPS.filter(
		(item) => group === "suggested" || item.id === group,
	);
	return (
		<div className="grid min-h-0 flex-1 grid-cols-[200px_1fr]">
			<nav className="flex flex-col gap-0.5 border-r p-3">
				<p className="px-2 py-1 text-muted-foreground text-xs">Đề xuất</p>
				{GROUPS.map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => setGroup(item.id)}
						className={cn(
							"flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent",
							group === item.id && "bg-accent text-accent-foreground",
						)}
					>
						<Icon icon={item.icon} className="size-4" />
						{item.title}
					</button>
				))}
			</nav>
			<div className="flex flex-col gap-6 overflow-y-auto p-5">
				{visible.map((item) => (
					<section key={item.id} className="flex flex-col gap-3">
						<h3 className="font-semibold text-sm">{item.title}</h3>
						<div className="grid gap-3 md:grid-cols-3">
							{item.id === "suggested" ? (
								<button
									type="button"
									disabled={!canManage}
									title={canManage ? undefined : MANAGER_ONLY}
									onClick={() => onPick(EMPTY_DRAFT)}
									className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border p-4 hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Icon icon={Add} className="size-8 text-primary" />
									<span className="font-medium text-sm">Thêm tự động hóa</span>
								</button>
							) : null}
							{item.templates.map((template) => (
								<TemplateCard
									key={template.description}
									template={template}
									disabled={!canManage}
									onPick={onPick}
								/>
							))}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}

type AutomationRow =
	RouterOutputs["pancakeInbox"]["automations"]["rows"][number];

function editDraft(row: AutomationRow): AutomationDraft {
	const config = row.config;
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		trigger:
			AUTOMATION_TRIGGERS.find((option) => option.value === row.trigger)
				?.value ?? EMPTY_DRAFT.trigger,
		entity:
			AUTOMATION_ENTITIES.find((option) => option.value === row.entity)
				?.value ?? EMPTY_DRAFT.entity,
		action:
			AUTOMATION_ACTIONS.find((option) => option.value === row.action)?.value ??
			EMPTY_DRAFT.action,
		enabled: row.enabled,
		fields: {
			...EMPTY_FIELDS,
			title: config && "title" in config ? (config.title ?? "") : "",
			body: config && "body" in config ? (config.body ?? "") : "",
			assigneeId: config && "assigneeId" in config ? config.assigneeId : "",
			to: config && "to" in config ? (config.to ?? "") : "",
			subject: config && "subject" in config ? config.subject : "",
			message: config && "message" in config ? (config.message ?? "") : "",
			flowId:
				config && "flowId" in config && config.flowId ? `${config.flowId}` : "",
			url: config && "url" in config ? config.url : "",
			method:
				config && "method" in config ? config.method : EMPTY_FIELDS.method,
			headers:
				config && "headers" in config
					? Object.entries(config.headers)
							.map(([key, value]) => `${key}: ${value}`)
							.join("\n")
					: "",
		},
	};
}

export function AutomationList({ shopId }: { shopId: string }) {
	const api = useTRPC();
	const queryClient = useQueryClient();
	const [q, setQ] = useState("");
	const [search, changeSearch] = useSearchInput(
		q,
		setQ,
		INBOX.automations.searchDebounceMs,
	);
	const [filter, setFilter] =
		useState<(typeof FILTERS)[number]["value"]>("all");
	const [draft, setDraft] = useState<AutomationDraft | null>(null);
	const [removing, setRemoving] = useState<AutomationRow | null>(null);
	const list = useQuery(
		api.pancakeInbox.automations.queryOptions({
			shopId,
			q: q.trim(),
			enabled: filter === "all" ? undefined : filter === "on",
		}),
	);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: api.pancakeInbox.automations.pathKey(),
		});
	const toggle = useMutation(
		api.pancakeInbox.toggleAutomation.mutationOptions({
			onSuccess: (row) => {
				toast.success(
					row.enabled ? "Đã bật tự động hóa" : "Đã tắt tự động hóa",
				);
				refresh();
			},
			onError: () => toast.error(`Không thể thay đổi. ${MANAGER_ONLY}`),
		}),
	);
	const archive = useMutation(
		api.pancakeInbox.archiveAutomation.mutationOptions({
			onSuccess: () => {
				toast.success("Đã xóa tự động hóa");
				setRemoving(null);
				refresh();
			},
			onError: () => toast.error(`Không thể xóa. ${MANAGER_ONLY}`),
		}),
	);
	const canManage = list.data?.canManage ?? false;
	const rows = list.data?.rows ?? [];
	const lockTitle = canManage ? undefined : MANAGER_ONLY;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-80">
					<Icon
						icon={Search}
						className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
					/>
					<Input
						value={search}
						onChange={(event) => changeSearch(event.target.value)}
						maxLength={INBOX.search.maxLength}
						placeholder="Tìm theo tên, mô tả"
						aria-label="Tìm tự động hóa"
						className="pl-8"
					/>
				</div>
				<Select
					value={filter}
					onValueChange={(value) =>
						setFilter(
							FILTERS.find((option) => option.value === value)?.value ?? "all",
						)
					}
				>
					<SelectTrigger aria-label="Lọc trạng thái">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FILTERS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="ml-auto" title={lockTitle}>
					<Button disabled={!canManage} onClick={() => setDraft(EMPTY_DRAFT)}>
						<Icon icon={Add} data-icon="inline-start" />
						Thêm tự động hóa
					</Button>
				</span>
			</div>
			{rows.length === 0 ? (
				<p className="py-16 text-center text-muted-foreground text-xs">
					{list.isLoading
						? "Đang tải tự động hóa…"
						: list.isError
							? "Không tải được danh sách tự động hóa."
							: q || filter !== "all"
								? "Không có tự động hóa phù hợp."
								: 'Chưa có tự động hóa nào! Bấm "Thêm tự động hóa" để bắt đầu.'}
				</p>
			) : (
				<div className="flex flex-col divide-y rounded-lg border">
					{rows.map((row) => (
						<div key={row.id} className="flex items-center gap-3 px-4 py-3">
							<span title={lockTitle}>
								<Switch
									checked={row.enabled}
									disabled={!canManage || toggle.isPending}
									aria-label={row.enabled ? "Tắt" : "Bật"}
									onCheckedChange={(enabled) =>
										toggle.mutate({ shopId, id: row.id, enabled })
									}
								/>
							</span>
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<div className="flex flex-wrap items-center gap-2">
									<span className="truncate font-medium text-sm">
										{row.name}
									</span>
									{row.supported ? null : (
										<Badge variant="soft-orange">{UNSUPPORTED_LABEL}</Badge>
									)}
									{row.supported && row.status ? (
										<Badge variant="outline">{row.status}</Badge>
									) : null}
								</div>
								<span className="text-muted-foreground text-xs">
									{labelOf(AUTOMATION_TRIGGERS, row.trigger)} ·{" "}
									{labelOf(AUTOMATION_ENTITIES, row.entity)} →{" "}
									{labelOf(AUTOMATION_ACTIONS, row.action)}
								</span>
								{row.description ? (
									<span className="truncate text-muted-foreground text-xs">
										{row.description}
									</span>
								) : null}
							</div>
							<span className="hidden shrink-0 text-right text-muted-foreground text-xs md:block">
								{row.createdBy.name}
								<br />
								{row.lastRunAt
									? `Chạy: ${formatDate(row.lastRunAt)}`
									: "Chưa chạy"}
							</span>
							<span title={lockTitle}>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Sửa"
									disabled={!canManage}
									onClick={() => setDraft(editDraft(row))}
								>
									<Icon icon={Edit} />
								</Button>
							</span>
							<span title={lockTitle}>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Xóa"
									disabled={!canManage}
									onClick={() => setRemoving(row)}
								>
									<Icon icon={TrashCan} />
								</Button>
							</span>
						</div>
					))}
				</div>
			)}
			<AutomationForm
				shopId={shopId}
				draft={draft}
				onClose={() => setDraft(null)}
			/>
			<AlertDialog
				open={removing !== null}
				onOpenChange={(open) => !open && setRemoving(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Xóa tự động hóa?</AlertDialogTitle>
						<AlertDialogDescription>
							"{removing?.name}" sẽ ngừng chạy và bị xóa khỏi danh sách.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={archive.isPending}>
							Hủy
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={archive.isPending}
							onClick={(event) => {
								event.preventDefault();
								if (removing) archive.mutate({ shopId, id: removing.id });
							}}
						>
							Xóa
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export function AutomationCenter({
	shopId,
	label,
}: {
	shopId: string;
	label?: string;
}) {
	const api = useTRPC();
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<"suggested" | "manage">("suggested");
	const [draft, setDraft] = useState<AutomationDraft | null>(null);
	const summary = useQuery({
		...api.pancakeInbox.automations.queryOptions({ shopId, q: "" }),
		enabled: open || Boolean(label),
	});
	const canManage = summary.data?.canManage ?? false;
	return (
		<>
			{label ? (
				<span title={canManage ? undefined : MANAGER_ONLY}>
					<Button disabled={!canManage} onClick={() => setOpen(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						{label}
					</Button>
				</span>
			) : (
				<Button
					variant="ghost"
					size="icon"
					aria-label="Trung tâm tự động hóa"
					title="Trung tâm tự động hóa"
					onClick={() => setOpen(true)}
					className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
				>
					<Icon icon={Flash} />
				</Button>
			)}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="flex h-[80vh] max-w-5xl flex-col gap-0 p-0 sm:max-w-5xl">
					<DialogHeader className="flex-row items-center gap-6 border-b px-5 py-3">
						<DialogTitle className="flex items-center gap-2 text-base">
							<Icon icon={Flash} className="size-4 text-primary" />
							Trung tâm tự động hóa
						</DialogTitle>
						<div className="flex gap-4 text-sm">
							{(
								[
									{ value: "suggested", label: "Được đề xuất" },
									{
										value: "manage",
										label: `Quản lý (${summary.data?.active ?? 0}/${summary.data?.total ?? 0})`,
									},
								] as const
							).map((tab) => (
								<button
									key={tab.value}
									type="button"
									onClick={() => setView(tab.value)}
									className={cn(
										"border-b-2 border-transparent pb-1",
										view === tab.value
											? "border-primary text-primary"
											: "text-muted-foreground",
									)}
								>
									{tab.label}
								</button>
							))}
						</div>
					</DialogHeader>
					{view === "suggested" ? (
						<Templates canManage={canManage} onPick={setDraft} />
					) : (
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
							<AutomationList shopId={shopId} />
						</div>
					)}
				</DialogContent>
			</Dialog>
			<AutomationForm
				shopId={shopId}
				draft={draft}
				onClose={() => setDraft(null)}
			/>
		</>
	);
}
