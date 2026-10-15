import "@crm/env/load";
import { isWorkspaceEmail } from "@crm/auth/workspace";
import { db } from "@crm/db";
import { PancakeAccessError, shopGrants } from "@crm/pancake/access";
import { assertCrmDatabase } from "@crm/pancake/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createCrmMcpServer } from "./server";

const email = z.email().safeParse(process.env.PANCAKE_MCP_USER_EMAIL);
if (!email.success) {
	process.stderr.write(
		"Pancake CRM MCP is disabled. Set PANCAKE_MCP_USER_EMAIL to an existing permitted CRM account.\n",
	);
} else {
	assertCrmDatabase(process.env.DATABASE_URL ?? "");
	const server = createCrmMcpServer(db, async () => {
		if (!isWorkspaceEmail(email.data)) throw new PancakeAccessError();
		const user = await db.user.findUnique({
			where: { email: email.data },
			select: { id: true },
		});
		if (!user) throw new PancakeAccessError();
		await shopGrants(db, user.id);
		return user.id;
	});
	async function stop() {
		await server.close();
		await db.$disconnect();
	}
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	process.stdin.on("end", stop);
	await server.connect(new StdioServerTransport());
}
