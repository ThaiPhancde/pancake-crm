import { beforeAll, describe, expect, test } from "bun:test";
import type { Db } from "@crm/db";
import { PancakeAccessError } from "../src/access";
import {
	bulkAssignPages,
	confirmGeneratePageToken,
	connectAndDiscoverPages,
	conversationMessages,
	ingestPageWebhook,
	listConversations,
	listWorkspacePages,
	matchConversationCustomer,
	sendConversationMessage,
	setPageManualToken,
	syncPageConversations,
	syncShopPages,
} from "../src/conversations";
import {
	decryptToken,
	encryptToken,
	maskToken,
	redactSecrets,
} from "../src/crypto";
import {
	type DiscoveredPage,
	type IncomingConversation,
	type ListConversationsOptions,
	type MessagesPageResult,
	type PancakePagesAdapter,
	PancakePagesApiError,
	PancakePagesClient,
	type SendMessageRequest,
	type SendMessageResult,
} from "../src/pages-client";

const shopA = "1635200759";
const shopB = "1328205216";
const adminA = "user-admin-a";
const viewerB = "user-viewer-b";

type PageRow = {
	id: string;
	shopId: string;
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
	assigned: boolean;
	syncEnabled: boolean;
	encryptedAccessToken: string | null;
	tokenMasked: string | null;
	tokenStatus: string;
	tokenSource: string | null;
	tokenReason: string | null;
	connectStatus: string;
	importFrom: Date | null;
	importUntil: Date | null;
	lastSyncAt: Date | null;
	lastSuccessAt: Date | null;
	lastWebhookAt: Date | null;
	lastError: string | null;
	lastErrorCode: string | null;
	raw: unknown;
};

type CursorRow = {
	shopId: string;
	pageId: string;
	phase: string;
	lastConversationId: string | null;
	pendingConversationId: string | null;
	pendingMessageCount: number;
	windowStart: Date | null;
	windowEnd: Date | null;
	watermark: Date | null;
	importFrom: Date | null;
	importUntil: Date | null;
	syncedConversations: number;
	syncedMessages: number;
	lastSuccessAt: Date | null;
	lastError: string | null;
	lastErrorCode: string | null;
};

type ConversationRow = {
	id: string;
	shopId: string;
	pageId: string;
	conversationId: string;
	type: string;
	customerId: string | null;
	linkStatus: string;
	matchedPhoneTail: string | null;
	customerName: string | null;
	customerPhone: string | null;
	customerFbId: string | null;
	pageCustomerId: string | null;
	globalUserId: string | null;
	snippet: string | null;
	seen: boolean;
	isReplied: boolean;
	canInbox: boolean;
	messageCount: number;
	version: number | null;
	messagesComplete: boolean;
	nextMessageCount: number;
	assigneeIds: unknown;
	tags: unknown;
	adIds: unknown;
	sourceInsertedAt: Date | null;
	sourceUpdatedAt: Date;
	fetchedAt: Date;
	raw: unknown;
};

type MessageRow = {
	id: string;
	shopId: string;
	pageId: string;
	conversationId: string;
	messageId: string;
	type: string;
	senderType: string;
	senderId: string | null;
	senderName: string | null;
	staffId: string | null;
	staffName: string | null;
	message: string;
	originalMessage: string | null;
	attachments: unknown;
	phoneInfo: unknown;
	hasPhone: boolean;
	seen: boolean;
	isRemoved: boolean;
	isHidden: boolean;
	canReplyPrivately: boolean | null;
	sourceInsertedAt: Date;
	fetchedAt: Date;
	raw: unknown;
};

type OutboundRow = {
	id: string;
	shopId: string;
	pageId: string;
	conversationId: string;
	clientMessageId: string;
	action: string;
	message: string;
	senderUserId: string;
	status: string;
	remoteMessageId: string | null;
	errorCode: string | null;
	errorMessage: string | null;
	attempts: number;
	createdAt: Date;
	updatedAt: Date;
};

type WebhookEventRow = {
	id: string;
	shopId: string;
	pageId: string;
	dedupeKey: string;
	eventType: string;
	requestId: string | null;
	eventTimestamp: number | null;
	version: number | null;
	status: string;
	payload: unknown;
	processedAt: Date | null;
};

type CustomerRow = {
	shopId: string;
	customerId: string;
	name: string;
	phone: string | null;
	phoneTail: string | null;
	email: string | null;
	raw: unknown;
};

