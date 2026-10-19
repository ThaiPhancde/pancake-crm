import Settings from "@carbon/icons-react/es/Settings";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Switch } from "@crm/ui/components/switch";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { COLLECTIONS, type CollectionKey } from "@/components/shop/collections";
import { EmptyBox } from "@/components/shop/empty-state";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { UNSUPPORTED } from "@/components/shop/settings/config";
import { Unsupported } from "@/components/shop/settings/unsupported";
import { SettingsFrame, SettingsTabs } from "@/components/shop/settings-frame";
import { getServerTrpcClient } from "@/lib/trpc/server";

const TABS = [
	{ value: "modules", label: "Thiết lập module" },
	{ value: "apps", label: "Quản lý ứng dụng" },
	{ value: "email", label: "Quản lý mẫu email" },
	{ value: "webhook", label: "Webhook - API" },
];

type Module = {
	key: CollectionKey;
	icon: string;
	description: string;
	toggle?: boolean;
	options: {
		title: string;
		description: string;
		toggle?: boolean;
		linked?: boolean;
	}[];
};

const MODULES: Module[] = [
	{
		key: "task",
		icon: "📋",
		description: "Theo dõi việc cần làm, lịch hẹn cá nhân của bạn",
		options: [
			{
				title: "Cấu hình trạng thái",
				description: "Xác định các bước trong quy trình xử lý nhiệm vụ.",
			},
			{
				title: "Cấu hình danh mục",
				description: "Thiết lập danh mục cho nhiệm vụ",
			},
		],
	},
	{
		key: "lead",
		icon: "🧩",
		description: "Sử dụng để nhận khách hàng tiềm năng từ tất cả các nguồn",
		options: [
			{
				title: "Cấu hình trạng thái",
				description: "Thiết lập các bước xử lý và pipeline của tiềm năng.",
			},
			{
				title: "Ghép trường chuyển đổi",
				description:
					"Thiết lập các thông tin tự động đồng bộ khi chuyển đổi tiềm năng",
			},
			{
				title: "Cấu hình biểu mẫu",
				description:
					"Thiết lập biểu mẫu thu thập thông tin khách hàng tiềm năng.",
			},
			{
				title: "Lý do không tiềm năng",
				description:
					"Chọn các trường cần điền khi đánh dấu tiềm năng là không tiềm năng",
			},
			{
				title: "Tự động gộp bản ghi trùng",
				description:
					"Bản ghi mới trùng số điện thoại hoặc email thì gộp vào bản ghi đã có thay vì tạo mới",
				toggle: true,
			},
		],
	},
	{
		key: "contact",
		icon: "👥",
		description:
			"Khách hàng đã xác định, đồng bộ từ Pancake POS theo số điện thoại",
		options: [
			{
				title: "Cấu hình trạng thái",
				description:
					"Vòng đời khách: mới, đang mua, mua lại, ngừng tương tác, chặn.",
			},
			{
				title: "Gộp theo số điện thoại",
				description: "Bỏ mã quốc gia khi so khớp khách giữa các đơn",
				toggle: true,
				linked: true,
			},
		],
	},
	{
		key: "order",
		icon: "🛒",
		description: "Đơn hàng COD đồng bộ từ Pancake POS",
		options: [
			{
				title: "Cấu hình trạng thái",
				description: "Ánh xạ trạng thái POS sang trạng thái CRM.",
			},
			{
				title: "Hãng vận chuyển",
				description: "Danh sách hãng vận chuyển và trạng thái giao hàng.",
			},
		],
	},
	{
		key: "ticket",
		icon: "🎫",
		description: "Theo dõi và giải quyết khiếu nại khách hàng",
		options: [
			{
				title: "Cấu hình trạng thái",
				description: "Mới, đang xử lý, hoàn thành.",
			},
			{
				title: "Cấu hình danh mục",
				description: "Đơn hàng, giao hàng, hoàn hàng, đề xuất.",
			},
		],
	},
	{
		key: "appointment",
		icon: "📅",
		description: "Đặt lịch, quản lý thông tin lịch hẹn của khách hàng",
		options: [
			{
				title: "Cấu hình trạng thái",
				description: "Đã đặt, hoàn thành, đã hủy, khách vắng.",
			},
		],
	},
];

