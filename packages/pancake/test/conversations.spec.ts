import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@crm/db";
import { PancakeAccessError } from "../src/access";
import {
	clearConversationCache,
	confirmGeneratePageToken,
	connectAndDiscoverPages,
	customerConversation,
	listWorkspacePages,
	sendCustomerMessage,
	setPageManualToken,
} from "../src/conversations";
import {
	decryptToken,
	encryptToken,
	maskToken,
	redactSecrets,
} from "../src/crypto";
import {
	type DiscoveredPage,
	type IncomingMessage,
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
const viewerA = "user-viewer-a";
const managerB = "user-manager-b";
const pageId = "1003517612854882";
const conversationId = `${pageId}_26686100114392547`;

type PageRow = {
	shopId: string;
	pageId: string;
	name: string;
	platform: string;
	username: string | null;
	avatarUrl: string | null;
	sourceShopId: string | null;
	roleInPage: string | null;
	encryptedAccessToken: string | null;
	tokenMasked: string | null;
	tokenStatus: string;
	tokenSource: string | null;
	tokenReason: string | null;
	lastError: string | null;
	lastErrorCode: string | null;
	[key: string]: unknown;
};

type CustomerRow = { shopId: string; customerId: string; raw: unknown };

type PageWhere = {
	shopId?: string;
	pageId?: string | { in: string[] };
	encryptedAccessToken?: { not: null };
};

function pageMatches(page: PageRow, where: PageWhere = {}) {
	if (where.shopId !== undefined && page.shopId !== where.shopId) return false;
	if (typeof where.pageId === "string" && page.pageId !== where.pageId)
		return false;
	if (
		typeof where.pageId === "object" &&
		!where.pageId.in.includes(page.pageId)
	)
		return false;
	if (where.encryptedAccessToken && page.encryptedAccessToken === null)
		return false;
	return true;
}

function createFakeDb() {
	const pages = new Map<string, PageRow>();
	const customers: CustomerRow[] = [];
	const connections = new Map<string, Record<string, unknown>>();
	const members = new Map<string, string>([
		[adminA, "admin"],
		[viewerA, "member"],
		[managerB, "member"],
	]);
	const shopMembers = [
		{ userId: viewerA, shopId: shopA, role: "VIEWER", employeeId: null },
		{ userId: managerB, shopId: shopB, role: "MANAGER", employeeId: null },
	];
	const key = (shopId: string, id: string) => `${shopId}:${id}`;
	const fake = {
		pages,
		customers,
		member: {
			findUnique: async ({
				where,
			}: {
				where: { organizationId_userId: { userId: string } };
			}) => {
				const role = members.get(where.organizationId_userId.userId);
				return role ? { role } : null;
			},
		},
		pancakeShop: {
			findMany: async () => [{ id: shopA }, { id: shopB }],
		},
		pancakeShopMember: {
			findMany: async ({ where }: { where: { userId: string } }) =>
				shopMembers.filter((row) => row.userId === where.userId),
		},
		pancakeAuditLog: { create: async () => ({}) },
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
				const next = prev ? { ...prev, ...update } : create;
				connections.set(where.shopId, next);
				return next;
			},
			updateMany: async () => ({ count: 0 }),
		},
		pancakePage: {
			findMany: async ({ where }: { where?: PageWhere } = {}) =>
				[...pages.values()]
					.filter((page) => pageMatches(page, where))
					.map((page) => ({ ...page })),
			findUnique: async ({
				where,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
			}) => {
				const row = pages.get(
					key(where.shopId_pageId.shopId, where.shopId_pageId.pageId),
				);
				return row ? { ...row } : null;
			},
			findUniqueOrThrow: async (args: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
			}) => {
				const row = await fake.pancakePage.findUnique(args);
				if (!row) throw new Error("not found");
				return row;
			},
			createMany: async ({ data }: { data: PageRow[] }) => {
				for (const row of data) {
					pages.set(key(row.shopId, row.pageId), {
						...row,
						lastError: row.lastError ?? null,
						lastErrorCode: row.lastErrorCode ?? null,
					});
				}
				return { count: data.length };
			},
			update: async ({
				where,
				data,
			}: {
				where: { shopId_pageId: { shopId: string; pageId: string } };
				data: Partial<PageRow>;
			}) => {
				const id = key(where.shopId_pageId.shopId, where.shopId_pageId.pageId);
				const row = pages.get(id);
				if (!row) throw new Error("not found");
				const next = { ...row, ...data };
				pages.set(id, next);
				return next;
			},
			updateMany: async ({
				where,
				data,
			}: {
				where: PageWhere;
				data: Partial<PageRow>;
			}) => {
				let count = 0;
				for (const [id, row] of pages) {
					if (!pageMatches(row, where)) continue;
					pages.set(id, { ...row, ...data });
					count++;
				}
				return { count };
			},
		},
		pancakeCustomer: {
			findFirst: async ({
				where,
			}: {
				where: { AND: [{ OR: { shopId: string }[] }, { customerId: string }] };
			}) => {
				const [scope, { customerId }] = where.AND;
				const shops = scope.OR.map((item) => item.shopId);
				return (
					customers.find(
						(row) =>
							row.customerId === customerId && shops.includes(row.shopId),
					) ?? null
				);
			},
		},
		$transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fake),
	};
	return fake;
}

