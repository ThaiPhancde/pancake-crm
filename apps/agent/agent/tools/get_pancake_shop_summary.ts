import { db } from "@crm/db";
import { shopSummary, shopSummaryArgs } from "@crm/pancake/assistant";
import { defineTool } from "eve/tools";
import { workspaceShopGrants } from "../lib/pancake";

export default defineTool({
	description:
		"Summarise Pancake shops over the last N days: orders, received orders and revenue per currency, returns, cancellations and return rate.",
	inputSchema: shopSummaryArgs,
	async execute(input) {
		return shopSummary(db, await workspaceShopGrants(), input);
	},
});
