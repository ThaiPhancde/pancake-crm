import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { GUEST_ACCESS } from "../src/guest-config";

const user = {
	id: GUEST_ACCESS.id,
	name: "Guest",
	email: GUEST_ACCESS.email,
	emailVerified: false,
	createdAt: new Date(),
	updatedAt: new Date(),
};
const workspace = mock(
	async (): Promise<{ slug: string } | null> => ({ slug: "crm" }),
);
const member = mock(async () => ({}));
const grant = mock(async () => ({}));
const upsertUser = mock(async () => user);
const tx = {
	user: { upsert: upsertUser },
	member: { upsert: member },
	pancakeShop: { findMany: async () => [{ id: "shop-a" }, { id: "shop-b" }] },
	pancakeShopMember: { upsert: grant },
};
const databaseModule = { ...(await import("@crm/db")) };
mock.module("@crm/db", () => ({
	...databaseModule,
	db: {
		organization: { findUnique: workspace },
		$transaction: async (run: (client: typeof tx) => Promise<unknown>) =>
			run(tx),
	},
}));
const cookie = mock(async () => {});
const cookieHelpers = { ...(await import("better-auth/cookies")) };
mock.module("better-auth/cookies", () => ({
	...cookieHelpers,
	setSessionCookie: cookie,
}));
const { guestAccess } = await import("../src/guest");
afterAll(() => {
	mock.module("@crm/db", () => databaseModule);
	mock.module("better-auth/cookies", () => cookieHelpers);
});
const createSession = mock(async () => ({
	id: "session",
	token: "test-token",
	userId: user.id,
}));

async function enter() {
	const endpoint = guestAccess().endpoints.signInGuest;
	return endpoint({
		method: "POST",
		context: { internalAdapter: { createSession } },
	} as Parameters<typeof endpoint>[0]);
}

beforeEach(() => {
	workspace.mockClear();
	member.mockClear();
	grant.mockClear();
	upsertUser.mockClear();
	cookie.mockClear();
	createSession.mockClear();
	workspace.mockImplementation(async () => ({ slug: "crm" }));
});

describe("Guest entry", () => {
	test("opens the real workspace shop route with a viewer session", async () => {
		expect(await enter()).toEqual({ url: "/crm/shop" });
		expect(member).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({ role: "member" }),
			}),
		);
		expect(grant).toHaveBeenCalledTimes(2);
		expect(grant).toHaveBeenCalledWith(
			expect.objectContaining({
				create: { shopId: "shop-a", userId: user.id, role: "VIEWER" },
				update: { role: "VIEWER", profileId: null, employeeId: null },
			}),
		);
		expect(createSession).toHaveBeenCalledWith(user.id, true, {
			expiresAt: expect.any(Date),
		});
		expect(cookie).toHaveBeenCalledTimes(1);
	});
	test("does not create an identity or session without a workspace", async () => {
		workspace.mockImplementation(async () => null);
		await expect(enter()).rejects.toThrow("Chưa có workspace CRM");
		expect(upsertUser).not.toHaveBeenCalled();
		expect(createSession).not.toHaveBeenCalled();
		expect(cookie).not.toHaveBeenCalled();
	});
});
