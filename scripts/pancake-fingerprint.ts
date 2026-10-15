import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export function pancakeFingerprint(root: string): string {
	const files: string[] = [];
	for (const folder of [
		"packages/pancake/src",
		"packages/pancake/test",
		"apps/api/src/pancake",
		"apps/pancake-sync/src",
	]) {
		for (const entry of readdirSync(resolve(root, folder), {
			recursive: true,
			withFileTypes: true,
		}))
			if (entry.isFile()) files.push(resolve(entry.parentPath, entry.name));
	}
	files.push(resolve(root, "packages/db/prisma/schema.prisma"));
	const hash = createHash("sha256");
	for (const file of files.sort())
		hash.update(relative(root, file)).update(readFileSync(file));
	return hash.digest("hex");
}
