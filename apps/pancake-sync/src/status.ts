import "@crm/env/load";
import { db } from "@crm/db";
import { PANCAKE } from "@crm/pancake/config";

async function status() {
	const now = Date.now();
	const shops = await db.pancakeShop.findMany({
		where: {
			enabled: true,
			liveApprovedAt: { not: null },
			fixtureVerifiedAt: { not: null },
		},
		select: { id: true, name: true, lastSyncAt: true, lastError: true },
		orderBy: { id: "asc" },
	});
	const report = await Promise.all(
		shops.map(async (shop) => {
			const [run, cursor, newest] = await Promise.all([
				db.pancakeSyncRun.findFirst({
					where: { shopId: shop.id },
					orderBy: { startedAt: "desc" },
					select: {
						status: true,
						errorCode: true,
						startedAt: true,
						finishedAt: true,
					},
				}),
				db.pancakeSyncCursor.findUnique({
					where: { shopId_resource: { shopId: shop.id, resource: "orders" } },
					select: { phase: true, updatedAt: true, watermark: true },
				}),
				db.pancakeOrder.aggregate({
					where: { shopId: shop.id, sourceCreatedAt: { lte: new Date(now) } },
					_max: { sourceCreatedAt: true, fetchedAt: true },
				}),
			]);
			const progressAt = Math.max(
				cursor?.updatedAt.getTime() ?? 0,
				newest._max.fetchedAt?.getTime() ?? 0,
			);
			return {
				shopId: shop.id,
				name: shop.name,
				healthy: now - progressAt < PANCAKE.statusStaleMs,
				lastProgressAt: progressAt ? new Date(progressAt).toISOString() : null,
				newestOrderAt: newest._max.sourceCreatedAt?.toISOString() ?? null,
				ordersCursor: cursor
					? {
							phase: cursor.phase,
							watermark: cursor.watermark?.toISOString() ?? null,
						}
					: null,
				lastRun: run
					? {
							status: run.status,
							errorCode: run.errorCode,
							startedAt: run.startedAt.toISOString(),
							finishedAt: run.finishedAt?.toISOString() ?? null,
						}
					: null,
				lastError: shop.lastError,
			};
		}),
	);
	const healthy = report.every((shop) => shop.healthy);
	process.stdout.write(
		`${JSON.stringify(
			{ checkedAt: new Date(now).toISOString(), healthy, shops: report },
			null,
			2,
		)}\n`,
	);
	return healthy;
}

let healthy = false;
try {
	healthy = await status();
} finally {
	await db.$disconnect();
}
process.exit(healthy ? 0 : 1);
