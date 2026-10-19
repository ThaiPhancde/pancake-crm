import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	AutomationCenter,
	AutomationList,
} from "@/components/shop/automation-center";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { SettingsFrame } from "@/components/shop/settings-frame";

export default function AutomationPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Automation params={params} />
		</Suspense>
	);
}

async function Automation({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	return (
		<SettingsFrame current="Tự động hoá" className="gap-4 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold text-sm">Danh sách tự động hóa</h2>
					<p className="text-muted-foreground text-xs">
						Tự động thông báo, phân công khi bản ghi thay đổi
					</p>
				</div>
				<AutomationCenter shopId={ctx.shopId} label="Mẫu đề xuất" />
			</div>
			<AutomationList shopId={ctx.shopId} />
		</SettingsFrame>
	);
}