function createFakeDb() {
	const connections = new Map<
		string,
		{
			shopId: string;
			encryptedUserToken: string | null;
			tokenMasked: string | null;
			status: string;
			lastVerifiedAt: Date | null;
			lastError: string | null;
			discoveredCount: number;
			updatedById: string | null;
		}
	>();
	const pages = new Map<string, PageRow>();
	const cursors = new Map<string, CursorRow>();
	const conversations = new Map<string, ConversationRow>();
	const messages = new Map<string, MessageRow>();
	const outbounds = new Map<string, OutboundRow>();
	const webhookEvents = new Map<string, WebhookEventRow>();
	const customers: CustomerRow[] = [];

	function pageKey(shopId: string, pageId: string) {
		return `${shopId}:${pageId}`;
	}
	function convKey(shopId: string, pageId: string, conversationId: string) {
		return `${shopId}:${pageId}:${conversationId}`;
	}
	function msgKey(
		shopId: string,
		pageId: string,
		conversationId: string,
		messageId: string,
	) {
		return `${shopId}:${pageId}:${conversationId}:${messageId}`;
	}

	const fake = {
		customers,
		pages,
		cursors,
		conversations,
		messages,
		outbounds,
		$queryRaw: async () => [{ locked: true }],
		$executeRaw: async () => 1,
		$transaction: async (arg: unknown) => {
			if (Array.isArray(arg)) {
				return Promise.all(arg);
			}
			const fn = arg as (tx: unknown) => Promise<unknown>;
			return fn(fake);
		},
		member: {
			findUnique: async ({
				where,
			}: {
				where: {
					organizationId_userId: { organizationId: string; userId: string };
				};
			}) => ({
				userId: where.organizationId_userId.userId,
				role: "member",
			}),
			findMany: async ({ where }: { where: { userId: string } }) => [
				{
					userId: where.userId,
					role: "member",
				},
			],
		},
		pancakeShop: {
			findMany: async () => [{ id: shopA }, { id: shopB }],
			findFirst: async () => ({ id: shopA }),
		},
		pancakeShopMember: {
			findMany: async ({ where }: { where: { userId: string } }) => {
				if (where.userId === adminA) {
					return [
						{
							shopId: shopA,
							userId: adminA,
							role: "MANAGER",
							employeeId: "emp-a",
							profile: null,
						},
					];
				}
				return [
					{
						shopId: shopB,
						userId: viewerB,
						role: "VIEWER",
						employeeId: "emp-b",
						profile: null,
					},
				];
			},
		},
		pancakeShopSettings: {
			findUnique: async () => null,
		},
		pancakeAuditLog: {
			create: async () => ({}),
		},
		user: {
			findUnique: async ({ where }: { where: { id: string } }) => ({
				id: where.id,
				name: where.id === adminA ? "Quản lý Shop A" : "Nhân viên B",
				email: `${where.id}@example.com`,
			}),
		},
		pancakeAccountConnection: {
			findUnique: async ({ where }: { where: { shopId: string } }) =>
				connections.get(where.shopId) ?? null,
			upsert: async ({
				where,
				create,
				update,
			}: {
				where: { shopId: string };
				create: Record<string, unknown>;
				update: Record<string, unknown>;
			}) => {
				const prev = connections.get(where.shopId);
				const next = prev
					? {
							...prev,
							...(update as Partial<typeof prev>),
						}
					: {
							shopId: where.shopId,
							encryptedUserToken:
								(create.encryptedUserToken as string | null) ?? null,
							tokenMasked: (create.tokenMasked as string | null) ?? null,
							status: (create.status as string) ?? "active",
							lastVerifiedAt: (create.lastVerifiedAt as Date | null) ?? null,
							lastError: (create.lastError as string | null) ?? null,
							discoveredCount: (create.discoveredCount as number) ?? 0,
							updatedById: (create.updatedById as string | null) ?? null,
						};
				connections.set(where.shopId, next);
				return next;
			},
			updateMany: async () => ({ count: 1 }),
		},
		pancakePage: {
			findUnique: async ({
				where,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
			}) => {
				const row = pages.get(
					pageKey(where.shopId_pageId.shopId, where.shopId_pageId.pageId),
				);
				if (!row) return null;
				return {
					...row,
					cursor:
						cursors.get(
							pageKey(where.shopId_pageId.shopId, where.shopId_pageId.pageId),
						) ?? null,
				};
			},
			findUniqueOrThrow: async ({
				where,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
			}) => {
				const row = pages.get(
					pageKey(where.shopId_pageId.shopId, where.shopId_pageId.pageId),
				);
				if (!row) throw new Error("Page not found");
				return row;
			},
			findMany: async ({
				where,
			}: {
				where?: {
					shopId?: string;
					pageId?: string | { in: string[] };
					assigned?: boolean;
					syncEnabled?: boolean;
					tokenStatus?: string;
				};
			}) => {
				const list = [...pages.values()].filter((p) => {
					if (where?.shopId && p.shopId !== where.shopId) return false;
					if (where?.assigned !== undefined && p.assigned !== where.assigned)
						return false;
					if (
						where?.syncEnabled !== undefined &&
						p.syncEnabled !== where.syncEnabled
					)
						return false;
					if (
						where?.tokenStatus !== undefined &&
						p.tokenStatus !== where.tokenStatus
					)
						return false;
					if (where?.pageId) {
						if (Array.isArray((where.pageId as { in?: string[] }).in)) {
							const allowed = (where.pageId as { in: string[] }).in;
							if (!allowed.includes(p.pageId)) return false;
						} else if (p.pageId !== where.pageId) {
							return false;
						}
					}
					return true;
				});
				return list.map((p) => ({
					...p,
					cursor: cursors.get(pageKey(p.shopId, p.pageId)) ?? null,
				}));
			},
			createMany: async ({
				data,
			}: {
				data: Array<Partial<PageRow> & { shopId: string; pageId: string }>;
			}) => {
				let count = 0;
				for (const item of data) {
					const key = pageKey(item.shopId, item.pageId);
					if (pages.has(key)) continue;
					pages.set(key, {
						id: crypto.randomUUID(),
						shopId: item.shopId,
						pageId: item.pageId,
						name: item.name ?? `Page ${item.pageId}`,
						platform: item.platform ?? "facebook",
						username: item.username ?? null,
						avatarUrl: item.avatarUrl ?? null,
						sourceShopId: item.sourceShopId ?? null,
						roleInPage: item.roleInPage ?? null,
						isActivated: item.isActivated ?? true,
						hasSubscription: item.hasSubscription ?? true,
						needFixWebhook: item.needFixWebhook ?? false,
						assigned: item.assigned ?? false,
						syncEnabled: item.syncEnabled ?? false,
						encryptedAccessToken: item.encryptedAccessToken ?? null,
						tokenMasked: item.tokenMasked ?? null,
						tokenStatus: item.tokenStatus ?? "missing",
						tokenSource: item.tokenSource ?? null,
						tokenReason: item.tokenReason ?? null,
						connectStatus: item.connectStatus ?? "connected",
						importFrom: item.importFrom ?? null,
						importUntil: item.importUntil ?? null,
						lastSyncAt: item.lastSyncAt ?? null,
						lastSuccessAt: item.lastSuccessAt ?? null,
						lastWebhookAt: item.lastWebhookAt ?? null,
						lastError: item.lastError ?? null,
						lastErrorCode: item.lastErrorCode ?? null,
						raw: item.raw ?? {},
					});
					count++;
				}
				return { count };
			},
			upsert: async ({
				where,
				create,
				update,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
				create: Partial<PageRow>;
				update: Partial<PageRow>;
			}) => {
				const key = pageKey(
					where.shopId_pageId.shopId,
					where.shopId_pageId.pageId,
				);
				const prev = pages.get(key);
				const merged: PageRow = prev
					? {
							...prev,
							...Object.fromEntries(
								Object.entries(update).filter(([, v]) => v !== undefined),
							),
						}
					: {
							id: crypto.randomUUID(),
							shopId: where.shopId_pageId.shopId,
							pageId: where.shopId_pageId.pageId,
							name: create.name ?? `Page ${where.shopId_pageId.pageId}`,
							platform: create.platform ?? "facebook",
							username: create.username ?? null,
							avatarUrl: create.avatarUrl ?? null,
							sourceShopId: create.sourceShopId ?? null,
							roleInPage: create.roleInPage ?? null,
							isActivated: create.isActivated ?? true,
							hasSubscription: create.hasSubscription ?? true,
							needFixWebhook: create.needFixWebhook ?? false,
							assigned: create.assigned ?? false,
							syncEnabled: create.syncEnabled ?? false,
							encryptedAccessToken: create.encryptedAccessToken ?? null,
							tokenMasked: create.tokenMasked ?? null,
							tokenStatus: create.tokenStatus ?? "missing",
							tokenSource: create.tokenSource ?? null,
							tokenReason: create.tokenReason ?? null,
							connectStatus: create.connectStatus ?? "connected",
							importFrom: create.importFrom ?? null,
							importUntil: create.importUntil ?? null,
							lastSyncAt: create.lastSyncAt ?? null,
							lastSuccessAt: create.lastSuccessAt ?? null,
							lastWebhookAt: create.lastWebhookAt ?? null,
							lastError: create.lastError ?? null,
							lastErrorCode: create.lastErrorCode ?? null,
							raw: create.raw ?? {},
						};
				pages.set(key, merged);
				return merged;
			},
			update: async ({
				where,
				data,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
				data: Partial<PageRow>;
			}) => {
				const key = pageKey(
					where.shopId_pageId.shopId,
					where.shopId_pageId.pageId,
				);
				const prev = pages.get(key);
				if (!prev) throw new Error("Page not found");
				const next: PageRow = {
					...prev,
					...Object.fromEntries(
						Object.entries(data).filter(([, v]) => v !== undefined),
					),
				};
				pages.set(key, next);
				return next;
			},
			updateMany: async ({
				where,
				data,
			}: {
				where: { shopId: string; pageId: { in: string[] } };
				data: Partial<PageRow>;
			}) => {
				let count = 0;
				for (const pid of where.pageId.in) {
					const key = pageKey(where.shopId, pid);
					const prev = pages.get(key);
					if (!prev) continue;
					pages.set(key, {
						...prev,
						...Object.fromEntries(
							Object.entries(data).filter(([, v]) => v !== undefined),
						),
					});
					count++;
				}
				return { count };
			},
		},
		pancakePageSyncCursor: {
			findUnique: async ({
				where,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
			}) =>
				cursors.get(
					pageKey(where.shopId_pageId.shopId, where.shopId_pageId.pageId),
				) ?? null,
			findUniqueOrThrow: async ({
				where,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
			}) => {
				const row = cursors.get(
					pageKey(where.shopId_pageId.shopId, where.shopId_pageId.pageId),
				);
				if (!row) throw new Error("Cursor not found");
				return row;
			},
			upsert: async ({
				where,
				create,
				update,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
				create: Partial<CursorRow>;
				update: Partial<CursorRow>;
			}) => {
				const key = pageKey(
					where.shopId_pageId.shopId,
					where.shopId_pageId.pageId,
				);
				const prev = cursors.get(key);
				const next: CursorRow = prev
					? {
							...prev,
							...Object.fromEntries(
								Object.entries(update).filter(([, v]) => v !== undefined),
							),
						}
					: {
							shopId: where.shopId_pageId.shopId,
							pageId: where.shopId_pageId.pageId,
							phase: create.phase ?? "importing",
							lastConversationId: create.lastConversationId ?? null,
							pendingConversationId: create.pendingConversationId ?? null,
							pendingMessageCount: create.pendingMessageCount ?? 0,
							windowStart: create.windowStart ?? null,
							windowEnd: create.windowEnd ?? null,
							watermark: create.watermark ?? null,
							importFrom: create.importFrom ?? null,
							importUntil: create.importUntil ?? null,
							syncedConversations: create.syncedConversations ?? 0,
							syncedMessages: create.syncedMessages ?? 0,
							lastSuccessAt: create.lastSuccessAt ?? null,
							lastError: create.lastError ?? null,
							lastErrorCode: create.lastErrorCode ?? null,
						};
				cursors.set(key, next);
				return next;
			},
			update: async ({
				where,
				data,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
				data: Record<string, unknown>;
			}) => {
				const key = pageKey(
					where.shopId_pageId.shopId,
					where.shopId_pageId.pageId,
				);
				const prev = cursors.get(key);
				if (!prev) throw new Error("Cursor not found");
				const next: CursorRow = { ...prev };
				for (const [k, v] of Object.entries(data)) {
					if (v === undefined) continue;
					if (
						k === "syncedConversations" &&
						v &&
						(v as { increment?: number }).increment !== undefined
					) {
						next.syncedConversations +=
							(v as { increment: number }).increment ?? 0;
					} else if (
						k === "syncedMessages" &&
						v &&
						(v as { increment?: number }).increment !== undefined
					) {
						next.syncedMessages += (v as { increment: number }).increment ?? 0;
					} else {
						(next as Record<string, unknown>)[k] = v;
					}
				}
				cursors.set(key, next);
				return next;
			},
		},
		pancakeCustomer: {
			findMany: async ({
				where,
			}: {
				where: {
					shopId: string;
					customerId?: { in: string[] };
					raw?: { path: string[]; equals: string };
					OR?: Array<{
						phoneTail?: { in: string[] };
						phone?: { contains: string };
					}>;
				};
			}) =>
				customers.filter((c) => {
					if (c.shopId !== where.shopId) return false;
					if (where.customerId?.in) {
						return where.customerId.in.includes(c.customerId);
					}
					if (where.raw) {
						const field = where.raw.path[0];
						const rawRec = c.raw as { [k: string]: string | undefined } | null;
						return Boolean(field && rawRec && rawRec[field] === where.raw.equals);
					}
					if (where.OR) {
						return where.OR.some((clause) => {
							if (clause.phoneTail?.in && c.phoneTail) {
								return clause.phoneTail.in.includes(c.phoneTail);
							}
							if (clause.phone?.contains && c.phone) {
								return c.phone.includes(clause.phone.contains);
							}
							return false;
						});
					}
					return true;
				}),
		},
		pancakeOrder: {
			findMany: async () => [],
		},
		pancakeConversation: {
			findUnique: async ({
				where,
			}: {
				where: {
					shopId_pageId_conversationId: {
						shopId: string;
						pageId: string;
						conversationId: string;
					};
				};
			}) => {
				const k = where.shopId_pageId_conversationId;
				const row = conversations.get(
					convKey(k.shopId, k.pageId, k.conversationId),
				);
				if (!row) return null;
				const page = pages.get(pageKey(k.shopId, k.pageId));
				const cust = row.customerId
					? (customers.find(
							(c) => c.shopId === k.shopId && c.customerId === row.customerId,
						) ?? null)
					: null;
				return {
					...row,
					page: page ?? {
						name: `Page ${k.pageId}`,
						platform: "facebook",
						avatarUrl: null,
						tokenStatus: "active",
						tokenReason: null,
						connectStatus: "connected",
						encryptedAccessToken: null,
					},
					customer: cust,
				};
			},
			findUniqueOrThrow: async ({
				where,
			}: {
				where: {
					shopId_pageId_conversationId: {
						shopId: string;
						pageId: string;
						conversationId: string;
					};
				};
			}) => {
				const k = where.shopId_pageId_conversationId;
				const row = conversations.get(
					convKey(k.shopId, k.pageId, k.conversationId),
				);
				if (!row) throw new Error("Conversation not found");
				return row;
			},
			findMany: async ({
				where,
			}: {
				where: { shopId: string; pageId?: string };
			}) =>
				[...conversations.values()]
					.filter(
						(c) =>
							c.shopId === where.shopId &&
							(!where.pageId || c.pageId === where.pageId),
					)
					.map((row) => ({
						...row,
						page: pages.get(pageKey(row.shopId, row.pageId)) ?? {
							name: row.pageId,
							platform: "facebook",
							avatarUrl: null,
							tokenStatus: "active",
							connectStatus: "connected",
						},
						customer: null,
					})),
			count: async ({
				where,
			}: {
				where: { shopId: string; pageId?: string };
			}) =>
				[...conversations.values()].filter(
					(c) =>
						c.shopId === where.shopId &&
						(!where.pageId || c.pageId === where.pageId),
				).length,
			groupBy: async () => [],
			upsert: async ({
				where,
				create,
				update,
			}: {
				where: {
					shopId_pageId_conversationId: {
						shopId: string;
						pageId: string;
						conversationId: string;
					};
				};
				create: ConversationRow;
				update: Partial<ConversationRow>;
			}) => {
				const k = where.shopId_pageId_conversationId;
				const key = convKey(k.shopId, k.pageId, k.conversationId);
				const prev = conversations.get(key);
				const next: ConversationRow = prev
					? { ...prev, ...update }
					: { ...create, id: crypto.randomUUID() };
				conversations.set(key, next);
				return next;
			},
			update: async ({
				where,
				data,
			}: {
				where: {
					shopId_pageId_conversationId: {
						shopId: string;
						pageId: string;
						conversationId: string;
					};
				};
				data: Record<string, unknown>;
			}) => {
				const k = where.shopId_pageId_conversationId;
				const key = convKey(k.shopId, k.pageId, k.conversationId);
				const prev = conversations.get(key);
				if (!prev) throw new Error("Conversation not found");
				const next: ConversationRow = { ...prev };
				for (const [field, val] of Object.entries(data)) {
					if (val === undefined) continue;
					if (
						field === "messageCount" &&
						val &&
						(val as { increment?: number }).increment !== undefined
					) {
						next.messageCount += (val as { increment: number }).increment ?? 0;
					} else {
						(next as Record<string, unknown>)[field] = val;
					}
				}
				conversations.set(key, next);
				return next;
			},
			updateMany: async ({
				where,
				data,
			}: {
				where: { shopId: string; pageId: string; conversationId: string };
				data: Partial<ConversationRow>;
			}) => {
				const key = convKey(where.shopId, where.pageId, where.conversationId);
				const prev = conversations.get(key);
				if (prev) {
					conversations.set(key, { ...prev, ...data });
				}
				return { count: prev ? 1 : 0 };
			},
		},
		pancakeMessage: {
			findMany: async ({
				where,
			}: {
				where: { shopId: string; pageId: string; conversationId: string };
			}) =>
				[...messages.values()].filter(
					(m) =>
						m.shopId === where.shopId &&
						m.pageId === where.pageId &&
						m.conversationId === where.conversationId,
				),
			count: async ({
				where,
			}: {
				where: { shopId: string; pageId?: string; conversationId?: string };
			}) =>
				[...messages.values()].filter(
					(m) =>
						m.shopId === where.shopId &&
						(!where.pageId || m.pageId === where.pageId) &&
						(!where.conversationId ||
							m.conversationId === where.conversationId),
				).length,
			groupBy: async () => [],
			createMany: async ({
				data,
			}: {
				data: MessageRow[];
				skipDuplicates?: boolean;
			}) => {
				let count = 0;
				for (const item of data) {
					const key = msgKey(
						item.shopId,
						item.pageId,
						item.conversationId,
						item.messageId,
					);
					if (!messages.has(key)) {
						messages.set(key, { ...item, id: crypto.randomUUID() });
						count++;
					}
				}
				return { count };
			},
			upsert: async ({
				where,
				create,
				update,
			}: {
				where: {
					shopId_pageId_conversationId_messageId: {
						shopId: string;
						pageId: string;
						conversationId: string;
						messageId: string;
					};
				};
				create: MessageRow;
				update: Partial<MessageRow>;
			}) => {
				const k = where.shopId_pageId_conversationId_messageId;
				const key = msgKey(k.shopId, k.pageId, k.conversationId, k.messageId);
				const prev = messages.get(key);
				const next: MessageRow = prev
					? { ...prev, ...update }
					: { ...create, id: crypto.randomUUID() };
				messages.set(key, next);
				return next;
			},
		},
		pancakeOutboundMessage: {
			findUnique: async ({
				where,
			}: {
				where: {
					shopId_pageId_conversationId_clientMessageId: {
						shopId: string;
						pageId: string;
						conversationId: string;
						clientMessageId: string;
					};
				};
			}) => {
				const k = where.shopId_pageId_conversationId_clientMessageId;
				return (
					outbounds.get(
						msgKey(k.shopId, k.pageId, k.conversationId, k.clientMessageId),
					) ?? null
				);
			},
			findUniqueOrThrow: async ({
				where,
			}: {
				where: {
					shopId_pageId_conversationId_clientMessageId: {
						shopId: string;
						pageId: string;
						conversationId: string;
						clientMessageId: string;
					};
				};
			}) => {
				const k = where.shopId_pageId_conversationId_clientMessageId;
				const row = outbounds.get(
					msgKey(k.shopId, k.pageId, k.conversationId, k.clientMessageId),
				);
				if (!row) throw new Error("Outbound not found");
				return row;
			},
			findMany: async () => [],
			create: async ({ data }: { data: Partial<OutboundRow> }) => {
				const row: OutboundRow = {
					id: crypto.randomUUID(),
					shopId: data.shopId ?? shopA,
					pageId: data.pageId ?? "",
					conversationId: data.conversationId ?? "",
					clientMessageId: data.clientMessageId ?? "",
					action: data.action ?? "reply_inbox",
					message: data.message ?? "",
					senderUserId: data.senderUserId ?? adminA,
					status: data.status ?? "sending",
					remoteMessageId: null,
					errorCode: null,
					errorMessage: null,
					attempts: 1,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				outbounds.set(
					msgKey(
						row.shopId,
						row.pageId,
						row.conversationId,
						row.clientMessageId,
					),
					row,
				);
				return row;
			},
			update: async ({
				where,
				data,
			}: {
				where: {
					shopId_pageId_conversationId_clientMessageId: {
						shopId: string;
						pageId: string;
						conversationId: string;
						clientMessageId: string;
					};
				};
				data: Record<string, unknown>;
			}) => {
				const k = where.shopId_pageId_conversationId_clientMessageId;
				const key = msgKey(
					k.shopId,
					k.pageId,
					k.conversationId,
					k.clientMessageId,
				);
				const prev = outbounds.get(key);
				if (!prev) throw new Error("Outbound not found");
				const next: OutboundRow = {
					...prev,
					status: (data.status as string) ?? prev.status,
					remoteMessageId:
						data.remoteMessageId !== undefined
							? (data.remoteMessageId as string | null)
							: prev.remoteMessageId,
					errorCode:
						data.errorCode !== undefined
							? (data.errorCode as string | null)
							: prev.errorCode,
					errorMessage:
						data.errorMessage !== undefined
							? (data.errorMessage as string | null)
							: prev.errorMessage,
					attempts: prev.attempts + 1,
					updatedAt: new Date(),
				};
				outbounds.set(key, next);
				return next;
			},
		},
		pancakePageWebhookEvent: {
			findUnique: async ({
				where,
			}: {
				where: {
					shopId_pageId_dedupeKey: {
						shopId: string;
						pageId: string;
						dedupeKey: string;
					};
				};
			}) => {
				const k = where.shopId_pageId_dedupeKey;
				return webhookEvents.get(convKey(k.shopId, k.pageId, k.dedupeKey)) ?? null;
			},
			upsert: async ({
				where,
				create,
			}: {
				where: {
					shopId_pageId_dedupeKey: {
						shopId: string;
						pageId: string;
						dedupeKey: string;
					};
				};
				create: WebhookEventRow;
			}) => {
				const k = where.shopId_pageId_dedupeKey;
				const key = convKey(k.shopId, k.pageId, k.dedupeKey);
				const prev = webhookEvents.get(key);
				const next = prev ?? { ...create, id: crypto.randomUUID() };
				webhookEvents.set(key, next);
				return next;
			},
		},
	};

	return fake;
}

class MockPagesAdapter implements PancakePagesAdapter {
	pagesToReturn: DiscoveredPage[] = [];
	generatedToken = "pat_generated_secret_987654321";
	conversationsByPage = new Map<string, IncomingConversation[]>();
	messagesByConv = new Map<string, MessagesPageResult[]>();
	listConversationsCalls: Array<{
		pageId: string;
		options: ListConversationsOptions;
	}> = [];
	listMessagesCalls: Array<{
		pageId: string;
		conversationId: string;
		currentCount?: number;
	}> = [];
	sendCalls: Array<{
		pageId: string;
		conversationId: string;
		payload: SendMessageRequest;
	}> = [];
	failWithError: PancakePagesApiError | null = null;
	sendResult: SendMessageResult = {
		success: true,
		remoteMessageId: "mid_remote_001",
		errorCode: null,
		errorMessage: null,
	};

	async listPages(_userAccessToken: string): Promise<DiscoveredPage[]> {
		if (this.failWithError) throw this.failWithError;
		return this.pagesToReturn;
	}

	async generatePageAccessToken(
		_userAccessToken: string,
		_pageId: string,
	): Promise<string> {
		if (this.failWithError) throw this.failWithError;
		return this.generatedToken;
	}

	async listConversations(
		pageId: string,
		_pageAccessToken: string,
		options: ListConversationsOptions = {},
	): Promise<IncomingConversation[]> {
		this.listConversationsCalls.push({ pageId, options });
		if (this.failWithError) throw this.failWithError;
		const all = this.conversationsByPage.get(pageId) ?? [];
		if (!options.lastConversationId) {
			return all.slice(0, 60);
		}
		const idx = all.findIndex((c) => c.id === options.lastConversationId);
		if (idx < 0) return [];
		return all.slice(idx + 1, idx + 61);
	}

	async listMessages(
		pageId: string,
		conversationId: string,
		_pageAccessToken: string,
		currentCount?: number,
	): Promise<MessagesPageResult> {
		this.listMessagesCalls.push({ pageId, conversationId, currentCount });
		if (this.failWithError) throw this.failWithError;
		const batches = this.messagesByConv.get(conversationId) ?? [];
		const batchIndex = Math.floor((currentCount ?? 0) / 30);
		return (
			batches[batchIndex] ?? {
				messages: [],
				customers: [],
				convCustomers: [],
				convFrom: null,
				canInbox: true,
				phones: [],
			}
		);
	}

	async sendMessage(
		pageId: string,
		conversationId: string,
		_pageAccessToken: string,
		payload: SendMessageRequest,
	): Promise<SendMessageResult> {
		this.sendCalls.push({ pageId, conversationId, payload });
		if (this.failWithError) throw this.failWithError;
		return this.sendResult;
	}

	async markSeen(): Promise<boolean> {
		return true;
	}
}

const fakeDb = createFakeDb();
const db = fakeDb as unknown as Db;

beforeAll(() => {
	process.env.PANCAKE_TOKEN_ENCRYPTION_KEY =
		"test-encryption-secret-key-for-pancake-pages-32bytes";
});

describe("token encryption and log masking", () => {
	test("AES-256-GCM encrypts and decrypts Page Access Tokens and rejects tampering", () => {
		const plain = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretPayload123456";
		const cipher = encryptToken(plain);
		expect(cipher).not.toContain("secretPayload");
		expect(decryptToken(cipher)).toBe(plain);

		const parts = cipher.split(":");
		const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:AAAA${(parts[3] ?? "").slice(4)}`;
		expect(() => decryptToken(tampered)).toThrow();
	});

	test("masks tokens and redacts query/JSON secrets in logs", () => {
		const tok = "1234567890abcdef1234567890abcdef";
		expect(maskToken(tok)).toBe("1234••••cdef");

		const dirty =
			'GET https://pages.fm/api/v1/pages?access_token=superSecretToken123456789&page_access_token=patSecret987654321 {"page_access_token":"jsonSecret111222333"}';
		const clean = redactSecrets(dirty);
		expect(clean).not.toContain("superSecretToken123456789");
		expect(clean).not.toContain("patSecret987654321");
		expect(clean).not.toContain("jsonSecret111222333");
	});
});

describe("PancakePagesClient HTTP behavior (429, 401, 403, fake-success prevention)", () => {
	test("retries on HTTP 429 with backoff and succeeds", async () => {
		let calls = 0;
		const client = new PancakePagesClient(
			(async () => {
				calls++;
				if (calls === 1) {
					return new Response(JSON.stringify({ message: "Too Many Requests" }), {
						status: 429,
						headers: { "retry-after": "0" },
					});
				}
				return new Response(
					JSON.stringify({
						success: true,
						conversations: [{ id: "p1_u1", updated_at: "2026-10-20T05:00:00" }],
					}),
					{ status: 200 },
				);
			}) as unknown as typeof fetch,
			1,
			5,
			3,
		);

		const convs = await client.listConversations("p1", "pat_valid_12345678");
		expect(calls).toBe(2);
		expect(convs).toHaveLength(1);
		expect(convs[0]?.id).toBe("p1_u1");
	});

	test("stops immediately without retry on 401 (expired token) and 403 (missing permission)", async () => {
		let calls401 = 0;
		const client401 = new PancakePagesClient(
			(async () => {
				calls401++;
				return new Response(JSON.stringify({ message: "Invalid token" }), {
					status: 401,
				});
			}) as unknown as typeof fetch,
			1,
			5,
			4,
		);
		await expect(
			client401.listConversations("p1", "pat_expired"),
		).rejects.toThrow("Token đã hết hạn");
		expect(calls401).toBe(1);

		let calls403 = 0;
		const client403 = new PancakePagesClient(
			(async () => {
				calls403++;
				return new Response(JSON.stringify({ message: "Forbidden" }), {
					status: 403,
				});
			}) as unknown as typeof fetch,
			1,
			5,
			4,
		);
		await expect(
			client403.listConversations("p1", "pat_forbidden"),
		).rejects.toThrow("không đủ quyền");
		expect(calls403).toBe(1);
	});

	test("sendMessage does not report fake success when HTTP 200 has success: false", async () => {
		const client = new PancakePagesClient(
			(async () =>
				new Response(
					JSON.stringify({
						success: false,
						e_code: 10,
						message:
							"(#10) Tin nhắn này được gửi ngoài khoảng thời gian 24 giờ cho phép.",
					}),
					{ status: 200 },
				)) as unknown as typeof fetch,
			1,
			5,
			2,
		);

		const res = await client.sendMessage("p1", "p1_c1", "pat_valid_12345", {
			action: "reply_inbox",
			message: "Xin chào",
		});
		expect(res.success).toBe(false);
		expect(res.errorMessage).toContain("24 giờ");
	});
});

describe("485+ Pages discovery, bulk assignment, and existing token preservation", () => {
	test("discovers 485 Pages, preserves existing tokens without regenerating, and bulk assigns", async () => {
		const adapter = new MockPagesAdapter();
		adapter.pagesToReturn = Array.from({ length: 485 }, (_, idx) => {
			const num = idx + 1;
			const isMatch = num <= 100;
			const hasExistingPat = num <= 40;
			const role = num > 450 ? "EDIT_PROFILE" : "ADMINISTER";
			return {
				pageId: `page_${num}`,
				name: `Page Thực Tế #${num}`,
				platform: "facebook",
				username: `page_${num}`,
				avatarUrl: null,
				sourceShopId: isMatch ? shopA : shopB,
				roleInPage: role,
				isActivated: true,
				hasSubscription: true,
				needFixWebhook: false,
				existingPageAccessToken: hasExistingPat
					? `pat_existing_secret_${num}_abcdef`
					: null,
				raw: {
					id: `page_${num}`,
					name: `Page Thực Tế #${num}`,
				},
			};
		});

		const discovery = await connectAndDiscoverPages(
			db,
			adminA,
			{
				shopId: shopA,
				userAccessToken: "user_token_secret_for_485_pages",
				autoAssignMatchingShop: false,
			},
			adapter,
		);

		expect(discovery.discoveredCount).toBe(485);
		expect(discovery.existingTokensSaved).toBe(40);

		const allIds = adapter.pagesToReturn.map((p) => p.pageId);
		const bulkRes = await bulkAssignPages(db, adminA, {
			shopId: shopA,
			pageIds: allIds,
			assigned: true,
			syncEnabled: true,
			importFrom: "2026-10-01T00:00:00.000Z",
			importUntil: "2026-10-20T00:00:00.000Z",
		});

		expect(bulkRes.updatedCount).toBe(485);
		expect(bulkRes.activeSyncCount).toBe(40);
		expect(bulkRes.missingTokenCount).toBe(445);

		const editProfilePage = await fakeDb.pancakePage.findUniqueOrThrow({
			where: { shopId_pageId: { shopId: shopA, pageId: "page_480" } },
		});
		expect(editProfilePage.tokenStatus).toBe("permission_denied");
		expect(editProfilePage.tokenReason).toContain("EDIT_PROFILE");
		expect(editProfilePage.syncEnabled).toBe(false);

		await expect(
			confirmGeneratePageToken(
				db,
				adminA,
				{
					shopId: shopA,
					pageId: "page_480",
					confirmReplace: true,
				},
				adapter,
			),
		).rejects.toThrow("ADMINISTER");

		const manualRes = await setPageManualToken(db, adminA, {
			shopId: shopA,
			pageId: "page_41",
			pageAccessToken: "pat_manual_confirmed_123456789",
			confirmReplace: true,
		});
		expect(manualRes.tokenStatus).toBe("active");

		await bulkAssignPages(db, adminA, {
			shopId: shopA,
			pageIds: allIds,
			assigned: false,
		});
	});
});

