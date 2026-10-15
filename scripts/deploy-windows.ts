import "@crm/env/load";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@crm/db";
import { assertCrmDatabase } from "@crm/pancake/config";

const url = process.env.DATABASE_URL ?? "";
assertCrmDatabase(url);
if (!["/CRM", "/comp_ai_crm"].includes(new URL(url).pathname))
	throw new Error("Deployment requires the dedicated comp_ai_crm database.");
const root = resolve(import.meta.dir, "..");
try {
	const tables = await db.$queryRaw<
		{ name: string }[]
	>`SELECT tablename AS name FROM pg_tables WHERE schemaname='public'`;
	const modelNames = new Set(
		[
			...readFileSync(
				resolve(root, "packages/db/prisma/schema.prisma"),
				"utf8",
			).matchAll(/@@map\("([^"]+)"\)/g),
		].map((match) => match[1]),
	);
	modelNames.add("_prisma_migrations");
	if (
		tables.length &&
		(!tables.some((table) => table.name === "_prisma_migrations") ||
			tables.some((table) => !modelNames.has(table.name)))
	)
		throw new Error(
			"Database contains unrelated tables. Migration is refused.",
		);
	if (tables.some((table) => table.name === "_prisma_migrations")) {
		const applied = await db.$queryRaw<
			{ name: string }[]
		>`SELECT migration_name AS name FROM "_prisma_migrations"`;
		const available = new Set(
			readdirSync(resolve(root, "packages/db/prisma/migrations")),
		);
		if (applied.some((migration) => !available.has(migration.name)))
			throw new Error(
				"Database belongs to a different application. Migration is refused.",
			);
	}
} finally {
	await db.$disconnect();
}
for (const command of [
	["x", "--bun", "prisma", "migrate", "deploy"],
	["x", "--bun", "prisma", "generate"],
	[
		"x",
		"--bun",
		"prisma",
		"migrate",
		"diff",
		"--from-config-datasource",
		"--to-schema",
		"prisma/schema.prisma",
		"--exit-code",
	],
]) {
	const result = Bun.spawnSync([process.execPath, ...command], {
		cwd: resolve(root, "packages/db"),
		stdout: "inherit",
		stderr: "inherit",
	});
	if (result.exitCode !== 0) process.exit(result.exitCode);
}
for (const command of [
	["run", "--filter=api", "build"],
	["run", "--filter=app", "build"],
]) {
	const result = Bun.spawnSync([process.execPath, ...command], {
		cwd: root,
		stdout: "inherit",
		stderr: "inherit",
	});
	if (result.exitCode !== 0) process.exit(result.exitCode);
}
process.stdout.write(
	"CRM production artifacts are built. Start with scripts/windows/Start-Crm.ps1 -Production.\n",
);
