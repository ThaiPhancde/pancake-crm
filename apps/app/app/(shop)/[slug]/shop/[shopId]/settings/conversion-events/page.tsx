import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Switch } from "@crm/ui/components/switch";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { EmptyBox } from "@/components/shop/empty-state";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { UNSUPPORTED } from "@/components/shop/settings/config";
import { Unsupported } from "@/components/shop/settings/unsupported";
import { SettingsFrame, SettingsTabs } from "@/components/shop/settings-frame";

const TABS = [
	{ value: "meta", label: "Facebook & Instagram" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "whatsapp", label: "WhatsApp" },
	{ value: "google", label: "Google" },
];

const EVENTS = [
	{ name: "LeadSubmitted", entity: "Tiềm năng", value: "Đã chuyển đổi" },
	{ name: "Spam", entity: "Tiềm năng", value: "Không tiềm năng" },
	{ name: "Purchase", entity: "Đơn hàng", value: "Đã xác nhận" },
	{ name: "Delivered", entity: "Đơn hàng", value: "Đã nhận (COD thu tiền)" },
];

export default function ConversionEventsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<ConversionEvents {...props} />
		</Suspense>
	);
}

async function ConversionEvents({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const tab = TABS.some((item) => item.value === text(values, "tab"))
		? text(values, "tab")
		: "meta";
	const page = `${ctx.base}/settings/conversion-events`;
	const channel =
		tab === "meta"
			? "Meta"
			: (TABS.find((item) => item.value === tab)?.label ?? "Meta");
	return (
		<SettingsFrame current="Sự kiện chuyển đổi">
			<SettingsTabs
				tabs={TABS}
				current={tab}
				href={(value) =>
					withParams(page, {}, { tab: value === "meta" ? "" : value })
				}
			/>
			<div className="flex flex-col gap-8 p-5">
				<section className="flex flex-col gap-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 className="font-semibold text-sm">
								Sự kiện Tin nhắn {channel}
							</h2>
							<p className="text-muted-foreground text-xs">
								Cài đặt điều kiện đồng bộ các sự kiện về {channel} để tối ưu{" "}
								<b>quảng cáo tin nhắn</b>
							</p>
						</div>
						<div className="flex gap-2">
							<Unsupported reason={UNSUPPORTED.external}>
								<Button variant="outline" disabled>
									Danh sách dataset tin nhắn
								</Button>
							</Unsupported>
							<Unsupported reason={UNSUPPORTED.external}>
								<Button disabled>
									<Icon icon={Add} data-icon="inline-start" />
									Thêm sự kiện
								</Button>
							</Unsupported>
						</div>
					</div>
					<ListTable
						selectable={false}
						columns={[
							{ key: "on", label: "Bật/Tắt" },
							{ key: "name", label: "Tên sự kiện" },
							{ key: "rule", label: "Bắn sự kiện khi" },
							{
								key: "updated",
								label: "Cập nhật gần nhất",
								className: "text-right",
							},
						]}
						rows={EVENTS.map((event) => ({
							key: event.name,
							cells: [
								<Unsupported key="on" reason={UNSUPPORTED.external}>
									<Switch checked={false} disabled aria-label="Bật/Tắt" />
								</Unsupported>,
								event.name,
								<span key="rule">
									{event.entity} với <b>Trạng thái</b> Là <b>{event.value}</b>
								</span>,
								<span key="updated" className="text-muted-foreground">
									Chưa kết nối
								</span>,
							],
						}))}
					/>
				</section>
				<section className="flex flex-col gap-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 className="font-semibold text-sm">
								Sự kiện {channel} Lead Form
							</h2>
							<p className="text-muted-foreground text-xs">
								Cài đặt điều kiện đồng bộ các sự kiện về {channel} để tối ưu{" "}
								<b>quảng cáo Lead Form</b>
							</p>
						</div>
						<Unsupported reason={UNSUPPORTED.external}>
							<Button variant="outline" disabled>
								Danh sách dataset CRM
							</Button>
						</Unsupported>
					</div>
					<EmptyBox
						title={`Chưa có sự kiện ${channel} Lead Form`}
						description={`Bấm "Thêm sự kiện" để thêm sự kiện ${channel} Lead Form`}
						action={
							<Unsupported reason={UNSUPPORTED.external}>
								<Button disabled>
									<Icon icon={Add} data-icon="inline-start" />
									Thêm sự kiện
								</Button>
							</Unsupported>
						}
					/>
				</section>
			</div>
		</SettingsFrame>
	);
}