describe("Customer matching rules (ID source vs unique phone vs ambiguous vs name-only)", () => {
	const custIdSource = "cust_src_1";
	const custUniquePhone = "cust_phone_1";
	const custDupPhone1 = "cust_dup1_1";
	const custDupPhone2 = "cust_dup2_1";
	const custNameOnly = "cust_name_1";
	const custOtherShop = "cust_other_shop_1";

	beforeAll(() => {
		fakeDb.customers.push(
			{
				shopId: shopA,
				customerId: custIdSource,
				name: "Fatima Al Mansoori",
				phone: "+971501112233",
				phoneTail: "501112233",
				email: null,
				raw: { id: custIdSource, fb_id: "121087_psid999" },
			},
			{
				shopId: shopA,
				customerId: custUniquePhone,
				name: "Omar Unique Phone",
				phone: "+971554443322",
				phoneTail: "554443322",
				email: null,
				raw: { id: custUniquePhone },
			},
			{
				shopId: shopA,
				customerId: custDupPhone1,
				name: "Khách Trùng SĐT 1",
				phone: "+971567778899",
				phoneTail: "567778899",
				email: null,
				raw: { id: custDupPhone1 },
			},
			{
				shopId: shopA,
				customerId: custDupPhone2,
				name: "Khách Trùng SĐT 2",
				phone: "0567778899",
				phoneTail: "567778899",
				email: null,
				raw: { id: custDupPhone2 },
			},
			{
				shopId: shopA,
				customerId: custNameOnly,
				name: "Trùng Tên Nhưng Không Có SĐT",
				phone: null,
				phoneTail: null,
				email: null,
				raw: { id: custNameOnly },
			},
			{
				shopId: shopB,
				customerId: custOtherShop,
				name: "Khách Ở Shop B",
				phone: "+971589990000",
				phoneTail: "589990000",
				email: null,
				raw: { id: custOtherShop },
			},
		);
	});

	test("matches by exact source customer_id -> linked_id", async () => {
		const res = await matchConversationCustomer(
			db,
			{
				shopId: shopA,
				pageId: "page_1",
				conversationId: "page_1_conv_a",
				sourceCustomerIds: [custIdSource],
				pageCustomerIds: [],
				psids: [],
				phones: [],
			},
			"971",
		);
		expect(res.linkStatus).toBe("linked_id");
		expect(res.customerId).toBe(custIdSource);
	});

	test("matches by unique normalized phone in the same workspace -> linked_phone", async () => {
		const res = await matchConversationCustomer(
			db,
			{
				shopId: shopA,
				pageId: "page_1",
				conversationId: "page_1_conv_b",
				sourceCustomerIds: [],
				pageCustomerIds: [],
				psids: [],
				phones: ["055 444 3322"],
			},
			"971",
		);
		expect(res.linkStatus).toBe("linked_phone");
		expect(res.customerId).toBe(custUniquePhone);
	});

	test("marks ambiguous and leaves customerId null when multiple customers share the phone", async () => {
		const res = await matchConversationCustomer(
			db,
			{
				shopId: shopA,
				pageId: "page_1",
				conversationId: "page_1_conv_c",
				sourceCustomerIds: [],
				pageCustomerIds: [],
				psids: [],
				phones: ["+971 56 777 8899"],
			},
			"971",
		);
		expect(res.linkStatus).toBe("ambiguous");
		expect(res.customerId).toBeNull();
	});

	test("never matches by name alone and never links across workspaces", async () => {
		const nameOnlyRes = await matchConversationCustomer(
			db,
			{
				shopId: shopA,
				pageId: "page_1",
				conversationId: "page_1_conv_d",
				sourceCustomerIds: [],
				pageCustomerIds: [],
				psids: ["unknown_psid"],
				phones: [],
			},
			"971",
		);
		expect(nameOnlyRes.linkStatus).toBe("unlinked");
		expect(nameOnlyRes.customerId).toBeNull();

		const crossShopRes = await matchConversationCustomer(
			db,
			{
				shopId: shopA,
				pageId: "page_1",
				conversationId: "page_1_conv_e",
				sourceCustomerIds: [custOtherShop],
				pageCustomerIds: [],
				psids: [],
				phones: ["+971589990000"],
			},
			"971",
		);
		expect(crossShopRes.linkStatus).toBe("unlinked");
		expect(crossShopRes.customerId).toBeNull();
	});
});

