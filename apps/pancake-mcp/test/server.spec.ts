import { beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createCrmMcpServer } from "../src/server";

const id = crypto.randomUUID();
const userId = `mcp-${id}`;
const shopId = `mcp-shop-${id}`;

beforeAll(async () => {
	const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://invalid");
	if (url.pathname !== "/comp_ai_crm_test" || url.hostname !== "127.0.0.1")
		throw new Error("Isolated test database required");
	await db.organization.upsert({
		where: { id: "workspace" },
		create: {
			id: "workspace",
			name: "Fixture",
			slug: "sample-fixture",
			createdAt: new Date(),
		},
		update: {},
	});
	await db.user.create({
		data: {
			id: userId,
			email: `${userId}@example.invalid`,
			name: "MCP fixture",
		},
	});
	await db.member.create({
		data: {
			id: crypto.randomUUID(),
			organizationId: "workspace",
			userId,
			role: "member",
			createdAt: new Date(),
		},
	});
	await db.pancakeShop.create({
		data: {
			id: shopId,
			name: "MCP fixture",
			apiKeyEnv: "PANCAKE_API_KEY_SAMPLE",
		},
	});
	await db.pancakeShopMember.create({
		data: { shopId, userId, role: "VIEWER" },
	});
});

async function withClient(
	action: (client: Client) => Promise<void>,
	resolve = async () => userId,
) {
	const server = createCrmMcpServer(db, resolve);
	const client = new Client({ name: "fixture-client", version: "1.0.0" });
	const [left, right] = InMemoryTransport.createLinkedPair();
	await server.connect(left);
	await client.connect(right);
	try {
		await action(client);
	} finally {
		await client.close();
		await server.close();
	}
}

describe("read-only CRM MCP protocol", () => {
	test("all eight tools advertise read-only behavior and expose no write action", () =>
		withClient(async (client) => {
			const { tools } = await client.listTools();
			expect(tools.length).toBe(8);
			expect(
				tools.every(
					(tool) =>
						tool.annotations?.readOnlyHint && !tool.annotations.destructiveHint,
				),
			).toBe(true);
			expect(
				tools.some((tool) => /create|update|delete|manage/.test(tool.name)),
			).toBe(false);
		}));
	test("shop reads preserve memberships and exclude credential references", () =>
		withClient(async (client) => {
			const result = await client.callTool({
				name: "crm_list_shops",
				arguments: {},
			});
			const parsed = z
				.object({ data: z.array(z.object({ id: z.string() })) })
				.parse(result.structuredContent);
			expect(parsed.data.map((row) => row.id)).toEqual([shopId]);
			expect(JSON.stringify(result)).not.toContain("PANCAKE_API_KEY");
		}));
	test("foreign shops, oversized reads and unknown write tools fail", () =>
		withClient(async (client) => {
			expect(
				(
					await client.callTool({
						name: "crm_list_orders",
						arguments: { shopId: "forbidden" },
					})
				).isError,
			).toBe(true);
			expect(
				(
					await client.callTool({
						name: "crm_list_orders",
						arguments: { pageSize: 101 },
					})
				).isError,
			).toBe(true);
			expect(
				(
					await client.callTool({
						name: "manage_orders",
						arguments: { action: "delete", order_id: 1 },
					})
				).isError,
			).toBe(true);
		}));
	test("unavailable identity fails without leaking errors or calling a model", () =>
		withClient(
			async (client) => {
				const result = await client.callTool({
					name: "crm_list_shops",
					arguments: {},
				});
				expect(result.isError).toBe(true);
				expect(JSON.stringify(result)).not.toContain("SECRET_FIXTURE");
			},
			async () => {
				throw new Error("SECRET_FIXTURE");
			},
		));
});
