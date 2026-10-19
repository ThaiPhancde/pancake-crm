export type FieldType =
	| "phone"
	| "money"
	| "number"
	| "text"
	| "textarea"
	| "datetime"
	| "date"
	| "boolean"
	| "select"
	| "multiselect"
	| "email"
	| "url"
	| "formula"
	| "user"
	| "relation";

export type BadgeTone =
	| "blue"
	| "navy"
	| "orange"
	| "brown"
	| "teal"
	| "green"
	| "red"
	| "purple"
	| "gray";

export type FieldOption = { value: string; label: string; color?: BadgeTone };

export type FieldDef = {
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	locked?: boolean;
	hidden?: boolean;
	placeholder?: string;
	options?: FieldOption[];
	relation?: "contact" | "customer" | "product" | "order" | "lead" | "ticket";
	section?: string;
	source: "pancake" | "crm";
	list?: boolean;
	wide?: boolean;
};

export type CollectionKey =
	| "lead"
	| "contact"
	| "order"
	| "product"
	| "appointment"
	| "ticket"
	| "task";

export type Collection = {
	key: CollectionKey;
	title: string;
	description: string;
	createLabel: string;
	fields: FieldDef[];
};

export const FIELD_TYPES: { type: FieldType; label: string; tone: string }[] = [
	{ type: "phone", label: "Số điện thoại", tone: "bg-[#fa8c16]" },
	{ type: "money", label: "Số tiền", tone: "bg-[#1677ff]" },
	{ type: "number", label: "Số", tone: "bg-[#1890ff]" },
	{ type: "text", label: "Văn bản một dòng", tone: "bg-[#9254de]" },
	{ type: "textarea", label: "Văn bản nhiều dòng", tone: "bg-[#722ed1]" },
	{ type: "datetime", label: "Ngày giờ", tone: "bg-[#f5222d]" },
	{ type: "boolean", label: "Có / Không", tone: "bg-[#13c2a3]" },
	{ type: "select", label: "Chọn một", tone: "bg-[#52c41a]" },
	{ type: "multiselect", label: "Chọn nhiều", tone: "bg-[#389e0d]" },
	{ type: "email", label: "Email", tone: "bg-[#08979c]" },
	{ type: "url", label: "Website / URL", tone: "bg-[#2f54eb]" },
	{ type: "formula", label: "Công thức", tone: "bg-[#fa541c]" },
];

export const SOURCE_OPTIONS: FieldOption[] = [
	{ value: "messenger", label: "Facebook Messenger" },
	{ value: "whatsapp", label: "WhatsApp" },
	{ value: "instagram", label: "Instagram" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "lead-form", label: "Lead form" },
	{ value: "website", label: "Website" },
	{ value: "referral", label: "Giới thiệu" },
	{ value: "other", label: "Khác" },
];

export const COUNTRY_OPTIONS: FieldOption[] = [
	{ value: "AE", label: "United Arab Emirates" },
	{ value: "SA", label: "Saudi Arabia" },
	{ value: "KW", label: "Kuwait" },
	{ value: "QA", label: "Qatar" },
	{ value: "BH", label: "Bahrain" },
	{ value: "OM", label: "Oman" },
];

export const LANGUAGE_OPTIONS: FieldOption[] = [
	{ value: "ar", label: "Tiếng Ả Rập" },
	{ value: "en", label: "Tiếng Anh" },
	{ value: "other", label: "Khác" },
];

export const GENDER_OPTIONS: FieldOption[] = [
	{ value: "male", label: "Nam" },
	{ value: "female", label: "Nữ" },
	{ value: "unknown", label: "Chưa có thông tin" },
];

export const LEAD_STATUSES: FieldOption[] = [
	{ value: "new", label: "Mới", color: "blue" },
	{ value: "contacted", label: "Đã liên hệ", color: "orange" },
	{ value: "nurturing", label: "Đang chăm sóc", color: "purple" },
	{ value: "converted", label: "Đã chuyển đổi", color: "green" },
	{ value: "disqualified", label: "Không tiềm năng", color: "gray" },
];

export const CONTACT_STATUSES: FieldOption[] = [
	{ value: "new", label: "Mới", color: "blue" },
	{ value: "active", label: "Đang mua", color: "green" },
	{ value: "repeat", label: "Khách mua lại", color: "teal" },
	{ value: "inactive", label: "Ngừng tương tác", color: "gray" },
	{ value: "blocked", label: "Chặn (bom hàng)", color: "red" },
];

