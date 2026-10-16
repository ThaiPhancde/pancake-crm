import Settings from "@carbon/icons-react/es/Settings";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Switch } from "@crm/ui/components/switch";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { SettingsLine, SettingsRow } from "@/components/shop/page";
import { SettingsFrame } from "@/components/shop/settings-frame";
import { shopProfile } from "@/components/shop/shop-profile";

export default function GeneralSettingsPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<General params={params} />
		</Suspense>
	);
}

function ConfigButton({ label = "Cấu hình" }: { label?: string }) {
	return (
		<span className="inline-flex overflow-hidden rounded-md border">
			<Button variant="ghost" size="sm" className="rounded-none text-primary">
				{label}
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				className="rounded-none border-l text-primary"
				aria-label="Mở cấu hình"
			>
				<Icon icon={Settings} />
			</Button>
		</span>
	);
}

async function General({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	const profile = shopProfile(ctx.shopId);
	return (
		<SettingsFrame current="Cài đặt chung" className="px-5">
			<SettingsRow
				title="Cấu hình cơ bản"
				description="Cài đặt đơn vị tiền tệ, phương thức thanh toán phù hợp"
			>
				<SettingsLine label="Tên và ảnh đại diện của workspace">
					<span className="text-muted-foreground text-xs">{ctx.shop.name}</span>
					<ConfigButton />
				</SettingsLine>
				<SettingsLine label="Đơn vị tiền tệ mặc định">
					<Badge variant="outline" className="h-8 px-3">
						{profile.currency} ▾
					</Badge>
				</SettingsLine>
				<SettingsLine label="Mã shop Pancake POS">
					<span className="font-mono text-xs">{ctx.shopId}</span>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Cấu hình hệ thống"
				description="Điều chỉnh các thiết lập hệ thống phù hợp với mô hình vận hành"
			>
				<SettingsLine
					label="Sao chép cấu hình"
					hint="Sao chép cấu hình từ workspace khác"
				>
					<Button variant="outline" size="sm">
						Sao chép
					</Button>
				</SettingsLine>
				<SettingsLine
					label="Nguồn khách hàng"
					hint="Danh sách nguồn dùng cho tiềm năng, liên hệ và đơn hàng"
				>
					<ConfigButton />
				</SettingsLine>
				<SettingsLine label="Hiển thị khách hàng có cùng số điện thoại trên hội thoại">
					<Switch defaultChecked />
				</SettingsLine>
				<SettingsLine label="Gộp đơn theo số điện thoại (bỏ mã quốc gia)">
					<Switch defaultChecked />
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Cấu hình đa quốc gia"
				description="Cài đặt múi giờ, quốc gia kinh doanh phù hợp"
			>
				<SettingsLine label="Chọn quốc gia kinh doanh">
					<Badge variant="outline" className="h-8 gap-2 px-3">
						{profile.flag} {profile.country}{" "}
						<span className="text-muted-foreground">×</span>
					</Badge>
				</SettingsLine>
				<SettingsLine label="Múi giờ">
					<Badge variant="outline" className="h-8 px-3">
						{profile.timezoneLabel} ▾
					</Badge>
				</SettingsLine>
				<SettingsLine label="Mã vùng điện thoại">
					<span className="text-xs">+{profile.dialCode}</span>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Thông báo cá nhân"
				description="Tuỳ chỉnh thông báo theo tài khoản cá nhân"
			>
				<SettingsLine
					label="Tắt thông báo ứng dụng"
					hint="Không nhận thông báo trong CRM"
				>
					<Switch />
				</SettingsLine>
				<SettingsLine
					label="Thông báo qua trình duyệt"
					hint="Cần cho phép thông báo trên trình duyệt"
				>
					<Switch />
				</SettingsLine>
				<SettingsLine label="Âm thanh">
					<Badge variant="outline" className="h-8 px-3 text-primary">
						Im lặng 🔕 ▾
					</Badge>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Xóa Workspace"
				description="Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn và không thể khôi phục"
			>
				<div className="flex justify-end">
					<Button
						variant="outline"
						className="border-destructive text-destructive"
						disabled
					>
						Xóa Workspace
					</Button>
				</div>
			</SettingsRow>
		</SettingsFrame>
	);
}
