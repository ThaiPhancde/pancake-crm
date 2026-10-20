import { createHash } from "node:crypto";
import type { Db, Prisma } from "@crm/db";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { z } from "zod";
import {
	assertShopManager,
	assertShopReader,
	assertShopWriter,
	canManage,
	canWrite,
} from "./access";
import { writeAudit } from "./admin";
import { PANCAKE } from "./config";
import { sourceDate, sourceId } from "./contracts";
import { decryptToken, encryptToken, maskToken, redactSecrets } from "./crypto";
import { logSync, withDbRetry } from "./errors";
import {
	conversationWire,
	type DiscoveredPage,
	extractPhones,
	type IncomingConversation,
	type IncomingMessage,
	type MessagesPageResult,
	messageWire,
	type PancakePagesAdapter,
	PancakePagesApiError,
	PancakePagesClient,
} from "./pages-client";
import { phoneTail } from "./phone";
import { effectiveSettings } from "./settings";

export const connectUserTokenInput = z.object({
	shopId: z.string().min(1),
	userAccessToken: z.string().trim().min(8).max(4000).optional(),
	autoAssignMatchingShop: z.boolean().default(false),
});

export const pagesListInput = z.object({
	shopId: z.string().min(1),
	q: z.string().max(120).default(""),
	filter: z
		.enum([
			"all",
			"assigned",
			"matching_shop",
			"has_token",
			"missing_token",
			"error",
		])
		.default("all"),
});

export const bulkAssignPagesInput = z
	.object({
		shopId: z.string().min(1),
		pageIds: z.array(z.string().min(1)).min(1).max(PANCAKE.maxBulkPages),
		assigned: z.boolean(),
		syncEnabled: z.boolean().optional(),
		importFrom: z.iso.datetime({ offset: true }).nullable().optional(),
		importUntil: z.iso.datetime({ offset: true }).nullable().optional(),
	})
	.refine(
		(v) => !v.importFrom || !v.importUntil || v.importFrom <= v.importUntil,
		"Khoảng thời gian import không hợp lệ",
	);

export const configurePageSyncInput = z
	.object({
		shopId: z.string().min(1),
		pageIds: z.array(z.string().min(1)).min(1).max(PANCAKE.maxBulkPages),
		syncEnabled: z.boolean().optional(),
		importFrom: z.iso.datetime({ offset: true }).nullable().optional(),
		importUntil: z.iso.datetime({ offset: true }).nullable().optional(),
		resetCursor: z.boolean().default(false),
	})
	.refine(
		(v) => !v.importFrom || !v.importUntil || v.importFrom <= v.importUntil,
		"Khoảng thời gian import không hợp lệ",
	);

export const setPageManualTokenInput = z.object({
	shopId: z.string().min(1),
	pageId: z.string().min(1),
	pageAccessToken: z.string().trim().min(8).max(4000),
	confirmReplace: z.literal(true),
});

export const confirmGeneratePageTokenInput = z.object({
	shopId: z.string().min(1),
	pageId: z.string().min(1),
	confirmReplace: z.literal(true),
});

export const syncPagesNowInput = z.object({
	shopId: z.string().min(1),
	pageIds: z.array(z.string().min(1)).max(50).optional(),
	conversationBudget: z.number().int().min(1).max(10).default(2),
	messageBudget: z.number().int().min(1).max(30).default(10),
});

export const pancakeConversationListInput = z.object({
	shopId: z.string().min(1),
	pageId: z.string().min(1).optional(),
	customerId: z.string().min(1).optional(),
	linkStatus: z
		.enum(["all", "linked", "unlinked", "ambiguous"])
		.default("all"),
	unreadOnly: z.boolean().default(false),
	q: z.string().max(120).default(""),
	page: z.number().int().min(1).max(100_000).default(1),
	pageSize: z.number().int().min(1).max(PANCAKE.maxListSize).default(25),
});

export const conversationListInput = pancakeConversationListInput;

export const conversationMessagesInput = z.object({
	shopId: z.string().min(1),
	pageId: z.string().min(1),
	conversationId: z.string().min(1),
	beforeInsertedAt: z.iso.datetime({ offset: true }).optional(),
	beforeMessageId: z.string().min(1).optional(),
	limit: z.number().int().min(1).max(100).default(PANCAKE.messageListSize),
	fetchRemoteOlder: z.boolean().default(false),
});

export const sendConversationMessageInput = z.object({
	shopId: z.string().min(1),
	pageId: z.string().min(1),
	conversationId: z.string().min(1),
	clientMessageId: z.string().trim().min(4).max(120),
	message: z.string().trim().min(1).max(4000),
});

export const markConversationSeenInput = z.object({
	shopId: z.string().min(1),
	pageId: z.string().min(1),
	conversationId: z.string().min(1),
	seen: z.boolean().default(true),
});

export type CustomerMatchInput = {
	shopId: string;
	pageId: string;
	conversationId: string;
	sourceCustomerIds: string[];
	pageCustomerIds: string[];
	psids: string[];
	phones: string[];
};

export type CustomerMatchResult = {
	customerId: string | null;
	linkStatus: "linked_id" | "linked_phone" | "unlinked" | "ambiguous";
	matchedPhoneTail: string | null;
};

const customerRawPhoneSchema = z
	.object({
		phone_numbers: z.array(z.string()).optional(),
	})
	.passthrough();

const storedAttachmentSchema = z.array(
	z
		.object({
			id: z.string().nullish(),
			type: z.string().nullish(),
			url: z.string().nullish(),
			preview_url: z.string().nullish(),
			file_url: z.string().nullish(),
			name: z.string().nullish(),
			mime_type: z.string().nullish(),
		})
		.passthrough(),
);

function describeMissingTokenReason(page: DiscoveredPage) {
	if (page.roleInPage === "NO_PERMISSION") {
		return {
			tokenStatus: "permission_denied" as const,
			tokenReason:
				"Tài khoản không có quyền truy cập Page này trên Pancake (nopermission).",
		};
	}
	if (page.roleInPage && page.roleInPage !== "ADMINISTER") {
		return {
			tokenStatus: "permission_denied" as const,
			tokenReason: `Tài khoản chỉ có quyền ${page.roleInPage} trên Page này (cần quyền ADMINISTER để lấy/tạo Page Access Token hoặc nhập token hiện có).`,
		};
	}
	return {
		tokenStatus: "missing" as const,
		tokenReason:
			"Page chưa có Page Access Token. Vui lòng nhập token hiện có hoặc xác nhận tạo mới.",
	};
}

async function resolveUserAccessToken(
	db: Db,
	shopId: string,
	explicitToken?: string,
): Promise<string> {
	if (explicitToken?.trim()) {
		return explicitToken.trim();
	}
	const stored = await db.pancakeAccountConnection.findUnique({
		where: { shopId },
	});
	if (stored?.encryptedUserToken) {
		return decryptToken(stored.encryptedUserToken);
	}
	const envToken =
		process.env.PANCAKE_USER_ACCESS_TOKEN?.trim() ||
		process.env.PANCAKE_TOKEN?.trim();
	if (envToken) {
		return envToken;
	}
	throw new PancakePagesApiError(
		"CONFIGURATION_REQUIRED",
		"Chưa cấu hình Pancake User Access Token cho cửa hàng này.",
	);
}