describe("Batch import, checkpoint resume after restart, idempotent re-import, and expired token handling", () => {
	const testPageId = "page_sync_1";
	const conv1Id = "page_sync_1_psid_101";
	const conv2Id = "page_sync_1_psid_102";

	beforeAll(async () => {
		await fakeDb.pancakePage.upsert({
			where: { shopId_pageId: { shopId: shopA, pageId: testPageId } },
			create: {
				shopId: shopA,
				pageId: testPageId,
				name: "Page Checkpoint Test",
				platform: "facebook",
				assigned: true,
				syncEnabled: true,
				encryptedAccessToken: encryptToken("pat_checkpoint_valid_123"),
				tokenMasked: "pat_..._123",
				tokenStatus: "active",
				tokenSource: "existing",
			},
			update: {
				assigned: true,
				syncEnabled: true,
				encryptedAccessToken: encryptToken("pat_checkpoint_valid_123"),
				tokenStatus: "active",
				lastError: null,
				lastErrorCode: null,
			},
		});
	});

	test("pauses mid-conversation at messageBudget checkpoint, resumes after restart, and re-imports without duplicates", async () => {
		const adapter = new MockPagesAdapter();
		adapter.conversationsByPage.set(testPageId, [
			{
				id: conv1Id,
				type: "INBOX",
				seen: false,
				snippet: "Tin nhắn mới nhất conv 1",
				inserted_at: "2026-10-19T10:00:00",
				updated_at: "2026-10-20T06:00:00",
				message_count: 45,
				from: { id: "psid_101", name: "Khách Checkpoint 1" },
				customers: [{ id: "mc_1", name: "Khách Checkpoint 1" }],
			},
			{
				id: conv2Id,
				type: "INBOX",
				seen: true,
				snippet: "Tin nhắn conv 2",
				inserted_at: "2026-10-19T09:00:00",
				updated_at: "2026-10-20T05:00:00",
				message_count: 5,
				from: { id: "psid_102", name: "Khách Checkpoint 2" },
				customers: [{ id: "mc_2", name: "Khách Checkpoint 2" }],
			},
		]);

		const batch1Messages = Array.from({ length: 30 }, (_, i) => ({
			id: `msg_c1_${i + 1}`,
			message: `Nội dung đợt 1 #${i + 1}`,
			original_message: `Nội dung đợt 1 #${i + 1}`,
			inserted_at: `2026-10-20T04:${String(i).padStart(2, "0")}:00`,
			from: { id: "psid_101", name: "Khách Checkpoint 1" },
			attachments:
				i === 0
					? [
							{
								id: "att_1",
								type: "photo",
								url: "https://cdn.pancake.vn/photo1.jpg",
							},
						]
					: [],
		}));
		const batch2Messages = Array.from({ length: 15 }, (_, i) => ({
			id: `msg_c1_${i + 31}`,
			message: `Nội dung đợt 2 #${i + 31}`,
			original_message: `Nội dung đợt 2 #${i + 31}`,
			inserted_at: `2026-10-20T03:${String(i).padStart(2, "0")}:00`,
			from: {
				id: testPageId,
				name: "Page Checkpoint Test",
				admin_id: "staff_1",
				admin_name: "Sale Linh",
			},
			attachments: [],
		}));
		const conv2Messages = Array.from({ length: 5 }, (_, i) => ({
			id: `msg_c2_${i + 1}`,
			message: `Nội dung conv 2 #${i + 1}`,
			original_message: `Nội dung conv 2 #${i + 1}`,
			inserted_at: `2026-10-20T02:0${i}:00`,
			from: { id: "psid_102", name: "Khách Checkpoint 2" },
			attachments: [],
		}));

		adapter.messagesByConv.set(conv1Id, [
			{
				messages: batch1Messages,
				customers: [],
				convCustomers: [],
				convFrom: null,
				canInbox: true,
				phones: ["+971554443322"],
			},
			{
				messages: batch2Messages,
				customers: [],
				convCustomers: [],
				convFrom: null,
				canInbox: true,
				phones: ["+971554443322"],
			},
		]);
		adapter.messagesByConv.set(conv2Id, [
			{
				messages: conv2Messages,
				customers: [],
				convCustomers: [],
				convFrom: null,
				canInbox: true,
				phones: [],
			},
		]);

		const run1 = await syncPageConversations(
			db,
			shopA,
			testPageId,
			adapter,
			{
				conversationBudget: 1,
				messageBudget: 1,
			},
		);

		expect(run1.complete).toBe(false);
		expect(run1.messagesWritten).toBe(30);

		const cursorAfterRun1 =
			await fakeDb.pancakePageSyncCursor.findUniqueOrThrow({
				where: { shopId_pageId: { shopId: shopA, pageId: testPageId } },
			});
		expect(cursorAfterRun1.pendingConversationId).toBe(conv1Id);
		expect(cursorAfterRun1.pendingMessageCount).toBe(30);

		const run2 = await syncPageConversations(
			db,
			shopA,
			testPageId,
			adapter,
			{
				conversationBudget: 2,
				messageBudget: 10,
			},
		);
		expect(run2.complete).toBe(true);
		expect(run2.messagesWritten).toBe(20);

		const resumeCall = adapter.listMessagesCalls.find(
			(c) => c.conversationId === conv1Id && c.currentCount === 30,
		);
		expect(resumeCall).toBeDefined();

		const totalInDbBeforeReimport = await fakeDb.pancakeMessage.count({
			where: { shopId: shopA, pageId: testPageId },
		});
		expect(totalInDbBeforeReimport).toBe(50);

		await syncPageConversations(db, shopA, testPageId, adapter, {
			conversationBudget: 2,
			messageBudget: 10,
		});
		const totalInDbAfterReimport = await fakeDb.pancakeMessage.count({
			where: { shopId: shopA, pageId: testPageId },
		});
		expect(totalInDbAfterReimport).toBe(50);
	});

	test("marks page token expired and stops infinite retry on TOKEN_EXPIRED_OR_REVOKED", async () => {
		const adapter = new MockPagesAdapter();
		adapter.failWithError = new PancakePagesApiError(
			"TOKEN_EXPIRED_OR_REVOKED",
			"Page Access Token đã bị thu hồi trên Facebook.",
		);

		const failedRun = await syncPageConversations(
			db,
			shopA,
			testPageId,
			adapter,
		);
		expect(failedRun.errorCode).toBe("TOKEN_EXPIRED_OR_REVOKED");
		expect(failedRun.phase).toBe("paused_auth");

		const pageAfterExpire = await fakeDb.pancakePage.findUniqueOrThrow({
			where: { shopId_pageId: { shopId: shopA, pageId: testPageId } },
		});
		expect(pageAfterExpire.tokenStatus).toBe("expired");

		adapter.listConversationsCalls = [];
		const nextShopCycle = await syncShopPages(db, shopA, adapter);
		expect(nextShopCycle.pagesProcessed).toBe(0);
		expect(adapter.listConversationsCalls).toHaveLength(0);

		await fakeDb.pancakePage.update({
			where: { shopId_pageId: { shopId: shopA, pageId: testPageId } },
			data: {
				tokenStatus: "active",
				tokenReason: null,
				lastError: null,
				lastErrorCode: null,
			},
		});
	});
});