function page(overrides: Partial<PageRow>): PageRow {
	return {
		shopId: shopA,
		pageId,
		name: "UAE Gold Calira Jewelry",
		platform: "facebook",
		username: null,
		avatarUrl: null,
		sourceShopId: shopA,
		roleInPage: "ADMINISTER",
		encryptedAccessToken: encryptToken("pat_live_page_token_123456"),
		tokenMasked: "pat_••••3456",
		tokenStatus: "active",
		tokenSource: "existing",
		tokenReason: null,
		lastError: null,
		lastErrorCode: null,
		...overrides,
	};
}

function message(
	id: string,
	text: string,
	insertedAt: string,
	from: IncomingMessage["from"],
): IncomingMessage {
	return {
		id,
		message: text,
		inserted_at: insertedAt,
		from,
		attachments: [],
	};
}

class MockPagesAdapter implements PancakePagesAdapter {
	pagesToReturn: DiscoveredPage[] = [];
	generatedToken = "pat_generated_secret_987654321";
	messages: IncomingMessage[] = [];
	canInbox = true;
	listMessagesCalls: Array<{ conversationId: string; token: string }> = [];
	sendCalls: Array<{ conversationId: string; payload: SendMessageRequest }> =
		[];
	failWithError: PancakePagesApiError | null = null;
	sendResult: SendMessageResult = {
		success: true,
		remoteMessageId: "mid_remote_001",
		errorCode: null,
		errorMessage: null,
	};

	async listPages(): Promise<DiscoveredPage[]> {
		if (this.failWithError) throw this.failWithError;
		return this.pagesToReturn;
	}

	async generatePageAccessToken(): Promise<string> {
		if (this.failWithError) throw this.failWithError;
		return this.generatedToken;
	}

	async listMessages(
		_pageId: string,
		conversationId: string,
		token: string,
	): Promise<MessagesPageResult> {
		this.listMessagesCalls.push({ conversationId, token });
		if (this.failWithError) throw this.failWithError;
		return { messages: this.messages, canInbox: this.canInbox };
	}

	async sendMessage(
		_pageId: string,
		conversationId: string,
		_token: string,
		payload: SendMessageRequest,
	): Promise<SendMessageResult> {
		this.sendCalls.push({ conversationId, payload });
		if (this.failWithError) throw this.failWithError;
		return this.sendResult;
	}
}

let fakeDb: ReturnType<typeof createFakeDb>;
let db: Db;

beforeAll(() => {
	process.env.PANCAKE_TOKEN_ENCRYPTION_KEY =
		"test-encryption-secret-key-for-pancake-pages-32bytes";
});

beforeEach(() => {
	clearConversationCache();
	fakeDb = createFakeDb();
	db = fakeDb as unknown as Db;
});

