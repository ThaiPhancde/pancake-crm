import Filter from "@carbon/icons-react/es/Filter";
import Search from "@carbon/icons-react/es/Search";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { AutomationCenter } from "@/components/shop/automation-center";
import { EmptyBox } from "@/components/shop/empty-state";
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
	await loadShop(params);
	return (
		<SettingsFrame current="Tự động hoá" className="gap-4 p-5">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-80">
					<Icon
						icon={Search}
						className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
					/>
					<Input placeholder="Tìm theo tên, mô tả" className="pl-8" />
				</div>
				<Button variant="outline">Tất cả ▾</Button>
				<Button variant="outline">
					<Icon icon={Filter} data-icon="inline-start" />
					Bộ lọc
				</Button>
			</div>
			<EmptyBox
				title="Chưa có tự động hóa nào!"
				description='Bấm "Thêm mới" để thêm tự động hóa'
				action={<AutomationCenter label="Thêm mới" />}
			/>
		</SettingsFrame>
	);
}
