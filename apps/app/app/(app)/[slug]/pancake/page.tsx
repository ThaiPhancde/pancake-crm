import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	parseFilters,
	type SearchValues,
} from "@/components/pancake/filter-state";
import { type PancakeData, PancakeScreen } from "@/components/pancake/screen";
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
	const { input, tab, customerId, orderId, taskView } = parseFilters(values);
	const api = getServerTrpcClient().pancake;
	const data: PancakeData = { shops: [] };
	const pending: Promise<void>[] = [
		api.status.query().then((shops) => {
			data.shops = shops;
		}),
	];
	if (tab === "overview")
		pending.push(
			api.overview.query(input).then((value) => {
				data.overview = value;
			}),
		);
	if (["overview", "orders", "report"].includes(tab))
		pending.push(
			api.sellers.query({ shopId: input.shopId }).then((value) => {
				data.sellers = value;
			}),
		);
	if (tab === "tasks")
		pending.push(
			api.tasks.query({ ...input, taskView }).then((value) => {
				data.tasks = value;
			}),
		);
	if (tab === "orders") {
		if (customerId && input.shopId)
			pending.push(
				api.purchases
					.query({ shopId: input.shopId, customerId, filters: input })
					.then((value) => {
						data.purchases = value;
					}),
			);
		else
			pending.push(
				api.orders.query(input).then((value) => {
					data.orders = value;
				}),
			);
		if (orderId && input.shopId)
			pending.push(
				api.detail
					.query({ shopId: input.shopId, orderId })
					.then(async (value) => {
						data.detail = value;
						if (value.canCreateTask)
							data.assignees = await api.taskAssignees.query({
								shopId: value.shopId,
								orderId: value.orderId,
							});
					}),
			);
	}
	if (tab === "customers")
		pending.push(
			api.customers.query(input).then((value) => {
				data.customers = value;
			}),
		);
	if (tab === "report")
		pending.push(
			api.report.query(input).then((value) => {
				data.report = value;
			}),
		);
	if (tab === "products")
		pending.push(
			api.products.query(input).then((value) => {
				data.products = value;
			}),
		);
	await Promise.all(pending);

	return (
		<PancakeScreen base={`/${slug}/pancake`} values={values} data={data} />
	);
}
