import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	type PancakeData,
	PancakeScreen,
	parseFilters,
	type SearchValues,
} from "@/components/pancake/screen";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

export default function PancakePage(props: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<PancakeContent {...props} />
		</Suspense>
	);
}

async function PancakeContent({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<SearchValues>;
}) {
	await requireSession();
	const [{ slug }, values] = await Promise.all([params, searchParams]);
	const { input, tab, customerId, orderId } = parseFilters(values);
	const api = getServerTrpcClient().pancake;
	const data: PancakeData = { shops: await api.status.query() };
	if (tab === "orders") {
		if (customerId && input.shopId)
			data.purchases = await api.purchases.query({
				shopId: input.shopId,
				customerId,
				filters: input,
			});
		else data.orders = await api.orders.query(input);
		if (orderId && input.shopId)
			data.detail = await api.detail.query({ shopId: input.shopId, orderId });
	}
	if (tab === "customers") data.customers = await api.customers.query(input);
	if (tab === "report") data.report = await api.report.query(input);
	if (tab === "products") data.products = await api.products.query(input);
	return (
		<PancakeScreen base={`/${slug}/pancake`} values={values} data={data} />
	);
}
