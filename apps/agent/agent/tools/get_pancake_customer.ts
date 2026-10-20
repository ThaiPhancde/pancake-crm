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
		"Look up a customer across Pancake shops by phone number or name. Returns their full purchase history, total spending, return rate / COD risk assessment.",
	inputSchema: z.object({
		query: z
			.string()
			.min(2)
			.describe("Phone number or name of the customer."),
		shopId: z.string().optional().describe("Filter to a specific shop if known."),
	}),
	async execute({ query, shopId }) {
		const text = query.trim();

		const where: any = {};
		if (shopId) where.shopId = shopId;
		where.OR = [
			{ phone: { contains: text } },
			{ name: { contains: text, mode: "insensitive" } },
		];

		const customers = await db.pancakeCustomer.findMany({
			where,
			take: 10,
			include: {
				shop: {
					select: { id: true, name: true },
				},
				orders: {
					orderBy: { sourceCreatedAt: "desc" },
					take: 20,
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

		if (customers.length === 0) {
			return {
				found: false,
				message: `Không tìm thấy khách hàng nào với thông tin "${text}".`,
			};
		}

		return {
			found: true,
			customers: customers.map((c) => {
				const totalOrders = c.orders.length;
				const successfulOrders = c.orders.filter((o) => [3, 16].includes(o.status)).length;
				const returnedOrders = c.orders.filter((o) => [4, 5, 15].includes(o.status)).length;
				const totalSpent = c.orders
					.filter((o) => [3, 16].includes(o.status))
					.reduce((acc, o) => acc + Number(o.totalPrice), 0);

				return {
					name: c.name,
					phone: c.phone,
					shopName: c.shop.name,
					totalOrders,
					successfulOrders,
					returnedOrders,
					totalSpent,
					recentOrders: c.orders.slice(0, 5).map((o) => ({
						orderId: o.orderId,
						status: STATUS_MAP[o.status] ?? `Mã ${o.status}`,
						price: Number(o.totalPrice),
						currency: o.currency,
						date: o.sourceCreatedAt.toISOString().split("T")[0],
					})),
					codRiskNotice:
						returnedOrders > 0
							? `Cảnh báo: Khách từng có ${returnedOrders} đơn hoàn/hủy.`
							: totalOrders > 0
								? "Khách hàng tốt, chưa có lịch sử bùng/hoàn hàng."
								: "Khách mới chưa có lịch sử đơn hàng hoàn tất.",
				};
			}),
		};
	},
});
