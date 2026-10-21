import { db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { GUEST_ACCESS as GUEST } from "./guest-config";

export function guestAccess() {
	return {
		id: "guest-access",
		endpoints: {
			signInGuest: createAuthEndpoint(
				"/sign-in/guest",
				{ method: "POST" },
				async (ctx) => {
					const workspace = await db.organization.findUnique({
						where: { id: WORKSPACE_ID },
					});
					if (!workspace)
						throw new APIError("BAD_REQUEST", {
							message: "Chưa có workspace CRM. Hãy cấu hình workspace trước.",
						});
					const user = await db.$transaction(async (tx) => {
						const user = await tx.user.upsert({
							where: { id: GUEST.id },
							create: {
								id: GUEST.id,
								name: GUEST.name,
								email: GUEST.email,
								emailVerified: false,
							},
							update: {},
						});
						await tx.member.upsert({
							where: {
								organizationId_userId: {
									organizationId: WORKSPACE_ID,
									userId: user.id,
								},
							},
							create: {
								id: crypto.randomUUID(),
								organizationId: WORKSPACE_ID,
								userId: user.id,
								role: "member",
								createdAt: new Date(),
							},
							update: { role: "member" },
						});
						const shops = await tx.pancakeShop.findMany({
							select: { id: true },
						});
						for (const shop of shops)
							await tx.pancakeShopMember.upsert({
								where: { shopId_userId: { shopId: shop.id, userId: user.id } },
								create: { shopId: shop.id, userId: user.id, role: "VIEWER" },
								update: { role: "VIEWER", profileId: null, employeeId: null },
							});
						return user;
					});
					const session = await ctx.context.internalAdapter.createSession(
						user.id,
						true,
						{ expiresAt: new Date(Date.now() + GUEST.sessionSeconds * 1000) },
					);
					if (!session)
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Không thể mở phiên guest.",
						});
					await setSessionCookie(ctx, { session, user }, true);
					return ctx.json({ url: `/${workspace.slug}/shop` });
				},
			),
		},
	};
}
