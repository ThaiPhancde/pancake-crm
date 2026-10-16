import { redirect } from "next/navigation";
import type { ShopRoute } from "@/components/shop/load";

export default async function SettingsIndex({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	const { slug, shopId } = await params;
	redirect(`/${slug}/shop/${shopId}/settings/general`);
}
