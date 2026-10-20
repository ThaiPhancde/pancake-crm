import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";

const STATUS_GROUPS = {
	new: [0, 17],
	processing: [1, 8, 9, 11, 12, 13, 20],
	shipping: [2],
	delivered: [3, 16],
	returning: [4, 15],
	returned: [5],
	cancelled: [6, 7],
};

export default defineTool({
	description:
		"Get operational summary and statistics of Pancake shops (UAE, Saudi, Kuwait, etc.): total orders, revenue, and order breakdown by status.",
	inputSchema: z.object({
		shopId: z.string().optional().describe("Shop ID if inquiring about one shop. Omit for all shops."),
		days: z.number().int().min(1).max(365).default(30).describe("Number of days in the past to analyze (default 30)."),
	}),
	async execute({ shopId, days }) {
		const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const shops = await db.pancakeShop.findMany({
			where: shopId ? { id: shopId } : undefined,
			select: { id: true, name: true },
		});

		const summaries = await Promise.all(
			shops.map(async (shop) => {
				const orders = await db.pancakeOrder.findMany({
					where: {
						shopId: shop.id,
						sourceCreatedAt: { gte: since },
					},
					select: {
						status: true,
						totalPrice: true,
						currency: true,
					},
				});

				const totalOrders = orders.length;
				let revenue = 0;
				let deliveredCount = 0;
				let returningCount = 0;
				let returnedCount = 0;
				let cancelledCount = 0;
				let currency = orders[0]?.currency ?? "USD";

				for (const o of orders) {
					if (STATUS_GROUPS.delivered.includes(o.status)) {
						revenue += Number(o.totalPrice);
						deliveredCount++;
					} else if (STATUS_GROUPS.returning.includes(o.status)) {
						returningCount++;
					} else if (STATUS_GROUPS.returned.includes(o.status)) {
						returnedCount++;
					} else if (STATUS_GROUPS.cancelled.includes(o.status)) {
						cancelledCount++;
					}
				}

				return {
					shopId: shop.id,
					shopName: shop.name,
					periodDays: days,
					totalOrders,
					currency,
					deliveredRevenue: revenue,
					deliveredCount,
					returningCount,
					returnedCount,
					cancelledCount,
					returnRatePercent:
						totalOrders > 0
							? Number((((returnedCount + returningCount) / totalOrders) * 100).toFixed(1))
							: 0,
				};
			}),
		);

		return {
			periodDays: days,
			shops: summaries,
		};
	},
});
