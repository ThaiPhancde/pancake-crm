import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";

const STATUS_MAP: Record<number, string> = {
	0: "Mới",
	17: "Chờ xác nhận",
	11: "Chờ hàng",
	12: "Chờ in",
	13: "Đã in",
	20: "Đã đặt hàng",
	1: "Đã xác nhận",
	8: "Đang đóng hàng",
	9: "Chờ chuyển hàng",
	2: "Đã gửi hàng",
	3: "Đã nhận",
	16: "Đã thu tiền",
	4: "Đang hoàn",
	15: "Hoàn một phần",
	5: "Đã hoàn",
	6: "Đã hủy",
	7: "Đã xóa",
};

export default defineTool({
	description:
		"Search and inspect Pancake POS orders across shops (UAE, Saudi, Kuwait, etc.) by order ID, customer phone number, customer name, status, or shop. Use this whenever the user asks about Pancake orders, delivery status, tracking codes, or order history.",
	inputSchema: z.object({
		query: z
			.string()
			.optional()
			.describe("Order ID, tracking code, customer phone number, or customer name to search for."),
		shopId: z
			.string()
			.optional()
			.describe("Filter by specific shop ID (e.g. UAE: 1635200759, Saudi: 1328205216, Kuwait: 1328205226)."),
		status: z
			.number()
			.optional()
			.describe("Numeric status code (e.g. 0: Mới, 1: Đã xác nhận, 2: Đã gửi hàng, 3: Đã nhận, 4: Đang hoàn, 5: Đã hoàn, 6: Đã hủy)."),
		limit: z.number().int().min(1).max(50).default(10),
	}),
	async execute({ query, shopId, status, limit }) {
		const text = query?.trim();

		const where: any = {};
		if (shopId) where.shopId = shopId;
		if (status !== undefined) where.status = status;

		if (text) {
			where.OR = [
				{ orderId: { contains: text, mode: "insensitive" } },
				{ customerPhone: { contains: text } },
				{ customerName: { contains: text, mode: "insensitive" } },
				{ trackingCode: { contains: text, mode: "insensitive" } },
			];
		}

		const orders = await db.pancakeOrder.findMany({
			where,
			take: limit,
			orderBy: { sourceCreatedAt: "desc" },
			include: {
				shop: {
					select: { id: true, name: true },
				},
			},
		});

		return {
			count: orders.length,
			orders: orders.map((o) => ({
				orderId: o.orderId,
				shopName: o.shop.name,
				shopId: o.shopId,
				customerName: o.customerName,
				customerPhone: o.customerPhone,
				statusText: STATUS_MAP[o.status] ?? `Mã ${o.status}`,
				statusCode: o.status,
				totalPrice: Number(o.totalPrice),
				currency: o.currency,
				trackingCode: o.trackingCode,
				trackingUrl: o.trackingUrl,
				deliveryStatus: o.deliveryStatus,
				createdAt: o.sourceCreatedAt.toISOString(),
			})),
		};
	},
});
