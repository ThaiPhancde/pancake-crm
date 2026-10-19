import Add from "@carbon/icons-react/es/Add";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatDate } from "@/components/pancake/format";
import { EmptyBox } from "@/components/shop/empty-state";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { UNSUPPORTED } from "@/components/shop/settings/config";
import { Unsupported } from "@/components/shop/settings/unsupported";
import { SettingsFrame, SettingsTabs } from "@/components/shop/settings-frame";
import { SyncToggle } from "@/components/shop/sync-toggle";

const TABS = [
	{ value: "pancake", label: "Pancake" },
	{ value: "pos", label: "POS" },
	{ value: "leadforms", label: "Lead forms" },
	{ value: "ads", label: "Tài khoản quảng cáo" },
];

export default function ConnectionsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Connections {...props} />
		</Suspense>
	);
}

async function Connections({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const tab = TABS.some((item) => item.value === text(values, "tab"))
		? text(values, "tab")
		: "pancake";
	const page = `${ctx.base}/settings/connections`;
	const shop = ctx.shop;
	return (
		<SettingsFrame current="Kết nối">
			<SettingsTabs
				tabs={TABS}
				current={tab}
				href={(value) =>
					withParams(page, {}, { tab: value === "pancake" ? "" : value })
				}
			/>
			<div className="flex flex-1 flex-col gap-4 p-5">
				{tab === "pancake" ? (
					<>
						<div>
							<h2 className="font-semibold text-sm">Danh sách trang Pancake</h2>
							<p className="text-muted-foreground text-xs">
								Dữ liệu sẽ được đồng bộ về bảng Tiềm năng
							</p>
						</div>
						<EmptyBox
							title="Chưa có page nào được kết nối!"
							description={UNSUPPORTED.external}
							action={
								<Unsupported reason={UNSUPPORTED.external}>
									<Button disabled>
										<Icon icon={Add} data-icon="inline-start" />
										Thêm trang
									</Button>
								</Unsupported>
							}
						/>
					</>
				) : null}
				{tab === "pos" ? (
					<>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h2 className="font-semibold text-sm">Pancake POS</h2>
								<p className="text-muted-foreground text-xs">
									Khách hàng, đơn hàng, sản phẩm và nhân viên đồng bộ từ shop
									POS này.
								</p>
							</div>
							<SyncToggle shopId={shop.id} enabled={shop.enabled} />
						</div>
						<div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
							<div className="flex flex-col gap-2 text-xs">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-semibold text-sm">{shop.name}</span>
									<Badge variant={shop.syncEnabled ? "green" : "gray"}>
										{shop.syncEnabled ? "Đã bật" : "Đang dừng"}
									</Badge>
									<Badge
										variant={shop.liveApprovedAt ? "soft-green" : "soft-orange"}
									>
										{shop.liveApprovedAt
											? "Đã duyệt dữ liệu thật"
											: "Chưa duyệt dữ liệu thật"}
									</Badge>
								</div>
								<p>Đồng bộ shop: {shop.enabled ? "Đang bật" : "Đã tạm dừng"}</p>
								<p>
									Mã shop: <span className="font-mono">{shop.id}</span>
								</p>
								<p>Đồng bộ gần nhất: {formatDate(shop.lastSyncAt)}</p>
								<p>Webhook gần nhất: {formatDate(shop.lastWebhookAt)}</p>
								<p>Lỗi gần nhất: {shop.lastError ?? "Không có"}</p>
								<p>Webhook cần xử lý lại: {shop.deadWebhooks}</p>
								{!shop.historyComplete ? (
									<p className="text-warning">
										Lịch sử chưa nhập đầy đủ. Danh sách và báo cáo phản ánh dữ
										liệu đã nhập.
									</p>
								) : null}
							</div>
							<div className="flex flex-col gap-1 text-xs">
								<span className="font-medium">Tiến độ đồng bộ</span>
								{shop.cursors.length === 0 ? (
									<span className="text-muted-foreground">
										Chưa chạy đồng bộ.
									</span>
								) : (
									shop.cursors.map((cursor) => (
										<div
											key={cursor.resource}
											className="flex items-center justify-between border-b py-1 last:border-b-0"
										>
											<span className="capitalize">{cursor.resource}</span>
											<span className="text-muted-foreground">
												{cursor.phase} · trang {cursor.nextPage} ·{" "}
												{formatDate(cursor.watermark)}
											</span>
										</div>
									))
								)}
							</div>
						</div>
					</>
				) : null}
				{tab === "leadforms" ? (
					<EmptyBox
						title="Chưa có Lead form nào được kết nối"
						description={`Kết nối Facebook Lead Ads. ${UNSUPPORTED.external}.`}
						action={
							<Unsupported reason={UNSUPPORTED.external}>
								<Button disabled>
									<Icon icon={Add} data-icon="inline-start" />
									Thêm Lead form
								</Button>
							</Unsupported>
						}
					/>
				) : null}
				{tab === "ads" ? (
					<EmptyBox
						title="Chưa có tài khoản quảng cáo"
						description={`Kết nối tài khoản Meta, TikTok. ${UNSUPPORTED.external}.`}
						action={
							<Unsupported reason={UNSUPPORTED.external}>
								<Button disabled>
									<Icon icon={Add} data-icon="inline-start" />
									Thêm tài khoản
								</Button>
							</Unsupported>
						}
					/>
				) : null}
			</div>
		</SettingsFrame>
	);
}
