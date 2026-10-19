export const PERMISSION_ENTITY_LABELS = {
	lead: "Tiềm năng",
	contact: "Liên hệ",
	order: "Đơn hàng",
	product: "Sản phẩm",
	appointment: "Lịch hẹn",
	ticket: "Vấn đề",
	task: "Nhiệm vụ",
	report: "Thống kê",
	settings: "Cấu hình",
} as const;

export const PERMISSION_ACTION_LABELS = {
	configure: "Cấu hình",
	view: "Xem",
	edit: "Chỉnh sửa",
	delete: "Xóa",
	create: "Tạo mới",
	export: "Xuất dữ liệu",
} as const;

export type PermissionEntity = keyof typeof PERMISSION_ENTITY_LABELS;
export type PermissionAction = keyof typeof PERMISSION_ACTION_LABELS;
export type PermissionRights = Record<PermissionAction, boolean>;
export type PermissionMatrix = Partial<
	Record<PermissionEntity, PermissionRights>
>;

export const HISTORY_TABS = [
	{ value: "all", label: "Tất cả" },
	{ value: "settings", label: "Cấu hình" },
	{ value: "automation", label: "Tự động hoá" },
	{ value: "permission", label: "Phân quyền" },
	{ value: "branch", label: "Chi nhánh" },
	{ value: "record", label: "Bản ghi" },
] as const;

export type HistoryTab = (typeof HISTORY_TABS)[number]["value"];

export const ADMIN = {
	history: {
		pageSize: 25,
		legacyTabs: { config: "settings" },
		unsupported: ["Tin nhắn", "Sự kiện chuyển đổi", "Tổng đài"],
	},
	branch: { noBranch: "none" },
	profile: { none: "none" },
} as const;
