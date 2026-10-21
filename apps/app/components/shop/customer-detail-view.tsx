"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Calendar from "@carbon/icons-react/es/Calendar";
import Close from "@carbon/icons-react/es/Close";
import Document from "@carbon/icons-react/es/Document";
import Email from "@carbon/icons-react/es/Email";
import Launch from "@carbon/icons-react/es/Launch";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import Phone from "@carbon/icons-react/es/Phone";
import ShoppingCart from "@carbon/icons-react/es/ShoppingCart";
import Task from "@carbon/icons-react/es/Task";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	formatAmount,
	formatAmounts,
	formatDate,
} from "@/components/pancake/format";
import { initials } from "@/lib/initials";
import { COLLECTIONS, type FieldOption, RECORD_DEFAULTS } from "./collections";
import { CustomerConversation } from "./customer-conversation";
import { EmptyRows } from "./empty-state";
import { orderStatusName, orderStatusTone } from "./order-status";
import { RecordForm, RecordSheet } from "./record-sheet";

export type CustomerDetailData = {
	shopId: string;
	customerId: string;
	name: string;
	phone: string | null;
	email: string | null;
	assignedEmployeeId: string | null;
	assignedEmployeeName: string | null;
	assignedEmployeeAvatarUrl: string | null;
	birthday: string | null;
	gender: string | null;
	tags: string[];
	source: string | null;
	address: string | null;
	conversationLink: string | null;
	createdAt: string;
	updatedAt: string;
	canWrite: boolean;
	orderCount: number;
	deliveredCount: number;
	totalSpent: { amount: string; currency: string }[];
	spendWindowDays: number;
	currency: string;
	orders: {
		shopId: string;
		orderId: string;
		customerName: string;
		customerPhone: string | null;
		sellerName: string | null;
		status: number;
		currency: string;
		totalPrice: string;
		itemsSummary: string;
		sourceCreatedAt: string;
		sourceUpdatedAt: string;
	}[];
	notes: {
		id: string;
		content: string;
		authorName: string;
		createdAt: string;
	}[];
	appointments: {
		id: string;
		title: string;
		startAt: string;
		endAt: string | null;
		status: string;
	}[];
	tickets: {
		id: string;
		title: string;
		status: string;
		priority: string;
		createdAt: string;
	}[];
	tasks: {
		id: string;
		orderId: string;
		title: string;
		note: string;
		status: string;
		dueAt: string;
		assigneeName: string;
	}[];
};

type Popup = "appointment" | "ticket" | null;

export type CustomerStaff = {
	users: FieldOption[];
	currentEmployeeId: string | null;
};

const READ_ONLY = "Bạn chỉ có quyền xem cửa hàng này";

function localInput(ms: number) {
	const offset = new Date(ms).getTimezoneOffset() * RECORD_DEFAULTS.minuteMs;
	return new Date(ms - offset).toISOString().slice(0, 16);
}

function ContactRecordPopup({
	detail,
	staff,
	popup,
	now,
	onClose,
}: {
	detail: CustomerDetailData;
	staff: CustomerStaff;
	popup: Popup;
	now: number;
	onClose: () => void;
}) {
	const step =
		RECORD_DEFAULTS.appointmentStepMinutes * RECORD_DEFAULTS.minuteMs;
	const start = Math.floor(now / step) * step + step;
	const contact = { value: detail.customerId, label: detail.name };
	const common = {
		users: staff.users,
		hidden: { customerId: detail.customerId, contactName: detail.name },
		locked: { contact },
	};
	const assigneeId = detail.assignedEmployeeId ?? staff.currentEmployeeId ?? "";
	return (
		<>
			<Dialog
				open={popup === "appointment"}
				onOpenChange={(open) => !open && onClose()}
			>
				<DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
					<DialogHeader className="border-b px-5 py-4">
						<DialogTitle className="text-base">
							{COLLECTIONS.appointment.createLabel}
						</DialogTitle>
					</DialogHeader>
					<RecordForm
						collection="appointment"
						{...common}
						defaults={{
							title: `Lịch hẹn - ${detail.name}`,
							phone: detail.phone ?? "",
							startAt: localInput(start),
							endAt: localInput(
								start +
									RECORD_DEFAULTS.appointmentMinutes * RECORD_DEFAULTS.minuteMs,
							),
							status: RECORD_DEFAULTS.appointmentStatus,
							assigneeId,
						}}
						onDone={onClose}
					/>
				</DialogContent>
			</Dialog>
			<RecordSheet
				collection="ticket"
				size="md"
				open={popup === "ticket"}
				onOpenChange={(open) => !open && onClose()}
				{...common}
				relations={{
					order: detail.orders.map((ord) => ({
						value: ord.orderId,
						label: `Đơn hàng #${ord.orderId}`,
					})),
				}}
				defaults={{
					phone: detail.phone ?? "",
					email: detail.email ?? "",
					priority: RECORD_DEFAULTS.ticketPriority,
					status: RECORD_DEFAULTS.ticketStatus,
					dueAt: localInput(
						now + RECORD_DEFAULTS.ticketDueDays * RECORD_DEFAULTS.dayMs,
					),
					assigneeId,
				}}
			/>
		</>
	);
}

