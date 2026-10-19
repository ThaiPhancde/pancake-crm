"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Switch } from "@crm/ui/components/switch";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import {
	ASSIGNABLE_ENTITIES,
	AUTOMATION_ACTIONS,
	AUTOMATION_ENTITIES,
	AUTOMATION_TRIGGERS,
	type AutomationAction,
	type AutomationEntity,
	type AutomationTrigger,
	JSON_API_METHODS,
	SUPPORTED_ACTIONS,
	UNSUPPORTED_LABEL,
} from "./config";

export type AutomationFields = {
	title: string;
	body: string;
	assigneeId: string;
	to: string;
	subject: string;
	message: string;
	flowId: string;
	url: string;
	method: string;
	headers: string;
};

export type AutomationDraft = {
	id: string | null;
	name: string;
	description: string;
	trigger: AutomationTrigger;
	entity: AutomationEntity;
	action: AutomationAction;
	enabled: boolean;
	fields: AutomationFields;
};

export const EMPTY_FIELDS: AutomationFields = {
	title: "",
	body: "",
	assigneeId: "",
	to: "",
	subject: "",
	message: "",
	flowId: "",
	url: "",
	method: "POST",
	headers: "",
};

export const EMPTY_DRAFT: AutomationDraft = {
	id: null,
	name: "",
	description: "",
	trigger: "record_created",
	entity: "lead",
	action: "notify_assignee",
	enabled: true,
	fields: EMPTY_FIELDS,
};

function optional(value: string) {
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function headersOf(text: string) {
	const headers: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const index = line.indexOf(":");
		if (index <= 0) continue;
		const key = line.slice(0, index).trim();
		if (key) headers[key] = line.slice(index + 1).trim();
	}
	return headers;
}

function ruleOf(action: AutomationAction, fields: AutomationFields) {
	switch (action) {
		case "notify_assignee":
			return {
				action,
				config: { title: optional(fields.title), body: optional(fields.body) },
			};
		case "assign_to":
			return { action, config: { assigneeId: fields.assigneeId } };
		case "send_email":
			return {
				action,
				config: {
					to: optional(fields.to),
					subject: fields.subject.trim(),
					body: fields.body.trim(),
				},
			};
		case "zalo_friend":
			return { action, config: { message: optional(fields.message) } };
		case "botcake_message":
			return {
				action,
				config: {
					flowId: fields.flowId.trim(),
					message: optional(fields.message),
				},
			};
		case "json_api":
			return {
				action,
				config: {
					url: fields.url.trim(),
					method:
						JSON_API_METHODS.find((method) => method === fields.method) ??
						"POST",
					headers: headersOf(fields.headers),
				},
			};
	}
}

function missing(draft: AutomationDraft) {
	const { fields } = draft;
	if (!draft.name.trim()) return "Nhập tên tự động hóa.";
	if (draft.action === "assign_to") {
		if (!ASSIGNABLE_ENTITIES.some((entity) => entity === draft.entity))
			return "Phân công chỉ áp dụng cho tiềm năng, lịch hẹn hoặc vấn đề.";
		if (!fields.assigneeId) return "Chọn người xử lý.";
	}
	if (draft.action === "send_email" && !fields.subject.trim())
		return "Nhập tiêu đề email.";
	if (draft.action === "botcake_message" && !fields.flowId.trim())
		return "Nhập mã flow Botcake.";
	if (draft.action === "json_api" && !fields.url.trim().startsWith("https://"))
		return "URL phải bắt đầu bằng https://";
	return null;
}