describe("Webhook deduplication and out-of-order protection", () => {
	const whPageId = "page_sync_1";
	const whConvId = "page_sync_1_psid_webhook";

	test("processes new webhook, deduplicates identical request_id, and ignores stale lower-version events", async () => {
		const payloadV5 = JSON.stringify({
			page_id: whPageId,
			event_type: "conversation",
			request_id: "req_v5_test",
			timestamp: 1760940000,
			data: {
				conversation: {
					id: whConvId,
					page_id: whPageId,
					type: "INBOX",
					seen: false,
					snippet: "Tin nhắn mới ở version 5",
					version: 5,
					updated_at: "2026-10-20T07:00:00",
					from: { id: "psid_webhook", name: "Khách Webhook" },
				},
			},
		});

		const first = await ingestPageWebhook(db, payloadV5, shopA);
		expect(first.accepted).toBe(true);
		expect(first.duplicate).toBe(false);
		expect(first.stale).toBe(false);

		const dup = await ingestPageWebhook(db, payloadV5, shopA);
		expect(dup.duplicate).toBe(true);

		const stalePayloadV3 = JSON.stringify({
			page_id: whPageId,
			event_type: "conversation",
			request_id: "req_v3_stale_test",
			timestamp: 1760930000,
			data: {
				conversation: {
					id: whConvId,
					page_id: whPageId,
					type: "INBOX",
					seen: true,
					snippet: "Tin nhắn cũ ở version 3 (không được ghi đè)",
					version: 3,
					updated_at: "2026-10-20T06:00:00",
					from: { id: "psid_webhook", name: "Khách Webhook" },
				},
			},
		});

		const staleRes = await ingestPageWebhook(db, stalePayloadV3, shopA);
		expect(staleRes.stale).toBe(true);

		const storedConv = await fakeDb.pancakeConversation.findUniqueOrThrow({
			where: {
				shopId_pageId_conversationId: {
					shopId: shopA,
					pageId: whPageId,
					conversationId: whConvId,
				},
			},
		});
		expect(storedConv.version).toBe(5);
		expect(storedConv.snippet).toBe("Tin nhắn mới ở version 5");
		expect(storedConv.seen).toBe(false);
	});
});