function usePopup() {
	const [state, setState] = useState<{ popup: Popup; now: number }>({
		popup: null,
		now: 0,
	});
	return {
		...state,
		open: (popup: Popup) => setState({ popup, now: Date.now() }),
		close: () => setState((prev) => ({ ...prev, popup: null })),
	};
}

function QuickActions({
	detail,
	base,
	onWriteNote,
	onOpen,
}: {
	detail: CustomerDetailData;
	base: string;
	onWriteNote: () => void;
	onOpen: (popup: Popup) => void;
}) {
	const actions: {
		label: string;
		icon: typeof Document;
		onClick?: () => void;
		href?: string;
		disabled?: string;
	}[] = [
		{ label: "Ghi chú", icon: Document, onClick: onWriteNote },
		{
			label: "Lịch hẹn",
			icon: Calendar,
			onClick: () => onOpen("appointment"),
			disabled: detail.canWrite ? undefined : READ_ONLY,
		},
		{
			label: "Vấn đề",
			icon: WarningAlt,
			onClick: () => onOpen("ticket"),
			disabled: detail.canWrite ? undefined : READ_ONLY,
		},
		detail.email
			? { label: "Mail", icon: Email, href: `mailto:${detail.email}` }
			: { label: "Mail", icon: Email, disabled: "Liên hệ chưa có email" },
	];
	return (
		<div className="flex flex-wrap items-center justify-center gap-4 py-2">
			{actions.map((act) => {
				const content = (
					<>
						<span className="flex size-9 items-center justify-center rounded-full border border-[#d0e4ff] bg-[#f0f7ff] text-[#1677ff] transition-colors group-hover:bg-[#1677ff] group-hover:text-white">
							<Icon icon={act.icon} className="size-4" />
						</span>
						<span className="text-[11px] text-muted-foreground">
							{act.label}
						</span>
					</>
				);
				if (act.href) {
					return (
						<Link
							key={act.label}
							href={act.href}
							className="group flex flex-col items-center gap-1"
						>
							{content}
						</Link>
					);
				}
				return (
					<button
						key={act.label}
						type="button"
						onClick={act.onClick}
						disabled={Boolean(act.disabled)}
						title={act.disabled}
						className="group flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{content}
					</button>
				);
			})}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="group flex flex-col items-center gap-1"
					>
						<span className="flex size-9 items-center justify-center rounded-full border border-[#d0e4ff] bg-[#f0f7ff] text-[#1677ff] transition-colors group-hover:bg-[#1677ff] group-hover:text-white">
							<Icon icon={OverflowMenuHorizontal} className="size-4" />
						</span>
						<span className="text-[11px] text-muted-foreground">Xem thêm</span>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem asChild>
						<Link href={`${base}/reports/tasks`} className="gap-2">
							<Icon icon={Task} className="size-4 text-[#1677ff]" />
							Nhiệm vụ
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link
							href={`${base}/orders?customerId=${detail.customerId}`}
							className="gap-2"
						>
							<Icon icon={ShoppingCart} className="size-4 text-[#1677ff]" />
							Đơn hàng
						</Link>
					</DropdownMenuItem>
					{detail.phone ? (
						<DropdownMenuItem asChild>
							<a href={`tel:${detail.phone}`} className="gap-2">
								<Icon icon={Phone} className="size-4 text-[#1677ff]" />
								Điện thoại ({detail.phone})
							</a>
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function NoteComposer({
	shopId,
	customerId,
}: {
	shopId: string;
	customerId: string;
}) {
	const router = useRouter();
	const [content, setContent] = useState("");
	const [saving, setSaving] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!content.trim()) return;
		setSaving(true);
		try {
			const client = createTRPCClient<AppRouter>({
				links: [httpBatchLink({ url: "/api/trpc" })],
			});
			await client.pancake.createNote.mutate({
				shopId,
				customerId,
				content: content.trim(),
			});
			setContent("");
			toast.success("Đã thêm ghi chú.");
			router.refresh();
		} catch {
			toast.error("Không lưu được ghi chú.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-2">
			<Textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				placeholder="Viết ghi chú chăm sóc khách hàng..."
				rows={3}
				className="text-xs"
			/>
			<div className="flex justify-end">
				<Button type="submit" size="sm" disabled={saving || !content.trim()}>
					{saving ? "Đang lưu..." : "+ Thêm ghi chú"}
				</Button>
			</div>
		</form>
	);
}

function DetailFieldsGrid({
	detail,
	twoColumns = false,
}: {
	detail: CustomerDetailData;
	twoColumns?: boolean;
}) {
	const statusBadge =
		detail.orderCount > 1
			? { label: "Khách mua lại", variant: "green" as const }
			: detail.orderCount === 1
				? { label: "Đang mua", variant: "blue" as const }
				: { label: "Mới", variant: "blue" as const };
	const rows = [
		{ label: "Tên liên hệ", value: detail.name, required: true },
		{
			label: "Số điện thoại",
			value: detail.phone ? (
				<span className="inline-flex items-center gap-1.5 font-medium">
					{detail.phone}
					<Icon icon={Phone} className="size-3.5 text-[#1677ff]" />
				</span>
			) : (
				"—"
			),
		},
		{ label: "Email", value: detail.email ?? "—" },
		{
			label: "Người xử lý",
			value: detail.assignedEmployeeName ? (
				<span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
					<Avatar size="xs">
						{detail.assignedEmployeeAvatarUrl ? (
							<AvatarImage
								src={detail.assignedEmployeeAvatarUrl}
								alt={detail.assignedEmployeeName}
							/>
						) : null}
						<AvatarFallback>
							{initials(detail.assignedEmployeeName)}
						</AvatarFallback>
					</Avatar>
					<span>{detail.assignedEmployeeName}</span>
				</span>
			) : (
				"—"
			),
		},
		{
			label: "Thẻ Pancake",
			value:
				detail.tags.length > 0 ? (
					<div className="flex flex-wrap gap-1">
						{detail.tags.map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</div>
				) : (
					"—"
				),
		},
		{ label: "Ngày sinh", value: detail.birthday ?? "—" },
		{ label: "Nguồn liên hệ", value: detail.source ?? "Pancake POS" },
		{
			label: "Trạng thái",
			value: <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>,
		},
		{
			label: "Ghi chú gần nhất",
			value: detail.notes[0]?.content ?? "—",
		},
		{ label: "Địa chỉ", value: detail.address ?? "—" },
	];

	return (
		<div className="space-y-5">
			<div>
				<h4 className="mb-3 font-semibold text-[#1677ff] text-xs">
					Thông tin liên hệ
				</h4>
				<dl
					className={cn(
						"grid gap-x-6 gap-y-3 text-xs",
						twoColumns ? "md:grid-cols-2" : "grid-cols-1",
					)}
				>
					{rows.map((item) => (
						<div
							key={item.label}
							className="flex flex-col gap-1 border-b border-dashed pb-2.5"
						>
							<dt className="text-muted-foreground">
								{item.required ? (
									<span className="mr-0.5 text-destructive">*</span>
								) : null}
								{item.label}
							</dt>
							<dd className="font-medium text-foreground">{item.value}</dd>
						</div>
					))}
				</dl>
			</div>
		</div>
	);
}

export function CustomerDetailDrawer({
	detail,
	closeHref,
	fullHref,
	base,
	staff,
}: {
	detail: CustomerDetailData;
	closeHref: string;
	fullHref: string;
	base: string;
	staff: CustomerStaff;
}) {
	const router = useRouter();
	const [tab, setTab] = useState<"details" | "activity" | "chat">("details");
	const popup = usePopup();

	return (
		<>
			<ContactRecordPopup
				detail={detail}
				staff={staff}
				popup={popup.popup}
				now={popup.now}
				onClose={popup.close}
			/>
			<Sheet
				open
				onOpenChange={(open) => {
					if (!open) router.push(closeHref, { scroll: false });
				}}
			>
				<SheetContent
					side="right"
					size="lg"
					showCloseButton={false}
					className="flex w-full max-w-[560px] flex-col gap-0 p-0"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>{detail.name}</SheetTitle>
					</SheetHeader>
					<div className="flex items-center justify-between border-b px-4 py-2.5">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Đóng"
							onClick={() => router.push(closeHref, { scroll: false })}
						>
							<Icon icon={Close} />
						</Button>
						<Button
							asChild
							variant="ghost"
							size="icon-sm"
							aria-label="Mở rộng toàn trang"
						>
							<Link href={fullHref}>
								<Icon icon={Launch} />
							</Link>
						</Button>
					</div>

					<div className="border-b px-5 py-4">
						<div className="flex items-center gap-3.5">
							<Avatar className="size-12 bg-[#d9dfe8]">
								<AvatarFallback className="font-semibold text-base">
									{initials(detail.name)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<h2 className="truncate font-bold text-lg">{detail.name}</h2>
								<div className="text-muted-foreground text-xs">
									{detail.phone ?? detail.email ?? `#${detail.customerId}`}
								</div>
							</div>
						</div>

						<QuickActions
							detail={detail}
							base={base}
							onWriteNote={() => setTab("activity")}
							onOpen={popup.open}
						/>

						<div className="mt-2 grid grid-cols-2 gap-2">
							<div className="flex items-center gap-2 rounded-md border bg-[#f0f7ff] px-3 py-2 text-xs">
								<Icon
									icon={ShoppingCart}
									className="size-4 shrink-0 text-[#1677ff]"
								/>
								<span className="text-muted-foreground">Số đơn đã mua:</span>
								<strong className="ml-auto tabular-nums">
									{detail.orderCount}
								</strong>
							</div>
							<div className="flex items-center gap-2 rounded-md border bg-[#fff8eb] px-3 py-2 text-xs">
								<span className="text-sm">🪙</span>
								<span className="text-muted-foreground">
									Số tiền đã chi ({detail.spendWindowDays} ngày):
								</span>
								<strong className="ml-auto tabular-nums">
									{formatAmounts(detail.totalSpent, detail.currency)}
								</strong>
							</div>
						</div>
					</div>

					<div className="flex gap-6 border-b px-5 text-xs">
						{[
							{ key: "details" as const, label: "Thông tin chi tiết" },
							{
								key: "activity" as const,
								label: `Hoạt động (${detail.orders.length + detail.notes.length})`,
							},
							{ key: "chat" as const, label: "Hội thoại" },
						].map((item) => (
							<button
								key={item.key}
								type="button"
								onClick={() => setTab(item.key)}
								className={cn(
									"-mb-px border-b-2 py-2.5 font-medium transition-colors",
									tab === item.key
										? "border-[#1677ff] text-[#1677ff]"
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
							>
								{item.label}
							</button>
						))}
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto p-5">
						{tab === "details" ? (
							<DetailFieldsGrid detail={detail} />
						) : tab === "activity" ? (
							<div className="flex flex-col gap-5">
								<div className="rounded-lg border bg-muted/20 p-3">
									<div className="mb-2 font-semibold text-xs">Ghi chú mới</div>
									<NoteComposer
										shopId={detail.shopId}
										customerId={detail.customerId}
									/>
								</div>

								{detail.notes.length > 0 ? (
									<div className="space-y-2">
										<h4 className="font-semibold text-xs">
											Ghi chú ({detail.notes.length})
										</h4>
										{detail.notes.map((note) => (
											<div
												key={note.id}
												className="rounded-lg border bg-card p-3 text-xs"
											>
												<div className="flex items-center justify-between text-muted-foreground">
													<span className="font-medium text-foreground">
														{note.authorName}
													</span>
													<span>{formatDate(note.createdAt)}</span>
												</div>
												<p className="mt-1.5 whitespace-pre-wrap">
													{note.content}
												</p>
											</div>
										))}
									</div>
								) : null}

								<div className="space-y-2">
									<h4 className="font-semibold text-xs">
										Đơn hàng ({detail.orders.length})
									</h4>
									{detail.orders.length === 0 ? (
										<EmptyRows label="Chưa có đơn hàng" />
									) : (
										detail.orders.map((ord) => (
											<div
												key={ord.orderId}
												className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs"
											>
												<div className="min-w-0">
													<Link
														href={`${base}/orders?orderId=${ord.orderId}`}
														className="font-semibold text-[#1677ff] hover:underline"
													>
														Đơn #{ord.orderId}
													</Link>
													<div className="truncate text-muted-foreground">
														{ord.itemsSummary ||
															formatDate(ord.sourceCreatedAt)}
													</div>
												</div>
												<div className="flex flex-col items-end gap-1">
													<Badge variant={orderStatusTone(ord.status)}>
														{orderStatusName(ord.status)}
													</Badge>
													<span className="font-semibold tabular-nums">
														{formatAmount(ord.totalPrice, ord.currency)}
													</span>
												</div>
											</div>
										))
									)}
								</div>
							</div>
						) : (
							<CustomerConversation
								shopId={detail.shopId}
								customerId={detail.customerId}
								canWrite={detail.canWrite}
								base={base}
							/>
						)}
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}

export function CustomerDetailFullView({
	detail,
	backHref,
	base,
	staff,
}: {
	detail: CustomerDetailData;
	backHref: string;
	base: string;
	staff: CustomerStaff;
}) {
	const popup = usePopup();
	const [centerTab, setCenterTab] = useState<
		"activity" | "details" | "orders" | "history"
	>("activity");
	const [rightTab, setRightTab] = useState<"notes" | "chat">("notes");

	return (
		<div className="grid min-h-full gap-3 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
			<ContactRecordPopup
				detail={detail}
				staff={staff}
				popup={popup.popup}
				now={popup.now}
				onClose={popup.close}
			/>
			<aside className="flex flex-col rounded-lg border bg-card p-4 shadow-2xs">
				<div>
					<Button asChild variant="ghost" size="icon-sm" aria-label="Quay lại">
						<Link href={backHref}>
							<Icon icon={ArrowLeft} />
						</Link>
					</Button>
				</div>

				<div className="mt-1 flex items-center gap-3 px-1">
					<Avatar className="size-12 bg-[#d9dfe8]">
						<AvatarFallback className="font-semibold text-base">
							{initials(detail.name)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<h1 className="truncate font-bold text-lg">{detail.name}</h1>
						<p className="text-muted-foreground text-xs">
							#{detail.customerId}
						</p>
					</div>
				</div>

				<QuickActions
					detail={detail}
					base={base}
					onWriteNote={() => setRightTab("notes")}
					onOpen={popup.open}
				/>

				<div className="mt-2 space-y-2 border-b pb-4">
					<div className="flex items-center gap-2 rounded-md border bg-[#f0f7ff] px-3 py-2 text-xs">
						<Icon icon={ShoppingCart} className="size-4 text-[#1677ff]" />
						<span className="text-muted-foreground">Số đơn đã mua:</span>
						<strong className="ml-auto tabular-nums">
							{detail.orderCount}
						</strong>
					</div>
					<div className="flex items-center gap-2 rounded-md border bg-[#fff8eb] px-3 py-2 text-xs">
						<span>🪙</span>
						<span className="text-muted-foreground">
							Số tiền đã chi ({detail.spendWindowDays} ngày):
						</span>
						<strong className="ml-auto tabular-nums">
							{formatAmounts(detail.totalSpent, detail.currency)}
						</strong>
					</div>
				</div>

				<div className="mt-4 flex-1 overflow-y-auto">
					<h3 className="mb-3 font-semibold text-xs">
						▾ Thông tin về liên hệ này
					</h3>
					<DetailFieldsGrid detail={detail} />
				</div>
			</aside>

			<section className="flex min-h-0 flex-col rounded-lg border bg-card shadow-2xs">
				<div className="flex gap-6 border-b px-5 text-sm">
					{[
						{ key: "activity" as const, label: "Hoạt động" },
						{ key: "details" as const, label: "Chi tiết" },
						{
							key: "orders" as const,
							label: "Đơn hàng",
							badge: detail.orders.length,
						},
						{ key: "history" as const, label: "Lịch sử" },
					].map((item) => (
						<button
							key={item.key}
							type="button"
							onClick={() => setCenterTab(item.key)}
							className={cn(
								"-mb-px flex items-center gap-1.5 border-b-2 py-3 font-medium text-xs transition-colors",
								centerTab === item.key
									? "border-[#1677ff] text-[#1677ff]"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							<span>{item.label}</span>
							{item.badge !== undefined ? (
								<span className="rounded-full bg-[#e8f3ff] px-1.5 py-0.5 font-semibold text-[#1677ff] text-[10px]">
									{item.badge}
								</span>
							) : null}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-y-auto p-5">
					{centerTab === "activity" ? (
						<div className="space-y-6">
							<div>
								<h3 className="mb-3 font-semibold text-sm">Sắp diễn ra</h3>
								<div className="space-y-3">
									{[
										{
											title: "Lịch hẹn",
											popup: "appointment" as const,
											items: detail.appointments.map((a) => ({
												id: a.id,
												label: a.title,
												meta: formatDate(a.startAt),
											})),
										},
										{
											title: "Nhiệm vụ",
											popup: null,
											items: detail.tasks.map((t) => ({
												id: t.id,
												label: t.title,
												meta: `#${t.orderId} · Hạn ${formatDate(t.dueAt)}`,
											})),
										},
										{
											title: "Vấn đề",
											popup: "ticket" as const,
											items: detail.tickets.map((t) => ({
												id: t.id,
												label: t.title,
												meta: t.status,
											})),
										},
									].map((group) => (
										<div key={group.title} className="rounded-lg border">
											<div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 font-semibold text-xs">
												<span>
													▾ {group.title} ({group.items.length})
												</span>
												{group.popup && detail.canWrite ? (
													<Button
														variant="ghost"
														size="icon-xs"
														aria-label={`Thêm ${group.title.toLowerCase()}`}
														title={`Thêm ${group.title.toLowerCase()}`}
														onClick={() => popup.open(group.popup)}
													>
														<Icon icon={Add} />
													</Button>
												) : null}
											</div>
											{group.items.length === 0 ? (
												<EmptyRows label="Trống" className="py-6" />
											) : (
												<ul className="divide-y p-3 text-xs">
													{group.items.map((item) => (
														<li
															key={item.id}
															className="flex items-center justify-between py-2"
														>
															<span className="font-medium">{item.label}</span>
															<span className="text-muted-foreground">
																{item.meta}
															</span>
														</li>
													))}
												</ul>
											)}
										</div>
									))}
								</div>
							</div>

							<div>
								<h3 className="mb-3 font-semibold text-sm">Tất cả hoạt động</h3>
								<div className="rounded-lg border">
									<div className="border-b bg-muted/40 px-4 py-2 font-semibold text-xs">
										▾ Đơn hàng ({detail.orders.length})
									</div>
									{detail.orders.length === 0 ? (
										<EmptyRows label="Trống" className="py-6" />
									) : (
										<ul className="divide-y p-3 text-xs">
											{detail.orders.map((ord) => (
												<li
													key={ord.orderId}
													className="flex items-center justify-between py-2.5"
												>
													<div>
														<Link
															href={`${base}/orders?orderId=${ord.orderId}`}
															className="font-semibold text-[#1677ff] hover:underline"
														>
															Đơn hàng #{ord.orderId}
														</Link>
														<div className="text-muted-foreground">
															{ord.itemsSummary || "Đơn hàng Pancake POS"} ·{" "}
															{formatDate(ord.sourceCreatedAt)}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Badge variant={orderStatusTone(ord.status)}>
															{orderStatusName(ord.status)}
														</Badge>
														<span className="font-semibold tabular-nums">
															{formatAmount(ord.totalPrice, ord.currency)}
														</span>
													</div>
												</li>
											))}
										</ul>
									)}
								</div>
							</div>
						</div>
					) : centerTab === "details" ? (
						<DetailFieldsGrid detail={detail} twoColumns />
					) : centerTab === "orders" ? (
						detail.orders.length === 0 ? (
							<EmptyRows label="Khách hàng chưa có đơn hàng nào" />
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead>
										<tr className="border-b bg-muted/50 text-muted-foreground">
											<th className="p-2.5 font-semibold">Mã đơn</th>
											<th className="p-2.5 font-semibold">Sản phẩm</th>
											<th className="p-2.5 font-semibold">Nhân viên</th>
											<th className="p-2.5 font-semibold">Trạng thái</th>
											<th className="p-2.5 text-right font-semibold">
												Tổng tiền
											</th>
											<th className="p-2.5 text-right font-semibold">
												Ngày tạo
											</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										{detail.orders.map((ord) => (
											<tr key={ord.orderId} className="hover:bg-accent/30">
												<td className="p-2.5 font-semibold">
													<Link
														href={`${base}/orders?orderId=${ord.orderId}`}
														className="text-[#1677ff] hover:underline"
													>
														#{ord.orderId}
													</Link>
												</td>
												<td className="max-w-60 truncate p-2.5">
													{ord.itemsSummary || "—"}
												</td>
												<td className="p-2.5">{ord.sellerName ?? "—"}</td>
												<td className="p-2.5">
													<Badge variant={orderStatusTone(ord.status)}>
														{orderStatusName(ord.status)}
													</Badge>
												</td>
												<td className="p-2.5 text-right font-semibold tabular-nums">
													{formatAmount(ord.totalPrice, ord.currency)}
												</td>
												<td className="p-2.5 text-right text-muted-foreground tabular-nums">
													{formatDate(ord.sourceCreatedAt)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)
					) : (
						<div className="space-y-3 text-xs">
							<div className="rounded-lg border p-3.5">
								<div className="font-medium">
									Đồng bộ dữ liệu khách hàng từ Pancake POS
								</div>
								<div className="mt-1 text-muted-foreground">
									Cập nhật gần nhất: {formatDate(detail.updatedAt)}
								</div>
							</div>
							<div className="rounded-lg border p-3.5">
								<div className="font-medium">Khởi tạo hồ sơ liên hệ</div>
								<div className="mt-1 text-muted-foreground">
									Thời gian tạo: {formatDate(detail.createdAt)}
								</div>
							</div>
						</div>
					)}
				</div>
			</section>

			<aside className="flex flex-col rounded-lg border bg-card shadow-2xs">
				<div className="flex gap-6 border-b px-4 text-xs">
					{[
						{
							key: "notes" as const,
							label: `Ghi chú (${detail.notes.length})`,
						},
						{ key: "chat" as const, label: "Hội thoại" },
					].map((item) => (
						<button
							key={item.key}
							type="button"
							onClick={() => setRightTab(item.key)}
							className={cn(
								"-mb-px border-b-2 py-3 font-medium transition-colors",
								rightTab === item.key
									? "border-[#1677ff] text-[#1677ff]"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							{item.label}
						</button>
					))}
				</div>

				<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
					{rightTab === "notes" ? (
						<>
							<NoteComposer
								shopId={detail.shopId}
								customerId={detail.customerId}
							/>
							{detail.notes.length === 0 ? (
								<EmptyRows label="Trống" />
							) : (
								<div className="space-y-2.5">
									{detail.notes.map((note) => (
										<div
											key={note.id}
											className="rounded-lg border bg-muted/20 p-3 text-xs"
										>
											<div className="flex items-center justify-between text-muted-foreground">
												<strong className="text-foreground">
													{note.authorName}
												</strong>
												<span>{formatDate(note.createdAt)}</span>
											</div>
											<p className="mt-1.5 whitespace-pre-wrap">
												{note.content}
											</p>
										</div>
									))}
								</div>
							)}
						</>
					) : (
						<CustomerConversation
							shopId={detail.shopId}
							customerId={detail.customerId}
							canWrite={detail.canWrite}
							base={base}
						/>
					)}
				</div>
			</aside>
		</div>
	);
}