export default function ToolsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Tools {...props} />
		</Suspense>
	);
}

async function Tools({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const settings = await getServerTrpcClient().pancakeSettings.get.query({
		shopId: ctx.shopId,
	});
	const tab = TABS.some((item) => item.value === text(values, "tab"))
		? text(values, "tab")
		: "modules";
	const page = `${ctx.base}/settings/tools`;
	return (
		<SettingsFrame current="Công cụ">
			<SettingsTabs
				tabs={TABS}
				current={tab}
				href={(value) =>
					withParams(page, {}, { tab: value === "modules" ? "" : value })
				}
			/>
			{tab === "modules" ? (
				<div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-5">
					<div>
						<h2 className="font-semibold text-sm">Danh sách module</h2>
						<p className="text-muted-foreground text-xs">
							Chọn các tính năng CRM bạn muốn kích hoạt trong workspace
						</p>
					</div>
					{MODULES.map((module) => (
						<section
							key={module.key}
							className="rounded-lg border bg-muted/40 p-4"
						>
							<div className="flex items-start gap-3">
								<span className="flex size-9 items-center justify-center rounded-md bg-card text-lg">
									{module.icon}
								</span>
								<div className="flex-1">
									<h3 className="font-semibold text-sm">
										{COLLECTIONS[module.key].title}
									</h3>
									<p className="text-muted-foreground text-xs">
										{module.description}
									</p>
								</div>
								<Button asChild variant="outline" size="sm">
									<Link href={`${page}/fields/${module.key}`}>
										Bảng · trường dữ liệu
									</Link>
								</Button>
							</div>
							<div className="mt-3 flex flex-col divide-y rounded-md bg-card px-4">
								{module.options.map((option) => (
									<div
										key={option.title}
										className="flex items-center justify-between gap-3 py-3"
									>
										<div>
											<p className="font-medium text-xs">{option.title}</p>
											<p className="text-muted-foreground text-xs">
												{option.description}
											</p>
										</div>
										{option.toggle ? (
											<Unsupported
												reason={
													option.linked
														? UNSUPPORTED.generalSettings
														: UNSUPPORTED.modules
												}
											>
												<Switch
													checked={
														option.linked ? settings.mergeOrdersByPhone : false
													}
													disabled
													aria-label={option.title}
												/>
											</Unsupported>
										) : (
											<Button
												asChild
												variant="outline"
												size="icon-sm"
												aria-label={option.title}
											>
												<Link href={`${page}/fields/${module.key}`}>
													<Icon icon={Settings} />
												</Link>
											</Button>
										)}
									</div>
								))}
							</div>
						</section>
					))}
					<section className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
						<div className="flex items-start gap-3">
							<span className="flex size-9 items-center justify-center rounded-md bg-card text-lg">
								🏢
							</span>
							<div>
								<h3 className="font-semibold text-sm">Công ty</h3>
								<p className="text-muted-foreground text-xs">
									Bán sỉ, đại lý theo công ty
								</p>
							</div>
						</div>
						<Unsupported reason={UNSUPPORTED.modules}>
							<Switch checked={false} disabled aria-label="Công ty" />
						</Unsupported>
					</section>
				</div>
			) : (
				<div className="p-5">
					<EmptyBox
						title={
							tab === "apps"
								? "Chưa có ứng dụng nào"
								: tab === "email"
									? "Chưa có mẫu email"
									: "Chưa có webhook hoặc API key"
						}
						description={UNSUPPORTED.feature}
					/>
				</div>
			)}
		</SettingsFrame>
	);
}