describe("Send message idempotency, error surfacing, and cross-workspace isolation", () => {
	const testPageId = "page_sync_1";
	const testConvId = "page_sync_1_psid_101";

	test("surfaces platform failure without fake success, and retries idempotently using clientMessageId", async () => {
		const adapter = new MockPagesAdapter();
		const clientMsgId = "client_msg_idempotent_1";

		adapter.sendResult = {
			success: false,
			remoteMessageId: null,
			errorCode: "invalid_upload_fb_attachments_result",
			errorMessage: "Tệp đính kèm hết hạn hoặc vượt giới hạn gửi.",
		};

		await expect(
			sendConversationMessage(
				db,
				adminA,
				{
					shopId: shopA,
					pageId: testPageId,
					conversationId: testConvId,
					clientMessageId: clientMsgId,
					message: "Xin chào anh/chị",
				},
				adapter,
			),
		).rejects.toThrow("hết hạn");

		const failedRow = await fakeDb.pancakeOutboundMessage.findUniqueOrThrow({
			where: {
				shopId_pageId_conversationId_clientMessageId: {
					shopId: shopA,
					pageId: testPageId,
					conversationId: testConvId,
					clientMessageId: clientMsgId,
				},
			},
		});
		expect(failedRow.status).toBe("failed");

		adapter.sendResult = {
			success: true,
			remoteMessageId: "mid_ok_1",
			errorCode: null,
			errorMessage: null,
		};

		const retrySuccess = await sendConversationMessage(
			db,
			adminA,
			{
				shopId: shopA,
				pageId: testPageId,
				conversationId: testConvId,
				clientMessageId: clientMsgId,
				message: "Xin chào anh/chị",
			},
			adapter,
		);
		expect(retrySuccess.status).toBe("sent");
		expect(retrySuccess.deduplicated).toBe(false);
		expect(adapter.sendCalls).toHaveLength(2);

		const duplicateRetry = await sendConversationMessage(
			db,
			adminA,
			{
				shopId: shopA,
				pageId: testPageId,
				conversationId: testConvId,
				clientMessageId: clientMsgId,
				message: "Xin chào anh/chị",
			},
			adapter,
		);
		expect(duplicateRetry.status).toBe("sent");
		expect(duplicateRetry.deduplicated).toBe(true);
		expect(adapter.sendCalls).toHaveLength(2);
	});

	test("enforces strict workspace authorization across pages, conversations, messages, and send", async () => {
		await expect(
			listWorkspacePages(db, viewerB, {
				shopId: shopA,
				q: "",
				filter: "all",
			}),
		).rejects.toBeInstanceOf(PancakeAccessError);

		await expect(
			listConversations(db, viewerB, {
				shopId: shopA,
				linkStatus: "all",
				unreadOnly: false,
				q: "",
				page: 1,
				pageSize: 20,
			}),
		).rejects.toBeInstanceOf(PancakeAccessError);

		await expect(
			conversationMessages(db, viewerB, {
				shopId: shopA,
				pageId: testPageId,
				conversationId: testConvId,
				limit: 20,
				fetchRemoteOlder: false,
			}),
		).rejects.toBeInstanceOf(PancakeAccessError);

		await expect(
			sendConversationMessage(db, viewerB, {
				shopId: shopA,
				pageId: testPageId,
				conversationId: testConvId,
				clientMessageId: "unauth_msg_1",
				message: "Thử gửi trái phép",
			}),
		).rejects.toBeInstanceOf(PancakeAccessError);
	});
});
