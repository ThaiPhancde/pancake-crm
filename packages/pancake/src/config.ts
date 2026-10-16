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
	reconcileMs: 86_400_000,
	pageBudget: 25,
	historyPageBudget: 60,
	recentWindowMs: 172_800_000,
	recentPageBudget: 20,
	transactionMs: 300_000,
	webhookMaxBytes: 1_048_576,
	webhookMaxAttempts: 8,
	webhookBatch: 25,
	maxListSize: 100,
	overviewRows: 8,
	timezone: "Asia/Ho_Chi_Minh",
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
	returns: { name: "Hoàn hàng", statuses: [4, 5, 15] },
	unassigned: { name: "Chưa phân công", statuses: [] as number[] },
} as const;

export const RESOURCES = [
	"employees",
	"customers",
	"products",
	"orders",
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
