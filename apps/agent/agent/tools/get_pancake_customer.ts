import { db } from "@crm/db";
import { customerHistory, customerHistoryArgs } from "@crm/pancake/assistant";
import { defineTool } from "eve/tools";
import { workspaceShopGrants } from "../lib/pancake";

export default defineTool({
	description:
		"Look up a Pancake customer by phone number or name. Returns order totals across all their orders: received, returned, cancelled, received revenue per currency, return rate and the latest orders. Use it to judge COD risk.",
	inputSchema: customerHistoryArgs,
	async execute(input) {
		return customerHistory(db, await workspaceShopGrants(), input);
	},
});
