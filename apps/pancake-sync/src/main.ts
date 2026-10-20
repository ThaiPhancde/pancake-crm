import "@crm/env/load";
import { db } from "@crm/db";
import { PancakeApiError } from "@crm/pancake/client";
import { assertCrmDatabase, PANCAKE } from "@crm/pancake/config";
import { safeErrorCode, syncShop } from "@crm/pancake/sync";

async function withWatchdog<T>(shopId: string, work: Promise<T>): Promise<T> {
	const timer = setTimeout(() => {
		process.stderr.write(
			`${JSON.stringify({ shopId, errorCode: "SYNC_STALLED" })}\n`,
		);
		process.exit(1);
	}, PANCAKE.shopSyncTimeoutMs);
	try {
		return await work;
	} finally {
		clearTimeout(timer);
	}
}

type LogValue = string | number | boolean | null | undefined;

function log(entry: { event: string; [key: string]: LogValue }) {
	process.stdout.write(
		`${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
	);
}

let stopping = false;
const retryAt = new Map<string, number>();
process.on("SIGINT", () => {
	stopping = true;
});
process.on("SIGTERM", () => {
	stopping = true;
});

async function main() {
	if (process.env.PANCAKE_LIVE_SYNC_ENABLED !== "1") {
		process.stdout.write(
			"Pancake worker is disabled. Real-data synchronization remains locked.\n",
		);
		return;
	}
	assertCrmDatabase(process.env.DATABASE_URL ?? "");
	await db.pancakeSyncRun.updateMany({
		where: { status: "running" },
		data: {
			status: "failed",
			errorCode: PANCAKE.workerRestartCode,
			finishedAt: new Date(),
		},
	});
	log({ event: "worker_started", pollMs: PANCAKE.pollMs });
	do {
		const shops = await db.pancakeShop.findMany({
			where: {
				enabled: true,
				liveApprovedAt: { not: null },
				fixtureVerifiedAt: { not: null },
			},
			orderBy: { id: "asc" },
		});
		log({ event: "cycle_started", shops: shops.length });
		for (const shop of shops) {
			if (stopping) break;
			if ((retryAt.get(shop.id) ?? 0) > Date.now()) continue;
			try {
				const result = await withWatchdog(shop.id, syncShop(db, shop));
				log({ event: "shop_synced", shopId: shop.id, ...result });
			} catch (error) {
				if (error instanceof PancakeApiError && error.retryAfterMs > 0)
					retryAt.set(shop.id, Date.now() + error.retryAfterMs);
				process.stderr.write(
					`${JSON.stringify({
						at: new Date().toISOString(),
						event: "shop_failed",
						shopId: shop.id,
						errorCode: safeErrorCode(
							error instanceof PancakeApiError ? error : null,
						),
						message:
							error instanceof Error
								? error.message.slice(0, PANCAKE.logMessageMax)
								: undefined,
					})}\n`,
				);
			}
		}
		if (process.argv.includes("--once")) break;
		await Bun.sleep(PANCAKE.pollMs);
	} while (!stopping);
}

try {
	await main();
} finally {
	await db.$disconnect();
}
