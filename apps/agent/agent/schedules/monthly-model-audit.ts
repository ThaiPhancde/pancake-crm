import { db } from "@crm/db";
import { defineSchedule } from "eve/schedules";
import { runModelAudit } from "../lib/model-audit";
import { MODEL_AUDIT } from "../lib/model-audit-config";

export default defineSchedule({
	cron: MODEL_AUDIT.cron,
	async run({ waitUntil }) {
		waitUntil(
			runModelAudit(db)
				.then((result) =>
					console.log(JSON.stringify({ event: "model_audit", ...result })),
				)
				.catch((error) =>
					console.error(
						JSON.stringify({
							event: "model_audit_failed",
							reason: error instanceof Error ? error.message : String(error),
						}),
					),
				),
		);
	},
});
