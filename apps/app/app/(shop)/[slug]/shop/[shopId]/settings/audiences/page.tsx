import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { EmptyBox } from "@/components/shop/empty-state";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { SettingsFrame } from "@/components/shop/settings-frame";

export default function AudiencesPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Audiences params={params} />
		</Suspense>
	);
}

async function Audiences({ params }: { params: Promise<ShopRoute> }) {
	await loadShop(params);
	return (
		<SettingsFrame current="Tệp khách hàng" className="gap-4 p-5">
			<div>
				<h2 className="font-semibold text-sm">Danh sách tệp khách hàng</h2>
				<p className="text-muted-foreground text-xs">
					Tạo tệp khách hàng, đồng bộ Custom Audiences Facebook, Tiktok
				</p>
			</div>
			<EmptyBox
				title="Danh sách tệp khách hàng"
				description="Tạo tệp khách hàng, đồng bộ Custom Audiences Facebook, Tiktok"
				action={
					<Button disabled>
						<Icon icon={Add} data-icon="inline-start" />
						Thêm mới
					</Button>
				}
			/>
		</SettingsFrame>
	);
}