export async function connectAndDiscoverPages(
	db: Db,
	userId: string,
	input: z.infer<typeof connectUserTokenInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopManager(db, userId, input.shopId);
	const userToken = await resolveUserAccessToken(
		db,
		input.shopId,
		input.userAccessToken,
	);
	let discovered: DiscoveredPage[];
	try {
		discovered = await adapter.listPages(userToken);
	} catch (error) {
		const message =
			error instanceof Error
				? redactSecrets(error.message)
				: "Không thể kết nối Pancake User Access Token.";
		if (input.userAccessToken) {
			await db.pancakeAccountConnection.upsert({
				where: { shopId: input.shopId },
				create: {
					shopId: input.shopId,
					encryptedUserToken: encryptToken(userToken),
					tokenMasked: maskToken(userToken),
					status: "invalid",
					lastError: message,
					updatedById: userId,
				},
				update: {
					status: "invalid",
					lastError: message,
					updatedById: userId,
				},
			});
		} else {
			await db.pancakeAccountConnection.updateMany({
				where: { shopId: input.shopId },
				data: {
					status: "expired",
					lastError: message,
				},
			});
		}
		throw error;
	}

	const now = new Date();
	const existingPages = await db.pancakePage.findMany({
		where: { shopId: input.shopId },
		select: {
			pageId: true,
			assigned: true,
			syncEnabled: true,
			encryptedAccessToken: true,
			tokenMasked: true,
			tokenStatus: true,
			tokenSource: true,
			tokenReason: true,
		},
	});
	const existingById = new Map(existingPages.map((p) => [p.pageId, p]));

	let existingTokensSaved = 0;
	let autoAssigned = 0;

	await db.pancakeAccountConnection.upsert({
		where: { shopId: input.shopId },
		create: {
			shopId: input.shopId,
			encryptedUserToken: encryptToken(userToken),
			tokenMasked: maskToken(userToken),
			status: "active",
			lastVerifiedAt: now,
			lastError: null,
			discoveredCount: discovered.length,
			updatedById: userId,
		},
		update: {
			encryptedUserToken: encryptToken(userToken),
			tokenMasked: maskToken(userToken),
			status: "active",
			lastVerifiedAt: now,
			lastError: null,
			discoveredCount: discovered.length,
			updatedById: userId,
		},
	});

	const newRows: Prisma.PancakePageCreateManyInput[] = [];
	const updateTasks: Array<() => Promise<unknown>> = [];

	for (const page of discovered) {
		const prev = existingById.get(page.pageId);
		const hasIncomingToken = Boolean(page.existingPageAccessToken);
		const keepPreviousToken =
			!hasIncomingToken && Boolean(prev?.encryptedAccessToken);
		let encryptedAccessToken: string | null = null;
		let tokenMaskedVal: string | null = null;
		let tokenStatus = "missing";
		let tokenSource: string | null = null;
		let tokenReason: string | null = null;

		if (page.existingPageAccessToken) {
			encryptedAccessToken = encryptToken(page.existingPageAccessToken);
			tokenMaskedVal = maskToken(page.existingPageAccessToken);
			tokenStatus = "active";
			tokenSource = "existing";
			tokenReason = null;
			existingTokensSaved++;
		} else if (keepPreviousToken && prev) {
			encryptedAccessToken = prev.encryptedAccessToken;
			tokenMaskedVal = prev.tokenMasked;
			tokenStatus = prev.tokenStatus;
			tokenSource = prev.tokenSource;
			tokenReason = prev.tokenReason;
		} else {
			const missing = describeMissingTokenReason(page);
			tokenStatus = missing.tokenStatus;
			tokenReason = missing.tokenReason;
		}

		const matchesShop = page.sourceShopId === input.shopId;
		const assigned =
			prev?.assigned ?? (input.autoAssignMatchingShop && matchesShop);
		const syncEnabled =
			prev?.syncEnabled ??
			(assigned && tokenStatus === "active" && matchesShop);
		if (!prev?.assigned && assigned) {
			autoAssigned++;
		}

		if (!prev) {
			newRows.push({
				shopId: input.shopId,
				pageId: page.pageId,
				name: page.name,
				platform: page.platform,
				username: page.username,
				avatarUrl: page.avatarUrl,
				sourceShopId: page.sourceShopId,
				roleInPage: page.roleInPage,
				isActivated: page.isActivated,
				hasSubscription: page.hasSubscription,
				needFixWebhook: page.needFixWebhook,
				assigned,
				syncEnabled,
				encryptedAccessToken,
				tokenMasked: tokenMaskedVal,
				tokenStatus,
				tokenSource,
				tokenReason,
				raw: page.raw as Prisma.InputJsonValue,
			});
		} else {
			updateTasks.push(() =>
				db.pancakePage.update({
					where: {
						shopId_pageId: { shopId: input.shopId, pageId: page.pageId },
					},
					data: {
						name: page.name,
						platform: page.platform,
						username: page.username,
						avatarUrl: page.avatarUrl,
						sourceShopId: page.sourceShopId,
						roleInPage: page.roleInPage,
						isActivated: page.isActivated,
						hasSubscription: page.hasSubscription,
						needFixWebhook: page.needFixWebhook,
						assigned,
						syncEnabled,
						encryptedAccessToken,
						tokenMasked: tokenMaskedVal,
						tokenStatus,
						tokenSource,
						tokenReason,
						raw: page.raw as Prisma.InputJsonValue,
					},
				}),
			);
		}
	}

	const createChunkSize = 100;
	for (let i = 0; i < newRows.length; i += createChunkSize) {
		await db.pancakePage.createMany({
			data: newRows.slice(i, i + createChunkSize),
			skipDuplicates: true,
		});
	}

	const updateChunkSize = 5;
	for (let i = 0; i < updateTasks.length; i += updateChunkSize) {
		await Promise.all(
			updateTasks.slice(i, i + updateChunkSize).map((fn) => fn()),
		);
	}

	await writeAudit(db, {
		shopId: input.shopId,
		userId,
		area: "settings",
		action: "pancake_pages_discover",
		summary: `Đồng bộ danh sách ${discovered.length} Page từ Pancake (${existingTokensSaved} Page đã có sẵn token${autoAssigned ? `, gán tự động ${autoAssigned} Page khớp mã shop` : ""}).`,
	});

	return {
		discoveredCount: discovered.length,
		existingTokensSaved,
		autoAssigned,
		tokenMasked: maskToken(userToken),
	};
}

export async function listWorkspacePages(
	db: Db,
	userId: string,
	input: z.infer<typeof pagesListInput>,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const q = input.q.trim().toLowerCase();
	const [connection, pages, convCounts, msgCounts] = await Promise.all([
		db.pancakeAccountConnection.findUnique({
			where: { shopId: input.shopId },
		}),
		db.pancakePage.findMany({
			where: { shopId: input.shopId },
			include: { cursor: true },
			orderBy: [
				{ assigned: "desc" },
				{ syncEnabled: "desc" },
				{ name: "asc" },
			],
		}),
		db.pancakeConversation.groupBy({
			by: ["pageId"],
			where: { shopId: input.shopId },
			_count: { _all: true },
		}),
		db.pancakeMessage.groupBy({
			by: ["pageId"],
			where: { shopId: input.shopId },
			_count: { _all: true },
		}),
	]);

	const convCountMap = new Map(
		convCounts.map((row) => [row.pageId, row._count._all]),
	);
	const msgCountMap = new Map(
		msgCounts.map((row) => [row.pageId, row._count._all]),
	);

	const mapped = pages.map((page) => {
		const conversationCount =
			convCountMap.get(page.pageId) ?? page.cursor?.syncedConversations ?? 0;
		const messageCount =
			msgCountMap.get(page.pageId) ?? page.cursor?.syncedMessages ?? 0;
		const matchesShop = page.sourceShopId === input.shopId;
		return {
			shopId: page.shopId,
			pageId: page.pageId,
			name: page.name,
			platform: page.platform,
			username: page.username,
			avatarUrl: page.avatarUrl,
			sourceShopId: page.sourceShopId,
			matchesShop,
			roleInPage: page.roleInPage,
			isActivated: page.isActivated,
			hasSubscription: page.hasSubscription,
			needFixWebhook: page.needFixWebhook,
			assigned: page.assigned,
			syncEnabled: page.syncEnabled,
			tokenMasked: page.tokenMasked,
			tokenStatus: page.tokenStatus,
			tokenSource: page.tokenSource,
			tokenReason: page.tokenReason,
			connectStatus: page.connectStatus,
			importFrom: page.importFrom?.toISOString() ?? null,
			importUntil: page.importUntil?.toISOString() ?? null,
			lastSyncAt: page.lastSyncAt?.toISOString() ?? null,
			lastSuccessAt:
				(page.lastSuccessAt ?? page.cursor?.lastSuccessAt)?.toISOString() ??
				null,
			lastWebhookAt: page.lastWebhookAt?.toISOString() ?? null,
			lastError: page.lastError ?? page.cursor?.lastError ?? null,
			lastErrorCode: page.lastErrorCode ?? page.cursor?.lastErrorCode ?? null,
			phase: page.cursor?.phase ?? "idle",
			lastConversationId: page.cursor?.lastConversationId ?? null,
			pendingConversationId: page.cursor?.pendingConversationId ?? null,
			pendingMessageCount: page.cursor?.pendingMessageCount ?? 0,
			watermark: page.cursor?.watermark?.toISOString() ?? null,
			conversationCount,
			messageCount,
		};
	});

	const filtered = mapped.filter((row) => {
		if (
			q &&
			!row.name.toLowerCase().includes(q) &&
			!row.pageId.toLowerCase().includes(q) &&
			!(row.username ?? "").toLowerCase().includes(q)
		) {
			return false;
		}
		if (input.filter === "assigned") return row.assigned;
		if (input.filter === "matching_shop") return row.matchesShop;
		if (input.filter === "has_token") return row.tokenStatus === "active";
		if (input.filter === "missing_token") return row.tokenStatus !== "active";
		if (input.filter === "error") {
			return (
				Boolean(row.lastError) ||
				row.tokenStatus === "expired" ||
				row.tokenStatus === "revoked" ||
				row.connectStatus === "disconnected"
			);
		}
		return true;
	});

	const hasEnvToken = Boolean(
		process.env.PANCAKE_USER_ACCESS_TOKEN?.trim() ||
			process.env.PANCAKE_TOKEN?.trim(),
	);

	return {
		canManage: canManage(grants, input.shopId),
		connection: connection
			? {
					connected: true,
					tokenMasked: connection.tokenMasked,
					status: connection.status,
					lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
					lastError: connection.lastError,
					discoveredCount: connection.discoveredCount,
					hasEnvToken,
				}
			: {
					connected: false,
					tokenMasked: hasEnvToken
						? maskToken(
								process.env.PANCAKE_USER_ACCESS_TOKEN ||
									process.env.PANCAKE_TOKEN,
							)
						: null,
					status: hasEnvToken ? "env_ready" : "disconnected",
					lastVerifiedAt: null,
					lastError: null,
					discoveredCount: 0,
					hasEnvToken,
				},
		summary: {
			total: mapped.length,
			assigned: mapped.filter((p) => p.assigned).length,
			syncEnabled: mapped.filter((p) => p.assigned && p.syncEnabled).length,
			matchingShop: mapped.filter((p) => p.matchesShop).length,
			activeToken: mapped.filter((p) => p.tokenStatus === "active").length,
			missingToken: mapped.filter((p) => p.tokenStatus !== "active").length,
			errorCount: mapped.filter(
				(p) =>
					Boolean(p.lastError) ||
					p.tokenStatus === "expired" ||
					p.tokenStatus === "revoked",
			).length,
			totalConversations: mapped.reduce(
				(sum, p) => sum + p.conversationCount,
				0,
			),
			totalMessages: mapped.reduce((sum, p) => sum + p.messageCount, 0),
		},
		pages: filtered,
	};
}

