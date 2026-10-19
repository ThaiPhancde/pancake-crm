const MINUTE_MS = 60_000;
const DAY_MS = 1440 * MINUTE_MS;
const CANCELLED_STATUSES: readonly number[] = [6, 7];
const RETURNED_STATUSES: readonly number[] = [4, 5, 15];

export const PANCAKE = {
	baseUrl: "https://pos.pages.fm/api/v1",
	pageSize: 100,
	timeoutMs: 20_000,
	attempts: 4,
	retryMs: 1_000,
	maxRetryMs: 60_000,
	requestGapMs: 350,
	pollMs: 60_000,
	overlapMs: 300_000,
	dayMs: DAY_MS,
	reconcileMs: DAY_MS,
	pageBudget: 25,
	historyPageBudget: 60,
	recentWindowMs: 2 * DAY_MS,
	recentPageBudget: 20,
	transactionMs: 600_000,
	syncLeaseMs: 900_000,
	workerRestartCode: "WORKER_RESTART",
	webhookMaxBytes: 1_048_576,
	webhookMaxAttempts: 8,
	webhookBatch: 25,
	maxListSize: 100,
	overviewRows: 8,
	timezone: "Asia/Ho_Chi_Minh",
	shopTimezone: new Map([
		["1635200759", "Asia/Dubai"],
		["1328205216", "Asia/Riyadh"],
		["1328205226", "Asia/Kuwait"],
	]),
	spendWindowDays: 30,
	receivedStatuses: [3, 16] as readonly number[],
	cancelledStatuses: CANCELLED_STATUSES,
	returnedStatuses: RETURNED_STATUSES,
	bookedExcludedStatuses: [...CANCELLED_STATUSES, ...RETURNED_STATUSES],
	unassignedValue: "none",
	anyValue: "all",
	appointmentDoneStatuses: ["done"] as readonly string[],
	appointmentCancelledStatuses: ["cancelled"] as readonly string[],
	ticketDoneStatuses: ["done"] as readonly string[],
	defaultCurrency: "SAR",
	// Fallback when an order carries no order_currency.
	shopCurrency: new Map([
		["1635200759", "AED"],
		["1328205216", "SAR"],
		["1328205226", "KWD"],
	]),
	// Dial codes, so 0553409828 and 971553409828 read as the same number.
	shopDialCode: new Map([
		["1635200759", "971"],
		["1328205216", "966"],
		["1328205226", "965"],
	]),
	reminderWindowMs: 60 * MINUTE_MS,
	reminderBatch: 50,
	reminderSyncMs: 5 * MINUTE_MS,
	automationCacheMs: 5_000,
	settingsCacheMs: 30_000,
	automationRunnableTriggers: [
		"record_created",
		"record_updated",
		"converted",
	] as readonly string[],
	automationRunnableEntities: [
		"lead",
		"appointment",
		"ticket",
	] as readonly string[],
	automationStatus: {
		ok: "đã chạy",
		unsupported: "chưa hỗ trợ",
		invalid: "lỗi cấu hình",
	},
	automationInternalActions: [
		"notify_assignee",
		"assign_to",
	] as readonly string[],
	defaultSound: "silent",
	notificationSounds: [
		"silent",
		"default",
		"bell",
		"chime",
	] as readonly string[],
	savedFilterMax: 10,
	exportMaxRows: 5000,
	searchLimit: 5,
	bulkMax: 50,
	historyMaxPage: 100,
	leadConvertedStatus: "converted",
	ageBuckets: [18, 25, 35, 45, 55] as readonly number[],
	purchaseBuckets: 5,
	databaseNames: [
		"CRM",
		"crm",
		"comp_ai_crm",
		"comp_ai_crm_test",
		"comp_ai_crm_demo",
	],
} as const;

export const ORDER_VIEWS = {
	all: { name: "Tất cả", statuses: [] as number[] },
	pending: { name: "Chờ xử lý", statuses: [0, 17, 1, 8, 9, 11, 12, 13, 20] },
	shipping: { name: "Đang giao", statuses: [2] },
	returns: { name: "Hoàn hàng", statuses: PANCAKE.returnedStatuses },
	unassigned: { name: "Chưa phân công", statuses: [] as number[] },
} as const;

export const PERMISSION_ENTITIES = [
	"lead",
	"contact",
	"order",
	"product",
	"appointment",
	"ticket",
	"task",
	"report",
	"settings",
] as const;
export const PERMISSION_ACTIONS = [
	"configure",
	"view",
	"edit",
	"delete",
	"create",
	"export",
] as const;
export const PERMISSION_DEFAULTS = [
	{ name: "Quản trị viên", actions: PERMISSION_ACTIONS, skip: [] },
	{
		name: "Nhân viên bán hàng",
		actions: ["view", "create", "edit"],
		skip: ["product", "report", "settings"],
	},
	{ name: "Chỉ xem", actions: ["view"], skip: ["settings"] },
] as const;

export const RESOURCES = [
	"employees",
	"orders",
	"products",
	"customers",
	"returns",
] as const;
export type Resource = (typeof RESOURCES)[number];

export const STATUS_NAMES = new Map([
	[0, "Mới"],
	[17, "Chờ xác nhận"],
	[11, "Chờ hàng"],
	[12, "Chờ in"],
	[13, "Đã in"],
	[20, "Đã đặt hàng"],
	[1, "Đã xác nhận"],
	[8, "Đang đóng hàng"],
	[9, "Chờ chuyển hàng"],
	[2, "Đã gửi hàng"],
	[3, "Đã nhận"],
	[16, "Đã thu tiền"],
	[4, "Đang hoàn"],
	[15, "Hoàn một phần"],
	[5, "Đã hoàn"],
	[6, "Đã hủy"],
	[7, "Đã xóa"],
]);

export function shopTimezone(shopId?: string): string {
	return (shopId && PANCAKE.shopTimezone.get(shopId)) || PANCAKE.timezone;
}

export function spendSince(now: Date): Date {
	return new Date(now.getTime() - PANCAKE.spendWindowDays * PANCAKE.dayMs);
}

export function assertCrmDatabase(url: string): void {
	const parsed = new URL(url);
	if (!["postgresql:", "postgres:"].includes(parsed.protocol))
		throw new Error("Use a PostgreSQL URI without a Python driver suffix.");
	const name = parsed.pathname.slice(1);
	if (
		!PANCAKE.databaseNames.some(
			(allowed) => allowed.toLowerCase() === name.toLowerCase(),
		)
	) {
		throw new Error(
			"Pancake requires a dedicated CRM or comp_ai_crm database. Other databases are refused.",
		);
	}
}
