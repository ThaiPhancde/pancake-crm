import Add from "@carbon/icons-react/es/Add";
import Search from "@carbon/icons-react/es/Search";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Avatar, AvatarFallback } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { SettingsFrame } from "@/components/shop/settings-frame";
import { shopProfile } from "@/components/shop/shop-profile";

export default function BranchesPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Branches params={params} />
		</Suspense>
	);
}

async function Branches({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	const sellers = await ctx.api.sellers.query({ shopId: ctx.shopId });
	const profile = shopProfile(ctx.shopId);
	return (
		<SettingsFrame current="Chi nhánh" className="bg-transparent">
			<div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
				<aside className="flex flex-col gap-3 rounded-lg bg-card p-4">
					<h2 className="font-semibold text-sm">Danh sách chi nhánh</h2>
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Icon
								icon={Search}
								className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
							/>
							<Input placeholder="Tìm kiếm chi nhánh" className="pl-8" />
						</div>
						<Button size="icon" aria-label="Thêm chi nhánh" disabled>
							<Icon icon={Add} />
						</Button>
					</div>
					<div className="rounded-md border border-primary bg-accent/40 p-3">
						<p className="font-medium text-sm">{ctx.shop.name}</p>
						<p className="text-muted-foreground text-xs italic">
							(Chi nhánh mặc định)
						</p>
					</div>
				</aside>
				<div className="flex flex-col gap-4 rounded-lg bg-card p-5">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold text-base">{ctx.shop.name}</h2>
						<div className="flex items-center gap-3 text-xs">
							<label
								htmlFor="branch-default"
								className="flex items-center gap-2"
							>
								<Checkbox id="branch-default" checked disabled />
								Đặt làm mặc định
							</label>
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="Xoá chi nhánh"
								disabled
							>
								<Icon icon={TrashCan} />
							</Button>
						</div>
					</div>
					<section className="flex flex-col gap-3 rounded-lg border p-4">
						<h3 className="font-semibold text-sm">Thông tin chung</h3>
						<div className="grid gap-4 md:grid-cols-2">
							<Field>
								<FieldLabel>
									Tên chi nhánh <span className="text-destructive">*</span>
								</FieldLabel>
								<Input defaultValue={ctx.shop.name} readOnly />
							</Field>
							<Field>
								<FieldLabel>Số điện thoại</FieldLabel>
								<Input placeholder={`+${profile.dialCode} …`} />
							</Field>
							<Field>
								<FieldLabel>Email</FieldLabel>
								<Input placeholder="Nhập email" type="email" />
							</Field>
							<Field>
								<FieldLabel>Địa chỉ</FieldLabel>
								<Input placeholder={`${profile.flag} ${profile.country}`} />
							</Field>
						</div>
					</section>
					<section className="flex flex-col gap-3 rounded-lg border p-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h3 className="flex items-center gap-2 font-semibold text-sm">
								Nhân viên chi nhánh
								<Badge variant="soft-blue">{sellers.length}</Badge>
							</h3>
							<div className="flex items-center gap-2">
								<div className="relative">
									<Icon
										icon={Search}
										className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
									/>
									<Input
										placeholder="Tìm kiếm nhân viên…"
										className="w-56 pl-8"
									/>
								</div>
								<Button disabled>
									<Icon icon={Add} data-icon="inline-start" />
									Thêm nhân viên
								</Button>
							</div>
						</div>
						<ListTable
							columns={[
								{ key: "name", label: "Nhân viên" },
								{ key: "role", label: "Chức vụ", className: "text-right" },
							]}
							rows={sellers.map((seller) => ({
								key: seller.employeeId,
								cells: [
									<span key="name" className="flex items-center gap-2">
										<Avatar className="size-7">
											<AvatarFallback className="text-xs">
												{seller.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="flex flex-col">
											<span className="font-medium">{seller.name}</span>
											<span className="text-muted-foreground">
												Mã NV {seller.employeeId}
											</span>
										</span>
									</span>,
									<Badge key="role" variant="secondary">
										Telesale
									</Badge>,
								],
							}))}
							empty="Chưa có nhân viên đồng bộ từ Pancake POS"
						/>
					</section>
				</div>
			</div>
		</SettingsFrame>
	);
}
