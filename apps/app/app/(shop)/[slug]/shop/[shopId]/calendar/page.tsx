import Calendar from "@carbon/icons-react/es/Calendar";
import DataTable from "@carbon/icons-react/es/DataTable";
import { PANCAKE } from "@crm/pancake/config";
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
	QuickViewChip,
	RangeChip,
	ViewSwitch,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { DetailFields } from "@/components/shop/lists/detail-fields";
import { loadSavedFilters } from "@/components/shop/lists/saved-filters-server";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { OrderDetailSheet } from "@/components/shop/order-detail-sheet";
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
	const timeZone = ctx.shop.timezone;
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
			: shopFilters(
					{ ...values, status: undefined },
					ctx.shopId,
					undefined,
					ctx.shop.timezone,
				).input;
	const appointmentId = text(values, "appointmentId");
	const recordInput = {
		shopId: ctx.shopId,
		q: text(values, "q"),
		status: text(values, "status") || undefined,
		assigneeId: text(values, "assignee") || undefined,
		from: bounds.from,
		to: bounds.to,
	};
	const [sellers, appointments, customers, saved] = await Promise.all([
		ctx.api.sellers.query({ shopId: ctx.shopId }),
		ctx.api.appointments.query({
			...recordInput,
			page: view === "calendar" ? 1 : pageNum,
			pageSize: view === "calendar" ? PANCAKE.maxListSize : 25,
		}),
		ctx.api.customers.query({
			shopId: ctx.shopId,
			pageSize: PANCAKE.maxListSize,
		}),
		loadSavedFilters(ctx.shopId, "appointments"),
	]);
	const selected = appointmentId
		? (appointments.rows.find((row) => row.id === appointmentId) ??
			(
				await ctx.api.appointments.query({
					shopId: ctx.shopId,
					id: appointmentId,
					pageSize: 1,
				})
			).rows.find((row) => row.id === appointmentId))
		: undefined;
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
	const appointmentHref = (id: string) =>
		withParams(page, values, { appointmentId: id });
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
							<FilterButton
								saved={saved}
								fields={[
									{
										param: "status",
										label: "Trạng thái",
										options: APPOINTMENT_STATUSES,
									},
									{
										param: "assignee",
										label: "Phân công",
										options: [
											{ value: "none", label: "Chưa được phân công" },
											...staff,
										],
									},
								]}
							/>
							<MoreMenu
								exportRequest={{
									kind: "appointments",
									shopId: ctx.shopId,
									filters: recordInput,
								}}
							/>
						</>
					}
				>
					<QuickViewChip
						options={[{ value: "all", label: "Tất cả lịch hẹn" }]}
						saved={saved}
					/>
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
						events={toCalendarEvents(
							appointments.rows,
							timeZone,
							appointmentHref,
						)}
					/>
				) : (
					<>
						<ListTable
							columns={columns}
							bulk={{
								shopId: ctx.shopId,
								entity: "appointment",
								statuses: APPOINTMENT_STATUSES,
								staff,
								canWrite: appointments.canWrite,
							}}
							rows={appointments.rows.map((item) => ({
								key: item.id,
								href: appointmentHref(item.id),
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
			{selected ? (
				<OrderDetailSheet
					title={`Lịch hẹn · ${selected.title}`}
					closeHref={withParams(page, values, { appointmentId: "" })}
				>
					<DetailFields
						items={[
							{ label: "Tiêu đề", value: selected.title },
							{ label: "Liên hệ", value: selected.contactName },
							{ label: "Số điện thoại", value: selected.phone },
							{ label: "Bắt đầu", value: formatDate(selected.startAt) },
							{
								label: "Kết thúc",
								value: selected.endAt ? formatDate(selected.endAt) : null,
							},
							{
								label: "Trạng thái",
								value: (
									<RecordQuickEdit
										kind="appointment"
										field="status"
										id={selected.id}
										shopId={ctx.shopId}
										value={selected.status}
										options={APPOINTMENT_STATUSES}
										disabled={!appointments.canWrite}
									/>
								),
							},
							{
								label: "Phân công",
								value: (
									<RecordQuickEdit
										kind="appointment"
										field="assigneeId"
										id={selected.id}
										shopId={ctx.shopId}
										value={selected.assigneeId}
										options={staff}
										disabled={!appointments.canWrite}
									/>
								),
							},
							{ label: "Kênh", value: selected.source },
							{ label: "Ghi chú", value: selected.note || null },
						]}
					/>
				</OrderDetailSheet>
			) : null}
		</ShopPage>
	);
}
