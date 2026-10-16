import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";

export default function ShopIndex({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense fallback={null}>
			<Pick params={params} />
		</Suspense>
	);
}

async function Pick({ params }: { params: Promise<{ slug: string }> }) {
	const [, { slug }] = await Promise.all([requireSession(), params]);
	const shops = await getServerTrpcClient().pancake.status.query();
	const first = shops[0];
	if (first) redirect(`/${slug}/shop/${first.id}`);
	return (
		<main className="mx-auto max-w-lg p-10">
			<Alert>
				<AlertTitle>Chưa có shop được cấp quyền</AlertTitle>
				<AlertDescription>
					Quản trị viên cấu hình shop Pancake và cấp quyền cho tài khoản của bạn
					trước khi mở workspace.
				</AlertDescription>
			</Alert>
		</main>
	);
}
