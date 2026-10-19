import type { Db, PancakeShopModel } from "@crm/db";
import {
	PancakeApiError,
	PancakeClient,
	type PancakeReader,
	pageComplete,
} from "./client";
import { assertCrmDatabase, PANCAKE, RESOURCES, type Resource } from "./config";
import { storeRecord } from "./store";

export function assertLiveAllowed(
	shop: Pick<
		PancakeShopModel,
		"enabled" | "fixtureVerifiedAt" | "liveApprovedAt"
	>,
): void {
	if (
		process.env.PANCAKE_LIVE_SYNC_ENABLED !== "1" ||
		!shop.enabled ||
		!shop.fixtureVerifiedAt ||
		!shop.liveApprovedAt
	) {
		throw new PancakeApiError("LIVE_SYNC_LOCKED");
	}
}

export async function syncResource(
	db: Db,
	shopId: string,
	resource: Resource,
	reader: PancakeReader,
	forceFull = false,
	now = new Date(),
	budget: number = PANCAKE.pageBudget,
): Promise<{
	pages: number;
	records: number;
	complete: boolean;
	coveredUntil: Date;
}> {
	const key = { shopId_resource: { shopId, resource } };
	let cursor = await db.pancakeSyncCursor.upsert({
		where: key,
		create: { shopId, resource },
		update: {},
	});
	if (!cursor.windowEnd) {
		const full =
			forceFull ||
			cursor.phase === "history" ||
			resource === "employees" ||
			!cursor.lastFullScanAt ||
			now.getTime() - cursor.lastFullScanAt.getTime() >= PANCAKE.reconcileMs;
		cursor = await db.pancakeSyncCursor.update({
			where: key,
			data: {
				windowStart: full
					? null
					: new Date(
							Math.max(
								0,
								(cursor.watermark?.getTime() ?? 0) - PANCAKE.overlapMs,
							),
						),
				windowEnd: now,
				nextPage: 1,
				phase:
					cursor.phase === "history"
						? "history"
						: full
							? "reconcile"
							: "incremental",
			},
		});
	}
	let pages = 0;
	let records = 0;
	const coveredUntil = cursor.windowEnd ?? now;
	const limit =
		cursor.phase === "history" && budget === PANCAKE.pageBudget
			? PANCAKE.historyPageBudget
			: budget;
	while (pages < limit) {
		const end = cursor.windowEnd;
		if (!end) throw new PancakeApiError("CURSOR_WINDOW_REQUIRED");
		const fetchedAt = new Date();
		const page = await reader.readPage({
			resource,
			page: cursor.nextPage,
			start: cursor.windowStart,
			end,
		});
		if (page.page_number !== undefined && page.page_number !== cursor.nextPage)
			throw new PancakeApiError("UNEXPECTED_PAGE_NUMBER");
		const complete = pageComplete(page, cursor.nextPage, resource);
		if (!complete && page.data.length === 0)
			throw new PancakeApiError("EMPTY_INCOMPLETE_PAGE");
		const committed = await db.$transaction(
			async (tx) => {
				let written = 0;
				for (const item of page.data) {
					if (item === null) throw new PancakeApiError("INVALID_RECORD");
					if (await storeRecord(tx, shopId, resource, item, fetchedAt))
						written++;
				}
				const advanced = await tx.pancakeSyncCursor.updateMany({
					where: {
						shopId,
						resource,
						nextPage: cursor.nextPage,
						windowEnd: end,
					},
					data: complete
						? {
								phase: "incremental",
								nextPage: 1,
								watermark: end,
								windowStart: null,
								windowEnd: null,
								lastFullScanAt:
									cursor.phase !== "incremental" ? end : undefined,
							}
						: { nextPage: cursor.nextPage + 1 },
				});
				if (advanced.count !== 1) throw new PancakeApiError("CURSOR_MOVED");
				const next = await tx.pancakeSyncCursor.findUniqueOrThrow({
					where: key,
				});
				return { next, written };
			},
			{ timeout: PANCAKE.transactionMs },
		);
		pages++;
		records += committed.written;
		cursor = committed.next;
		if (complete) return { pages, records, complete: true, coveredUntil };
	}
	return { pages, records, complete: false, coveredUntil };
}

export async function syncRecent(
	db: Db,
	shopId: string,
	resource: Resource,
	reader: PancakeReader,
	now = new Date(),
): Promise<{ pages: number; records: number }> {
	const cursor = await db.pancakeSyncCursor.findUnique({
		where: { shopId_resource: { shopId, resource } },
		select: { phase: true },
	});
	if (cursor && cursor.phase === "incremental") return { pages: 0, records: 0 };
	const start = new Date(now.getTime() - PANCAKE.recentWindowMs);
	let pages = 0;
	let records = 0;
	for (let number = 1; number <= PANCAKE.recentPageBudget; number++) {
		const fetchedAt = new Date();
		const page = await reader.readPage({
			resource,
			page: number,
			start,
			end: now,
		});
		const written = await db.$transaction(
			async (tx) => {
				let count = 0;
				for (const item of page.data) {
					if (item === null) throw new PancakeApiError("INVALID_RECORD");
					if (await storeRecord(tx, shopId, resource, item, fetchedAt)) count++;
				}
				return count;
			},
			{ timeout: PANCAKE.transactionMs },
		);
		pages++;
		records += written;
		if (page.data.length === 0 || pageComplete(page, number, resource)) break;
	}
	return { pages, records };
}

