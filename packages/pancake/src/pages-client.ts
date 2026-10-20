import { z } from "zod";
import { PANCAKE } from "./config";
import { sourceId } from "./contracts";
import { redactSecrets } from "./crypto";

export type PagesErrorCode =
	| "TOKEN_EXPIRED_OR_REVOKED"
	| "PERMISSION_DENIED"
	| "HTTP_429"
	| "NETWORK_OR_TIMEOUT"
	| "INVALID_JSON"
	| "INVALID_API_RESPONSE"
	| "SEND_FAILED"
	| "MESSAGING_WINDOW_CLOSED"
	| "CONFIGURATION_REQUIRED"
	| `HTTP_${number}`;

export class PancakePagesApiError extends Error {
	constructor(
		readonly code: PagesErrorCode,
		message?: string,
		readonly retryAfterMs = 0,
		readonly platformCode?: string,
	) {
		super(redactSecrets(message ?? code));
		this.name = "PancakePagesApiError";
	}
}

const rawPageItem = z
	.object({
		id: sourceId,
		name: z.string().nullish(),
		platform: z.string().nullish(),
		username: z.string().nullish(),
		avatar_url: z.string().nullish(),
		shop_id: z.union([z.string(), z.number()]).nullish(),
		role_in_page: z.string().nullish(),
		is_activated: z.boolean().nullish(),
		has_active_subscription: z.boolean().nullish(),
		need_fix_webhook: z.boolean().nullish(),
		page_access_token: z.string().nullish(),
		settings: z
			.object({
				page_access_token: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
	})
	.passthrough();

const pagesListEnvelope = z
	.object({
		success: z.boolean().optional(),
		pages: z.array(rawPageItem).optional(),
		categorized: z
			.object({
				activated: z.array(rawPageItem).optional(),
				inactivated: z.array(rawPageItem).optional(),
				nopermission: z.array(rawPageItem).optional(),
				hidden: z.array(rawPageItem).optional(),
			})
			.passthrough()
			.optional(),
		message: z.string().optional(),
		error_code: z.union([z.string(), z.number()]).optional(),
	})
	.passthrough();

export type DiscoveredPageRaw = z.infer<typeof rawPageItem>;

export type DiscoveredPage = {
	pageId: string;
	name: string;
	platform: string;
	username: string | null;
	avatarUrl: string | null;
	sourceShopId: string | null;
	roleInPage: string | null;
	isActivated: boolean;
	hasSubscription: boolean;
	needFixWebhook: boolean;
	existingPageAccessToken: string | null;
	raw: DiscoveredPageRaw;
};

const apiErrorBodyEnvelope = z
	.object({
		message: z.string().optional(),
		error_code: z.union([z.string(), z.number()]).optional(),
	})
	.passthrough();

const generateTokenObjectEnvelope = z
	.object({
		success: z.boolean().optional(),
		message: z.string().optional(),
		error_code: z.union([z.string(), z.number()]).optional(),
		page_access_token: z.string().optional(),
		access_token: z.string().optional(),
		token: z.string().optional(),
		data: z
			.object({
				page_access_token: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

const markSeenEnvelope = z
	.object({
		success: z.boolean().optional(),
	})
	.passthrough();

export const conversationCustomerWire = z
	.object({
		id: sourceId.optional(),
		fb_id: z.string().nullish(),
		customer_id: z.string().nullish(),
		global_id: z.string().nullish(),
		name: z.string().nullish(),
	})
	.passthrough();

export const recentPhoneWire = z.union([
	z.string().transform((s) => ({ phone_number: s, captured: null })),
	z
		.object({
			phone_number: z.string().nullish(),
			captured: z.string().nullish(),
		})
		.passthrough(),
]);

export const conversationTagWire = z
	.union([
		z.number(),
		z.string(),
		z
			.object({
				id: z.union([z.number(), z.string()]).nullish(),
				text: z.string().nullish(),
				color: z.string().nullish(),
			})
			.passthrough(),
	])
	.nullable();

export const conversationWire = z
	.object({
		id: sourceId,
		type: z.string().nullish(),
		page_id: sourceId.nullish(),
		post_id: z.string().nullish(),
		snippet: z.string().nullish(),
		seen: z.boolean().nullish(),
		is_replied: z.boolean().nullish(),
		message_count: z.number().int().nonnegative().nullish(),
		has_phone: z.boolean().nullish(),
		inserted_at: z.string().nullish(),
		updated_at: z.string().nullish(),
		version: z.number().int().nullish(),
		customer_id: z.string().nullish(),
		from: z
			.object({
				id: sourceId.nullish(),
				name: z.string().nullish(),
				email: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
		last_sent_by: z
			.object({
				id: sourceId.nullish(),
				name: z.string().nullish(),
				uid: z.string().nullish(),
				admin_id: z.string().nullish(),
				admin_name: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
		tags: z.array(conversationTagWire).nullish(),
		assignee_ids: z.array(sourceId).nullish(),
		customers: z.array(conversationCustomerWire).nullish(),
		recent_phone_numbers: z.array(recentPhoneWire).nullish(),
		page_customer: z
			.object({
				id: sourceId.nullish(),
				name: z.string().nullish(),
				customer_id: z.string().nullish(),
				psid: z.string().nullish(),
				global_id: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
	})
	.passthrough();

export type IncomingConversation = z.infer<typeof conversationWire>;

const conversationsEnvelope = z
	.object({
		success: z.boolean().optional(),
		conversations: z.array(conversationWire).optional(),
		message: z.string().optional(),
		error_code: z.union([z.string(), z.number()]).optional(),
	})
	.passthrough();

export const messageAttachmentWire = z
	.object({
		id: sourceId.nullish(),
		type: z.string().nullish(),
		url: z.string().nullish(),
		title: z.string().nullish(),
		message: z.string().nullish(),
		link: z.string().nullish(),
		mime_type: z.string().nullish(),
		image: z
			.object({
				url: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
		video_data: z
			.object({
				url: z.string().nullish(),
				width: z.number().nullish(),
				height: z.number().nullish(),
			})
			.passthrough()
			.nullish(),
		target: z
			.object({
				id: sourceId.nullish(),
				url: z.string().nullish(),
				thumbnail: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
	})
	.passthrough();

export const messageWire = z
	.object({
		id: sourceId,
		conversation_id: sourceId.nullish(),
		page_id: sourceId.nullish(),
		type: z.string().nullish(),
		message: z.string().nullish(),
		original_message: z.string().nullish(),
		inserted_at: z.string().nullish(),
		seen: z.boolean().nullish(),
		has_phone: z.boolean().nullish(),
		is_hidden: z.boolean().nullish(),
		is_removed: z.boolean().nullish(),
		parent_id: z.string().nullish(),
		from: z
			.object({
				id: sourceId.nullish(),
				name: z.string().nullish(),
				email: z.string().nullish(),
				uid: z.string().nullish(),
				admin_id: z.string().nullish(),
				admin_name: z.string().nullish(),
				page_customer_id: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
		attachments: z.array(messageAttachmentWire).nullish(),
		phone_info: z.array(recentPhoneWire).nullish(),
	})
	.passthrough();

export type IncomingMessage = z.infer<typeof messageWire>;

export const messageCustomerDetailWire = z
	.object({
		id: sourceId.nullish(),
		customer_id: z.string().nullish(),
		fb_id: z.string().nullish(),
		global_id: z.string().nullish(),
		name: z.string().nullish(),
		can_inbox: z.boolean().nullish(),
		recent_phone_numbers: z.array(recentPhoneWire).nullish(),
		shop_customer_addresses: z
			.array(
				z
					.object({
						phone_number: z.string().nullish(),
						full_name: z.string().nullish(),
						full_address: z.string().nullish(),
					})
					.passthrough(),
			)
			.nullish(),
	})
	.passthrough();

const messagesEnvelope = z
	.object({
		success: z.boolean().optional(),
		conversation_id: sourceId.nullish(),
		messages: z.array(messageWire).optional(),
		customers: z.array(messageCustomerDetailWire).nullish(),
		conv_customers: z.array(conversationCustomerWire).nullish(),
		conv_from: z
			.object({
				id: sourceId.nullish(),
				name: z.string().nullish(),
				email: z.string().nullish(),
			})
			.passthrough()
			.nullish(),
		can_inbox: z.boolean().nullish(),
		recent_phone_numbers: z.array(recentPhoneWire).nullish(),
		conv_phone_numbers: z.array(recentPhoneWire).nullish(),
		conv_recent_phone_numbers: z.array(recentPhoneWire).nullish(),
		message: z.string().optional(),
		error_code: z.union([z.string(), z.number()]).optional(),
	})
	.passthrough();

export type MessagesPageResult = {
	messages: IncomingMessage[];
	customers: z.infer<typeof messageCustomerDetailWire>[];
	convCustomers: z.infer<typeof conversationCustomerWire>[];
	convFrom: {
		id?: string | null;
		name?: string | null;
		email?: string | null;
	} | null;
	canInbox: boolean;
	phones: string[];
};

const sendMessageEnvelope = z
	.object({
		success: z.boolean().optional(),
		id: sourceId.nullish(),
		message: z.string().nullish(),
		message_code: z.string().nullish(),
		error_code: z.union([z.string(), z.number()]).nullish(),
	})
	.passthrough();

export type SendMessageRequest = {
	action: "reply_inbox" | "reply_comment" | "private_replies";
	message?: string;
	contentIds?: string[];
	messageId?: string;
	postId?: string;
	fromId?: string;
};

export type SendMessageResult = {
	success: boolean;
	remoteMessageId: string | null;
	errorCode: string | null;
	errorMessage: string | null;
};

export type ListConversationsOptions = {
	lastConversationId?: string;
	since?: number;
	until?: number;
	orderBy?: "inserted_at" | "updated_at";
	unreadFirst?: boolean;
	types?: string[];
};

export interface PancakePagesAdapter {
	listPages(userAccessToken: string): Promise<DiscoveredPage[]>;
	generatePageAccessToken(
		userAccessToken: string,
		pageId: string,
	): Promise<string>;
	listConversations(
		pageId: string,
		pageAccessToken: string,
		options?: ListConversationsOptions,
	): Promise<IncomingConversation[]>;
	listMessages(
		pageId: string,
		conversationId: string,
		pageAccessToken: string,
		currentCount?: number,
	): Promise<MessagesPageResult>;
	sendMessage(
		pageId: string,
		conversationId: string,
		pageAccessToken: string,
		payload: SendMessageRequest,
	): Promise<SendMessageResult>;
	markSeen(
		pageId: string,
		conversationId: string,
		pageAccessToken: string,
		seen: boolean,
	): Promise<boolean>;
}

const TOKEN_ERROR_PATTERNS = [
	/token.*(expired|invalid|revoked|not found)/i,
	/(invalid|expired|revoked).*token/i,
	/unauthenticated/i,
	/unauthorized/i,
	/session.*expired/i,
	/access_token.*invalid/i,
	/page_access_token.*invalid/i,
];

const PERMISSION_ERROR_PATTERNS = [
	/permission/i,
	/forbidden/i,
	/not.*admin/i,
	/admin.*required/i,
	/access.*denied/i,
	/nopermission/i,
];

const WINDOW_ERROR_PATTERNS = [
	/outside.*window/i,
	/24.*hour/i,
	/can_not_inbox/i,
	/cannot.*inbox/i,
	/messaging.*window/i,
];

function classifyApiErrorBody(
	status: number,
	bodyMessage?: string | null,
	errorCode?: string | number | null,
): PagesErrorCode {
	const text = `${bodyMessage ?? ""} ${errorCode ?? ""}`.trim();
	if (status === 401 || TOKEN_ERROR_PATTERNS.some((p) => p.test(text))) {
		return "TOKEN_EXPIRED_OR_REVOKED";
	}
	if (status === 403 || PERMISSION_ERROR_PATTERNS.some((p) => p.test(text))) {
		return "PERMISSION_DENIED";
	}
	if (WINDOW_ERROR_PATTERNS.some((p) => p.test(text))) {
		return "MESSAGING_WINDOW_CLOSED";
	}
	if (status === 429) return "HTTP_429";
	return status >= 400 ? `HTTP_${status}` : "INVALID_API_RESPONSE";
}

export function extractPhones(
	items: readonly z.infer<typeof recentPhoneWire>[] | null | undefined,
): string[] {
	if (!items?.length) return [];
	const result: string[] = [];
	for (const item of items) {
		const val = item.phone_number ?? item.captured;
		if (val?.trim()) result.push(val.trim());
	}
	return [...new Set(result)];
}

function scrubRawPage(item: DiscoveredPageRaw): DiscoveredPageRaw {
	return {
		...item,
		page_access_token: null,
		settings: item.settings
			? {
					...item.settings,
					page_access_token: null,
				}
			: item.settings,
	};
}

export class PancakePagesClient implements PancakePagesAdapter {
	private readonly pageLocks = new Map<string, Promise<void>>();
	private readonly pageLastCallAt = new Map<string, number>();

	constructor(
		private readonly fetcher: typeof fetch = fetch,
		private readonly requestGapMs: number = PANCAKE.pageRequestGapMs,
		private readonly retryBaseMs: number = PANCAKE.retryMs,
		private readonly maxAttempts: number = PANCAKE.attempts,
	) {}

	private async throttlePage(pageKey: string): Promise<void> {
		const previous = this.pageLocks.get(pageKey) ?? Promise.resolve();
		let release!: () => void;
		const next = new Promise<void>((resolve) => {
			release = resolve;
		});
		this.pageLocks.set(
			pageKey,
			previous.then(() => next),
		);
		await previous;
		try {
			const last = this.pageLastCallAt.get(pageKey) ?? 0;
			const waitMs = last + this.requestGapMs - Date.now();
			if (waitMs > 0) {
				await Bun.sleep(waitMs);
			}
			this.pageLastCallAt.set(pageKey, Date.now());
		} finally {
			release();
		}
	}

	private async requestJson(
		pageKey: string,
		url: URL,
		init: RequestInit,
	): Promise<unknown> {
		for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
			await this.throttlePage(pageKey);
			let response: Response;
			try {
				response = await this.fetcher(url, {
					...init,
					redirect: "error",
					signal: AbortSignal.timeout(PANCAKE.timeoutMs),
				});
			} catch {
				if (attempt + 1 >= this.maxAttempts) {
					throw new PancakePagesApiError("NETWORK_OR_TIMEOUT");
				}
				await Bun.sleep(this.retryBaseMs * 2 ** attempt);
				continue;
			}

			if (response.status === 401) {
				throw new PancakePagesApiError(
					"TOKEN_EXPIRED_OR_REVOKED",
					"Token đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.",
				);
			}
			if (response.status === 403) {
				throw new PancakePagesApiError(
					"PERMISSION_DENIED",
					"Tài khoản hoặc Page Access Token không đủ quyền truy cập Page này.",
				);
			}
			if (response.status === 429 || response.status >= 500) {
				const header = response.headers.get("retry-after");
				const retryHeaderMs = header
					? Number(header) * 1000 || Math.max(0, Date.parse(header) - Date.now())
					: 0;
				const delay = Math.max(
					this.retryBaseMs * 2 ** attempt,
					retryHeaderMs,
				);
				if (attempt + 1 >= this.maxAttempts || delay > PANCAKE.maxRetryMs) {
					throw new PancakePagesApiError(
						response.status === 429
							? "HTTP_429"
							: `HTTP_${response.status}`,
						response.status === 429
							? "Vượt giới hạn tần suất gọi API Pancake (429)."
							: `Lỗi máy chủ Pancake (HTTP ${response.status}).`,
						delay,
					);
				}
				await Bun.sleep(delay);
				continue;
			}

			let parsedJson: unknown;
			try {
				parsedJson = await response.json();
			} catch {
				throw new PancakePagesApiError("INVALID_JSON");
			}

			if (!response.ok) {
				const errParsed = apiErrorBodyEnvelope.safeParse(parsedJson);
				const msg = errParsed.success ? errParsed.data.message : undefined;
				const errCode = errParsed.success
					? errParsed.data.error_code
					: undefined;
				throw new PancakePagesApiError(
					classifyApiErrorBody(response.status, msg, errCode),
					msg,
				);
			}

			return parsedJson;
		}
		throw new PancakePagesApiError("NETWORK_OR_TIMEOUT");
	}

	async listPages(userAccessToken: string): Promise<DiscoveredPage[]> {
		const token = userAccessToken.trim();
		if (!token) {
			throw new PancakePagesApiError("CONFIGURATION_REQUIRED");
		}
		const url = new URL(`${PANCAKE.pagesUserBaseUrl}/pages`);
		url.searchParams.set("access_token", token);
		const raw = await this.requestJson("account:pages", url, { method: "GET" });
		const parsed = pagesListEnvelope.safeParse(raw);
		if (!parsed.success) {
			throw new PancakePagesApiError("INVALID_API_RESPONSE");
		}
		if (parsed.data.success === false) {
			const code = classifyApiErrorBody(
				200,
				parsed.data.message ?? "Token không hợp lệ",
				parsed.data.error_code,
			);
			throw new PancakePagesApiError(
				code === "INVALID_API_RESPONSE" ? "TOKEN_EXPIRED_OR_REVOKED" : code,
				parsed.data.message ?? "User Access Token không hợp lệ hoặc đã hết hạn.",
			);
		}
		const categorized = parsed.data.categorized;
		const combined: Array<{
			item: z.infer<typeof rawPageItem>;
			defaultActivated: boolean;
			noPermission?: boolean;
		}> = [];
		if (categorized) {
			for (const item of categorized.activated ?? []) {
				combined.push({ item, defaultActivated: true });
			}
			for (const item of categorized.inactivated ?? []) {
				combined.push({ item, defaultActivated: false });
			}
			for (const item of categorized.nopermission ?? []) {
				combined.push({ item, defaultActivated: false, noPermission: true });
			}
			for (const item of categorized.hidden ?? []) {
				combined.push({ item, defaultActivated: false });
			}
		} else if (parsed.data.pages) {
			for (const item of parsed.data.pages) {
				combined.push({ item, defaultActivated: true });
			}
		}

		const byId = new Map<string, DiscoveredPage>();
		for (const { item, defaultActivated, noPermission } of combined) {
			const existingToken =
				item.settings?.page_access_token?.trim() ||
				item.page_access_token?.trim() ||
				null;
			const roleInPage = noPermission
				? "NO_PERMISSION"
				: (item.role_in_page ?? null);
			byId.set(item.id, {
				pageId: item.id,
				name: item.name?.trim() || `Page ${item.id}`,
				platform: item.platform?.trim().toLowerCase() || "facebook",
				username: item.username?.trim() || null,
				avatarUrl: item.avatar_url?.trim() || null,
				sourceShopId:
					item.shop_id !== undefined && item.shop_id !== null
						? String(item.shop_id)
						: null,
				roleInPage,
				isActivated: item.is_activated ?? defaultActivated,
				hasSubscription: item.has_active_subscription ?? true,
				needFixWebhook: item.need_fix_webhook ?? false,
				existingPageAccessToken: existingToken,
				raw: scrubRawPage(item),
			});
		}
		return [...byId.values()];
	}

	async generatePageAccessToken(
		userAccessToken: string,
		pageId: string,
	): Promise<string> {
		const token = userAccessToken.trim();
		if (!token || !pageId.trim()) {
			throw new PancakePagesApiError("CONFIGURATION_REQUIRED");
		}
		const url = new URL(
			`${PANCAKE.pagesUserBaseUrl}/pages/${encodeURIComponent(pageId)}/generate_page_access_token`,
		);
		url.searchParams.set("page_id", pageId);
		url.searchParams.set("access_token", token);
		const raw = await this.requestJson(`page:${pageId}`, url, {
			method: "POST",
		});
		const strParsed = z.string().safeParse(raw);
		if (strParsed.success && strParsed.data.trim()) {
			return strParsed.data.trim();
		}
		const objParsed = generateTokenObjectEnvelope.safeParse(raw);
		if (objParsed.success) {
			const record = objParsed.data;
			if (record.success === false) {
				const msg =
					record.message ??
					"Không thể tạo Page Access Token (kiểm tra quyền ADMINISTER trên Page).";
				throw new PancakePagesApiError(
					classifyApiErrorBody(403, msg, record.error_code),
					msg,
				);
			}
			const candidate =
				record.page_access_token ??
				record.access_token ??
				record.token ??
				record.data?.page_access_token;
			if (candidate?.trim()) {
				return candidate.trim();
			}
		}
		throw new PancakePagesApiError(
			"PERMISSION_DENIED",
			"Pancake không trả về Page Access Token. Tài khoản cần quyền Quản trị viên (ADMINISTER) trên Page này.",
		);
	}

	async listConversations(
		pageId: string,
		pageAccessToken: string,
		options: ListConversationsOptions = {},
	): Promise<IncomingConversation[]> {
		const token = pageAccessToken.trim();
		if (!pageId.trim() || !token) {
			throw new PancakePagesApiError("CONFIGURATION_REQUIRED");
		}
		const url = new URL(
			`${PANCAKE.pagesPublicV2BaseUrl}/pages/${encodeURIComponent(pageId)}/conversations`,
		);
		url.searchParams.set("page_access_token", token);
		if (options.lastConversationId) {
			url.searchParams.set("last_conversation_id", options.lastConversationId);
		}
		if (options.since !== undefined) {
			url.searchParams.set("since", String(Math.floor(options.since)));
		}
		if (options.until !== undefined) {
			url.searchParams.set("until", String(Math.floor(options.until)));
		}
		if (options.orderBy) {
			url.searchParams.set("order_by", options.orderBy);
		}
		if (options.unreadFirst !== undefined) {
			url.searchParams.set("unread_first", String(options.unreadFirst));
		}
		if (options.types?.length) {
			for (const t of options.types) {
				url.searchParams.append("type[]", t);
			}
		}
		const raw = await this.requestJson(`page:${pageId}`, url, {
			method: "GET",
		});
		const parsed = conversationsEnvelope.safeParse(raw);
		if (!parsed.success) {
			throw new PancakePagesApiError("INVALID_API_RESPONSE");
		}
		if (parsed.data.success === false) {
			throw new PancakePagesApiError(
				classifyApiErrorBody(
					401,
					parsed.data.message ?? "Page Access Token không hợp lệ",
					parsed.data.error_code,
				),
				parsed.data.message ??
					"Page Access Token hết hạn, bị thu hồi hoặc thiếu quyền truy cập.",
			);
		}
		return parsed.data.conversations ?? [];
	}

	async listMessages(
		pageId: string,
		conversationId: string,
		pageAccessToken: string,
		currentCount?: number,
	): Promise<MessagesPageResult> {
		const token = pageAccessToken.trim();
		if (!pageId.trim() || !conversationId.trim() || !token) {
			throw new PancakePagesApiError("CONFIGURATION_REQUIRED");
		}
		const url = new URL(
			`${PANCAKE.pagesPublicV1BaseUrl}/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
		);
		url.searchParams.set("page_access_token", token);
		if (currentCount !== undefined && currentCount > 0) {
			url.searchParams.set("current_count", String(currentCount));
		}
		const raw = await this.requestJson(`page:${pageId}`, url, {
			method: "GET",
		});
		const parsed = messagesEnvelope.safeParse(raw);
		if (!parsed.success) {
			throw new PancakePagesApiError("INVALID_API_RESPONSE");
		}
		if (parsed.data.success === false) {
			throw new PancakePagesApiError(
				classifyApiErrorBody(
					401,
					parsed.data.message ?? "Không thể tải tin nhắn",
					parsed.data.error_code,
				),
				parsed.data.message ??
					"Page Access Token không hợp lệ hoặc không đủ quyền đọc tin nhắn.",
			);
		}
		const phones = [
			...new Set([
				...extractPhones(parsed.data.recent_phone_numbers),
				...extractPhones(parsed.data.conv_phone_numbers),
				...extractPhones(parsed.data.conv_recent_phone_numbers),
			]),
		];
		return {
			messages: parsed.data.messages ?? [],
			customers: parsed.data.customers ?? [],
			convCustomers: parsed.data.conv_customers ?? [],
			convFrom: parsed.data.conv_from ?? null,
			canInbox: parsed.data.can_inbox ?? true,
			phones,
		};
	}

	async sendMessage(
		pageId: string,
		conversationId: string,
		pageAccessToken: string,
		payload: SendMessageRequest,
	): Promise<SendMessageResult> {
		const token = pageAccessToken.trim();
		if (!pageId.trim() || !conversationId.trim() || !token) {
			throw new PancakePagesApiError("CONFIGURATION_REQUIRED");
		}
		const hasMessage = Boolean(payload.message?.trim());
		const hasContentIds = Boolean(payload.contentIds?.length);
		if (hasMessage && hasContentIds) {
			throw new PancakePagesApiError(
				"SEND_FAILED",
				"API Pancake không cho phép gửi đồng thời cả nội dung văn bản (message) và tệp đính kèm (content_ids).",
			);
		}
		if (!hasMessage && !hasContentIds) {
			throw new PancakePagesApiError(
				"SEND_FAILED",
				"Nội dung tin nhắn không được để trống.",
			);
		}
		const body = {
			action: payload.action,
			message: hasMessage ? payload.message?.trim() : undefined,
			content_ids: hasContentIds ? payload.contentIds : undefined,
			message_id: payload.messageId,
			post_id: payload.postId,
			from_id: payload.fromId,
		};

		const url = new URL(
			`${PANCAKE.pagesPublicV1BaseUrl}/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
		);
		url.searchParams.set("page_access_token", token);
		const raw = await this.requestJson(`page:${pageId}`, url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		const parsed = sendMessageEnvelope.safeParse(raw);
		if (!parsed.success) {
			throw new PancakePagesApiError("INVALID_API_RESPONSE");
		}
		if (!parsed.data.success) {
			const code =
				parsed.data.message_code ??
				(parsed.data.error_code !== undefined &&
				parsed.data.error_code !== null
					? String(parsed.data.error_code)
					: "SEND_FAILED");
			const message =
				parsed.data.message ??
				describeSendErrorCode(code);
			return {
				success: false,
				remoteMessageId: null,
				errorCode: code,
				errorMessage: message,
			};
		}
		return {
			success: true,
			remoteMessageId: parsed.data.id ?? null,
			errorCode: null,
			errorMessage: null,
		};
	}

	async markSeen(
		pageId: string,
		conversationId: string,
		pageAccessToken: string,
		seen: boolean,
	): Promise<boolean> {
		const token = pageAccessToken.trim();
		if (!pageId.trim() || !conversationId.trim() || !token) {
			throw new PancakePagesApiError("CONFIGURATION_REQUIRED");
		}
		const endpoint = seen ? "read" : "unread";
		const url = new URL(
			`${PANCAKE.pagesPublicV1BaseUrl}/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(conversationId)}/${endpoint}`,
		);
		url.searchParams.set("page_access_token", token);
		const raw = await this.requestJson(`page:${pageId}`, url, {
			method: "POST",
		});
		const parsed = markSeenEnvelope.safeParse(raw);
		if (parsed.success && parsed.data.success !== undefined) {
			return parsed.data.success;
		}
		return true;
	}
}

export function describeSendErrorCode(code: string): string {
	switch (code) {
		case "invalid_upload_fb_attachments_result":
			return "Tệp đính kèm đã hết hạn trên Facebook. Vui lòng tải lại tệp và thử lại.";
		case "MESSAGING_WINDOW_CLOSED":
		case "outside_messaging_window":
			return "Đã quá thời hạn 24 giờ cho phép gửi tin nhắn Inbox theo chính sách nền tảng.";
		case "PERMISSION_DENIED":
			return "Page thiếu quyền gửi tin nhắn hoặc Token không hợp lệ.";
		default:
			return `Nền tảng từ chối gửi tin nhắn (mã lỗi: ${code}).`;
	}
}
