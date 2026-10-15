import type { Db } from "@crm/db";
import { listInput } from "@crm/pancake/contracts";
import {
	connectionStatus,
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	operationsOverview,
	orderDetail,
} from "@crm/pancake/queries";
import { listTasks, taskListInput } from "@crm/pancake/tasks";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createCrmMcpServer(db: Db, resolveUser: () => Promise<string>) {
	const server = new McpServer({
		name: "pancake-crm-readonly",
		version: "0.1.0",
	});
	const annotations = {
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	};
	async function read<T>(action: (userId: string) => Promise<T>) {
		try {
			const data = await action(await resolveUser());
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data) }],
				structuredContent: { data },
			};
		} catch {
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: "READ_FAILED: Check CRM membership, shop permissions and database availability.",
					},
				],
			};
		}
	}
	server.registerTool(
		"crm_list_shops",
		{
			description:
				"Read permitted CRM shops and synchronization timestamps. Data comes from the local CRM database.",
			annotations,
		},
		() => read((userId) => connectionStatus(db, userId)),
	);
	server.registerTool(
		"crm_list_orders",
		{
			description:
				"Read paginated synchronized orders. Filters include shop, salesperson, status, dates and processing group. Never writes to POS.",
			inputSchema: listInput,
			annotations,
		},
		(input) => read((userId) => listOrders(db, userId, input)),
	);
	server.registerTool(
		"crm_order_detail",
		{
			description:
				"Read one permitted order with shipping and status history. Raw API payloads and credentials are excluded.",
			inputSchema: z.object({
				shopId: z.string().min(1),
				orderId: z.string().min(1),
			}),
			annotations,
		},
		(input) =>
			read((userId) => orderDetail(db, userId, input.shopId, input.orderId)),
	);
	server.registerTool(
		"crm_list_customers",
		{
			description:
				"Read a page of permitted customers. Use q to find a name or phone, and always use shopId for customer history.",
			inputSchema: listInput,
			annotations,
		},
		(input) => read((userId) => listCustomers(db, userId, input)),
	);
	server.registerTool(
		"crm_customer_purchases",
		{
			description:
				"Read purchase history for one customer in one permitted shop.",
			inputSchema: z.object({
				shopId: z.string().min(1),
				customerId: z.string().min(1),
				filters: listInput.default(() => listInput.parse({})),
			}),
			annotations,
		},
		(input) =>
			read((userId) =>
				customerPurchases(
					db,
					userId,
					input.shopId,
					input.customerId,
					input.filters,
				),
			),
	);
	server.registerTool(
		"crm_sales_report",
		{
			description:
				"Read revenue and salesperson performance for synchronized orders. Currencies stay separate. Revenue is not net accounting revenue. Check shop sync state before interpreting totals.",
			inputSchema: listInput,
			annotations,
		},
		(input) => read((userId) => dashboardReport(db, userId, input)),
	);
	server.registerTool(
		"crm_operations_overview",
		{
			description:
				"Read processing queues and recent order updates within the user's shop permissions.",
			inputSchema: listInput,
			annotations,
		},
		(input) => read((userId) => operationsOverview(db, userId, input)),
	);
	server.registerTool(
		"crm_list_tasks",
		{
			description:
				"Read internal follow-up tasks, including overdue or assigned tasks. No task creation or POS mutations are exposed.",
			inputSchema: taskListInput,
			annotations,
		},
		(input) => read((userId) => listTasks(db, userId, input)),
	);
	return server;
}