export async function bulkAssignPages(
	db: Db,
	userId: string,
	input: z.infer<typeof bulkAssignPagesInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const pageIds = [...new Set(input.pageIds)];
	const pages = await db.pancakePage.findMany({
		where: { shopId: input.shopId, pageId: { in: pageIds } },
		select: { pageId: true, tokenStatus: true },
	});
	const activePageIds = pages
		.filter((p) => p.tokenStatus === "active")
		.map((p) => p.pageId);
	const nonActivePageIds = pages
		.filter((p) => p.tokenStatus !== "active")
		.map((p) => p.pageId);

	const importFrom =
		input.importFrom !== undefined
			? input.importFrom
				? new Date(input.importFrom)
				: null
			: undefined;
	const importUntil =
		input.importUntil !== undefined
			? input.importUntil
				? new Date(input.importUntil)
				: null
			: undefined;

	await db.$transaction(async (tx) => {
		if (!input.assigned) {
			await tx.pancakePage.updateMany({
				where: { shopId: input.shopId, pageId: { in: pageIds } },
				data: {
					assigned: false,
					syncEnabled: false,
				},
			});
		} else {
			if (activePageIds.length) {
				await tx.pancakePage.updateMany({
					where: { shopId: input.shopId, pageId: { in: activePageIds } },
					data: {
						assigned: true,
						syncEnabled: input.syncEnabled ?? true,
						importFrom,
						importUntil,
					},
				});
			}
			if (nonActivePageIds.length) {
				await tx.pancakePage.updateMany({
					where: { shopId: input.shopId, pageId: { in: nonActivePageIds } },
					data: {
						assigned: true,
						syncEnabled: false,
						importFrom,
						importUntil,
					},
				});
			}
		}
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "settings",
			action: input.assigned ? "pancake_pages_assign" : "pancake_pages_unassign",
			summary: `${input.assigned ? "Gán" : "Bỏ gán"} ${pages.length} Page cho shop ${input.shopId}.`,
		});
	});

	return {
		updatedCount: pages.length,
		activeSyncCount: input.assigned ? activePageIds.length : 0,
		missingTokenCount: input.assigned ? nonActivePageIds.length : 0,
	};
}

export async function configurePageSync(
	db: Db,
	userId: string,
	input: z.infer<typeof configurePageSyncInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const pageIds = [...new Set(input.pageIds)];
	const pages = await db.pancakePage.findMany({
		where: { shopId: input.shopId, pageId: { in: pageIds } },
		select: { pageId: true, tokenStatus: true },
	});
	const importFrom =
		input.importFrom !== undefined
			? input.importFrom
				? new Date(input.importFrom)
				: null
			: undefined;
	const importUntil =
		input.importUntil !== undefined
			? input.importUntil
				? new Date(input.importUntil)
				: null
			: undefined;

	await db.$transaction(async (tx) => {
		for (const page of pages) {
			const canEnable = page.tokenStatus === "active";
			const syncEnabled =
				input.syncEnabled !== undefined
					? input.syncEnabled && canEnable
					: undefined;
			await tx.pancakePage.update({
				where: {
					shopId_pageId: { shopId: input.shopId, pageId: page.pageId },
				},
				data: {
					syncEnabled,
					assigned: syncEnabled !== undefined ? true : undefined,
					importFrom,
					importUntil,
				},
			});
			if (
				input.resetCursor ||
				importFrom !== undefined ||
				importUntil !== undefined
			) {
				await tx.pancakePageSyncCursor.upsert({
					where: {
						shopId_pageId: { shopId: input.shopId, pageId: page.pageId },
					},
					create: {
						shopId: input.shopId,
						pageId: page.pageId,
						phase: "importing",
						importFrom: importFrom ?? null,
						importUntil: importUntil ?? null,
					},
					update: {
						phase: "importing",
						lastConversationId: null,
						pendingConversationId: null,
						pendingMessageCount: 0,
						importFrom,
						windowStart: importFrom,
						importUntil,
						windowEnd: importUntil,
						lastError: null,
						lastErrorCode: null,
					},
				});
			}
		}
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "settings",
			action: "pancake_pages_sync_config",
			summary: `Cập nhật cấu hình đồng bộ cho ${pages.length} Page.`,
		});
	});

	return { updatedCount: pages.length };
}

export async function setPageManualToken(
	db: Db,
	userId: string,
	input: z.infer<typeof setPageManualTokenInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const token = input.pageAccessToken.trim();
	const encryptedAccessToken = encryptToken(token);
	const tokenMaskedVal = maskToken(token);

	await db.$transaction(async (tx) => {
		await tx.pancakePage.update({
			where: {
				shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
			},
			data: {
				encryptedAccessToken,
				tokenMasked: tokenMaskedVal,
				tokenStatus: "active",
				tokenSource: "manual",
				tokenReason: null,
				lastError: null,
				lastErrorCode: null,
				assigned: true,
			},
		});
		await tx.pancakePageSyncCursor.upsert({
			where: {
				shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
			},
			create: {
				shopId: input.shopId,
				pageId: input.pageId,
				phase: "importing",
			},
			update: {
				phase: "importing",
				lastError: null,
				lastErrorCode: null,
			},
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "settings",
			action: "pancake_page_token_manual",
			summary: `Cập nhật thủ công Page Access Token cho Page ${input.pageId} (${tokenMaskedVal}).`,
		});
	});

	return {
		pageId: input.pageId,
		tokenMasked: tokenMaskedVal,
		tokenStatus: "active",
	};
}

export async function confirmGeneratePageToken(
	db: Db,
	userId: string,
	input: z.infer<typeof confirmGeneratePageTokenInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopManager(db, userId, input.shopId);
	const page = await db.pancakePage.findUnique({
		where: {
			shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
		},
	});
	if (!page) {
		throw new PancakePagesApiError(
			"CONFIGURATION_REQUIRED",
			"Không tìm thấy Page trong workspace này.",
		);
	}
	if (page.roleInPage && page.roleInPage !== "ADMINISTER") {
		const reason = `Không thể tạo Page Access Token vì tài khoản chỉ có quyền ${page.roleInPage} (yêu cầu quyền ADMINISTER).`;
		await db.pancakePage.update({
			where: {
				shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
			},
			data: {
				tokenStatus: "permission_denied",
				tokenReason: reason,
				lastError: reason,
				lastErrorCode: "PERMISSION_DENIED",
			},
		});
		throw new PancakePagesApiError("PERMISSION_DENIED", reason);
	}

	const userToken = await resolveUserAccessToken(db, input.shopId);
	let newPageToken: string;
	try {
		newPageToken = await adapter.generatePageAccessToken(
			userToken,
			input.pageId,
		);
	} catch (error) {
		const code =
			error instanceof PancakePagesApiError
				? error.code
				: "PERMISSION_DENIED";
		const reason =
			error instanceof Error
				? redactSecrets(error.message)
				: "Không thể tạo Page Access Token.";
		await db.pancakePage.update({
			where: {
				shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
			},
			data: {
				tokenStatus:
					code === "TOKEN_EXPIRED_OR_REVOKED"
						? "expired"
						: "permission_denied",
				tokenReason: reason,
				lastError: reason,
				lastErrorCode: code,
			},
		});
		throw error;
	}

	const encryptedAccessToken = encryptToken(newPageToken);
	const tokenMaskedVal = maskToken(newPageToken);

	await db.$transaction(async (tx) => {
		await tx.pancakePage.update({
			where: {
				shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
			},
			data: {
				encryptedAccessToken,
				tokenMasked: tokenMaskedVal,
				tokenStatus: "active",
				tokenSource: "generated",
				tokenReason: null,
				lastError: null,
				lastErrorCode: null,
				assigned: true,
			},
		});
		await tx.pancakePageSyncCursor.upsert({
			where: {
				shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
			},
			create: {
				shopId: input.shopId,
				pageId: input.pageId,
				phase: "importing",
			},
			update: {
				phase: "importing",
				lastError: null,
				lastErrorCode: null,
			},
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "settings",
			action: "pancake_page_token_generate",
			summary: `Xác nhận tạo mới Page Access Token cho Page ${input.pageId} (${tokenMaskedVal}).`,
		});
	});

	return {
		pageId: input.pageId,
		tokenMasked: tokenMaskedVal,
		tokenStatus: "active",
	};
}