describe("token encryption and log masking", () => {
	test("an empty optional encryption key uses the auth secret consistently", () => {
		const previousKey = process.env.PANCAKE_TOKEN_ENCRYPTION_KEY;
		const previousAuth = process.env.BETTER_AUTH_SECRET;
		try {
			process.env.BETTER_AUTH_SECRET = "shared-auth-secret";
			delete process.env.PANCAKE_TOKEN_ENCRYPTION_KEY;
			const encrypted = encryptToken("page-token");
			process.env.PANCAKE_TOKEN_ENCRYPTION_KEY = "";
			expect(decryptToken(encrypted)).toBe("page-token");
		} finally {
			if (previousKey === undefined)
				delete process.env.PANCAKE_TOKEN_ENCRYPTION_KEY;
			else process.env.PANCAKE_TOKEN_ENCRYPTION_KEY = previousKey;
			if (previousAuth === undefined) delete process.env.BETTER_AUTH_SECRET;
			else process.env.BETTER_AUTH_SECRET = previousAuth;
		}
	});

	test("AES-256-GCM encrypts and decrypts Page Access Tokens and rejects tampering", () => {
		const plain = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretPayload123456";
		const cipher = encryptToken(plain);
		expect(cipher).not.toContain(plain);
		expect(decryptToken(cipher)).toBe(plain);
		const parts = cipher.split(":");
		parts[3] = `${parts[3]?.slice(0, -2)}00`;
		expect(() => decryptToken(parts.join(":"))).toThrow();
	});

	test("masks tokens and redacts query/JSON secrets in logs", () => {
		expect(maskToken("pat_1234567890abcdef")).toBe("pat_••••cdef");
		const redacted = redactSecrets(
			'GET /x?page_access_token=pat_1234567890abcdef {"access_token":"user_1234567890abcd"}',
		);
		expect(redacted).not.toContain("pat_1234567890abcdef");
		expect(redacted).not.toContain("user_1234567890abcd");
	});
});

