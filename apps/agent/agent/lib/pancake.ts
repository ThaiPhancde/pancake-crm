import { db } from "@crm/db";
import type { ShopGrant } from "@crm/pancake/access";

export async function workspaceShopGrants(): Promise<ShopGrant[]> {
	const shops = await db.pancakeShop.findMany({ select: { id: true } });
	return shops.map((shop) => ({
		shopId: shop.id,
		role: "MANAGER",
		employeeId: null,
	}));
}
