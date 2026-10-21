import { redirect } from "next/navigation";

export const instant = false;

export default async function AgentChatPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	redirect(`/${slug}/shop`);
}
