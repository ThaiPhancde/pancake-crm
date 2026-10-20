import Settings from "@carbon/icons-react/es/Settings";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { ConversationsPanel } from "@/components/shop/conversations-panel";
import { loadShop, type ShopRoute } from "@/components/shop/load";

export default function ConversationsPage(props: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<ConversationsView {...props} />
		</Suspense>
	);
}

async function ConversationsView({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	const ctx = await loadShop(params);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Hội thoại Pancake</PageShellTitle>
					<PageShellDescription>
						Danh sách hội thoại và lịch sử tin nhắn theo các Page đã gán cho cửa
						hàng {ctx.shop.name} ({ctx.shopId}).
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Button asChild variant="outline" size="sm">
						<Link href={`${ctx.base}/settings/connections`}>
							<Icon icon={Settings} data-icon="inline-start" />
							Cấu hình Page Pancake
						</Link>
					</Button>
				</PageShellActions>
			</PageShellHeader>
			<PageShellContent>
				<ConversationsPanel shopId={ctx.shopId} base={ctx.base} />
			</PageShellContent>
		</PageShell>
	);
}
