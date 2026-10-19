import Calendar from "@carbon/icons-react/es/Calendar";
import DataTable from "@carbon/icons-react/es/DataTable";
import { PANCAKE, shopTimezone } from "@crm/pancake/config";
import { Icon } from "@crm/ui/components/icon";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatDate } from "@/components/pancake/format";
import {
	CalendarGrid,
	CalendarNav,
	toCalendarEvents,
	todayIso,
	visibleRange,
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
	RangeChip,
	ViewSwitch,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import {
	type SearchValues,
	shopFilters,
	text,
	withParams,
} from "@/components/shop/params";
import { RecordQuickEdit } from "@/components/shop/record-quick-edit";
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
	const timeZone = shopTimezone(ctx.shopId);
	const view = text(values, "view") === "table" ? "table" : "calendar";
	const rawMode = text(values, "mode");
	const mode = rawMode === "day" || rawMode === "month" ? rawMode : "week";
	const today = todayIso(timeZone);
	const date = /^\d{4}-\d{2}-\d{2}$/.test(text(values, "date"))
		? text(values, "date")
		: today;
	const bounds =
		view === "calendar"
			? visibleRange(date, mode, timeZone)
			: shopFilters({ ...values, status: undefined }, ctx.shopId).input;
	const [sellers, appointments, customers] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.appointments.query({
			shopId: ctx.shopId,
			q: text(values, "q"),
			status: text(values, "status") || undefined,
			assigneeId: text(values, "assignee") || undefined,
			from: bounds.from,
			to: bounds.to,
			page: view === "calendar" ? 1 : pageNum,
			pageSize: view === "calendar" ? PANCAKE.maxListSize : 25,
		}),
		ctx.api.customers.query({
			shopId: ctx.shopId,
			pageSize: PANCAKE.maxListSize,
		}),
	]);
	const staff = sellers.map((seller) => ({
		value: seller.employeeId,
		label: seller.name,
	}));
	const contacts = customers.rows.map((customer) => ({
		value: customer.customerId,
		label: customer.phone
			? `${customer.name ?? customer.phone} · ${customer.phone}`
			: (customer.name ?? customer.customerId),
	}));
	const collection = COLLECTIONS.appointment;
	const page = `${ctx.base}/calendar`;
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
						relations={{ contact: contacts }}
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
						options={[
							{ value: "none", label: "Chưa được phân công" },
							...staff,
						]}
					/>
					<FilterChip
						label="Trạng thái"
						param="status"
						multiple
						options={APPOINTMENT_STATUSES}
					/>
					{view === "table" ? (
						<RangeChip label="Thời gian hẹn" />
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
					<CalendarGrid
						date={date}
						mode={mode}
						today={today}
						events={toCalendarEvents(appointments.rows, timeZone)}
					/>
				) : (
					<>
						<ListTable
							columns={columns}
							rows={appointments.rows.map((item) => ({
								key: item.id,
								cells: [
									item.title,
									item.contactName ?? <Dash />,
									item.phone ?? <Dash />,
									formatDate(item.startAt),
									item.endAt ? formatDate(item.endAt) : <Dash key="endAt" />,
									<RecordQuickEdit
										key="status"
										kind="appointment"
										field="status"
										id={item.id}
										shopId={ctx.shopId}
										value={item.status}
										options={APPOINTMENT_STATUSES}
										disabled={!appointments.canWrite}
									/>,
									<RecordQuickEdit
										key="assignee"
										kind="appointment"
										field="assigneeId"
										id={item.id}
										shopId={ctx.shopId}
										value={item.assigneeId}
										options={staff}
										disabled={!appointments.canWrite}
									/>,
								],
							}))}
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
