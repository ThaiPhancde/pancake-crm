import { db } from "@crm/db";
import { searchOrders, searchOrdersArgs } from "@crm/pancake/assistant";
import { defineTool } from "eve/tools";
import { workspaceShopGrants } from "../lib/pancake";

export default defineTool({
	description:
		"Search Pancake POS orders across the workspace shops by order ID, tracking code, customer phone or name, optionally filtered by shop and status. Without a query it returns the newest orders. Use it for any question about Pancake orders, delivery status or tracking.",
	inputSchema: searchOrdersArgs,
	async execute(input) {
		return searchOrders(db, await workspaceShopGrants(), input);
	},
});
