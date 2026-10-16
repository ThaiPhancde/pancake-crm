import { Suspense } from "react";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopShell, ShopShellFallback } from "@/components/shop/shell";

export default function ShopLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<ShopShellFallback />}>
			<Shell params={params}>{children}</Shell>
		</Suspense>
	);
}

async function Shell({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<ShopRoute>;
}) {
	const { session, slug, shop, shops } = await loadShop(params);
	return (
		<ShopShell
			slug={slug}
			shop={{ id: shop.id, name: shop.name }}
			shops={shops.map((item) => ({ id: item.id, name: item.name }))}
			user={{
				name: session.user.name,
				email: session.user.email,
				image: session.user.image ?? null,
			}}
		>
			{children}
		</ShopShell>
	);
}
