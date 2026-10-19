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
	try {
		const local = await auth.api.getSession({ headers: reqHeaders });
		if (local) return local;
	} catch {
		// Fall through to remote API session lookup
	}

	const cookie = reqHeaders.get("cookie");
	if (!cookie) return null;

	try {
		const { data } = await serverAuthClient.getSession({
			fetchOptions: {
				headers: { cookie },
				cache: "no-store",
			},
		});
		return data ?? null;
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
		try {
			const rows = await db.account.findMany({
				where: { userId },
				select: { providerId: true, scope: true },
			});
			if (rows.length > 0) return rows;
		} catch {
			// Fall through to remote API account lookup
		}

		const reqHeaders = await headers();
		const cookie = reqHeaders.get("cookie");
		if (!cookie) return [];

		try {
			const { data } = await serverAuthClient.listAccounts({
				fetchOptions: {
					headers: { cookie },
					cache: "no-store",
				},
			});
			if (!data) return [];
			return data.map((account) => ({
				providerId: account.providerId,
				scope: account.scopes.join(" "),
			}));
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