export async function matchConversationCustomer(
	db: Pick<Db, "pancakeCustomer" | "pancakeOrder">,
	input: CustomerMatchInput,
	dialCode?: string | null,
): Promise<CustomerMatchResult> {
	const sourceIds = [
		...new Set(
			input.sourceCustomerIds.map((id) => id.trim()).filter(Boolean),
		),
	];
	const psids = [
		...new Set(
			input.psids
				.map((id) => id.trim())
				.filter((id) => Boolean(id) && id !== input.pageId),
		),
	];
	const fbIdCandidates = [
		...new Set([
			input.conversationId,
			...psids,
			...psids.map((psid) => `${input.pageId}_${psid}`),
		]),
	];

	const matchedCustomerIds = new Set<string>();

	if (sourceIds.length > 0) {
		const directMatches = await db.pancakeCustomer.findMany({
			where: {
				shopId: input.shopId,
				customerId: { in: sourceIds },
			},
			select: { customerId: true },
		});
		for (const row of directMatches) {
			matchedCustomerIds.add(row.customerId);
		}
	}

	const orderMatches = await db.pancakeOrder.findMany({
		where: {
			shopId: input.shopId,
			customerId: { not: null },
			raw: {
				path: ["conversation_id"],
				equals: input.conversationId,
			},
		},
		select: { customerId: true },
		take: 5,
	});
	for (const row of orderMatches) {
		if (row.customerId) matchedCustomerIds.add(row.customerId);
	}

	if (matchedCustomerIds.size === 0 && sourceIds.length > 0) {
		for (const sourceCustId of sourceIds.slice(0, 3)) {
			const rawCustomerMatches = await db.pancakeCustomer.findMany({
				where: {
					shopId: input.shopId,
					raw: {
						path: ["customer_id"],
						equals: sourceCustId,
					},
				},
				select: { customerId: true },
				take: 5,
			});
			for (const row of rawCustomerMatches) {
				matchedCustomerIds.add(row.customerId);
			}
		}
	}

	if (matchedCustomerIds.size === 0 && fbIdCandidates.length > 0) {
		for (const fbCandidate of fbIdCandidates.slice(0, 4)) {
			const rawFbMatches = await db.pancakeCustomer.findMany({
				where: {
					shopId: input.shopId,
					raw: {
						path: ["fb_id"],
						equals: fbCandidate,
					},
				},
				select: { customerId: true },
				take: 5,
			});
			for (const row of rawFbMatches) {
				matchedCustomerIds.add(row.customerId);
			}
		}
	}

	const dial =
		dialCode !== undefined
			? (dialCode ?? undefined)
			: PANCAKE.shopDialCode.get(input.shopId);
	const candidateTails = [
		...new Set(
			input.phones
				.map((p) => phoneTail(p, dial))
				.filter((tail): tail is string => Boolean(tail)),
		),
	];
	const primaryTail = candidateTails[0] ?? null;

	if (matchedCustomerIds.size === 1) {
		return {
			customerId: [...matchedCustomerIds][0] ?? null,
			linkStatus: "linked_id",
			matchedPhoneTail: primaryTail,
		};
	}
	if (matchedCustomerIds.size > 1) {
		return {
			customerId: null,
			linkStatus: "ambiguous",
			matchedPhoneTail: primaryTail,
		};
	}

	if (candidateTails.length > 0) {
		const suffixFilters = candidateTails.map((tail) => ({
			phone: { contains: tail.slice(-7) },
		}));
		const potentialCustomers = await db.pancakeCustomer.findMany({
			where: {
				shopId: input.shopId,
				OR: suffixFilters,
			},
			select: {
				customerId: true,
				phone: true,
				raw: true,
			},
			take: 25,
		});

		const tailSet = new Set(candidateTails);
		const phoneMatchedIds = new Set<string>();
		for (const cust of potentialCustomers) {
			const directTail = phoneTail(cust.phone, dial);
			if (directTail && tailSet.has(directTail)) {
				phoneMatchedIds.add(cust.customerId);
				continue;
			}
			const parsedRaw = customerRawPhoneSchema.safeParse(cust.raw);
			const rawPhones = parsedRaw.success
				? (parsedRaw.data.phone_numbers ?? [])
				: [];
			for (const rp of rawPhones) {
				const rt = phoneTail(rp, dial);
				if (rt && tailSet.has(rt)) {
					phoneMatchedIds.add(cust.customerId);
					break;
				}
			}
		}

		if (phoneMatchedIds.size === 1) {
			return {
				customerId: [...phoneMatchedIds][0] ?? null,
				linkStatus: "linked_phone",
				matchedPhoneTail: primaryTail,
			};
		}
		if (phoneMatchedIds.size > 1) {
			return {
				customerId: null,
				linkStatus: "ambiguous",
				matchedPhoneTail: primaryTail,
			};
		}
	}

	return {
		customerId: null,
		linkStatus: "unlinked",
		matchedPhoneTail: primaryTail,
	};
}

function classifyMessageSender(pageId: string, msg: IncomingMessage) {
	const from = msg.from;
	const senderId = from?.id ?? null;
	const staffId = from?.admin_id ?? from?.uid ?? null;
	const staffName = from?.admin_name ?? null;
	if (staffId || staffName) {
		return {
			senderType: "staff" as const,
			senderId,
			senderName: staffName ?? from?.name ?? "Nhân viên",
			staffId,
			staffName: staffName ?? from?.name ?? null,
		};
	}
	if (senderId && senderId === pageId) {
		return {
			senderType: "page" as const,
			senderId,
			senderName: from?.name ?? "Page",
			staffId: null,
			staffName: null,
		};
	}
	return {
		senderType: "customer" as const,
		senderId,
		senderName: from?.name ?? "Khách hàng",
		staffId: null,
		staffName: null,
	};
}

export async function storeMessagesBatch(
	db: Db,
	shopId: string,
	pageId: string,
	conversationId: string,
	messages: readonly IncomingMessage[],
	fetchedAt: Date,
): Promise<number> {
	if (!messages.length) return 0;
	const byId = new Map<string, IncomingMessage>();
	for (const msg of messages) {
		byId.set(msg.id, msg);
	}
	const uniqueMessages = [...byId.values()];
	const existing = await db.pancakeMessage.findMany({
		where: {
			shopId,
			pageId,
			conversationId,
			messageId: { in: uniqueMessages.map((m) => m.id) },
		},
		select: { messageId: true },
	});
	const existingSet = new Set(existing.map((e) => e.messageId));

	const rows = uniqueMessages.map((msg) => {
		const sender = classifyMessageSender(pageId, msg);
		const insertedAt = msg.inserted_at
			? sourceDate(msg.inserted_at)
			: fetchedAt;
		return {
			shopId,
			pageId,
			conversationId,
			messageId: msg.id,
			type: msg.type ?? "INBOX",
			senderType: sender.senderType,
			senderId: sender.senderId,
			senderName: sender.senderName,
			staffId: sender.staffId,
			staffName: sender.staffName,
			message: msg.message ?? msg.original_message ?? "",
			originalMessage: msg.original_message ?? null,
			attachments: (msg.attachments ?? []) as Prisma.InputJsonValue,
			hasPhone: msg.has_phone ?? false,
			seen: msg.seen ?? false,
			isRemoved: msg.is_removed ?? false,
			isHidden: msg.is_hidden ?? false,
			parentId: msg.parent_id ?? null,
			sourceInsertedAt: insertedAt,
			fetchedAt,
			raw: msg as Prisma.InputJsonValue,
		};
	});

	const newRows = rows.filter((r) => !existingSet.has(r.messageId));
	if (newRows.length > 0) {
		await db.pancakeMessage.createMany({
			data: newRows,
			skipDuplicates: true,
		});
	}
	for (const row of rows) {
		if (!existingSet.has(row.messageId)) continue;
		await db.pancakeMessage.update({
			where: {
				shopId_pageId_conversationId_messageId: {
					shopId,
					pageId,
					conversationId,
					messageId: row.messageId,
				},
			},
			data: {
				message: row.message,
				originalMessage: row.originalMessage,
				attachments: row.attachments,
				hasPhone: row.hasPhone,
				seen: row.seen,
				isRemoved: row.isRemoved,
				isHidden: row.isHidden,
				fetchedAt: row.fetchedAt,
				raw: row.raw,
			},
		});
	}
	return newRows.length;
}

export async function upsertConversationWithContext(
	db: Db,
	shopId: string,
	pageId: string,
	conv: IncomingConversation,
	msgPage: MessagesPageResult | null,
	messagesComplete: boolean,
	nextMessageCount: number,
	fetchedAt: Date,
	dialCode?: string | null,
): Promise<{
	customerId: string | null;
	linkStatus: string;
	writtenMessages: number;
}> {
	const sourceCustomerIds = [
		conv.customer_id,
		conv.page_customer?.customer_id,
		...(conv.customers ?? []).map((c) => c.customer_id),
		...(msgPage?.customers ?? []).map((c) => c.customer_id),
	].filter((id): id is string => Boolean(id?.trim()));

	const pageCustomerIds = [
		conv.page_customer?.id,
		...(conv.customers ?? []).map((c) => c.id),
		...(msgPage?.customers ?? []).map((c) => c.id),
		...(msgPage?.convCustomers ?? []).map((c) => c.id),
	].filter((id): id is string => Boolean(id?.trim()));

	const psids = [
		conv.page_customer?.psid,
		conv.from?.id,
		...(conv.customers ?? []).map((c) => c.fb_id),
		msgPage?.convFrom?.id,
		...(msgPage?.customers ?? []).map((c) => c.fb_id),
		...(msgPage?.convCustomers ?? []).map((c) => c.fb_id),
	].filter((id): id is string => Boolean(id?.trim()));

	const phones = [
		...extractPhones(conv.recent_phone_numbers),
		...(msgPage?.phones ?? []),
		...(msgPage?.customers ?? []).flatMap((c) => [
			...extractPhones(c.recent_phone_numbers),
			...(c.shop_customer_addresses ?? [])
				.map((a) => a.phone_number)
				.filter((p): p is string => Boolean(p?.trim())),
		]),
	];

	const match = await matchConversationCustomer(
		db,
		{
			shopId,
			pageId,
			conversationId: conv.id,
			sourceCustomerIds,
			pageCustomerIds,
			psids,
			phones,
		},
		dialCode,
	);

	const customerName =
		conv.customers?.[0]?.name?.trim() ||
		conv.page_customer?.name?.trim() ||
		msgPage?.customers?.[0]?.name?.trim() ||
		msgPage?.convFrom?.name?.trim() ||
		(conv.from?.id !== pageId ? conv.from?.name?.trim() : null) ||
		"Khách hội thoại";

	const customerPhone = phones[0] ?? null;
	const sourceInsertedAt = conv.inserted_at
		? sourceDate(conv.inserted_at)
		: null;
	const sourceUpdatedAt = conv.updated_at
		? sourceDate(conv.updated_at)
		: (sourceInsertedAt ?? fetchedAt);
	const canInbox =
		msgPage?.canInbox ??
		msgPage?.customers?.[0]?.can_inbox ??
		true;
	const isReplied =
		conv.is_replied ??
		Boolean(
			conv.last_sent_by?.admin_id ||
				conv.last_sent_by?.uid ||
				conv.last_sent_by?.id === pageId,
		);

	const convData = {
		type: conv.type ?? "INBOX",
		customerId: match.customerId,
		linkStatus: match.linkStatus,
		sourceCustomerId: sourceCustomerIds[0] ?? null,
		pageCustomerId: pageCustomerIds[0] ?? null,
		psid: psids.find((id) => id !== pageId) ?? null,
		customerName,
		customerPhone,
		phoneTail: match.matchedPhoneTail,
		snippet: conv.snippet ?? null,
		seen: conv.seen ?? false,
		isReplied,
		canInbox,
		messageCount:
			conv.message_count ?? msgPage?.messages.length ?? 0,
		assigneeIds: conv.assignee_ids ?? [],
		tags: (conv.tags ?? []) as Prisma.InputJsonValue,
		version: conv.version ?? undefined,
		messagesComplete,
		nextMessageCount,
		sourceInsertedAt,
		sourceUpdatedAt,
		fetchedAt,
		raw: conv as Prisma.InputJsonValue,
	};

	await db.pancakeConversation.upsert({
		where: {
			shopId_pageId_conversationId: {
				shopId,
				pageId,
				conversationId: conv.id,
			},
		},
		create: {
			shopId,
			pageId,
			conversationId: conv.id,
			...convData,
		},
		update: convData,
	});

	let writtenMessages = 0;
	if (msgPage?.messages.length) {
		writtenMessages = await storeMessagesBatch(
			db,
			shopId,
			pageId,
			conv.id,
			msgPage.messages,
			fetchedAt,
		);
	}

	return {
		customerId: match.customerId,
		linkStatus: match.linkStatus,
		writtenMessages,
	};
}