describe("PancakePagesClient HTTP behavior", () => {
	test("retries on HTTP 429 with backoff and succeeds", async () => {
		let calls = 0;
		const client = new PancakePagesClient(
			(async () => {
				calls++;
				if (calls === 1) {
					return new Response(
						JSON.stringify({ message: "Too Many Requests" }),
						{
							status: 429,
							headers: { "retry-after": "0" },
						},
					);
				}
				return new Response(
					JSON.stringify({
						success: true,
						can_inbox: false,
						messages: [{ id: "m1", message: "<div>Hi</div>" }],
					}),
					{ status: 200 },
				);
			}) as unknown as typeof fetch,
			1,
			5,
			3,
		);

		const result = await client.listMessages(
			"p1",
			"p1_u1",
			"pat_valid_12345678",
		);
		expect(calls).toBe(2);
		expect(result.messages).toHaveLength(1);
		expect(result.canInbox).toBe(false);
	});

	test("stops immediately without retry on 401 and 403", async () => {
		for (const [status, text] of [
			[401, "Token đã hết hạn"],
			[403, "không đủ quyền"],
		] as const) {
			let calls = 0;
			const client = new PancakePagesClient(
				(async () => {
					calls++;
					return new Response(JSON.stringify({ message: "denied" }), {
						status,
					});
				}) as unknown as typeof fetch,
				1,
				5,
				4,
			);
			await expect(
				client.listMessages("p1", "p1_u1", "pat_denied_123"),
			).rejects.toThrow(text);
			expect(calls).toBe(1);
		}
	});

	test("sendMessage does not report fake success when HTTP 200 has success: false", async () => {
		const client = new PancakePagesClient(
			(async () =>
				new Response(
					JSON.stringify({
						success: false,
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

describe("Page discovery and token management", () => {
	test("discovers Pages, keeps existing tokens, and guards token generation", async () => {
		const adapter = new MockPagesAdapter();
		adapter.pagesToReturn = Array.from({ length: 485 }, (_, idx) => {
			const num = idx + 1;
			return {
				pageId: `page_${num}`,
				name: `Page #${num}`,
				platform: "facebook",
				username: null,
				avatarUrl: null,
				sourceShopId: num <= 100 ? shopA : shopB,
				roleInPage: num > 450 ? "EDIT_PROFILE" : "ADMINISTER",
				isActivated: true,
				hasSubscription: true,
				needFixWebhook: false,
				existingPageAccessToken:
					num <= 40 ? `pat_existing_secret_${num}_abcdef` : null,
				raw: { id: `page_${num}` },
			};
		});

		const discovery = await connectAndDiscoverPages(
			db,
			adminA,
			{ shopId: shopA, userAccessToken: "user_token_secret_for_pages" },
			adapter,
		);
		expect(discovery.discoveredCount).toBe(485);
		expect(discovery.existingTokensSaved).toBe(40);

		const listed = await listWorkspacePages(db, adminA, {
			shopId: shopA,
			q: "",
			filter: "has_token",
		});
		expect(listed.summary.activeToken).toBe(40);
		expect(listed.summary.matchingShop).toBe(100);

		const editProfile = await fakeDb.pancakePage.findUniqueOrThrow({
			where: { shopId_pageId: { shopId: shopA, pageId: "page_480" } },
		});
		expect(editProfile.tokenStatus).toBe("permission_denied");
		await expect(
			confirmGeneratePageToken(
				db,
				adminA,
				{ shopId: shopA, pageId: "page_480", confirmReplace: true },
				adapter,
			),
		).rejects.toThrow("ADMINISTER");

		adapter.pagesToReturn = adapter.pagesToReturn.map((item) => ({
			...item,
			existingPageAccessToken: null,
		}));
		await connectAndDiscoverPages(db, adminA, { shopId: shopA }, adapter);
		const kept = await fakeDb.pancakePage.findUniqueOrThrow({
			where: { shopId_pageId: { shopId: shopA, pageId: "page_1" } },
		});
		expect(kept.tokenStatus).toBe("active");

		const manual = await setPageManualToken(db, adminA, {
			shopId: shopA,
			pageId: "page_41",
			pageAccessToken: "pat_manual_confirmed_123456789",
			confirmReplace: true,
		});
		expect(manual.tokenStatus).toBe("active");
		await expect(
			setPageManualToken(db, viewerA, {
				shopId: shopA,
				pageId: "page_42",
				pageAccessToken: "pat_manual_confirmed_123456789",
				confirmReplace: true,
			}),
		).rejects.toBeInstanceOf(PancakeAccessError);
	});

	test("restores legacy invalid tokens that decrypt on this server", async () => {
		fakeDb.pages.set(`${shopA}:${pageId}`, page({ tokenStatus: "invalid" }));
		const listed = await listWorkspacePages(db, adminA, {
			shopId: shopA,
			q: "",
			filter: "all",
		});
		expect(listed.pages[0]?.tokenStatus).toBe("active");
		expect(fakeDb.pages.get(`${shopA}:${pageId}`)?.tokenStatus).toBe("active");
	});
});

describe("Customer conversation on demand", () => {
	beforeEach(() => {
		fakeDb.pages.set(`${shopA}:${pageId}`, page({}));
		fakeDb.customers.push(
			{
				shopId: shopA,
				customerId: "cust-1",
				raw: {
					fb_id: conversationId,
					conversation_link: `https://pancake.vn/${pageId}?customer_id=x`,
				},
			},
			{ shopId: shopA, customerId: "cust-no-chat", raw: { fb_id: null } },
		);
	});

	function seededAdapter() {
		const adapter = new MockPagesAdapter();
		adapter.messages = [
			message(
				"m2",
				"<div>Hi &amp; welcome<br/>Gold</div>",
				"2026-05-02T04:21:00",
				{
					id: pageId,
					name: "UAE Gold Calira Jewelry",
					admin_name: "Linh",
				},
			),
			message("m1", "<div>Start</div>", "2026-05-02T04:20:00", {
				id: "26686100114392547",
				name: "Fathima Fasna",
			}),
			message("m1", "<div>Start</div>", "2026-05-02T04:20:00", {
				id: "26686100114392547",
				name: "Fathima Fasna",
			}),
			message("m3", "<div></div>", "2026-05-02T04:22:00", { id: pageId }),
		];
		return adapter;
	}

	test("loads messages from Pancake as plain text and serves repeats from cache", async () => {
		const adapter = seededAdapter();
		const result = await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(result.state).toBe("ready");
		if (result.state !== "ready") return;
		expect(result.messages.map((msg) => msg.id)).toEqual(["m1", "m2"]);
		expect(result.messages[0]?.fromPage).toBe(false);
		expect(result.messages[1]).toMatchObject({
			fromPage: true,
			senderName: "Linh",
			text: "Hi & welcome\nGold",
		});
		expect(adapter.listMessagesCalls[0]).toEqual({
			conversationId,
			token: "pat_live_page_token_123456",
		});

		await customerConversation(
			db,
			viewerA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(adapter.listMessagesCalls).toHaveLength(1);
	});

	test("reports customers without a conversation and Pages without a token", async () => {
		const adapter = seededAdapter();
		const none = await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-no-chat", loaded: 0 },
			adapter,
		);
		expect(none.state).toBe("none");

		fakeDb.pages.set(
			`${shopA}:${pageId}`,
			page({ encryptedAccessToken: null, tokenStatus: "missing" }),
		);
		const missing = await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(missing.state).toBe("unavailable");
		expect(adapter.listMessagesCalls).toHaveLength(0);
	});

	test("denies other shops and marks revoked tokens", async () => {
		const adapter = seededAdapter();
		await expect(
			customerConversation(
				db,
				managerB,
				{ shopId: shopA, customerId: "cust-1", loaded: 0 },
				adapter,
			),
		).rejects.toBeInstanceOf(PancakeAccessError);
		const crossShop = await customerConversation(
			db,
			managerB,
			{ shopId: shopB, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(crossShop.state).toBe("none");

		adapter.failWithError = new PancakePagesApiError(
			"TOKEN_EXPIRED_OR_REVOKED",
			"Token đã hết hạn",
		);
		const failed = await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(failed.state).toBe("unavailable");
		expect(fakeDb.pages.get(`${shopA}:${pageId}`)?.tokenStatus).toBe("expired");
	});

	test("reports a server key mismatch without discarding the token", async () => {
		const adapter = seededAdapter();
		fakeDb.pages.set(
			`${shopA}:${pageId}`,
			page({
				encryptedAccessToken: encryptToken("pat_x_123456789", "other-key"),
			}),
		);
		const result = await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(result.state).toBe("unavailable");
		expect(fakeDb.pages.get(`${shopA}:${pageId}`)?.tokenStatus).toBe("active");
	});

	test("sends a reply, refreshes the cache, and rejects viewers and platform failures", async () => {
		const adapter = seededAdapter();
		await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		const sent = await sendCustomerMessage(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", message: "Xin chào" },
			adapter,
		);
		expect(sent.remoteMessageId).toBe("mid_remote_001");
		expect(adapter.sendCalls[0]).toEqual({
			conversationId,
			payload: { action: "reply_inbox", message: "Xin chào" },
		});
		await customerConversation(
			db,
			adminA,
			{ shopId: shopA, customerId: "cust-1", loaded: 0 },
			adapter,
		);
		expect(adapter.listMessagesCalls).toHaveLength(2);

		await expect(
			sendCustomerMessage(
				db,
				viewerA,
				{ shopId: shopA, customerId: "cust-1", message: "Hi" },
				adapter,
			),
		).rejects.toBeInstanceOf(PancakeAccessError);

		adapter.sendResult = {
			success: false,
			remoteMessageId: null,
			errorCode: "outside_messaging_window",
			errorMessage: "Đã quá 24 giờ",
		};
		await expect(
			sendCustomerMessage(
				db,
				adminA,
				{ shopId: shopA, customerId: "cust-1", message: "Hi" },
				adapter,
			),
		).rejects.toThrow("24 giờ");
	});
});
