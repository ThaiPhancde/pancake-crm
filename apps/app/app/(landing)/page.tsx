import { db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { workspaceUrl } from "@/lib/workspace-url";

async function resolveWorkspaceSlug(): Promise<string | null> {
	try {
		const workspace = await getServerTrpcClient().workspace.get.query();
		if (workspace.slug) return workspace.slug;
	} catch {
		// Fall back to local DB workspace lookup when API server is not reachable
	}

	try {
		const workspace = await db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { slug: true },
		});
		return workspace?.slug ?? null;
	} catch {
		return null;
	}
}

// Skip the marketing page. Signed-in visitors go straight to their workspace;
// sending them to /sign-in would loop, as that page sends signed-in users back here.
async function Entry(): Promise<null> {
	if (!(await getSession())) redirect("/sign-in");
	const slug = await resolveWorkspaceSlug();
	redirect(slug ? workspaceUrl(slug, "/pancake") : "/onboarding");
	return null;
}

export default function Home() {
	return (
		<Suspense>
			<Entry />
		</Suspense>
	);
}
