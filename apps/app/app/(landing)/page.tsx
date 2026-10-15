import { db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { workspaceUrl } from "@/lib/workspace-url";

// Skip the marketing page. Signed-in visitors go straight to their workspace;
// sending them to /sign-in would loop, as that page sends signed-in users back here.
async function Entry(): Promise<null> {
	if (!(await getSession())) redirect("/sign-in");
	const workspace = await db.organization.findUnique({
		where: { id: WORKSPACE_ID },
		select: { slug: true },
	});
	redirect(
		workspace ? workspaceUrl(workspace.slug, "/pancake") : "/onboarding",
	);
	return null;
}

export default function Home() {
	return (
		<Suspense>
			<Entry />
		</Suspense>
	);
}
