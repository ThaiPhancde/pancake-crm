import { defineSchedule } from "eve/schedules";
import { exec } from "child_process";
import path from "path";

export default defineSchedule({
	// Runs at 00:00 on day 1 of every month
	cron: "0 0 1 * *",
	async run({ waitUntil }) {
		waitUntil(
			new Promise<void>((resolve) => {
				const scriptPath = path.resolve(process.cwd(), "scripts/optimize-models.js");
				exec(`node "${scriptPath}"`, (err, stdout, stderr) => {
					if (err) {
						console.error("[monthly-model-audit] Execution error:", err, stderr);
					} else {
						console.log("[monthly-model-audit] Scheduled audit completed:\n", stdout);
					}
					resolve();
				});
			}),
		);
	},
});