export type SyncPageOutcome = {
	pageId: string;
	phase: string;
	complete: boolean;
	conversationsProcessed: number;
	messagesWritten: number;
	errorCode?: string;
	errorMessage?: string;
};

export async function syncPageConversations(
	db: Db,
	shopId: string,
	pageId: string,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
	options: {
		conversationBudget?: number;
		messageBudget?: number;
		now?: Date;
	} = {},
): Promise<SyncPageOutcome> {
	const now = options.now ?? new Date();
	const conversationBudget =
		options.conversationBudget ?? PANCAKE.conversationPageBudget;
	const messageBudget = options.messageBudget ?? PANCAKE.messagePageBudget;

	const page = await db.pancakePage.findUnique({
		where: { shopId_pageId: { shopId, pageId } },
	});
	if (!page || !page.assigned || !page.syncEnabled) {
		return {
			pageId,
			phase: "idle",
			complete: true,
			conversationsProcessed: 0,
			messagesWritten: 0,
		};
	}

	if (
		!page.encryptedAccessToken ||
		page.tokenStatus === "missing" ||
		page.tokenStatus === "permission_denied" ||
		page.tokenStatus === "expired" ||
		page.tokenStatus === "revoked"
	) {
		return {
			pageId,
			phase: "paused_auth",
			complete: false,
			conversationsProcessed: 0,
			messagesWritten: 0,
			errorCode:
				page.tokenStatus === "permission_denied"
					? "PERMISSION_DENIED"
					: "TOKEN_EXPIRED_OR_REVOKED",
			errorMessage:
				page.tokenReason ??
				"Page chưa có token hợp lệ hoặc cần kết nối lại.",
		};
	}

	let pageAccessToken: string;
	try {
		pageAccessToken = decryptToken(page.encryptedAccessToken);
	} catch {
		const reason = "Không thể giải mã Page Access Token. Vui lòng kết nối lại.";
		await db.pancakePage.update({
			where: { shopId_pageId: { shopId, pageId } },
			data: {
				tokenStatus: "invalid",
				tokenReason: reason,
				lastError: reason,
				lastErrorCode: "TOKEN_EXPIRED_OR_REVOKED",
			},
		});
		return {
			pageId,
			phase: "paused_auth",
			complete: false,
			conversationsProcessed: 0,
			messagesWritten: 0,
			errorCode: "TOKEN_EXPIRED_OR_REVOKED",
			errorMessage: reason,
		};
	}

	const settings = await effectiveSettings(db, shopId);
	const dialCode = settings.dialCode;

	const cursorKey = { shopId_pageId: { shopId, pageId } };
	let cursor = await db.pancakePageSyncCursor.upsert({
		where: cursorKey,
		create: {
			shopId,
			pageId,
			phase: "importing",
			importFrom: page.importFrom,
			importUntil: page.importUntil,
		},
		update: {},
	});

	if (!cursor.windowEnd || cursor.phase === "idle" || cursor.phase === "paused_auth") {
		const isImporting = cursor.phase !== "incremental";
		const defaultStart = new Date(
			now.getTime() - PANCAKE.defaultImportDays * PANCAKE.dayMs,
		);
		const windowStart = isImporting
			? (cursor.importFrom ?? page.importFrom ?? defaultStart)
			: new Date(
					Math.max(
						0,
						(cursor.watermark?.getTime() ?? now.getTime() - PANCAKE.recentWindowMs) -
							PANCAKE.overlapMs,
					),
				);
		const windowEnd = isImporting
			? (cursor.importUntil ?? page.importUntil ?? now)
			: now;
		cursor = await db.pancakePageSyncCursor.update({
			where: cursorKey,
			data: {
				phase: isImporting ? "importing" : "incremental",
				windowStart,
				windowEnd,
				lastError: null,
				lastErrorCode: null,
			},
		});
	}

	let conversationsProcessed = 0;
	let messagesWritten = 0;
	let messageCallsUsed = 0;

	try {
		if (cursor.pendingConversationId) {
			const pendingConvId = cursor.pendingConversationId;
			let offset = cursor.pendingMessageCount;
			let finishedPending = false;
			while (messageCallsUsed < messageBudget) {
				const fetchedAt = new Date();
				const msgPage = await adapter.listMessages(
					pageId,
					pendingConvId,
					pageAccessToken,
					offset,
				);
				messageCallsUsed++;
				const written = await storeMessagesBatch(
					db,
					shopId,
					pageId,
					pendingConvId,
					msgPage.messages,
					fetchedAt,
				);
				messagesWritten += written;
				offset += msgPage.messages.length;
				if (msgPage.messages.length < PANCAKE.messageBatchSize) {
					finishedPending = true;
					break;
				}
			}

			await db.$transaction([
				db.pancakeConversation.updateMany({
					where: { shopId, pageId, conversationId: pendingConvId },
					data: {
						messagesComplete: finishedPending,
						nextMessageCount: offset,
					},
				}),
				db.pancakePageSyncCursor.update({
					where: cursorKey,
					data: {
						pendingConversationId: finishedPending ? null : pendingConvId,
						pendingMessageCount: finishedPending ? 0 : offset,
						syncedMessages: { increment: messagesWritten },
					},
				}),
			]);

			cursor = await db.pancakePageSyncCursor.findUniqueOrThrow({
				where: cursorKey,
			});

			if (!finishedPending) {
				await db.pancakePage.update({
					where: { shopId_pageId: { shopId, pageId } },
					data: { lastSyncAt: new Date(), lastError: null, lastErrorCode: null },
				});
				return {
					pageId,
					phase: cursor.phase,
					complete: false,
					conversationsProcessed,
					messagesWritten,
				};
			}
		}

		let conversationBatches = 0;
		while (
			conversationBatches < conversationBudget &&
			messageCallsUsed < messageBudget
		) {
			const sinceSec = cursor.windowStart
				? Math.floor(cursor.windowStart.getTime() / 1000)
				: undefined;
			const untilSec = cursor.windowEnd
				? Math.floor(cursor.windowEnd.getTime() / 1000)
				: undefined;

			const conversations = await adapter.listConversations(
				pageId,
				pageAccessToken,
				{
					lastConversationId: cursor.lastConversationId ?? undefined,
					since: sinceSec,
					until: untilSec,
					orderBy: "updated_at",
				},
			);
			conversationBatches++;

			if (conversations.length === 0) {
				const completedAt = new Date();
				await db.$transaction([
					db.pancakePageSyncCursor.update({
						where: cursorKey,
						data: {
							phase: "incremental",
							lastConversationId: null,
							pendingConversationId: null,
							pendingMessageCount: 0,
							watermark: cursor.windowEnd ?? completedAt,
							windowStart: null,
							windowEnd: null,
							lastSuccessAt: completedAt,
							lastError: null,
							lastErrorCode: null,
						},
					}),
					db.pancakePage.update({
						where: { shopId_pageId: { shopId, pageId } },
						data: {
							lastSyncAt: completedAt,
							lastSuccessAt: completedAt,
							lastError: null,
							lastErrorCode: null,
						},
					}),
				]);
				return {
					pageId,
					phase: "incremental",
					complete: true,
					conversationsProcessed,
					messagesWritten,
				};
			}

			const existingConvs = await db.pancakeConversation.findMany({
				where: {
					shopId,
					pageId,
					conversationId: { in: conversations.map((c) => c.id) },
				},
				select: {
					conversationId: true,
					sourceUpdatedAt: true,
					messagesComplete: true,
					nextMessageCount: true,
				},
			});
			const existingMap = new Map(
				existingConvs.map((c) => [c.conversationId, c]),
			);

			for (const conv of conversations) {
				const fetchedAt = new Date();
				const existing = existingMap.get(conv.id);
				const convUpdated = conv.updated_at
					? sourceDate(conv.updated_at)
					: conv.inserted_at
						? sourceDate(conv.inserted_at)
						: fetchedAt;
				const needsMessageSync =
					!existing ||
					!existing.messagesComplete ||
					convUpdated > existing.sourceUpdatedAt;

				let firstMsgPage: MessagesPageResult | null = null;
				let offset = 0;
				let convMessagesComplete = existing?.messagesComplete ?? false;
				let convMessagesWritten = 0;

				if (needsMessageSync && messageCallsUsed < messageBudget) {
					firstMsgPage = await adapter.listMessages(
						pageId,
						conv.id,
						pageAccessToken,
						0,
					);
					messageCallsUsed++;
					offset = firstMsgPage.messages.length;
					convMessagesComplete =
						firstMsgPage.messages.length < PANCAKE.messageBatchSize;
				}

				const upserted = await withDbRetry(() =>
					upsertConversationWithContext(
						db,
						shopId,
						pageId,
						conv,
						firstMsgPage,
						convMessagesComplete,
						offset,
						fetchedAt,
						dialCode,
					),
				);
				convMessagesWritten += upserted.writtenMessages;

				if (
					needsMessageSync &&
					!convMessagesComplete &&
					cursor.phase === "importing"
				) {
					while (messageCallsUsed < messageBudget && !convMessagesComplete) {
						const olderPage = await adapter.listMessages(
							pageId,
							conv.id,
							pageAccessToken,
							offset,
						);
						messageCallsUsed++;
						const written = await storeMessagesBatch(
							db,
							shopId,
							pageId,
							conv.id,
							olderPage.messages,
							new Date(),
						);
						convMessagesWritten += written;
						offset += olderPage.messages.length;
						if (olderPage.messages.length < PANCAKE.messageBatchSize) {
							convMessagesComplete = true;
						}
					}
					await db.pancakeConversation.update({
						where: {
							shopId_pageId_conversationId: {
								shopId,
								pageId,
								conversationId: conv.id,
							},
						},
						data: {
							messagesComplete: convMessagesComplete,
							nextMessageCount: offset,
						},
					});
				}

				conversationsProcessed++;
				messagesWritten += convMessagesWritten;

				const pausedMidConversation =
					needsMessageSync &&
					!convMessagesComplete &&
					cursor.phase === "importing";

				cursor = await db.pancakePageSyncCursor.update({
					where: cursorKey,
					data: {
						lastConversationId: conv.id,
						pendingConversationId: pausedMidConversation ? conv.id : null,
						pendingMessageCount: pausedMidConversation ? offset : 0,
						syncedConversations: existing ? undefined : { increment: 1 },
						syncedMessages:
							convMessagesWritten > 0
								? { increment: convMessagesWritten }
								: undefined,
						lastError: null,
						lastErrorCode: null,
					},
				});

				if (pausedMidConversation || messageCallsUsed >= messageBudget) {
					await db.pancakePage.update({
						where: { shopId_pageId: { shopId, pageId } },
						data: {
							lastSyncAt: new Date(),
							lastError: null,
							lastErrorCode: null,
						},
					});
					return {
						pageId,
						phase: cursor.phase,
						complete: false,
						conversationsProcessed,
						messagesWritten,
					};
				}
			}

			if (conversations.length < PANCAKE.conversationBatchSize) {
				const completedAt = new Date();
				await db.$transaction([
					db.pancakePageSyncCursor.update({
						where: cursorKey,
						data: {
							phase: "incremental",
							lastConversationId: null,
							pendingConversationId: null,
							pendingMessageCount: 0,
							watermark: cursor.windowEnd ?? completedAt,
							windowStart: null,
							windowEnd: null,
							lastSuccessAt: completedAt,
							lastError: null,
							lastErrorCode: null,
						},
					}),
					db.pancakePage.update({
						where: { shopId_pageId: { shopId, pageId } },
						data: {
							lastSyncAt: completedAt,
							lastSuccessAt: completedAt,
							lastError: null,
							lastErrorCode: null,
						},
					}),
				]);
				return {
					pageId,
					phase: "incremental",
					complete: true,
					conversationsProcessed,
					messagesWritten,
				};
			}
		}

		await db.pancakePage.update({
			where: { shopId_pageId: { shopId, pageId } },
			data: {
				lastSyncAt: new Date(),
				lastError: null,
				lastErrorCode: null,
			},
		});
		return {
			pageId,
			phase: cursor.phase,
			complete: false,
			conversationsProcessed,
			messagesWritten,
		};
	} catch (error) {
		const code =
			error instanceof PancakePagesApiError ? error.code : "UNKNOWN_ERROR";
		const message =
			error instanceof Error
				? redactSecrets(error.message).slice(0, PANCAKE.logMessageMax)
				: "Lỗi đồng bộ hội thoại";
		const isAuthFailure =
			code === "TOKEN_EXPIRED_OR_REVOKED" || code === "PERMISSION_DENIED";

		logSync({
			event: "page_sync_failed",
			shopId,
			pageId,
			code,
			message,
		});

		await db.$transaction([
			db.pancakePage.update({
				where: { shopId_pageId: { shopId, pageId } },
				data: {
					lastSyncAt: new Date(),
					lastError: message,
					lastErrorCode: code,
					tokenStatus: isAuthFailure
						? code === "PERMISSION_DENIED"
							? "permission_denied"
							: "expired"
						: undefined,
					tokenReason: isAuthFailure ? message : undefined,
				},
			}),
			db.pancakePageSyncCursor.update({
				where: cursorKey,
				data: {
					phase: isAuthFailure ? "paused_auth" : undefined,
					lastError: message,
					lastErrorCode: code,
				},
			}),
		]);

		return {
			pageId,
			phase: isAuthFailure ? "paused_auth" : cursor.phase,
			complete: false,
			conversationsProcessed,
			messagesWritten,
			errorCode: code,
			errorMessage: message,
		};
	}
}

