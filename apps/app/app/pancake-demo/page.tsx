import { db } from "@crm/db";
import {
	connectionStatus,
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	listProducts,
	orderDetail,
} from "@crm/pancake/queries";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
	type PancakeData,
	PancakeScreen,
	parseFilters,
	type SearchValues,
} from "@/components/pancake/screen";

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
	const { input, tab, customerId, orderId } = parseFilters(values);
	const userId = "pancake-demo-admin";
	const data: PancakeData = { shops: await connectionStatus(db, userId) };
	if (tab === "orders") {
		if (customerId && input.shopId)
			data.purchases = await customerPurchases(
				db,
				userId,
				input.shopId,
				customerId,
				input,
			);
		else data.orders = await listOrders(db, userId, input);
		if (orderId && input.shopId)
			data.detail = await orderDetail(db, userId, input.shopId, orderId);
	}
	if (tab === "customers")
		data.customers = await listCustomers(db, userId, input);
	if (tab === "report") data.report = await dashboardReport(db, userId, input);
	if (tab === "products") data.products = await listProducts(db, userId, input);
	return (
		<PancakeScreen base="/pancake-demo" values={values} data={data} demo />
	);
}
