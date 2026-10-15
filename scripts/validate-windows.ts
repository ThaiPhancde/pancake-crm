import "@crm/env/load";
import { db } from "@crm/db";
import { assertCrmDatabase } from "@crm/pancake/config";

const url = process.env.DATABASE_URL ?? "";
assertCrmDatabase(url);
const parsed = new URL(url);
if (
	!["/CRM", "/comp_ai_crm"].includes(parsed.pathname) ||
	parsed.password === "CHANGE_ME"
)
	throw new Error(
		"Configure DATABASE_URL for the dedicated comp_ai_crm database first.",
	);
if (
	!process.env.GOOGLE_CLIENT_ID ||
	!process.env.GOOGLE_CLIENT_SECRET ||
	!process.env.ALLOWED_SIGN_IN ||
	process.env.ALLOWED_SIGN_IN.includes("example.invalid")
)
	throw new Error(
		"Configure Google OAuth and ALLOWED_SIGN_IN before real deployment.",
	);
if (
	!process.env.BETTER_AUTH_SECRET ||
	process.env.BETTER_AUTH_SECRET.length < 32
)
	throw new Error("BETTER_AUTH_SECRET requires 32 or more characters.");
try {
	await db.$queryRaw`SELECT 1`;
} finally {
	await db.$disconnect();
}
process.stdout.write(
	"Windows CRM configuration passes validation. Secrets remain hidden.\n",
);