export async function syncShopPages(
	db: Db,
	shopId: string,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
	options: {
		pageIds?: string[];
		concurrency?: number;
		conversationBudget?: number;
		messageBudget?: number;
	} = {},
): Promise<{
	pagesProcessed: number;
	conversationsProcessed: number;
	messagesWritten: number;
	outcomes: SyncPageOutcome[];
}> {
	const pages = await db.pancakePage.findMany({
		where: {
			shopId,
			assigned: true,
			syncEnabled: true,
			tokenStatus: "active",
			pageId: options.pageIds?.length ? { in: options.pageIds } : undefined,
		},
		select: { pageId: true },
		orderBy: [{ lastSyncAt: "asc" }, { pageId: "asc" }],
	});

	if (!pages.length) {
		return {
			pagesProcessed: 0,
			conversationsProcessed: 0,
			messagesWritten: 0,
			outcomes: [],
		};
	}

	const concurrency = Math.max(
		1,
		options.concurrency ?? PANCAKE.pageSyncConcurrency,
	);
	const outcomes: SyncPageOutcome[] = [];
	let index = 0;

	async function workerLoop() {
		while (index < pages.length) {
			const current = pages[index++];
			if (!current) break;
			const outcome = await syncPageConversations(
				db,
				shopId,
				current.pageId,
				adapter,
				{
					conversationBudget: options.conversationBudget,
					messageBudget: options.messageBudget,
				},
			);
			outcomes.push(outcome);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, pages.length) }, () =>
			workerLoop(),
		),
	);

	return {
		pagesProcessed: outcomes.length,
		conversationsProcessed: outcomes.reduce(
			(sum, o) => sum + o.conversationsProcessed,
			0,
		),
		messagesWritten: outcomes.reduce((sum, o) => sum + o.messagesWritten, 0),
		outcomes,
	};
}

export async function syncPagesNow(
	db: Db,
	userId: string,
	input: z.infer<typeof syncPagesNowInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopManager(db, userId, input.shopId);
	return syncShopPages(db, input.shopId, adapter, {
		pageIds: input.pageIds,
		conversationBudget: input.conversationBudget,
		messageBudget: input.messageBudget,
	});
}

export const pageWebhookPayload = z
	.object({
		page_id: sourceId.optional(),
		event_type: z.enum([
			"messaging",
			"conversation",
			"connect_status",
			"post",
			"subscription",
		]),
		request_id: z.string().nullish(),
		timestamp: z.number().int().nullish(),
		data: z
			.object({
				conversation: conversationWire.optional(),
				message: messageWire.optional(),
				connect_status: z.enum(["connected", "disconnected"]).optional(),
				page_id: sourceId.optional(),
			})
			.passthrough(),
	})
	.passthrough();

export type IncomingPageWebhook = z.infer<typeof pageWebhookPayload>;

