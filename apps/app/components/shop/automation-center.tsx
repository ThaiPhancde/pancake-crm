"use client";

import Add from "@carbon/icons-react/es/Add";
import Calendar from "@carbon/icons-react/es/Calendar";
import Edit from "@carbon/icons-react/es/Edit";
import Flash from "@carbon/icons-react/es/Flash";
import Idea from "@carbon/icons-react/es/Idea";
import Notification from "@carbon/icons-react/es/Notification";
import Renew from "@carbon/icons-react/es/Renew";
import Sprout from "@carbon/icons-react/es/Sprout";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

type Template = { trigger: string; action: string; description: string };

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
				trigger: "Khi bản ghi được tạo",
				action: "Gửi thông báo cho người xử lý",
				description: "Gửi thông báo cho ai đó khi bản ghi được tạo",
			},
			{
				trigger: "Khi có cập nhật bản ghi",
				action: "Gửi lời mời kết bạn qua Zalo",
				description: "Gửi lời mời kết bạn Zalo khi cập nhật bản ghi",
			},
			{
				trigger: "Khi đến ngày hẹn",
				action: "Gửi thông báo cho người xử lý",
				description: "Gửi thông báo cho người xử lý khi đến ngày hẹn",
			},
			{
				trigger: "Khi đến ngày sinh nhật",
				action: "Gửi tin nhắn Botcake",
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
				trigger: "Khi bản ghi được tạo",
				action: "Gửi thông báo cho người xử lý",
				description: "Gửi email cho người xử lý khi bản ghi được tạo",
			},
			{
				trigger: "Khi bản ghi được tạo",
				action: "Phân công người xử lý",
				description: "Phân công người xử lý khi tạo bản ghi",
			},
			{
				trigger: "Khi bản ghi được tạo",
				action: "Gửi email cho người xử lý",
				description: "Gửi email cho người xử lý khi bản ghi được tạo",
			},
		],
	},
	{
		id: "updated",
		title: "Cập nhật bản ghi",
		icon: Edit,
		templates: [
			{
				trigger: "Khi có cập nhật bản ghi",
				action: "Gửi JSON API",
				description: "Gửi json api khi cập nhật bản ghi",
			},
			{
				trigger: "Khi có cập nhật bản ghi",
				action: "Gửi lời mời kết bạn qua Zalo",
				description: "Gửi thông báo cho ai đó khi cập nhật bản ghi",
			},
		],
	},
	{
		id: "notify",
		title: "Thông báo",
		icon: Notification,
		templates: [
			{
				trigger: "Khi đơn COD quá 48h chưa xác nhận",
				action: "Nhắc telesale gọi lại",
				description: "Tạo nhiệm vụ gọi xác nhận cho người bán",
			},
		],
	},
	{
		id: "due",
		title: "Ngày hẹn",
		icon: Calendar,
		templates: [
			{
				trigger: "Khi đến ngày hẹn",
				action: "Gửi WhatsApp nhắc lịch",
				description: "Nhắc khách trước giờ hẹn 1 giờ",
			},
		],
	},
	{
		id: "birthday",
		title: "Sinh nhật",
		icon: Sprout,
		templates: [
			{
				trigger: "Khi đến ngày sinh nhật",
				action: "Gửi mã giảm giá",
				description: "Tặng voucher sinh nhật qua kênh chat",
			},
		],
	},
	{
		id: "convert",
		title: "Chuyển đổi",
		icon: Renew,
		templates: [
			{
				trigger: "Khi tiềm năng chuyển trạng thái Đã chuyển đổi",
				action: "Tạo liên hệ",
				description: "Tự tạo liên hệ và gán người xử lý",
			},
		],
	},
];

function TemplateCard({ template }: { template: Template }) {
	return (
		<button
			type="button"
			onClick={() => toast.info("Tự động hoá chưa nối backend.")}
			className="flex flex-col gap-2 rounded-lg border p-4 text-left hover:border-primary/60 hover:bg-accent/30"
		>
			<p className="font-medium text-sm">
				<span className="mr-1 text-success">⊕</span>
				{template.trigger}
				<span className="mx-1 text-muted-foreground">→</span>
				<span className="text-primary">🔔</span> {template.action}
			</p>
			<p className="text-muted-foreground text-xs">{template.description}</p>
		</button>
	);
}

export function AutomationCenterBody() {
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
									onClick={() => toast.info("Tự động hoá chưa nối backend.")}
									className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border p-4 hover:border-primary/60"
								>
									<Icon icon={Add} className="size-8 text-primary" />
									<span className="font-medium text-sm">Thêm tự động hóa</span>
								</button>
							) : null}
							{item.templates.map((template) => (
								<TemplateCard key={template.description} template={template} />
							))}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}

export function AutomationCenter({ label }: { label?: string }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			{label ? (
				<Button onClick={() => setOpen(true)}>
					<Icon icon={Add} data-icon="inline-start" />
					{label}
				</Button>
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
							<span className="border-primary border-b-2 pb-1 text-primary">
								Được đề xuất
							</span>
							<span className="text-muted-foreground">Quản lý (0/0)</span>
						</div>
					</DialogHeader>
					<AutomationCenterBody />
				</DialogContent>
			</Dialog>
		</>
	);
}
