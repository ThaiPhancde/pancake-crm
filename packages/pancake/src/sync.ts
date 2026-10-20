import type { Db, PancakeShopModel, Prisma } from "@crm/db";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { z } from "zod";
import {
	PancakeApiError,
	PancakeClient,
	type PancakeReader,
	pageComplete,
} from "./client";
import { assertCrmDatabase, PANCAKE, RESOURCES, type Resource } from "./config";
import { classifyFailure, logSync, withDbRetry, zodDetail } from "./errors";
import { changedRecords, storeOrders, storeRecord } from "./store";

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

const idOnly = z.looseObject({
	id: z.union([z.string(), z.number()]).optional(),
	user_id: z.union([z.string(), z.number()]).optional(),
});

function recordId(record: Prisma.InputJsonValue): string | undefined {
	const parsed = idOnly.safeParse(record);
	if (!parsed.success) return undefined;
	const id = parsed.data.id ?? parsed.data.user_id;
	return id === undefined ? undefined : String(id);
}

export async function storePage(
	tx: Prisma.TransactionClient,
	shopId: string,
	resource: Resource,
	items: readonly (Prisma.InputJsonValue | null)[],
	fetchedAt: Date,
): Promise<number> {
	const records: Prisma.InputJsonValue[] = [];
	for (const item of items) {
		if (item === null) throw new PancakeApiError("INVALID_RECORD");
		records.push(item);
	}
	if (resource === "orders") return storeOrders(tx, shopId, records, fetchedAt);
	let written = 0;
	for (const record of records) {
		try {
			if (await storeRecord(tx, shopId, resource, record, fetchedAt)) written++;
		} catch (error) {
			if (!(error instanceof z.ZodError)) throw error;
			logSync({
				event: "record_skipped",
				shopId,
				resource,
				recordId: recordId(record),
				code: "PAYLOAD_INVALID",
				detail: zodDetail(error),
			});
		}
	}
	return written;
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
		const fresh = await changedRecords(
			db,
			shopId,
			resource,
			page.data,
			fetchedAt,
		);
		const committed = await withDbRetry(() =>
			db.$transaction(
				async (tx) => {
					const written = await storePage(
						tx,
						shopId,
						resource,
						fresh,
						fetchedAt,
					);
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
			),
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
		const fresh = await changedRecords(
			db,
			shopId,
			resource,
			page.data,
			fetchedAt,
		);
		const written = await withDbRetry(() =>
			db.$transaction(
				async (tx) => storePage(tx, shopId, resource, fresh, fetchedAt),
				{ timeout: PANCAKE.transactionMs },
			),
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
			await lockIdempotencyKey(tx, lock);
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
			if (resource === "employees") {
				const known = await db.pancakeSyncCursor.findUnique({
					where: { shopId_resource: { shopId: shop.id, resource } },
					select: { watermark: true },
				});
				if (
					known?.watermark &&
					Date.now() - known.watermark.getTime() < PANCAKE.employeeSyncMs
				)
					continue;
			}
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
				if (!readerOverride) {
					const recent = await syncRecent(db, shop.id, resource, reader);
					pages += recent.pages;
					records += recent.records;
				}
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
				if (outcome.complete && jobs.length)
					await db.pancakeWebhookJob.updateMany({
						where: {
							id: { in: jobs.map((job) => job.id) },
							createdAt: { lte: outcome.coveredUntil },
						},
						data: { status: "complete", completedAt: new Date() },
					});
			} catch (error) {
				const failure = classifyFailure(
					error instanceof Error ? error : undefined,
				);
				logSync({
					event: "resource_failed",
					shopId: shop.id,
					resource,
					code: failure.code,
					detail: failure.detail,
				});
				for (const job of jobs)
					await db.pancakeWebhookJob.update({
						where: { id: job.id },
						data: {
							attempts: { increment: 1 },
							status:
								job.attempts + 1 >= PANCAKE.webhookMaxAttempts
									? "dead"
									: "pending",
							lastError: failure.code,
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
				failures.push(`${resource}:${failure.code}`);
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
		const errorCode = safeErrorCode(error instanceof Error ? error : undefined);
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

export function safeErrorCode(error: Error | undefined): string {
	return classifyFailure(error).code;
}