export const ORDER_STATUSES: FieldOption[] = [
	{ value: "new", label: "Mới", color: "blue" },
	{ value: "confirmed", label: "Đã xác nhận", color: "navy" },
	{ value: "awaiting-payment", label: "Chờ thanh toán", color: "orange" },
	{ value: "partially-paid", label: "Thanh toán 1 phần", color: "brown" },
	{ value: "handed-over", label: "Bàn giao vận chuyển", color: "teal" },
	{ value: "completed", label: "Hoàn thành", color: "green" },
	{ value: "returned", label: "Hoàn", color: "red" },
];

export const TICKET_PRIORITIES: FieldOption[] = [
	{ value: "high", label: "Cao", color: "red" },
	{ value: "medium", label: "Trung bình", color: "orange" },
	{ value: "low", label: "Thấp", color: "green" },
];

export const TICKET_CATEGORIES: FieldOption[] = [
	{ value: "order", label: "Đơn hàng" },
	{ value: "opportunity", label: "Cơ hội bán hàng" },
	{ value: "issue", label: "Vấn đề" },
	{ value: "suggestion", label: "Đề xuất" },
	{ value: "delivery", label: "Giao hàng" },
	{ value: "return", label: "Hoàn hàng" },
];

export const TICKET_STATUSES: FieldOption[] = [
	{ value: "new", label: "Mới", color: "blue" },
	{ value: "in-progress", label: "Đang xử lý", color: "orange" },
	{ value: "done", label: "Hoàn thành", color: "green" },
];

export const APPOINTMENT_STATUSES: FieldOption[] = [
	{ value: "scheduled", label: "Đã đặt", color: "blue" },
	{ value: "done", label: "Hoàn thành", color: "green" },
	{ value: "cancelled", label: "Đã hủy", color: "gray" },
	{ value: "no-show", label: "Khách vắng", color: "red" },
];

export const TASK_STATUSES: FieldOption[] = [
	{ value: "open", label: "Đang mở", color: "blue" },
	{ value: "done", label: "Hoàn tất", color: "green" },
	{ value: "overdue", label: "Quá hạn", color: "red" },
];

export const PAYMENT_OPTIONS: FieldOption[] = [
	{ value: "cod", label: "COD (thu tiền khi giao)" },
	{ value: "bank", label: "Chuyển khoản" },
	{ value: "card", label: "Thẻ / cổng thanh toán" },
];

export const CARRIER_OPTIONS: FieldOption[] = [
	{ value: "aramex", label: "Aramex" },
	{ value: "smsa", label: "SMSA Express" },
	{ value: "imile", label: "iMile" },
	{ value: "jt", label: "J&T Express" },
	{ value: "fetchr", label: "Fetchr" },
	{ value: "other", label: "Khác" },
];

export const PRODUCT_TYPES: FieldOption[] = [
	{ value: "product", label: "Sản phẩm", color: "blue" },
	{ value: "service", label: "Dịch vụ", color: "orange" },
	{ value: "bundle", label: "Gói dịch vụ", color: "purple" },
];

const MINUTE_MS = 60_000;

export const RECORD_DEFAULTS = {
	minuteMs: MINUTE_MS,
	dayMs: 24 * 60 * MINUTE_MS,
	appointmentStepMinutes: 5,
	appointmentMinutes: 30,
	appointmentStatus: "scheduled",
	ticketDueDays: 3,
	ticketPriority: "low",
	ticketStatus: "new",
};

const INFO_LEAD = "Thông tin tiềm năng";
const INFO_CONTACT = "Thông tin liên hệ";
const ADDRESS = "Thông tin địa chỉ";

function field(
	key: string,
	label: string,
	type: FieldType,
	source: FieldDef["source"],
	section: string,
	extra: Partial<FieldDef> = {},
): FieldDef {
	return { key, label, type, source, section, ...extra };
}

