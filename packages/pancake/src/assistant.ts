import type { Db, Prisma } from "@crm/db";
import { z } from "zod";
import { orderScope, type ShopGrant } from "./access";
import { PANCAKE, STATUS_NAMES } from "./config";
import { customerScope } from "./queries";

const ASSISTANT = PANCAKE.assistant;

export const searchOrdersArgs = z.object({
	query: z
		.string()
		.trim()
		.max(120)
		.optional()
		.describe("Mã đơn, mã vận đơn, số điện thoại hoặc tên khách."),
	shopId: z.string().optional().describe("Mã shop. Bỏ trống để tìm mọi shop."),
	status: z
		.number()
		.int()
		.optional()
		.describe(
			`Mã trạng thái: ${[...STATUS_NAMES].map(([id, name]) => `${id}=${name}`).join(", ")}.`,
		),
	limit: z.number().int().min(1).max(ASSISTANT.maxRows).default(10),
});

export const customerHistoryArgs = z.object({
	query: z
		.string()
		.trim()
		.min(2)
		.max(120)
		.describe("Số điện thoại hoặc tên khách."),
	shopId: z.string().optional().describe("Mã shop. Bỏ trống để tìm mọi shop."),
});

export const shopSummaryArgs = z.object({
	shopId: z.string().optional().describe("Mã shop. Bỏ trống để xem mọi shop."),
	days: z.number().int().min(1).max(365).default(30),
});

function statusName(status: number) {
	return STATUS_NAMES.get(status) ?? `Trạng thái ${status}`;
}

function day(date: Date) {
	return date.toISOString().slice(0, 10);
}

function phoneDigits(text: string) {
	const digits = text.replace(/\D/g, "");
	return digits.length >= ASSISTANT.minPhoneDigits
		? digits.slice(-ASSISTANT.phoneMatchDigits)
		: null;
}

function shopFilter(grants: ShopGrant[], shopId?: string) {
	return shopId && grants.some((grant) => grant.shopId === shopId)
		? shopId
		: undefined;
}

function outcome(status: number) {
	if (PANCAKE.receivedStatuses.includes(status)) return "received";
	if (PANCAKE.returnedStatuses.includes(status)) return "returned";
	if (PANCAKE.cancelledStatuses.includes(status)) return "cancelled";
	return "open";
}

type Totals = {
	orders: number;
	received: number;
	returned: number;
	cancelled: number;
	open: number;
	revenue: Map<string, number>;
};

function addTotals(
	totals: Totals,
	row: { status: number; currency: string; count: number; amount: number },
) {
	const kind = outcome(row.status);
	totals.orders += row.count;
	totals[kind] += row.count;
	if (kind === "received") {
		totals.revenue.set(
			row.currency,
			(totals.revenue.get(row.currency) ?? 0) + row.amount,
		);
	}
}

function emptyTotals(): Totals {
	return {
		orders: 0,
		received: 0,
		returned: 0,
		cancelled: 0,
		open: 0,
		revenue: new Map(),
	};
}

function describeTotals(totals: Totals) {
	const closed = totals.received + totals.returned;
	return {
		orders: totals.orders,
		received: totals.received,
		returned: totals.returned,
		cancelled: totals.cancelled,
		inProgress: totals.open,
		receivedRevenue: Object.fromEntries(
			[...totals.revenue].map(([currency, amount]) => [
				currency,
				Math.round(amount * 100) / 100,
			]),
		),
		returnRatePercent:
			closed > 0 ? Math.round((totals.returned / closed) * 1000) / 10 : null,
	};
}

export async function searchOrders(
	db: Db,
	grants: ShopGrant[],
	args: z.infer<typeof searchOrdersArgs>,
) {
	const text = args.query;
	const digits = text ? phoneDigits(text) : null;
	const where: Prisma.PancakeOrderWhereInput = {
		AND: [
			orderScope(grants, shopFilter(grants, args.shopId)),
			args.status === undefined ? {} : { status: args.status },
			text
				? {
						OR: [
							{ orderId: text },
							{ trackingCode: { contains: text, mode: "insensitive" } },
							{ customerName: { contains: text, mode: "insensitive" } },
							...(digits ? [{ customerPhone: { contains: digits } }] : []),
						],
					}
				: {},
		],
	};
	const orders = await db.pancakeOrder.findMany({
		where,
		take: args.limit,
		orderBy: { sourceCreatedAt: "desc" },
		select: {
			orderId: true,
			customerName: true,
			customerPhone: true,
			status: true,
			totalPrice: true,
			currency: true,
			trackingCode: true,
			sourceCreatedAt: true,
			shop: { select: { name: true } },
		},
	});
	return {
		count: orders.length,
		orders: orders.map((order) => ({
			orderId: order.orderId,
			shop: order.shop.name,
			customer: order.customerName,
			phone: order.customerPhone,
			status: statusName(order.status),
			total: Number(order.totalPrice),
			currency: order.currency,
			trackingCode: order.trackingCode,
			date: day(order.sourceCreatedAt),
		})),
	};
}