export async function ingestPageWebhook(
	db: Db,
	rawBody: string,
	explicitShopId?: string,
): Promise<{
	accepted: boolean;
	duplicate: boolean;
	stale: boolean;
	shopId: string;
	pageId: string;
	eventType: string;
}> {
	const parsed = pageWebhookPayload.parse(JSON.parse(rawBody));
	const pageId =
		parsed.page_id ??
		parsed.data.page_id ??
		parsed.data.message?.page_id ??
		parsed.data.conversation?.page_id;
	if (!pageId) {
		throw new Error("PAGE_ID_REQUIRED");
	}

	const pageRows = await db.pancakePage.findMany({
		where: {
			pageId,
			shopId: explicitShopId,
		},
		orderBy: [{ assigned: "desc" }, { syncEnabled: "desc" }],
	});

	let targetShopId = explicitShopId ?? pageRows[0]?.shopId;
	if (!targetShopId) {
		const fallbackShop = await db.pancakeShop.findFirst({
			orderBy: { id: "asc" },
			select: { id: true },
		});
		if (!fallbackShop) throw new Error("SHOP_NOT_FOUND");
		targetShopId = fallbackShop.id;
	}

	if (pageRows.length === 0) {
		await db.pancakePage.upsert({
			where: {
				shopId_pageId: { shopId: targetShopId, pageId },
			},
			create: {
				shopId: targetShopId,
				pageId,
				name: `Page ${pageId}`,
				platform: "facebook",
				assigned: true,
			},
			update: {},
		});
	}

	const dedupeKey =
		parsed.request_id?.trim() ||
		createHash("sha256").update(rawBody).digest("hex");

	const existingEvent = await db.pancakePageWebhookEvent.findUnique({
		where: {
			shopId_pageId_dedupeKey: {
				shopId: targetShopId,
				pageId,
				dedupeKey,
			},
		},
	});
	if (existingEvent) {
		return {
			accepted: true,
			duplicate: true,
			stale: existingEvent.status === "ignored_stale",
			shopId: targetShopId,
			pageId,
			eventType: parsed.event_type,
		};
	}

	const now = new Date();
	const incomingVersion = parsed.data.conversation?.version ?? null;
	let stale = false;

	if (
		(parsed.event_type === "conversation" ||
			parsed.event_type === "messaging") &&
		parsed.data.conversation
	) {
		const conv = parsed.data.conversation;
		const existingConv = await db.pancakeConversation.findUnique({
			where: {
				shopId_pageId_conversationId: {
					shopId: targetShopId,
					pageId,
					conversationId: conv.id,
				},
			},
			select: {
				version: true,
				sourceUpdatedAt: true,
				messagesComplete: true,
				nextMessageCount: true,
			},
		});

		const eventTime = parsed.data.message?.inserted_at
			? sourceDate(parsed.data.message.inserted_at)
			: conv.updated_at
				? sourceDate(conv.updated_at)
				: parsed.timestamp
					? new Date(parsed.timestamp * 1000)
					: now;

		if (
			parsed.event_type === "conversation" &&
			existingConv?.version !== null &&
			existingConv?.version !== undefined &&
			incomingVersion !== null &&
			incomingVersion <= existingConv.version
		) {
			stale = true;
		} else if (
			parsed.event_type === "conversation" &&
			incomingVersion === null &&
			existingConv &&
			eventTime < existingConv.sourceUpdatedAt
		) {
			stale = true;
		}

		if (!stale) {
			const settings = await effectiveSettings(db, targetShopId);
			const isOutdatedConvMeta =
				existingConv &&
				((existingConv.version !== null &&
					incomingVersion !== null &&
					incomingVersion < existingConv.version) ||
					eventTime < existingConv.sourceUpdatedAt);

			if (!isOutdatedConvMeta) {
				const syntheticMsgPage: MessagesPageResult | null = parsed.data.message
					? {
							messages: [parsed.data.message],
							customers: [],
							convCustomers: conv.customers ?? [],
							convFrom: conv.from ?? null,
							canInbox: true,
							phones: extractPhones( parsed.data.message.phone_info),
						}
					: null;
				const convWithUpdated: IncomingConversation = {
					...conv,
					updated_at:
						conv.updated_at ??
						parsed.data.message?.inserted_at ??
						eventTime.toISOString().replace(/Z$/, ""),
				};
				await upsertConversationWithContext(
					db,
					targetShopId,
					pageId,
					convWithUpdated,
					syntheticMsgPage,
					existingConv?.messagesComplete ?? false,
					existingConv?.nextMessageCount ?? 0,
					now,
					settings.dialCode,
				);
			} else if (parsed.data.message) {
				await storeMessagesBatch(
					db,
					targetShopId,
					pageId,
					conv.id,
					[parsed.data.message],
					now,
				);
			}
		}
	}

	if (parsed.event_type === "connect_status" && parsed.data.connect_status) {
		const isDisconnected = parsed.data.connect_status === "disconnected";
		await db.pancakePage.update({
			where: { shopId_pageId: { shopId: targetShopId, pageId } },
			data: {
				connectStatus: parsed.data.connect_status,
				lastWebhookAt: now,
				lastError: isDisconnected
					? "Page bị mất kết nối với nền tảng (disconnected). Vui lòng kết nối lại trên Pancake."
					: undefined,
				lastErrorCode: isDisconnected ? "PAGE_DISCONNECTED" : undefined,
			},
		});
	} else {
		await db.pancakePage.update({
			where: { shopId_pageId: { shopId: targetShopId, pageId } },
			data: { lastWebhookAt: now },
		});
	}

	await db.pancakePageWebhookEvent.upsert({
		where: {
			shopId_pageId_dedupeKey: {
				shopId: targetShopId,
				pageId,
				dedupeKey,
			},
		},
		create: {
			shopId: targetShopId,
			pageId,
			dedupeKey,
			eventType: parsed.event_type,
			requestId: parsed.request_id ?? null,
			eventTimestamp: parsed.timestamp ?? null,
			version: incomingVersion,
			status: stale ? "ignored_stale" : "processed",
			payload: parsed as Prisma.InputJsonValue,
			processedAt: now,
		},
		update: {},
	});

	return {
		accepted: true,
		duplicate: false,
		stale,
		shopId: targetShopId,
		pageId,
		eventType: parsed.event_type,
	};
}

