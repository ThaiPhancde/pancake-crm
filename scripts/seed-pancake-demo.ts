import "@crm/env/load";
import { db } from "@crm/db";
import type { PancakeReader } from "@crm/pancake/client";
import { RESOURCES } from "@crm/pancake/config";
import { pageEnvelope } from "@crm/pancake/contracts";
import { storeRecord } from "@crm/pancake/store";
import { syncResource } from "@crm/pancake/sync";
import {
	sampleCustomer,
	sampleEmployee,
	sampleOrder,
	sampleProduct,
	sampleReturn,
} from "../packages/pancake/test/fixtures";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
	url.pathname !== "/comp_ai_crm_demo" ||
	url.hostname !== "127.0.0.1" ||
	url.port !== "55432"
)
	throw new Error(
		"Demo seed requires the isolated local comp_ai_crm_demo database on port 55432.",
	);
try {
	await db.organization.upsert({
		where: { id: "workspace" },
		create: {
			id: "workspace",
			name: "Pancake mẫu",
			slug: "pancake-sample",
			createdAt: new Date(),
			metadata: JSON.stringify({
				onboardedAt: new Date().toISOString(),
				website: "https://example.invalid",
			}),
		},
		update: {},
	});
	await db.user.upsert({
		where: { id: "pancake-demo-admin" },
		create: {
			id: "pancake-demo-admin",
			name: "Quản trị mẫu",
			email: "admin@example.invalid",
			emailVerified: true,
		},
		update: {},
	});
	await db.member.upsert({
		where: {
			organizationId_userId: {
				organizationId: "workspace",
				userId: "pancake-demo-admin",
			},
		},
		create: {
			id: crypto.randomUUID(),
			organizationId: "workspace",
			userId: "pancake-demo-admin",
			role: "owner",
			createdAt: new Date(),
		},
		update: {},
	});
	for (const [id, name] of [
		["10001", "Shop mẫu Hà Nội"],
		["10002", "Shop mẫu TP.HCM"],
	]) {
		if (!id || !name) throw new Error("Invalid sample shop");
		await db.pancakeShop.upsert({
			where: { id },
			create: {
				id,
				name,
				apiKeyEnv: "PANCAKE_API_KEY_SAMPLE",
				fixtureVerifiedAt: new Date(),
			},
			update: {},
		});
		const rows = {
			employees: [sampleEmployee],
			customers: [sampleCustomer],
			products: [sampleProduct],
			orders: [
				sampleOrder(id, "1", 0),
				sampleOrder(id, "2", 6),
				sampleOrder(id, "3", 5),
			],
			returns: [sampleReturn(id)],
		};
		const reader: PancakeReader = {
			readPage: async (request) =>
				pageEnvelope.parse({
					success: true,
					data: rows[request.resource].slice(
						(request.page - 1) * 2,
						request.page * 2,
					),
					page_number: request.page,
					page_size: 2,
					total_entries: rows[request.resource].length,
				}),
		};
		for (const resource of RESOURCES)
			await syncResource(
				db,
				id,
				resource,
				reader,
				false,
				new Date("2026-10-14T04:00:00Z"),
			);
		await db.$transaction((tx) =>
			storeRecord(
				tx,
				id,
				"orders",
				sampleOrder(id, "1", 3, "2026-10-14T04:00:00Z"),
				new Date(),
			),
		);
	}
	process.stdout.write(
		"Seeded two sample shops, six orders, customers, variations, employees, returns and status history. No API or AI calls.\n",
	);
} finally {
	await db.$disconnect();
}
