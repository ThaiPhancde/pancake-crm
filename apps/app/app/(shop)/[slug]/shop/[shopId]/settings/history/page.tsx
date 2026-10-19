import Checkmark from "@carbon/icons-react/es/Checkmark";
import Filter from "@carbon/icons-react/es/Filter";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	ADMIN,
	HISTORY_TABS,
	type HistoryTab,
} from "@/components/shop/admin/config";
import { ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { zonedDateTime } from "@/components/shop/range";
import { ExportCsvButton } from "@/components/shop/reports/export-button";
import { SettingsFrame, SettingsTabs } from "@/components/shop/settings-frame";
import { getServerTrpcClient } from "@/lib/trpc/server";

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

function stamp(at: string, timeZone: string) {
	const local = zonedDateTime(new Date(at), timeZone);
	return `${local.time} ${local.date.split("-").reverse().join("/")}`;
}

async function History({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const requested = text(values, "tab");
	const tab: HistoryTab =
		HISTORY_TABS.find((item) => item.value === requested)?.value ??
		Object.entries(ADMIN.history.legacyTabs).find(
			([legacy]) => legacy === requested,
		)?.[1] ??
		"all";
	const page = Math.max(1, Number(text(values, "page")) || 1);
	const pageSize = ADMIN.history.pageSize;
	const history = await getServerTrpcClient()
		.pancakeSettings.history.query({ shopId: ctx.shopId, tab, page, pageSize })
		.catch(() => null);
	const base = `${ctx.base}/settings/history`;
	const tabHref = (value: string) =>
		withParams(base, {}, { tab: value === "all" ? "" : value });
	const label = HISTORY_TABS.find((item) => item.value === tab)?.label ?? "";
	const areaLabel = (area: string) =>
		HISTORY_TABS.find((item) => item.value === area)?.label ?? area;
	const timeZone = ctx.shop.timezone;

	if (!history) {
		return (
			<SettingsFrame current="Lịch sử" className="p-5">
				<Alert>
					<AlertTitle>Chỉ quản lý shop mới xem được lịch sử</AlertTitle>
					<AlertDescription>
						Tài khoản của bạn là Telesale hoặc Người xem trên shop này.
					</AlertDescription>
				</Alert>
			</SettingsFrame>
		);
	}

	return (
		<SettingsFrame current="Lịch sử">
			<SettingsTabs tabs={[...HISTORY_TABS]} current={tab} href={tabHref} />
			<div className="flex flex-col gap-4 p-5">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="font-semibold text-base">
							Lịch sử {label.toLowerCase()}
						</h2>
						<p className="text-muted-foreground text-xs">
							Theo dõi lịch sử thay đổi trong CRM.{" "}
							{ADMIN.history.unsupported.join(", ")} chưa ghi lịch sử.
						</p>
					</div>
					<div className="flex gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" aria-label="Lọc">
									<Icon icon={Filter} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Khu vực</DropdownMenuLabel>
								{HISTORY_TABS.map((item) => (
									<DropdownMenuItem key={item.value} asChild>
										<Link
											href={tabHref(item.value)}
											aria-current={item.value === tab ? "page" : undefined}
										>
											<span className="flex-1">{item.label}</span>
											{item.value === tab ? <Icon icon={Checkmark} /> : null}
										</Link>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
						<ExportCsvButton
							source={{ kind: "history", shopId: ctx.shopId, tab }}
						/>
					</div>
				</div>
				<div className="rounded-lg border">
					<ListTable
						selectable={false}
						columns={[
							{ key: "at", label: "Thời gian" },
							{ key: "user", label: "Người thực hiện" },
							{ key: "area", label: "Khu vực" },
							{ key: "summary", label: "Nội dung" },
						]}
						rows={history.rows.map((row) => ({
							key: row.id,
							cells: [
								<span key="at" className="tabular-nums">
									{stamp(row.at, timeZone)}
								</span>,
								row.user?.name ?? "Hệ thống",
								<Badge key="area" variant="secondary">
									{areaLabel(row.area)}
								</Badge>,
								row.summary,
							],
						}))}
						empty="Không có dữ liệu"
					/>
				</div>
			</div>
			<ListFooter
				total={history.total}
				page={page}
				pageSize={pageSize}
				unit="bản ghi"
				pageHref={(next) =>
					withParams(base, values, { page: next > 1 ? String(next) : "" })
				}
			/>
		</SettingsFrame>
	);
}
