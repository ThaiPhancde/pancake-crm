import Download from "@carbon/icons-react/es/Download";
import Filter from "@carbon/icons-react/es/Filter";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { EmptyBox } from "@/components/shop/empty-state";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { SettingsFrame, SettingsTabs } from "@/components/shop/settings-frame";

const TABS = [
	{ value: "config", label: "Cấu hình" },
	{ value: "messages", label: "Tin nhắn" },
	{ value: "events", label: "Sự kiện chuyển đổi" },
	{ value: "calls", label: "Tổng đài" },
];

export default function HistoryPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<History {...props} />
		</Suspense>
	);
}

async function History({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const tab = TABS.some((item) => item.value === text(values, "tab"))
		? text(values, "tab")
		: "config";
	const page = `${ctx.base}/settings/history`;
	const label = TABS.find((item) => item.value === tab)?.label ?? "Cấu hình";
	return (
		<SettingsFrame current="Lịch sử">
			<SettingsTabs
				tabs={TABS}
				current={tab}
				href={(value) =>
					withParams(page, {}, { tab: value === "config" ? "" : value })
				}
			/>
			<div className="flex flex-col gap-4 p-5">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="font-semibold text-base">
							Lịch sử {label.toLowerCase()}
						</h2>
						<p className="text-muted-foreground text-xs">
							Theo dõi lịch sử thay đổi {label.toLowerCase()}
						</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="icon" aria-label="Lọc">
							<Icon icon={Filter} />
						</Button>
						<Button
							variant="outline"
							size="icon"
							aria-label="Tải xuống"
							disabled
						>
							<Icon icon={Download} />
						</Button>
					</div>
				</div>
				<div className="rounded-lg border">
					<EmptyBox title="Không có dữ liệu" />
				</div>
			</div>
		</SettingsFrame>
	);
}
