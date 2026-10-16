import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import type { SearchValues } from "@/components/pancake/filter-state";
import { legacyShopUrl } from "@/components/shop/legacy-url";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

export default function PancakePage(props: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<OpenShop {...props} />
		</Suspense>
	);
}

async function OpenShop({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<SearchValues>;
}) {
	await requireSession();
	const [{ slug }, values, shops] = await Promise.all([
		params,
		searchParams,
		getServerTrpcClient().pancake.status.query(),
	]);
	const shop = shops.find((item) => item.id === values.shopId) ?? shops[0];
	return redirect(
		shop ? legacyShopUrl(slug, shop.id, values) : `/${slug}/shop`,
	);
}
