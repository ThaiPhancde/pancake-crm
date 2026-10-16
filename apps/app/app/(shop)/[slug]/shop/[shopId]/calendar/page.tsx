import Calendar from "@carbon/icons-react/es/Calendar";
import DataTable from "@carbon/icons-react/es/DataTable";
import { Badge } from "@crm/ui/components/badge";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatDate } from "@/components/pancake/format";
import {
	CalendarGrid,
	CalendarNav,
	todayIso,
} from "@/components/shop/calendar-week";
import {
	APPOINTMENT_STATUSES,
	COLLECTIONS,
} from "@/components/shop/collections";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	ViewSwitch,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import { type SearchValues, text, withParams } from "@/components/shop/params";
import { rangeBounds } from "@/components/shop/range";
import { CreateRecordButton } from "@/components/shop/record-sheet";

export default function CalendarPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Appointments {...props} />
		</Suspense>
	);
}

async function Appointments({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const pageNum = Math.max(1, Number(text(values, "page") || "1"));
	const [sellers, appointments] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.appointments.query({
			shopId: ctx.shopId,
			q: text(values, "q"),
			status: text(values, "status") || undefined,
			assigneeId: text(values, "assignee") || undefined,
			page: pageNum,
			pageSize: 25,
		}),
	]);
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const sellerMap = new Map(sellers.map((s) => [s.employeeId, s.name]));
	const collection = COLLECTIONS.appointment;
	const view = text(values, "view") === "table" ? "table" : "calendar";
	const rawMode = text(values, "mode");
	const mode = rawMode === "day" || rawMode === "month" ? rawMode : "week";
	const today = todayIso();
	const date = /^\d{4}-\d{2}-\d{2}$/.test(text(values, "date"))
		? text(values, "date")
		: today;
	const page = `${ctx.base}/calendar`;
	const month = rangeBounds("month");
	const columns = collection.fields
		.filter((field) => field.list)
		.map((field) => ({ key: field.key, label: field.label }));

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<CreateRecordButton
						collection="appointment"
						label="Thêm lịch hẹn"
						users={staff}
						size="md"
					/>
				}
			/>
			<ShopPageBody>
				<FilterBar
					toolbar={
						<>
							<ViewSwitch
								options={[
									{
										value: "calendar",
										label: "Lịch hẹn",
										icon: <Icon icon={Calendar} />,
									},
									{
										value: "table",
										label: "Bảng",
										icon: <Icon icon={DataTable} />,
									},
								]}
							/>
							{view === "table" ? (
								<FilterButton
									fields={collection.fields.map((f) => ({
										value: f.key,
										label: f.label,
									}))}
								/>
							) : null}
							<MoreMenu />
						</>
					}
				>
					<FilterChip
						label="Phân công"
						param="assignee"
						multiple
						searchable
						options={staff}
					/>
					{view === "table" ? (
						<>
							<FilterChip
								label="Trạng thái"
								param="status"
								multiple
								options={APPOINTMENT_STATUSES}
							/>
							<form className="ml-1 flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-accent-foreground text-xs">
								<Input
									type="date"
									name="from"
									defaultValue={text(values, "from") || month.from}
									className="h-6 w-32 border-0 bg-transparent px-1"
								/>
								→
								<Input
									type="date"
									name="to"
									defaultValue={text(values, "to") || month.to}
									className="h-6 w-32 border-0 bg-transparent px-1"
								/>
							</form>
						</>
					) : (
						<div className="ml-4">
							<CalendarNav
								date={date}
								mode={mode}
								today={today}
								href={(change) =>
									withParams(page, values, {
										date: change.date ?? date,
										mode: change.mode ?? mode,
									})
								}
							/>
						</div>
					)}
				</FilterBar>
				{view === "calendar" ? (
					<CalendarGrid date={date} mode={mode} today={today} />
				) : (
					<>
						<ListTable
							columns={columns}
							rows={appointments.rows.map((item) => {
								const statusOpt = APPOINTMENT_STATUSES.find(
									(s) => s.value === item.status,
								);
								return {
									key: item.id,
									cells: [
										item.title,
										item.contactName ?? <Dash />,
										item.phone ?? <Dash />,
										formatDate(item.startAt),
										item.endAt ? formatDate(item.endAt) : <Dash />,
										<Badge key="status" variant="blue">
											{statusOpt?.label ?? item.status}
										</Badge>,
										item.assigneeId
											? (sellerMap.get(item.assigneeId) ?? item.assigneeId)
											: <Dash />,
									],
								};
							})}
						/>
						<ListFooter
							total={appointments.total}
							page={pageNum}
							pageSize={25}
							unit="lịch hẹn"
							pageHref={(next) =>
								withParams(page, values, { page: String(next) })
							}
						/>
					</>
				)}
			</ShopPageBody>
		</ShopPage>
	);
}