export async function syncShop(
	db: Db,
	shop: PancakeShopModel,
	readerOverride?: PancakeReader,
): Promise<{
	locked: boolean;
	pages: number;
	records: number;
	errorCode?: string;
}> {
	assertLiveAllowed(shop);
	const url = process.env.DATABASE_URL;
	if (!url) throw new PancakeApiError("DATABASE_REQUIRED");
	assertCrmDatabase(url);
	const apiKey = process.env[shop.apiKeyEnv];
	if (!apiKey) throw new PancakeApiError("API_KEY_REQUIRED");
	const lock = `pancake-sync:${shop.id}`;
	let runId: string | undefined;
	let pages = 0;
	let records = 0;
	try {
		const fresh = await db.pancakeShop.findUniqueOrThrow({
			where: { id: shop.id },
		});
		assertLiveAllowed(fresh);
		const run = await db.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
			const active = await tx.pancakeSyncRun.findFirst({
				where: {
					shopId: shop.id,
					status: "running",
					startedAt: { gt: new Date(Date.now() - PANCAKE.syncLeaseMs) },
				},
				select: { id: true },
			});
			if (active) return null;
			return tx.pancakeSyncRun.create({ data: { shopId: shop.id } });
		});
		if (!run) return { locked: true, pages, records };
		runId = run.id;
		const reader = readerOverride ?? new PancakeClient(shop.id, apiKey);
		let allComplete = true;
		const failures: string[] = [];
		for (const resource of RESOURCES) {
			assertLiveAllowed(
				await db.pancakeShop.findUniqueOrThrow({ where: { id: shop.id } }),
			);
			const jobs = await db.pancakeWebhookJob.findMany({
				where: {
					shopId: shop.id,
					resource,
					status: "pending",
					dueAt: { lte: new Date() },
				},
				orderBy: { createdAt: "asc" },
				take: PANCAKE.webhookBatch,
			});
			try {
				const outcome = await syncResource(
					db,
					shop.id,
					resource,
					reader,
					jobs.length > 0,
				);
				pages += outcome.pages;
				records += outcome.records;
				allComplete &&= outcome.complete;
				if (!outcome.complete && !readerOverride) {
					const recent = await syncRecent(db, shop.id, resource, reader);
					pages += recent.pages;
					records += recent.records;
				}
				if (outcome.complete && jobs.length)
					await db.pancakeWebhookJob.updateMany({
						where: {
							id: { in: jobs.map((job) => job.id) },
							createdAt: { lte: outcome.coveredUntil },
						},
						data: { status: "complete", completedAt: new Date() },
					});
			} catch (error) {
				for (const job of jobs)
					await db.pancakeWebhookJob.update({
						where: { id: job.id },
						data: {
							attempts: { increment: 1 },
							status:
								job.attempts + 1 >= PANCAKE.webhookMaxAttempts
									? "dead"
									: "pending",
							lastError: safeErrorCode(
								error instanceof PancakeApiError ? error : null,
							),
							dueAt: new Date(
								Date.now() +
									Math.min(
										PANCAKE.maxRetryMs,
										PANCAKE.retryMs * 2 ** job.attempts,
									),
							),
						},
					});
				if (error instanceof PancakeApiError && error.code === "HTTP_429")
					throw error;
				failures.push(
					`${resource}:${safeErrorCode(error instanceof PancakeApiError ? error : null)}`,
				);
			}
		}
		await db.$transaction([
			db.pancakeSyncRun.update({
				where: { id: runId },
				data: {
					status: failures.length
						? "failed"
						: allComplete
							? "complete"
							: "partial",
					errorCode: failures.length ? failures.join(",") : null,
					pages,
					records,
					finishedAt: new Date(),
				},
			}),
			db.pancakeShop.update({
				where: { id: shop.id },
				data: {
					lastSyncAt: new Date(),
					lastError: failures.length ? failures.join(",") : null,
				},
			}),
		]);
		return {
			locked: false,
			pages,
			records,
			errorCode: failures.length ? failures.join(",") : undefined,
		};
	} catch (error) {
		const errorCode = safeErrorCode(
			error instanceof PancakeApiError ? error : null,
		);
		await db.pancakeShop.update({
			where: { id: shop.id },
			data: { lastError: errorCode },
		});
		if (runId)
			await db.pancakeSyncRun.update({
				where: { id: runId },
				data: {
					status: "failed",
					errorCode,
					pages,
					records,
					finishedAt: new Date(),
				},
			});
		throw new PancakeApiError(
			errorCode,
			error instanceof PancakeApiError ? error.retryAfterMs : 0,
		);
	}
}

export function safeErrorCode(error: PancakeApiError | null): string {
	return error?.code ?? "PAYLOAD_OR_DATABASE_ERROR";
}
