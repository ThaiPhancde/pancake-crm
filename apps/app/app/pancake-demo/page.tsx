import { db } from "@crm/db";
import {
	connectionStatus,
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	listProducts,
	operationsOverview,
	orderDetail,
	sellerOptions,
} from "@crm/pancake/queries";
import { listTasks } from "@crm/pancake/tasks";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
	parseFilters,
	type SearchValues,
} from "@/components/pancake/filter-state";
import { type PancakeData, PancakeScreen } from "@/components/pancake/screen";

export default function PancakeDemo(props: {
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<p>Đang tải dữ liệu mẫu…</p>}>
			<Demo {...props} />
		</Suspense>
	);
}

async function Demo({ searchParams }: { searchParams: Promise<SearchValues> }) {
	await connection();
	const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
	if (
		process.env.NODE_ENV === "production" ||
		process.env.PANCAKE_DEMO_MODE !== "1" ||
		url.hostname !== "127.0.0.1" ||
		url.port !== "55432" ||
		url.pathname !== "/comp_ai_crm_demo"
	)
		notFound();
	const values = await searchParams;
	const { input, tab, customerId, orderId, taskView } = parseFilters(values);
	const userId = "pancake-demo-admin";
	const data: PancakeData = { shops: [] };
	const pending: Promise<void>[] = [
		connectionStatus(db, userId).then((shops) => {
			data.shops = shops;
		}),
	];
	if (tab === "overview")
		pending.push(
			operationsOverview(db, userId, input).then((value) => {
				data.overview = value;
			}),
		);
	if (["overview", "orders", "report"].includes(tab))
		pending.push(
			sellerOptions(db, userId, input.shopId).then((value) => {
				data.sellers = value;
			}),
		);
	if (tab === "tasks")
		pending.push(
			listTasks(db, userId, { ...input, taskView }).then((value) => {
				data.tasks = value;
			}),
		);
	if (tab === "orders") {
		if (customerId && input.shopId)
			pending.push(
				customerPurchases(db, userId, input.shopId, customerId, input).then(
					(value) => {
						data.purchases = value;
					},
				),
			);
		else
			pending.push(
				listOrders(db, userId, input).then((value) => {
					data.orders = value;
				}),
			);
		if (orderId && input.shopId)
			pending.push(
				orderDetail(db, userId, input.shopId, orderId).then((value) => {
					data.detail = value;
				}),
			);
	}
	if (tab === "customers")
		pending.push(
			listCustomers(db, userId, input).then((value) => {
				data.customers = value;
			}),
		);
	if (tab === "report")
		pending.push(
			dashboardReport(db, userId, input).then((value) => {
				data.report = value;
			}),
		);
	if (tab === "products")
		pending.push(
			listProducts(db, userId, input).then((value) => {
				data.products = value;
			}),
		);
	await Promise.all(pending);

	return (
		<PancakeScreen base="/pancake-demo" values={values} data={data} demo />
	);
}
