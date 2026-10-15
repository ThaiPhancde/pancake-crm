import "@crm/env/load";
import { resolve } from "node:path";
import { pancakeFingerprint } from "./pancake-fingerprint";

const url = process.env.TEST_DATABASE_URL;
if (
	!url ||
	new URL(url).pathname !== "/comp_ai_crm_test" ||
	new URL(url).hostname !== "127.0.0.1"
)
	throw new Error(
		"Set TEST_DATABASE_URL to an isolated local comp_ai_crm_test database.",
	);
const root = resolve(import.meta.dir, "..");
const result = Bun.spawnSync(
	[
		process.execPath,
		"test",
		"packages/pancake/test/client.spec.ts",
		"packages/pancake/test/policy.spec.ts",
		"packages/pancake/test/integration.spec.ts",
		"packages/pancake/test/workflow.spec.ts",
		"apps/app/components/pancake/filter-state.spec.ts",
		"apps/pancake-mcp/test/server.spec.ts",
	],
	{
		cwd: root,
		env: { ...process.env, NODE_ENV: "test", CRM_TELEMETRY_DISABLED: "1" },
		stdout: "inherit",
		stderr: "inherit",
	},
);
if (result.exitCode !== 0) process.exit(result.exitCode);
await Bun.write(
	resolve(root, ".scratch/pancake-verification.json"),
	JSON.stringify(
		{
			passed: true,
			checkedAt: new Date().toISOString(),
			fingerprint: pancakeFingerprint(root),
			database: "comp_ai_crm_test",
			outboundWrites: 0,
			aiCalls: 0,
		},
		null,
		2,
	),
);
process.stdout.write(
	"Pancake safety checks pass. Verification evidence is saved locally. Real sync remains locked.\n",
);