export async function customerHistory(
	db: Db,
	grants: ShopGrant[],
	args: z.infer<typeof customerHistoryArgs>,
) {
	const digits = phoneDigits(args.query);
	const customers = await db.pancakeCustomer.findMany({
		where: {
			AND: [
				customerScope(grants, shopFilter(grants, args.shopId)),
				digits
					? { phone: { contains: digits } }
					: { name: { contains: args.query, mode: "insensitive" } },
			],
		},
		take: ASSISTANT.maxCustomers,
		orderBy: { sourceUpdatedAt: "desc" },
		select: {
			shopId: true,
			customerId: true,
			name: true,
			phone: true,
			shop: { select: { name: true } },
			orders: {
				orderBy: { sourceCreatedAt: "desc" },
				take: ASSISTANT.recentOrders,
				select: {
					orderId: true,
					status: true,
					totalPrice: true,
					currency: true,
					sourceCreatedAt: true,
				},
			},
		},
	});
	if (customers.length === 0) return { count: 0, customers: [] };

	const groups = await db.pancakeOrder.groupBy({
		by: ["shopId", "customerId", "status", "currency"],
		where: {
			OR: customers.map((customer) => ({
				shopId: customer.shopId,
				customerId: customer.customerId,
			})),
		},
		_count: { _all: true },
		_sum: { totalPrice: true },
	});

	return {
		count: customers.length,
		customers: customers.map((customer) => {
			const totals = emptyTotals();
			for (const group of groups) {
				if (
					group.shopId !== customer.shopId ||
					group.customerId !== customer.customerId
				)
					continue;
				addTotals(totals, {
					status: group.status,
					currency: group.currency,
					count: group._count._all,
					amount: Number(group._sum.totalPrice ?? 0),
				});
			}
			return {
				name: customer.name,
				phone: customer.phone,
				shop: customer.shop.name,
				...describeTotals(totals),
				recentOrders: customer.orders.map((order) => ({
					orderId: order.orderId,
					status: statusName(order.status),
					total: Number(order.totalPrice),
					currency: order.currency,
					date: day(order.sourceCreatedAt),
				})),
			};
		}),
	};
}

export async function shopSummary(
	db: Db,
	grants: ShopGrant[],
	args: z.infer<typeof shopSummaryArgs>,
	now = new Date(),
) {
	const since = new Date(now.getTime() - args.days * PANCAKE.dayMs);
	const [shops, groups] = await Promise.all([
		db.pancakeShop.findMany({
			where: {
				id: {
					in: grants
						.map((grant) => grant.shopId)
						.filter((id) => !args.shopId || id === args.shopId),
				},
			},
			select: { id: true, name: true },
		}),
		db.pancakeOrder.groupBy({
			by: ["shopId", "status", "currency"],
			where: {
				AND: [
					orderScope(grants, shopFilter(grants, args.shopId)),
					{ sourceCreatedAt: { gte: since } },
				],
			},
			_count: { _all: true },
			_sum: { totalPrice: true },
		}),
	]);
	return {
		days: args.days,
		since: day(since),
		shops: shops.map((shop) => {
			const totals = emptyTotals();
			for (const group of groups) {
				if (group.shopId !== shop.id) continue;
				addTotals(totals, {
					status: group.status,
					currency: group.currency,
					count: group._count._all,
					amount: Number(group._sum.totalPrice ?? 0),
				});
			}
			return { shop: shop.name, shopId: shop.id, ...describeTotals(totals) };
		}),
	};
}

const TOOLS = {
	search_orders: {
		description:
			"Tìm đơn hàng theo mã đơn, mã vận đơn, số điện thoại hoặc tên khách. Không có từ khóa thì trả về đơn mới nhất.",
		args: searchOrdersArgs,
		run: searchOrders,
	},
	get_customer_history: {
		description:
			"Xem lịch sử mua của khách theo số điện thoại hoặc tên: tổng đơn, đơn đã nhận, đơn hoàn, đơn hủy, doanh thu và tỉ lệ hoàn.",
		args: customerHistoryArgs,
		run: customerHistory,
	},
	get_shop_summary: {
		description:
			"Thống kê đơn, doanh thu đã nhận, đơn hoàn, đơn hủy và tỉ lệ hoàn của từng shop trong N ngày gần nhất.",
		args: shopSummaryArgs,
		run: shopSummary,
	},
} as const;

export type AssistantToolName = keyof typeof TOOLS;

export const ASSISTANT_TOOLS = Object.entries(TOOLS).map(([name, tool]) => ({
	type: "function" as const,
	function: {
		name,
		description: tool.description,
		parameters: z.toJSONSchema(tool.args, { io: "input" }),
	},
}));

export async function runAssistantTool(
	db: Db,
	grants: ShopGrant[],
	name: string,
	rawArgs: string,
): Promise<unknown> {
	if (!(name in TOOLS)) return { error: `Không có công cụ ${name}.` };
	const tool = TOOLS[name as AssistantToolName];
	let json: unknown;
	try {
		json = JSON.parse(rawArgs || "{}");
	} catch {
		return { error: "Tham số công cụ không phải JSON." };
	}
	const args = tool.args.safeParse(json);
	if (!args.success) return { error: z.prettifyError(args.error) };
	return (
		tool.run as (db: Db, grants: ShopGrant[], args: unknown) => Promise<unknown>
	)(db, grants, args.data);
}

export function plainReply(text: string): string {
	return text
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/__(.+?)__/g, "$1")
		.replace(/(^|[\s(])\*(\S[^*\n]*?)\*(?=[\s).,!?:]|$)/g, "$1$2")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^\s*[*•]\s+/gm, "- ")
		.replace(/`([^`\n]+)`/g, "$1")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