export const COLLECTIONS = {
	lead: {
		key: "lead",
		title: "Tiềm năng",
		description:
			"Thông tin thô của khách hàng đến từ nhiều nguồn. Cần xử lý, xác định mức độ tiềm năng trước khi chuyển đổi thành Liên hệ",
		createLabel: "Thêm khách hàng tiềm năng",
		fields: [
			field("name", "Tên tiềm năng", "text", "crm", INFO_LEAD, {
				required: true,
				locked: true,
				list: true,
			}),
			field("phone", "Số điện thoại", "phone", "crm", INFO_LEAD, {
				list: true,
			}),
			field("email", "Email", "email", "crm", INFO_LEAD, { list: true }),
			field("tags", "Thẻ Pancake", "multiselect", "pancake", INFO_LEAD, {
				options: [],
			}),
			field("assigneeId", "Người xử lý", "user", "crm", INFO_LEAD, {
				list: true,
			}),
			field(
				"relatedUserIds",
				"Người xử lý liên quan",
				"user",
				"crm",
				INFO_LEAD,
			),
			field("gender", "Giới tính", "select", "crm", INFO_LEAD, {
				options: GENDER_OPTIONS,
			}),
			field("birthday", "Ngày sinh", "date", "crm", INFO_LEAD, { list: true }),
			field("source", "Nguồn tiềm năng", "select", "crm", INFO_LEAD, {
				options: SOURCE_OPTIONS,
				list: true,
			}),
			field("audience", "Tệp", "text", "crm", INFO_LEAD),
			field(
				"customerId",
				"Khách hàng Pancake",
				"relation",
				"pancake",
				INFO_LEAD,
				{
					relation: "customer",
					hidden: true,
				},
			),
			field(
				"productIds",
				"Sản phẩm quan tâm",
				"relation",
				"pancake",
				INFO_LEAD,
				{
					relation: "product",
				},
			),
			field("language", "Ngôn ngữ", "select", "crm", INFO_LEAD, {
				options: LANGUAGE_OPTIONS,
			}),
			field("status", "Trạng thái", "select", "crm", INFO_LEAD, {
				options: LEAD_STATUSES,
				list: true,
			}),
			field("address", "Địa chỉ", "text", "crm", ADDRESS),
			field("country", "Quốc gia", "select", "crm", ADDRESS, {
				options: COUNTRY_OPTIONS,
			}),
			field("city", "Tỉnh thành", "text", "crm", ADDRESS),
			field("district", "Phường xã", "text", "crm", ADDRESS),
			field("note", "Ghi chú", "textarea", "crm", "Khác", { wide: true }),
		],
	},
	contact: {
		key: "contact",
		title: "Liên hệ",
		description:
			"Khách hàng đã xác định, đồng bộ từ Pancake POS theo số điện thoại",
		createLabel: "Thêm liên hệ",
		fields: [
			field(
				"customerId",
				"Khách hàng Pancake",
				"relation",
				"pancake",
				INFO_CONTACT,
				{
					relation: "customer",
					hidden: true,
				},
			),
			field("name", "Tên liên hệ", "text", "pancake", INFO_CONTACT, {
				required: true,
				locked: true,
				list: true,
			}),
			field("phone", "Số điện thoại", "phone", "pancake", INFO_CONTACT, {
				list: true,
			}),
			field("email", "Email", "email", "pancake", INFO_CONTACT, { list: true }),
			field("source", "Nguồn liên hệ", "select", "crm", INFO_CONTACT, {
				options: SOURCE_OPTIONS,
				list: true,
			}),
			field("assigneeId", "Người xử lý", "user", "pancake", INFO_CONTACT, {
				list: true,
			}),
			field("status", "Trạng thái", "select", "crm", INFO_CONTACT, {
				options: CONTACT_STATUSES,
				list: true,
			}),
			field("tags", "Thẻ Pancake", "multiselect", "pancake", INFO_CONTACT, {
				options: [],
			}),
			field(
				"relatedUserIds",
				"Người xử lý liên quan",
				"user",
				"crm",
				INFO_CONTACT,
			),
			field("birthday", "Ngày sinh", "date", "crm", INFO_CONTACT),
			field("note", "Ghi chú", "textarea", "crm", INFO_CONTACT, { wide: true }),
			field(
				"secondaryPhones",
				"Số điện thoại phụ",
				"multiselect",
				"crm",
				INFO_CONTACT,
				{
					options: [],
				},
			),
			field(
				"secondaryEmails",
				"Email phụ",
				"multiselect",
				"crm",
				INFO_CONTACT,
				{
					options: [],
				},
			),
			field("language", "Ngôn ngữ", "select", "crm", INFO_CONTACT, {
				options: LANGUAGE_OPTIONS,
			}),
			field("orderCount", "Số lần mua", "formula", "pancake", "Mua hàng"),
			field("totalSpent", "Tổng chi tiêu", "money", "pancake", "Mua hàng"),
			field("lastOrderAt", "Mua gần nhất", "datetime", "pancake", "Mua hàng"),
			field("address", "Địa chỉ", "text", "crm", ADDRESS),
			field("country", "Quốc gia", "select", "crm", ADDRESS, {
				options: COUNTRY_OPTIONS,
			}),
			field("city", "Tỉnh thành", "text", "crm", ADDRESS),
		],
	},
	order: {
		key: "order",
		title: "Đơn hàng",
		description: "Quản lý thông tin đơn hàng, thông tin thanh toán",
		createLabel: "Thêm đơn hàng",
		fields: [
			field("orderId", "Mã đơn hàng", "text", "pancake", "Đơn hàng", {
				locked: true,
				list: true,
			}),
			field("contact", "Liên hệ", "relation", "pancake", "Đơn hàng", {
				relation: "contact",
				required: true,
				list: true,
			}),
			field("phone", "Số điện thoại", "phone", "pancake", "Đơn hàng", {
				list: true,
			}),
			field("items", "Sản phẩm", "relation", "pancake", "Đơn hàng", {
				relation: "product",
				list: true,
			}),
			field("total", "Tổng tiền", "money", "pancake", "Thanh toán", {
				list: true,
			}),
			field("discount", "Giảm giá", "money", "pancake", "Thanh toán", {
				list: true,
			}),
			field("remaining", "Còn lại", "money", "pancake", "Thanh toán", {
				list: true,
			}),
			field(
				"paymentMethod",
				"Phương thức thanh toán",
				"select",
				"crm",
				"Thanh toán",
				{
					options: PAYMENT_OPTIONS,
				},
			),
			field("source", "Nguồn", "select", "crm", "Đơn hàng", {
				options: SOURCE_OPTIONS,
				list: true,
			}),
			field("note", "Ghi chú", "textarea", "pancake", "Đơn hàng", {
				list: true,
				wide: true,
			}),
			field("status", "Trạng thái", "select", "pancake", "Đơn hàng", {
				options: ORDER_STATUSES,
				list: true,
			}),
			field("sellerId", "Nhân viên bán", "user", "pancake", "Đơn hàng"),
			field("carrier", "Hãng vận chuyển", "select", "crm", "Vận chuyển", {
				options: CARRIER_OPTIONS,
			}),
			field("trackingCode", "Mã vận đơn", "text", "pancake", "Vận chuyển"),
			field(
				"deliveryStatus",
				"Trạng thái giao hàng",
				"text",
				"pancake",
				"Vận chuyển",
			),
			field("returnReason", "Lý do hoàn", "text", "pancake", "Vận chuyển"),
			field("createdAt", "Thời điểm tạo", "datetime", "pancake", "Đơn hàng"),
		],
	},
	product: {
		key: "product",
		title: "Sản phẩm",
		description: "Sản phẩm, dịch vụ mà doanh nghiệp của bạn đang cung cấp",
		createLabel: "Thêm sản phẩm",
		fields: [
			field("name", "Tên", "text", "pancake", "Sản phẩm", {
				required: true,
				locked: true,
				list: true,
			}),
			field("sku", "Mã sản phẩm", "text", "pancake", "Sản phẩm", {
				list: true,
			}),
			field("type", "Loại hình", "select", "crm", "Sản phẩm", {
				options: PRODUCT_TYPES,
				list: true,
			}),
			field("variations", "Số mẫu mã", "number", "pancake", "Sản phẩm", {
				list: true,
			}),
			field("image", "Hình ảnh", "url", "pancake", "Sản phẩm", { list: true }),
			field("price", "Giá bán", "money", "pancake", "Sản phẩm", { list: true }),
			field("stock", "Số lượng", "number", "pancake", "Sản phẩm", {
				list: true,
			}),
			field("duration", "Thời lượng (Phút)", "number", "crm", "Sản phẩm", {
				list: true,
			}),
			field("description", "Mô tả", "textarea", "crm", "Sản phẩm", {
				list: true,
				wide: true,
			}),
			field("category", "Danh mục", "select", "crm", "Sản phẩm", {
				options: [],
				list: true,
			}),
		],
	},
	appointment: {
		key: "appointment",
		title: "Lịch hẹn",
		description: "Đặt lịch, quản lý thông tin lịch hẹn của khách hàng",
		createLabel: "Thêm lịch hẹn",
		fields: [
			field("title", "Tiêu đề", "text", "crm", "Lịch hẹn", {
				required: true,
				list: true,
			}),
			field("contact", "Liên quan đến", "relation", "crm", "Lịch hẹn", {
				relation: "contact",
				list: true,
			}),
			field("phone", "Số điện thoại", "phone", "crm", "Lịch hẹn", {
				list: true,
			}),
			field("startAt", "Bắt đầu", "datetime", "crm", "Lịch hẹn", {
				required: true,
				list: true,
			}),
			field("endAt", "Kết thúc", "datetime", "crm", "Lịch hẹn", { list: true }),
			field("status", "Trạng thái", "select", "crm", "Lịch hẹn", {
				options: APPOINTMENT_STATUSES,
				list: true,
			}),
			field("assigneeId", "Người xử lý", "user", "crm", "Lịch hẹn", {
				list: true,
			}),
			field("channel", "Kênh gọi", "select", "crm", "Lịch hẹn", {
				options: SOURCE_OPTIONS,
			}),
			field("note", "Ghi chú", "textarea", "crm", "Lịch hẹn", { wide: true }),
		],
	},
	ticket: {
		key: "ticket",
		title: "Vấn đề",
		description: "Theo dõi và giải quyết khiếu nại khách hàng",
		createLabel: "Thêm vấn đề",
		fields: [
			field("ticketId", "Ticket ID", "text", "crm", "Vấn đề", {
				locked: true,
				list: true,
			}),
			field("title", "Tên vấn đề", "text", "crm", "Vấn đề", {
				required: true,
				list: true,
			}),
			field("contact", "Liên hệ", "relation", "crm", "Vấn đề", {
				relation: "contact",
				required: true,
				list: true,
			}),
			field("phone", "Số điện thoại", "phone", "crm", "Vấn đề", { list: true }),
			field("email", "Email", "email", "crm", "Vấn đề", { list: true }),
			field("relatedUserIds", "Người liên quan", "user", "crm", "Vấn đề", {
				list: true,
			}),
			field("category", "Danh mục", "select", "crm", "Vấn đề", {
				options: TICKET_CATEGORIES,
				list: true,
			}),
			field("priority", "Mức độ ưu tiên", "select", "crm", "Vấn đề", {
				options: TICKET_PRIORITIES,
				list: true,
			}),
			field("status", "Trạng thái", "select", "crm", "Vấn đề", {
				options: TICKET_STATUSES,
				list: true,
			}),
			field("related", "Liên quan đến", "relation", "crm", "Vấn đề", {
				relation: "order",
			}),
			field("assigneeId", "Người xử lý", "user", "crm", "Vấn đề", {
				list: true,
			}),
			field("dueAt", "Thời hạn xử lý", "datetime", "crm", "Vấn đề", {
				list: true,
			}),
			field("source", "Nguồn", "select", "crm", "Vấn đề", {
				options: SOURCE_OPTIONS,
			}),
			field("description", "Mô tả", "textarea", "crm", "Vấn đề", {
				wide: true,
			}),
		],
	},
	task: {
		key: "task",
		title: "Nhiệm vụ",
		description: "Theo dõi việc cần làm, lịch hẹn cá nhân của bạn",
		createLabel: "Thêm nhiệm vụ",
		fields: [
			field("title", "Việc cần làm", "text", "crm", "Nhiệm vụ", {
				required: true,
				list: true,
			}),
			field("order", "Đơn hàng", "relation", "pancake", "Nhiệm vụ", {
				relation: "order",
				required: true,
				list: true,
			}),
			field("assigneeId", "Người phụ trách", "user", "crm", "Nhiệm vụ", {
				required: true,
				list: true,
			}),
			field("dueAt", "Hạn xử lý", "datetime", "crm", "Nhiệm vụ", {
				required: true,
				list: true,
			}),
			field("status", "Trạng thái", "select", "crm", "Nhiệm vụ", {
				options: TASK_STATUSES,
				list: true,
			}),
			field("note", "Ghi chú chăm sóc", "textarea", "crm", "Nhiệm vụ", {
				wide: true,
			}),
		],
	},
} satisfies Record<CollectionKey, Collection>;

export function isCollectionKey(value: string): value is CollectionKey {
	return value in COLLECTIONS;
}

export function fieldSections(fields: FieldDef[]): [string, FieldDef[]][] {
	const groups = new Map<string, FieldDef[]>();
	for (const item of fields) {
		if (item.hidden) continue;
		const key = item.section ?? "Thông tin";
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return [...groups];
}
