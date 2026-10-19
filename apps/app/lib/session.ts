import {
	auth,
	needsMailboxGrant,
	type Session,
	type SignInAccount,
} from "@crm/auth";
import { db } from "@crm/db";
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { API_URL } from "@/lib/env";

const serverAuthClient = createAuthClient({
	baseURL: API_URL,
	plugins: [organizationClient()],
});

export const getSession = cache(async (): Promise<Session | null> => {
	const reqHeaders = await headers();
	const cookie = reqHeaders.get("cookie");
	if (!cookie) return null;

	try {
		const { data, error } = await serverAuthClient.getSession({
			fetchOptions: {
				headers: { cookie },
				cache: "no-store",
			},
		});
		if (!error) return data ?? null;
	} catch {
		// Fall back to local auth lookup when API server is not reachable (e.g. unit tests)
	}

	try {
		return await auth.api.getSession({ headers: reqHeaders });
	} catch {
		return null;
	}
});

export async function requireSession(): Promise<Session> {
	const session = await getSession();

	if (!session) {
		redirect("/sign-in");
	}

	return session;
}

export const signInAccounts = cache(
	async (userId: string): Promise<SignInAccount[]> => {
		const reqHeaders = await headers();
		const cookie = reqHeaders.get("cookie");
		if (cookie) {
			try {
				const { data, error } = await serverAuthClient.listAccounts({
					fetchOptions: {
						headers: { cookie },
						cache: "no-store",
					},
				});
				if (!error && data) {
					return data.map((account) => ({
						providerId: account.providerId,
						scope: account.scopes.join(" "),
					}));
				}
			} catch {
				// Fall back to local DB lookup when API server is not reachable
			}
		}

		try {
			return await db.account.findMany({
				where: { userId },
				select: { providerId: true, scope: true },
			});
		} catch {
			return [];
		}
	},
);

export async function requireMailboxAccess(): Promise<Session> {
	const session = await requireSession();

	if (needsMailboxGrant(await signInAccounts(session.user.id))) {
		redirect("/grant-access");
	}

	return session;
}
