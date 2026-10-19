const SECOND_MS = 1000;

export const INBOX = {
	notifications: {
		pollMs: 60 * SECOND_MS,
		pageSize: 20,
		maxPageSize: 100,
	},
	search: { debounceMs: 300, maxLength: 120 },
	automations: { searchDebounceMs: 300 },
} as const;

export const NOTIFICATION_TABS = [
	{ value: "all", label: "Tất cả" },
	{ value: "assigned", label: "Phân công cho tôi" },
	{ value: "reminder", label: "Nhắc nhở" },
	{ value: "system", label: "Hệ thống" },
] as const;

export type NotificationTab = (typeof NOTIFICATION_TABS)[number]["value"];

export const AUTOMATION_TRIGGERS = [
	{ value: "record_created", label: "Khi bản ghi được tạo" },
	{ value: "record_updated", label: "Khi có cập nhật bản ghi" },
	{ value: "appointment_due", label: "Khi đến ngày hẹn" },
	{ value: "birthday", label: "Khi đến ngày sinh nhật" },
	{ value: "converted", label: "Khi tiềm năng được chuyển đổi" },
] as const;

export const AUTOMATION_ENTITIES = [
	{ value: "lead", label: "Tiềm năng" },
	{ value: "appointment", label: "Lịch hẹn" },
	{ value: "ticket", label: "Vấn đề" },
	{ value: "contact", label: "Liên hệ" },
	{ value: "order", label: "Đơn hàng" },
] as const;

export const AUTOMATION_ACTIONS = [
	{ value: "notify_assignee", label: "Gửi thông báo cho người xử lý" },
	{ value: "assign_to", label: "Phân công người xử lý" },
	{ value: "send_email", label: "Gửi email" },
	{ value: "zalo_friend", label: "Gửi lời mời kết bạn qua Zalo" },
	{ value: "botcake_message", label: "Gửi tin nhắn Botcake" },
	{ value: "json_api", label: "Gửi JSON API" },
] as const;

export const ASSIGNABLE_ENTITIES = ["lead", "appointment", "ticket"] as const;

export const SUPPORTED_ACTIONS = ["notify_assignee", "assign_to"] as const;

export const RUNNABLE_TRIGGERS = [
	"record_created",
	"record_updated",
	"converted",
] as const;

export const UNSUPPORTED_LABEL = "chưa hỗ trợ";

export const JSON_API_METHODS = ["POST", "PUT", "PATCH"] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number]["value"];
export type AutomationEntity = (typeof AUTOMATION_ENTITIES)[number]["value"];
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number]["value"];
export type JsonApiMethod = (typeof JSON_API_METHODS)[number];

export function labelOf(
	options: readonly { value: string; label: string }[],
	value: string,
) {
	return options.find((option) => option.value === value)?.label ?? value;
}
