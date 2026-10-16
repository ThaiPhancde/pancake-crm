import "@crm/env/load";

process.stdout.write(
	JSON.stringify({
		liveSyncEnabled: process.env.PANCAKE_LIVE_SYNC_ENABLED === "1",
	}),
);