export async function listConversations(
	db: Db,
	userId: string,
	input: z.infer<typeof conversationListInput>,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const q = input.q.trim();

	const where: Prisma.PancakeConversationWhereInput = {
		shopId: input.shopId,
		pageId: input.pageId,
		customerId:
			input.customerId ??
			(input.linkStatus === "linked" ? { not: null } : undefined),
		seen: input.unreadOnly ? false : undefined,
		linkStatus:
			input.linkStatus === "unlinked"
				? "unlinked"
				: input.linkStatus === "ambiguous"
					? "ambiguous"
					: undefined,
		OR: q
			? [
					{ customerName: { contains: q, mode: "insensitive" } },
					{ customerPhone: { contains: q } },
					{ snippet: { contains: q, mode: "insensitive" } },
					{ conversationId: { contains: q } },
				]
			: undefined,
	};

	const [rows, total, pages] = await Promise.all([
		db.pancakeConversation.findMany({
			where,
			include: {
				page: {
					select: {
						name: true,
						platform: true,
						avatarUrl: true,
						tokenStatus: true,
						connectStatus: true,
					},
				},
				customer: {
					select: {
						customerId: true,
						name: true,
						phone: true,
					},
				},
			},
			orderBy: [{ sourceUpdatedAt: "desc" }, { conversationId: "asc" }],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeConversation.count({ where }),
		db.pancakePage.findMany({
			where: { shopId: input.shopId, assigned: true },
			select: {
				pageId: true,
				name: true,
				platform: true,
				tokenStatus: true,
			},
			orderBy: { name: "asc" },
		}),
	]);

	return {
		canWrite: canWrite(grants, input.shopId),
		total,
		pages,
		rows: rows.map((row) => ({
			shopId: row.shopId,
			pageId: row.pageId,
			pageName: row.page.name,
			platform: row.page.platform,
			pageAvatarUrl: row.page.avatarUrl,
			pageTokenStatus: row.page.tokenStatus,
			pageConnectStatus: row.page.connectStatus,
			conversationId: row.conversationId,
			type: row.type,
			customerId: row.customerId,
			linkedCustomerName: row.customer?.name ?? null,
			linkedCustomerPhone: row.customer?.phone ?? null,
			linkStatus: row.linkStatus,
			customerName: row.customerName,
			customerPhone: row.customerPhone,
			snippet: row.snippet,
			seen: row.seen,
			isReplied: row.isReplied,
			canInbox: row.canInbox,
			messageCount: row.messageCount,
			messagesComplete: row.messagesComplete,
			sourceInsertedAt: row.sourceInsertedAt?.toISOString() ?? null,
			sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
		})),
	};
}

export async function conversationMessages(
	db: Db,
	userId: string,
	input: z.infer<typeof conversationMessagesInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const conversation = await db.pancakeConversation.findUnique({
		where: {
			shopId_pageId_conversationId: {
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
			},
		},
		include: {
			page: true,
			customer: {
				select: {
					customerId: true,
					name: true,
					phone: true,
					email: true,
				},
			},
		},
	});
	if (!conversation) {
		throw new PancakePagesApiError(
			"CONFIGURATION_REQUIRED",
			"Không tìm thấy hội thoại trong workspace này.",
		);
	}

	if (
		input.fetchRemoteOlder &&
		!conversation.messagesComplete &&
		conversation.page.encryptedAccessToken &&
		conversation.page.tokenStatus === "active"
	) {
		try {
			const pat = decryptToken(conversation.page.encryptedAccessToken);
			const offset = conversation.nextMessageCount;
			const older = await adapter.listMessages(
				input.pageId,
				input.conversationId,
				pat,
				offset,
			);
			await storeMessagesBatch(
				db,
				input.shopId,
				input.pageId,
				input.conversationId,
				older.messages,
				new Date(),
			);
			const newOffset = offset + older.messages.length;
			const complete = older.messages.length < PANCAKE.messageBatchSize;
			await db.pancakeConversation.update({
				where: {
					shopId_pageId_conversationId: {
						shopId: input.shopId,
						pageId: input.pageId,
						conversationId: input.conversationId,
					},
				},
				data: {
					messagesComplete: complete,
					nextMessageCount: newOffset,
					canInbox: older.canInbox,
				},
			});
			conversation.messagesComplete = complete;
			conversation.nextMessageCount = newOffset;
			conversation.canInbox = older.canInbox;
		} catch (error) {
			logSync({
				event: "lazy_messages_fetch_failed",
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
				code:
					error instanceof PancakePagesApiError ? error.code : "UNKNOWN_ERROR",
			});
		}
	}

	const beforeDate = input.beforeInsertedAt
		? new Date(input.beforeInsertedAt)
		: undefined;

	const where: Prisma.PancakeMessageWhereInput = {
		shopId: input.shopId,
		pageId: input.pageId,
		conversationId: input.conversationId,
		OR: beforeDate
			? [
					{ sourceInsertedAt: { lt: beforeDate } },
					...(input.beforeMessageId
						? [
								{
									sourceInsertedAt: beforeDate,
									messageId: { lt: input.beforeMessageId },
								},
							]
						: []),
				]
			: undefined,
	};

	const [rowsDesc, totalCount, outbound] = await Promise.all([
		db.pancakeMessage.findMany({
			where,
			orderBy: [{ sourceInsertedAt: "desc" }, { messageId: "desc" }],
			take: input.limit + 1,
		}),
		db.pancakeMessage.count({
			where: {
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
			},
		}),
		db.pancakeOutboundMessage.findMany({
			where: {
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
				status: { in: ["sending", "failed"] },
			},
			orderBy: { createdAt: "asc" },
			take: 20,
		}),
	]);

	const hasOlderInDb = rowsDesc.length > input.limit;
	const sliceDesc = hasOlderInDb ? rowsDesc.slice(0, input.limit) : rowsDesc;
	const chronological = [...sliceDesc].reverse();
	const oldestLoaded = chronological[0];

	return {
		canWrite: canWrite(grants, input.shopId),
		conversation: {
			shopId: conversation.shopId,
			pageId: conversation.pageId,
			pageName: conversation.page.name,
			platform: conversation.page.platform,
			pageTokenStatus: conversation.page.tokenStatus,
			pageTokenReason: conversation.page.tokenReason,
			conversationId: conversation.conversationId,
			type: conversation.type,
			customerId: conversation.customerId,
			customer: conversation.customer,
			linkStatus: conversation.linkStatus,
			customerName: conversation.customerName,
			customerPhone: conversation.customerPhone,
			seen: conversation.seen,
			isReplied: conversation.isReplied,
			canInbox: conversation.canInbox,
			messageCount: Math.max(conversation.messageCount, totalCount),
			messagesComplete: conversation.messagesComplete,
			sourceUpdatedAt: conversation.sourceUpdatedAt.toISOString(),
		},
		hasMoreOlder: hasOlderInDb || !conversation.messagesComplete,
		hasOlderInDb,
		nextCursor: oldestLoaded
			? {
					beforeInsertedAt: oldestLoaded.sourceInsertedAt.toISOString(),
					beforeMessageId: oldestLoaded.messageId,
				}
			: null,
		messages: chronological.map((msg) => {
			const parsedAttachments = storedAttachmentSchema.safeParse(
				msg.attachments,
			);
			const attachments = (
				parsedAttachments.success ? parsedAttachments.data : []
			).map((item) => ({
				id: item.id ?? null,
				type: item.type ?? null,
				url: item.url ?? null,
				previewUrl: item.preview_url ?? null,
				fileUrl: item.file_url ?? null,
				name: item.name ?? null,
				mimeType: item.mime_type ?? null,
			}));
			return {
				messageId: msg.messageId,
				type: msg.type,
				senderType: msg.senderType,
				senderId: msg.senderId,
				senderName: msg.senderName,
				staffId: msg.staffId,
				staffName: msg.staffName,
				message: msg.message,
				originalMessage: msg.originalMessage,
				attachments,
				hasPhone: msg.hasPhone,
				seen: msg.seen,
				isRemoved: msg.isRemoved,
				isHidden: msg.isHidden,
				sourceInsertedAt: msg.sourceInsertedAt.toISOString(),
			};
		}),
		pendingOutbound: outbound.map((item) => ({
			clientMessageId: item.clientMessageId,
			message: item.message,
			status: item.status,
			errorCode: item.errorCode,
			errorMessage: item.errorMessage,
			createdAt: item.createdAt.toISOString(),
		})),
	};
}

export async function sendConversationMessage(
	db: Db,
	userId: string,
	input: z.infer<typeof sendConversationMessageInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopWriter(db, userId, input.shopId);

	const [conversation, user] = await Promise.all([
		db.pancakeConversation.findUnique({
			where: {
				shopId_pageId_conversationId: {
					shopId: input.shopId,
					pageId: input.pageId,
					conversationId: input.conversationId,
				},
			},
			include: { page: true },
		}),
		db.user.findUnique({
			where: { id: userId },
			select: { name: true },
		}),
	]);

	if (!conversation) {
		throw new PancakePagesApiError(
			"CONFIGURATION_REQUIRED",
			"Không tìm thấy hội thoại trong workspace này.",
		);
	}
	if (
		!conversation.page.encryptedAccessToken ||
		conversation.page.tokenStatus !== "active"
	) {
		throw new PancakePagesApiError(
			"PERMISSION_DENIED",
			conversation.page.tokenReason ??
				"Page chưa có Page Access Token hợp lệ để gửi tin nhắn.",
		);
	}
	if (!conversation.canInbox && conversation.type === "INBOX") {
		throw new PancakePagesApiError(
			"MESSAGING_WINDOW_CLOSED",
			"Đã quá thời hạn cho phép gửi tin nhắn Inbox theo chính sách nền tảng (can_inbox = false).",
		);
	}

	const lockKey = `pancake-send:${input.shopId}:${input.pageId}:${input.conversationId}:${input.clientMessageId}`;
	const uniqueKey = {
		shopId_pageId_conversationId_clientMessageId: {
			shopId: input.shopId,
			pageId: input.pageId,
			conversationId: input.conversationId,
			clientMessageId: input.clientMessageId,
		},
	};

	const outboundState = await db.$transaction(async (tx) => {
		await lockIdempotencyKey(tx, lockKey);
		const existing = await tx.pancakeOutboundMessage.findUnique({
			where: uniqueKey,
		});
		if (existing) {
			if (existing.status === "sent") {
				return { alreadySent: true as const, record: existing };
			}
			if (existing.status === "sending") {
				return { inFlight: true as const, record: existing };
			}
			const retried = await tx.pancakeOutboundMessage.update({
				where: uniqueKey,
				data: {
					status: "sending",
					message: input.message,
					errorCode: null,
					errorMessage: null,
					attempts: { increment: 1 },
				},
			});
			return { alreadySent: false as const, inFlight: false as const, record: retried };
		}
		const created = await tx.pancakeOutboundMessage.create({
			data: {
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
				clientMessageId: input.clientMessageId,
				action: "reply_inbox",
				message: input.message,
				status: "sending",
				sentByUserId: userId,
			},
		});
		return { alreadySent: false as const, inFlight: false as const, record: created };
	});

	if (outboundState.alreadySent) {
		return {
			status: "sent" as const,
			deduplicated: true,
			clientMessageId: outboundState.record.clientMessageId,
			remoteMessageId: outboundState.record.remoteMessageId,
			errorCode: null,
			errorMessage: null,
		};
	}
	if (outboundState.inFlight) {
		return {
			status: "sending" as const,
			deduplicated: true,
			clientMessageId: outboundState.record.clientMessageId,
			remoteMessageId: null,
			errorCode: null,
			errorMessage: null,
		};
	}

	const pageAccessToken = decryptToken(conversation.page.encryptedAccessToken);

	try {
		const sendResult = await adapter.sendMessage(
			input.pageId,
			input.conversationId,
			pageAccessToken,
			{
				action: "reply_inbox",
				message: input.message,
			},
		);

		if (!sendResult.success) {
			const errorCode = sendResult.errorCode ?? "SEND_FAILED";
			const errorMessage =
				sendResult.errorMessage ?? "Nền tảng từ chối gửi tin nhắn.";
			await db.pancakeOutboundMessage.update({
				where: uniqueKey,
				data: {
					status: "failed",
					errorCode,
					errorMessage,
				},
			});
			throw new PancakePagesApiError(
				"SEND_FAILED",
				errorMessage,
				0,
				errorCode,
			);
		}

		const now = new Date();
		const remoteMessageId =
			sendResult.remoteMessageId ?? `local_${input.clientMessageId}`;
		const senderName = user?.name ?? conversation.page.name;

		await db.$transaction([
			db.pancakeOutboundMessage.update({
				where: uniqueKey,
				data: {
					status: "sent",
					remoteMessageId,
					errorCode: null,
					errorMessage: null,
				},
			}),
			db.pancakeMessage.upsert({
				where: {
					shopId_pageId_conversationId_messageId: {
						shopId: input.shopId,
						pageId: input.pageId,
						conversationId: input.conversationId,
						messageId: remoteMessageId,
					},
				},
				create: {
					shopId: input.shopId,
					pageId: input.pageId,
					conversationId: input.conversationId,
					messageId: remoteMessageId,
					type: conversation.type,
					senderType: "staff",
					senderId: conversation.pageId,
					senderName,
					staffId: userId,
					staffName: senderName,
					message: input.message,
					originalMessage: input.message,
					attachments: [],
					seen: true,
					sourceInsertedAt: now,
					fetchedAt: now,
					raw: {
						id: remoteMessageId,
						message: input.message,
						inserted_at: now.toISOString(),
						from: {
							id: conversation.pageId,
							name: conversation.page.name,
							admin_id: userId,
							admin_name: senderName,
						},
					},
				},
				update: {
					message: input.message,
					originalMessage: input.message,
					fetchedAt: now,
				},
			}),
			db.pancakeConversation.update({
				where: {
					shopId_pageId_conversationId: {
						shopId: input.shopId,
						pageId: input.pageId,
						conversationId: input.conversationId,
					},
				},
				data: {
					snippet: input.message,
					seen: true,
					isReplied: true,
					sourceUpdatedAt: now,
					messageCount: { increment: 1 },
				},
			}),
		]);

		return {
			status: "sent" as const,
			deduplicated: false,
			clientMessageId: input.clientMessageId,
			remoteMessageId,
			errorCode: null,
			errorMessage: null,
		};
	} catch (error) {
		if (
			!(error instanceof PancakePagesApiError && error.code === "SEND_FAILED")
		) {
			const code =
				error instanceof PancakePagesApiError ? error.code : "SEND_FAILED";
			const message =
				error instanceof Error
					? redactSecrets(error.message)
					: "Gửi tin nhắn thất bại.";
			await db.pancakeOutboundMessage.update({
				where: uniqueKey,
				data: {
					status: "failed",
					errorCode: code,
					errorMessage: message,
				},
			});
			if (
				code === "TOKEN_EXPIRED_OR_REVOKED" ||
				code === "PERMISSION_DENIED"
			) {
				await db.pancakePage.update({
					where: {
						shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
					},
					data: {
						tokenStatus:
							code === "PERMISSION_DENIED" ? "permission_denied" : "expired",
						tokenReason: message,
						lastError: message,
						lastErrorCode: code,
					},
				});
			}
		}
		throw error;
	}
}

export async function markConversationSeen(
	db: Db,
	userId: string,
	input: z.infer<typeof markConversationSeenInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopWriter(db, userId, input.shopId);
	const conversation = await db.pancakeConversation.findUnique({
		where: {
			shopId_pageId_conversationId: {
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
			},
		},
		include: { page: true },
	});
	if (!conversation) {
		throw new PancakePagesApiError(
			"CONFIGURATION_REQUIRED",
			"Không tìm thấy hội thoại.",
		);
	}
	if (
		conversation.page.encryptedAccessToken &&
		conversation.page.tokenStatus === "active"
	) {
		try {
			const pat = decryptToken(conversation.page.encryptedAccessToken);
			await adapter.markSeen(
				input.pageId,
				input.conversationId,
				pat,
				input.seen,
			);
		} catch (error) {
			void error;
		}
	}
	await db.pancakeConversation.update({
		where: {
			shopId_pageId_conversationId: {
				shopId: input.shopId,
				pageId: input.pageId,
				conversationId: input.conversationId,
			},
		},
		data: { seen: input.seen },
	});
	return { seen: input.seen };
}
