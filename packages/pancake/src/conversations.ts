import type { Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopManager,
	assertShopReader,
	assertShopWriter,
	canManage,
} from "./access";
import { writeAudit } from "./admin";
import { PANCAKE } from "./config";
import { sourceDate } from "./contracts";
import { decryptToken, encryptToken, maskToken, redactSecrets } from "./crypto";
import { messageText } from "./message-text";
import {
	type DiscoveredPage,
	type IncomingMessage,
	type MessagesPageResult,
	type PancakePagesAdapter,
	PancakePagesApiError,
	PancakePagesClient,
	type SendMessageResult,
} from "./pages-client";
import { customerScope } from "./queries";

export const connectUserTokenInput = z.object({
	shopId: z.string().min(1),
	userAccessToken: z.string().trim().min(8).max(4000).optional(),
});

export const pagesListInput = z.object({
	shopId: z.string().min(1),
	q: z.string().max(120).default(""),
	filter: z
		.enum(["all", "matching_shop", "has_token", "missing_token"])
		.default("all"),
});

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

export const customerConversationInput = z.object({
	shopId: z.string().min(1),
	customerId: z.string().min(1),
	loaded: z.number().int().min(0).max(5000).default(0),
});

export const sendCustomerMessageInput = z.object({
	shopId: z.string().min(1),
	customerId: z.string().min(1),
	message: z.string().trim().min(1).max(4000),
});

const customerSourceSchema = z
	.object({
		fb_id: z.string().nullish(),
		conversation_link: z.string().nullish(),
	})
	.passthrough();

const conversationIdPattern = /^(\d+)_(\d+)$/;

const TOKEN_FAILURES = new Map([
	["TOKEN_EXPIRED_OR_REVOKED", "expired"],
	["PERMISSION_DENIED", "permission_denied"],
]);

function describeMissingTokenReason(page: DiscoveredPage) {
	if (page.roleInPage === "NO_PERMISSION") {
		return {
			tokenStatus: "permission_denied",
			tokenReason:
				"Tài khoản không có quyền truy cập Page này trên Pancake (nopermission).",
		};
	}
	if (page.roleInPage && page.roleInPage !== "ADMINISTER") {
		return {
			tokenStatus: "permission_denied",
			tokenReason: `Tài khoản chỉ có quyền ${page.roleInPage} trên Page này (cần quyền ADMINISTER để lấy/tạo Page Access Token hoặc nhập token hiện có).`,
		};
	}
	return {
		tokenStatus: "missing",
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
				data: { status: "expired", lastError: message },
			});
		}
		throw error;
	}

	const existingPages = await db.pancakePage.findMany({
		where: { shopId: input.shopId },
		select: {
			pageId: true,
			encryptedAccessToken: true,
			tokenMasked: true,
			tokenStatus: true,
			tokenSource: true,
			tokenReason: true,
		},
	});
	const existingById = new Map(existingPages.map((p) => [p.pageId, p]));
	const connection = {
		encryptedUserToken: encryptToken(userToken),
		tokenMasked: maskToken(userToken),
		status: "active",
		lastVerifiedAt: new Date(),
		lastError: null,
		discoveredCount: discovered.length,
		updatedById: userId,
	};
	await db.pancakeAccountConnection.upsert({
		where: { shopId: input.shopId },
		create: { shopId: input.shopId, ...connection },
		update: connection,
	});

	let existingTokensSaved = 0;
	const created: Prisma.PancakePageCreateManyInput[] = [];
	const updated: Prisma.PancakePageCreateManyInput[] = [];
	for (const page of discovered) {
		const prev = existingById.get(page.pageId);
		let token: Pick<
			Prisma.PancakePageCreateManyInput,
			| "encryptedAccessToken"
			| "tokenMasked"
			| "tokenStatus"
			| "tokenSource"
			| "tokenReason"
		>;
		if (page.existingPageAccessToken) {
			existingTokensSaved++;
			token = {
				encryptedAccessToken: encryptToken(page.existingPageAccessToken),
				tokenMasked: maskToken(page.existingPageAccessToken),
				tokenStatus: "active",
				tokenSource: "existing",
				tokenReason: null,
			};
		} else if (prev?.encryptedAccessToken) {
			token = {
				encryptedAccessToken: prev.encryptedAccessToken,
				tokenMasked: prev.tokenMasked,
				tokenStatus: prev.tokenStatus,
				tokenSource: prev.tokenSource,
				tokenReason: prev.tokenReason,
			};
		} else {
			token = {
				encryptedAccessToken: null,
				tokenMasked: null,
				tokenSource: null,
				...describeMissingTokenReason(page),
			};
		}
		(prev ? updated : created).push({
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
			...token,
			raw: page.raw as Prisma.InputJsonValue,
		});
	}

	for (let i = 0; i < created.length; i += PANCAKE.pageWriteChunk) {
		await db.pancakePage.createMany({
			data: created.slice(i, i + PANCAKE.pageWriteChunk),
			skipDuplicates: true,
		});
	}
	for (let i = 0; i < updated.length; i += PANCAKE.pageUpdateConcurrency) {
		await Promise.all(
			updated
				.slice(i, i + PANCAKE.pageUpdateConcurrency)
				.map(({ shopId, pageId, ...data }) =>
					db.pancakePage.update({
						where: { shopId_pageId: { shopId, pageId } },
						data,
					}),
				),
		);
	}

	await writeAudit(db, {
		shopId: input.shopId,
		userId,
		area: "settings",
		action: "pancake_pages_discover",
		summary: `Tải danh sách ${discovered.length} Page từ Pancake (${existingTokensSaved} Page đã có sẵn token).`,
	});

	return {
		discoveredCount: discovered.length,
		existingTokensSaved,
		tokenMasked: maskToken(userToken),
	};
}