function Choice({
	id,
	label,
	value,
	options,
	onChange,
	disabled,
	placeholder,
}: {
	id: string;
	label: string;
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Select value={value} onValueChange={onChange} disabled={disabled}>
				<SelectTrigger id={id} className="w-full">
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function Text({
	id,
	label,
	value,
	onChange,
	placeholder,
	multiline,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{multiline ? (
				<Textarea
					id={id}
					rows={3}
					value={value}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<Input
					id={id}
					value={value}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</div>
	);
}

export function AutomationForm({
	shopId,
	draft,
	onClose,
}: {
	shopId: string;
	draft: AutomationDraft | null;
	onClose: () => void;
}) {
	return (
		<Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				{draft ? (
					<AutomationFormBody
						key={draft.id ?? `${draft.trigger}-${draft.action}`}
						shopId={shopId}
						initial={draft}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AutomationFormBody({
	shopId,
	initial,
	onClose,
}: {
	shopId: string;
	initial: AutomationDraft;
	onClose: () => void;
}) {
	const api = useTRPC();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState(initial);
	const sellers = useQuery({
		...api.pancake.sellers.queryOptions({ shopId }),
		enabled: draft.action === "assign_to",
	});
	const handlers = {
		onSuccess: () => {
			toast.success(
				initial.id ? "Đã cập nhật tự động hóa" : "Đã tạo tự động hóa",
			);
			queryClient.invalidateQueries({
				queryKey: api.pancakeInbox.automations.pathKey(),
			});
			onClose();
		},
		onError: () =>
			toast.error(
				"Không thể lưu tự động hóa. Kiểm tra cấu hình hoặc quyền quản lý.",
			),
	};
	const create = useMutation(
		api.pancakeInbox.createAutomation.mutationOptions(handlers),
	);
	const update = useMutation(
		api.pancakeInbox.updateAutomation.mutationOptions(handlers),
	);
	const pending = create.isPending || update.isPending;
	const supported = SUPPORTED_ACTIONS.some((action) => action === draft.action);
	const setField = (key: keyof AutomationFields) => (value: string) =>
		setDraft((current) => ({
			...current,
			fields: { ...current.fields, [key]: value },
		}));
	const staff = (sellers.data ?? []).map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));

	function save() {
		const problem = missing(draft);
		if (problem) {
			toast.error(problem);
			return;
		}
		const payload = {
			shopId,
			name: draft.name.trim(),
			description: draft.description.trim(),
			trigger: draft.trigger,
			entity: draft.entity,
			rule: ruleOf(draft.action, draft.fields),
			enabled: draft.enabled,
		};
		if (initial.id) update.mutate({ ...payload, id: initial.id });
		else create.mutate(payload);
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{initial.id ? "Sửa tự động hóa" : "Thêm tự động hóa"}
				</DialogTitle>
				<DialogDescription>
					Chọn sự kiện kích hoạt, loại bản ghi và hành động cần thực hiện.
				</DialogDescription>
			</DialogHeader>
			<div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
				<Text
					id="automation-name"
					label="Tên"
					value={draft.name}
					onChange={(name) => setDraft((current) => ({ ...current, name }))}
				/>
				<Text
					id="automation-description"
					label="Mô tả"
					value={draft.description}
					onChange={(description) =>
						setDraft((current) => ({ ...current, description }))
					}
				/>
				<div className="grid gap-4 sm:grid-cols-2">
					<Choice
						id="automation-trigger"
						label="Khi"
						value={draft.trigger}
						options={AUTOMATION_TRIGGERS}
						onChange={(value) => {
							const trigger = AUTOMATION_TRIGGERS.find(
								(option) => option.value === value,
							)?.value;
							if (trigger) setDraft((current) => ({ ...current, trigger }));
						}}
					/>
					<Choice
						id="automation-entity"
						label="Bản ghi"
						value={draft.entity}
						options={AUTOMATION_ENTITIES}
						onChange={(value) => {
							const entity = AUTOMATION_ENTITIES.find(
								(option) => option.value === value,
							)?.value;
							if (entity) setDraft((current) => ({ ...current, entity }));
						}}
					/>
				</div>
				<Choice
					id="automation-action"
					label="Hành động"
					value={draft.action}
					options={AUTOMATION_ACTIONS}
					onChange={(value) => {
						const action = AUTOMATION_ACTIONS.find(
							(option) => option.value === value,
						)?.value;
						if (action) setDraft((current) => ({ ...current, action }));
					}}
				/>
				{supported ? null : (
					<p className="flex items-center gap-2 text-muted-foreground text-xs">
						<Badge variant="soft-orange">{UNSUPPORTED_LABEL}</Badge>
						Hành động này được lưu nhưng chưa chạy. CRM chưa kết nối dịch vụ bên
						ngoài.
					</p>
				)}
				{draft.action === "notify_assignee" ? (
					<>
						<Text
							id="automation-title"
							label="Tiêu đề thông báo"
							value={draft.fields.title}
							onChange={setField("title")}
						/>
						<Text
							id="automation-body"
							label="Nội dung"
							value={draft.fields.body}
							onChange={setField("body")}
							multiline
						/>
					</>
				) : null}
				{draft.action === "assign_to" ? (
					<Choice
						id="automation-assignee"
						label="Người xử lý"
						value={draft.fields.assigneeId}
						options={staff}
						onChange={setField("assigneeId")}
						disabled={sellers.isLoading}
						placeholder={
							sellers.isLoading ? "Đang tải nhân viên…" : "Chọn người xử lý"
						}
					/>
				) : null}
				{draft.action === "send_email" ? (
					<>
						<Text
							id="automation-to"
							label="Gửi đến (để trống = người xử lý)"
							value={draft.fields.to}
							onChange={setField("to")}
							placeholder="email@congty.com"
						/>
						<Text
							id="automation-subject"
							label="Tiêu đề email"
							value={draft.fields.subject}
							onChange={setField("subject")}
						/>
						<Text
							id="automation-email-body"
							label="Nội dung"
							value={draft.fields.body}
							onChange={setField("body")}
							multiline
						/>
					</>
				) : null}
				{draft.action === "botcake_message" ? (
					<Text
						id="automation-flow"
						label="Mã flow Botcake"
						value={draft.fields.flowId}
						onChange={setField("flowId")}
					/>
				) : null}
				{draft.action === "zalo_friend" ||
				draft.action === "botcake_message" ? (
					<Text
						id="automation-message"
						label="Lời nhắn"
						value={draft.fields.message}
						onChange={setField("message")}
						multiline
					/>
				) : null}
				{draft.action === "json_api" ? (
					<>
						<Text
							id="automation-url"
							label="URL (https)"
							value={draft.fields.url}
							onChange={setField("url")}
							placeholder="https://"
						/>
						<Choice
							id="automation-method"
							label="Phương thức"
							value={draft.fields.method}
							options={JSON_API_METHODS.map((method) => ({
								value: method,
								label: method,
							}))}
							onChange={setField("method")}
						/>
						<Text
							id="automation-headers"
							label="Headers (mỗi dòng Tên: giá trị)"
							value={draft.fields.headers}
							onChange={setField("headers")}
							multiline
						/>
					</>
				) : null}
				<div className="flex items-center justify-between">
					<Label htmlFor="automation-enabled">Bật ngay sau khi lưu</Label>
					<Switch
						id="automation-enabled"
						checked={draft.enabled}
						onCheckedChange={(enabled) =>
							setDraft((current) => ({ ...current, enabled }))
						}
					/>
				</div>
			</div>
			<DialogFooter>
				<Button variant="outline" onClick={onClose} disabled={pending}>
					Hủy
				</Button>
				<Button onClick={save} disabled={pending}>
					{pending ? "Đang lưu…" : "Lưu"}
				</Button>
			</DialogFooter>
		</>
	);
}
