import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

export type ShopRoute = { slug: string; shopId: string };

export async function loadShop(params: Promise<ShopRoute>) {
	const [session, { slug, shopId }] = await Promise.all([
		requireSession(),
		params,
	]);
	const api = getServerTrpcClient().pancake;
	const shops = await api.status.query();
	const shop = shops.find((item) => item.id === shopId);
	if (!shop) notFound();
	return {
		session,
		slug,
		shopId,
		shop,
		shops,
		api,
		base: `/${slug}/shop/${shopId}`,
	};
}