function decryptable(payload: string | null): boolean {
	if (!payload) return false;
	try {
		decryptToken(payload);
		return true;
	} catch {
		return false;
	}
}

export async function listWorkspacePages(
	db: Db,
	userId: string,
	input: z.infer<typeof pagesListInput>,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const q = input.q.trim().toLowerCase();
	const [connection, pages] = await Promise.all([
		db.pancakeAccountConnection.findUnique({
			where: { shopId: input.shopId },
		}),
		db.pancakePage.findMany({
			where: { shopId: input.shopId },
			select: {
				pageId: true,
				name: true,
				platform: true,
				username: true,
				avatarUrl: true,
				sourceShopId: true,
				roleInPage: true,
				tokenMasked: true,
				tokenStatus: true,
				tokenReason: true,
				encryptedAccessToken: true,
			},
			orderBy: { name: "asc" },
		}),
	]);

	const repaired = pages
		.filter(
			(page) =>
				page.tokenStatus === "invalid" &&
				decryptable(page.encryptedAccessToken),
		)
		.map((page) => page.pageId);
	if (repaired.length > 0) {
		await db.pancakePage.updateMany({
			where: { shopId: input.shopId, pageId: { in: repaired } },
			data: {
				tokenStatus: "active",
				tokenReason: null,
				lastError: null,
				lastErrorCode: null,
			},
		});
	}

	const mapped = pages.map(({ encryptedAccessToken: _, ...page }) => {
		const fixed = repaired.includes(page.pageId);
		return {
			...page,
			matchesShop: page.sourceShopId === input.shopId,
			tokenStatus: fixed ? "active" : page.tokenStatus,
			tokenReason: fixed ? null : page.tokenReason,
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
		if (input.filter === "matching_shop") return row.matchesShop;
		if (input.filter === "has_token") return row.tokenStatus === "active";
		if (input.filter === "missing_token") return row.tokenStatus !== "active";
		return true;
	});

	const envToken =
		process.env.PANCAKE_USER_ACCESS_TOKEN?.trim() ||
		process.env.PANCAKE_TOKEN?.trim();

	return {
		canManage: canManage(grants, input.shopId),
		connection: connection
			? {
					connected: true,
					tokenMasked: connection.tokenMasked,
					status: connection.status,
					lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
					lastError: connection.lastError,
					hasEnvToken: Boolean(envToken),
				}
			: {
					connected: false,
					tokenMasked: envToken ? maskToken(envToken) : null,
					status: envToken ? "env_ready" : "disconnected",
					lastVerifiedAt: null,
					lastError: null,
					hasEnvToken: Boolean(envToken),
				},
		summary: {
			total: mapped.length,
			matchingShop: mapped.filter((p) => p.matchesShop).length,
			activeToken: mapped.filter((p) => p.tokenStatus === "active").length,
			missingToken: mapped.filter((p) => p.tokenStatus !== "active").length,
		},
		pages: filtered,
	};
}

async function storePageToken(
	db: Db,
	userId: string,
	input: { shopId: string; pageId: string },
	token: string,
	source: "manual" | "generated",
) {
	const tokenMasked = maskToken(token);
	await db.$transaction(async (tx) => {
		await tx.pancakePage.update({
			where: { shopId_pageId: { shopId: input.shopId, pageId: input.pageId } },
			data: {
				encryptedAccessToken: encryptToken(token),
				tokenMasked,
				tokenStatus: "active",
				tokenSource: source,
				tokenReason: null,
				lastError: null,
				lastErrorCode: null,
			},
		});
		await writeAudit(tx, {
			shopId: input.shopId,
			userId,
			area: "settings",
			action:
				source === "manual"
					? "pancake_page_token_manual"
					: "pancake_page_token_generate",
			summary: `${source === "manual" ? "Cập nhật thủ công" : "Tạo mới"} Page Access Token cho Page ${input.pageId} (${tokenMasked}).`,
		});
	});
	clearConversationCache();
	return { pageId: input.pageId, tokenMasked, tokenStatus: "active" };
}

export async function setPageManualToken(
	db: Db,
	userId: string,
	input: z.infer<typeof setPageManualTokenInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	return storePageToken(db, userId, input, input.pageAccessToken, "manual");
}

export async function confirmGeneratePageToken(
	db: Db,
	userId: string,
	input: z.infer<typeof confirmGeneratePageTokenInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopManager(db, userId, input.shopId);
	const key = {
		shopId_pageId: { shopId: input.shopId, pageId: input.pageId },
	};
	const page = await db.pancakePage.findUnique({ where: key });
	if (!page) {
		throw new PancakePagesApiError(
			"CONFIGURATION_REQUIRED",
			"Không tìm thấy Page trong workspace này.",
		);
	}
	if (page.roleInPage && page.roleInPage !== "ADMINISTER") {
		const reason = `Không thể tạo Page Access Token vì tài khoản chỉ có quyền ${page.roleInPage} (yêu cầu quyền ADMINISTER).`;
		await db.pancakePage.update({
			where: key,
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
	let pageToken: string;
	try {
		pageToken = await adapter.generatePageAccessToken(userToken, input.pageId);
	} catch (error) {
		const code =
			error instanceof PancakePagesApiError ? error.code : "PERMISSION_DENIED";
		const reason =
			error instanceof Error
				? redactSecrets(error.message)
				: "Không thể tạo Page Access Token.";
		await db.pancakePage.update({
			where: key,
			data: {
				tokenStatus:
					code === "TOKEN_EXPIRED_OR_REVOKED" ? "expired" : "permission_denied",
				tokenReason: reason,
				lastError: reason,
				lastErrorCode: code,
			},
		});
		throw error;
	}
	return storePageToken(db, userId, input, pageToken, "generated");
}

const conversationCache = new Map<
	string,
	{ expiresAt: number; value: MessagesPageResult }
>();

export function clearConversationCache(conversationId?: string): void {
	if (!conversationId) {
		conversationCache.clear();
		return;
	}
	for (const key of conversationCache.keys()) {
		if (key.startsWith(`${conversationId}:`)) conversationCache.delete(key);
	}
}

async function cachedMessages(
	adapter: PancakePagesAdapter,
	pageId: string,
	conversationId: string,
	token: string,
	loaded: number,
): Promise<MessagesPageResult> {
	const key = `${conversationId}:${loaded}`;
	const now = Date.now();
	const hit = conversationCache.get(key);
	if (hit && hit.expiresAt > now) return hit.value;
	const value = await adapter.listMessages(
		pageId,
		conversationId,
		token,
		loaded || undefined,
	);
	conversationCache.delete(key);
	conversationCache.set(key, {
		expiresAt: now + PANCAKE.conversationCacheMs,
		value,
	});
	for (const oldest of conversationCache.keys()) {
		if (conversationCache.size <= PANCAKE.conversationCacheMax) break;
		conversationCache.delete(oldest);
	}
	return value;
}

type PageKey = { shopId: string; pageId: string };

type ConversationTarget =
	| { state: "none"; link: string | null }
	| {
			state: "unavailable";
			link: string | null;
			pageName: string | null;
			reason: string;
	  }
	| {
			state: "ready";
			link: string | null;
			pageId: string;
			pageName: string;
			conversationId: string;
			token: string;
			page: PageKey;
	  };

async function conversationTarget(
	db: Db,
	userId: string,
	shopId: string,
	customerId: string,
): Promise<ConversationTarget> {
	const grants = await assertShopReader(db, userId, shopId);
	const customer = await db.pancakeCustomer.findFirst({
		where: { AND: [customerScope(grants, shopId), { customerId }] },
		select: { raw: true },
	});
	const source = customerSourceSchema.safeParse(customer?.raw ?? {});
	const link = source.success ? (source.data.conversation_link ?? null) : null;
	const match = source.success
		? conversationIdPattern.exec(source.data.fb_id ?? "")
		: null;
	const pageId = match?.[1];
	if (!match || !pageId) return { state: "none", link };

	const pages = await db.pancakePage.findMany({
		where: { pageId, encryptedAccessToken: { not: null } },
		select: {
			shopId: true,
			pageId: true,
			name: true,
			tokenStatus: true,
			tokenReason: true,
			encryptedAccessToken: true,
		},
	});
	const usable = pages.filter(
		(p) => p.tokenStatus !== "expired" && p.tokenStatus !== "permission_denied",
	);
	const page = usable.find((p) => p.shopId === shopId) ?? usable[0] ?? pages[0];
	if (!page?.encryptedAccessToken) {
		return {
			state: "unavailable",
			link,
			pageName: null,
			reason: `Page ${pageId} chưa có Page Access Token. Thêm token trong Cài đặt → Kết nối.`,
		};
	}
	if (!usable.includes(page)) {
		return {
			state: "unavailable",
			link,
			pageName: page.name,
			reason: page.tokenReason ?? "Page Access Token hết hạn hoặc thiếu quyền.",
		};
	}
	let token: string;
	try {
		token = decryptToken(page.encryptedAccessToken);
	} catch {
		return {
			state: "unavailable",
			link,
			pageName: page.name,
			reason:
				"Máy chủ không giải mã được Page Access Token. Khóa mã hóa trên máy chủ khác khóa lúc lưu token.",
		};
	}
	if (page.tokenStatus === "invalid") {
		await db.pancakePage.update({
			where: { shopId_pageId: { shopId: page.shopId, pageId } },
			data: { tokenStatus: "active", tokenReason: null },
		});
	}
	return {
		state: "ready",
		link,
		pageId,
		pageName: page.name,
		conversationId: match[0],
		token,
		page: { shopId: page.shopId, pageId },
	};
}

async function recordTokenFailure(db: Db, page: PageKey, error: unknown) {
	if (!(error instanceof PancakePagesApiError)) return;
	const tokenStatus = TOKEN_FAILURES.get(error.code);
	if (!tokenStatus) return;
	await db.pancakePage.update({
		where: { shopId_pageId: page },
		data: {
			tokenStatus,
			tokenReason: error.message,
			lastError: error.message,
			lastErrorCode: error.code,
		},
	});
}

function toMessage(pageId: string, msg: IncomingMessage) {
	const from = msg.from;
	const staffName = from?.admin_name ?? null;
	const fromPage = Boolean(
		staffName || from?.admin_id || from?.uid || from?.id === pageId,
	);
	return {
		id: msg.id,
		fromPage,
		senderName: staffName ?? from?.name ?? (fromPage ? "Page" : "Khách hàng"),
		text: messageText(msg.message ?? msg.original_message ?? ""),
		attachments: (msg.attachments ?? []).flatMap((item) => {
			const url =
				item.image?.url ??
				item.url ??
				item.video_data?.url ??
				item.target?.url ??
				item.link ??
				null;
			if (!url) return [];
			return [
				{
					url,
					image:
						Boolean(item.image?.url) ||
						item.type === "photo" ||
						item.type === "sticker" ||
						(item.mime_type ?? "").startsWith("image/"),
					name: item.title ?? item.type ?? null,
				},
			];
		}),
		sentAt: msg.inserted_at ? sourceDate(msg.inserted_at).toISOString() : null,
	};
}

export async function customerConversation(
	db: Db,
	userId: string,
	input: z.infer<typeof customerConversationInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	const target = await conversationTarget(
		db,
		userId,
		input.shopId,
		input.customerId,
	);
	if (target.state !== "ready") return target;
	let result: MessagesPageResult;
	try {
		result = await cachedMessages(
			adapter,
			target.pageId,
			target.conversationId,
			target.token,
			input.loaded,
		);
	} catch (error) {
		await recordTokenFailure(db, target.page, error);
		return {
			state: "unavailable" as const,
			link: target.link,
			pageName: target.pageName,
			reason:
				error instanceof Error
					? redactSecrets(error.message)
					: "Không tải được hội thoại từ Pancake.",
		};
	}
	const unique = new Map(
		result.messages
			.filter((msg) => !msg.is_hidden)
			.map((msg) => [msg.id, toMessage(target.pageId, msg)]),
	);
	const messages = [...unique.values()]
		.filter((msg) => msg.text || msg.attachments.length > 0)
		.sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""));
	return {
		state: "ready" as const,
		link: target.link,
		pageName: target.pageName,
		canInbox: result.canInbox,
		hasOlder: result.messages.length >= PANCAKE.messageBatchSize,
		fetched: result.messages.length,
		messages,
	};
}

export async function sendCustomerMessage(
	db: Db,
	userId: string,
	input: z.infer<typeof sendCustomerMessageInput>,
	adapter: PancakePagesAdapter = new PancakePagesClient(),
) {
	await assertShopWriter(db, userId, input.shopId);
	const target = await conversationTarget(
		db,
		userId,
		input.shopId,
		input.customerId,
	);
	if (target.state === "none") {
		throw new PancakePagesApiError(
			"CONFIGURATION_REQUIRED",
			"Khách hàng chưa có hội thoại Pancake.",
		);
	}
	if (target.state === "unavailable") {
		throw new PancakePagesApiError("PERMISSION_DENIED", target.reason);
	}
	let result: SendMessageResult;
	try {
		result = await adapter.sendMessage(
			target.pageId,
			target.conversationId,
			target.token,
			{ action: "reply_inbox", message: input.message },
		);
	} catch (error) {
		await recordTokenFailure(db, target.page, error);
		throw error;
	}
	if (!result.success) {
		throw new PancakePagesApiError(
			"SEND_FAILED",
			result.errorMessage ?? "Nền tảng từ chối gửi tin nhắn.",
			0,
			result.errorCode ?? undefined,
		);
	}
	clearConversationCache(target.conversationId);
	return { remoteMessageId: result.remoteMessageId };
}
