import { randomUUID } from "node:crypto";
import { type Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopManager,
	assertShopWriter,
	assertWorkspaceAdmin,
	canWrite,
	clearShopGrantsCache,
	orderScope,
	PancakeAccessError,
	type ShopGrant,
	shopGrants,
} from "./access";
import { writeAudit } from "./admin";
import {
	ORDER_VIEWS,
	PANCAKE,
	RESOURCES,
	shopTimezone,
	spendSince,
} from "./config";
import {
	type approveEmployeeInput,
	type createAppointmentInput,
	type createLeadInput,
	type createNoteInput,
	type createTicketInput,
	customerWire,
	employeeWire,
	type Grouping,
	type ListInput,
	orderWire,
	productWire,
	type RecordListInput,
	type ReportInput,
	type roleInput,
	sourceDate,
	type updateAppointmentInput,
	type updateLeadInput,
	type updateTicketInput,
} from "./contracts";
import { phoneTail } from "./phone";

export function splitList(raw?: string): string[] {
	return [
		...new Set(
			(raw ?? "")
				.split(",")
				.map((value) => value.trim())
				.filter((value) => value && value !== PANCAKE.anyValue),
		),
	];
}

function inList<T>(raw: string | undefined, clause: (values: string[]) => T) {
	const values = splitList(raw);
	return values.length ? clause(values) : {};
}

function inListOrNone<T, N>(
	raw: string | undefined,
	clause: (values: string[]) => T,
	none: N,
) {
	const values = splitList(raw);
	const named = values.filter((value) => value !== PANCAKE.unassignedValue);
	const clauses: (T | N)[] = [];
	if (named.length) clauses.push(clause(named));
	if (named.length < values.length) clauses.push(none);
	return clauses.length ? { OR: clauses } : {};
}

function dateRange(
	from?: string,
	to?: string,
): Prisma.DateTimeFilter | undefined {
	if (!from && !to) return undefined;
	return {
		gte: from ? new Date(from) : undefined,
		lt: to ? new Date(to) : undefined,
	};
}

export function zonedDay(instant: Date, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(instant);
}

export function zonedMidnight(day: string, timeZone: string): Date {
	const guess = new Date(`${day}T00:00:00Z`);
	const parts = new Map(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		})
			.formatToParts(guess)
			.map((part) => [part.type, Number(part.value)]),
	);
	const local = Date.UTC(
		parts.get("year") ?? 0,
		(parts.get("month") ?? 1) - 1,
		parts.get("day") ?? 1,
		parts.get("hour") ?? 0,
		parts.get("minute") ?? 0,
		parts.get("second") ?? 0,
	);
	return new Date(guess.getTime() - (local - guess.getTime()));
}

function weekStart(now: Date, timeZone: string): Date {
	const today = zonedDay(now, timeZone);
	const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
	const monday = new Date(
		Date.parse(`${today}T00:00:00Z`) - ((weekday + 6) % 7) * PANCAKE.dayMs,
	);
	return zonedMidnight(monday.toISOString().slice(0, 10), timeZone);
}

export function fillDays<T>(
	buckets: Map<string, T>,
	range: { from?: string; to?: string },
	now: Date,
	timeZone: string,
	empty: (day: string) => T,
): T[] {
	const known = [...buckets.keys()].sort();
	const start = range.from
		? zonedDay(new Date(range.from), timeZone)
		: known[0];
	if (!start) return [];
	const endAt = Math.min(
		range.to ? Date.parse(range.to) : now.getTime(),
		now.getTime(),
	);
	const end = Date.parse(
		`${zonedDay(new Date(endAt - 1), timeZone)}T00:00:00Z`,
	);
	const days: string[] = [];
	for (
		let at = Date.parse(`${start}T00:00:00Z`);
		at <= end;
		at += PANCAKE.dayMs
	)
		days.push(new Date(at).toISOString().slice(0, 10));
	return [...new Set([...days, ...known])]
		.sort()
		.map((day) => buckets.get(day) ?? empty(day));
}

export function bucketStart(day: string, grouping: Grouping): string {
	if (grouping === "month") return `${day.slice(0, 7)}-01`;
	if (grouping === "day") return day;
	const at = Date.parse(`${day}T00:00:00Z`);
	const weekday = new Date(at).getUTCDay();
	return new Date(at - ((weekday + 6) % 7) * PANCAKE.dayMs)
		.toISOString()
		.slice(0, 10);
}

export function groupSeries<T extends { date: string }>(
	days: T[],
	grouping: Grouping,
	add: (into: T, row: T) => T,
): T[] {
	const buckets = new Map<string, T>();
	for (const row of days) {
		const date = bucketStart(row.date, grouping);
		const current = buckets.get(date);
		buckets.set(date, current ? add(current, row) : { ...row, date });
	}
	return [...buckets.values()];
}

function bookedWhere(): Prisma.PancakeOrderWhereInput {
	return { status: { notIn: [...PANCAKE.bookedExcludedStatuses] } };
}

function recentSpendWhere(now: Date): Prisma.PancakeOrderWhereInput {
	return { ...bookedWhere(), sourceCreatedAt: { gte: spendSince(now) } };
}

async function creatorUserIds(
	db: Db,
	shopId: string,
	raw?: string,
): Promise<string[]> {
	const values = splitList(raw);
	if (!values.length) return [];
	const members = await db.pancakeShopMember.findMany({
		where: { shopId, employeeId: { in: values } },
		select: { userId: true },
	});
	return [...new Set([...values, ...members.map((m) => m.userId)])];
}

function parseEmployeeMeta(raw: Prisma.JsonValue | null) {
	const parsed = employeeWire.safeParse(raw);
	if (!parsed.success) {
		return {
			avatarUrl: null,
			phone: null,
			fbId: null,
			department: null,
			roleCode: null,
			profileId: null,
		};
	}
	return {
		avatarUrl: parsed.data.user.avatar_url ?? null,
		phone: parsed.data.user.phone_number ?? null,
		fbId: parsed.data.user.fb_id ?? null,
		department: parsed.data.department?.name ?? null,
		roleCode: parsed.data.role ?? null,
		profileId: parsed.data.profile_id ?? null,
	};
}

export function filteredOrders(
	scope: Prisma.PancakeOrderWhereInput,
	input: ListInput,
): Prisma.PancakeOrderWhereInput {
	const filters: Prisma.PancakeOrderWhereInput = {
		status: input.status,
		sourceCreatedAt: dateRange(input.from, input.to),
		OR: input.q
			? [
					{ orderId: { contains: input.q } },
					{ customerName: { contains: input.q, mode: "insensitive" } },
					{ customerPhone: { contains: input.q } },
					{ trackingCode: { contains: input.q } },
				]
			: undefined,
	};
	const view = ORDER_VIEWS[input.view];
	return {
		AND: [
			scope,
			filters,
			inListOrNone(input.sellerId, (ids) => ({ sellerId: { in: ids } }), {
				sellerId: null,
			}),
			input.view === "unassigned"
				? { sellerId: null }
				: view.statuses.length
					? { status: { in: [...view.statuses] } }
					: {},
		],
	};
}

function orderSort(
	input: ListInput,
): Prisma.PancakeOrderOrderByWithRelationInput[] {
	return [
		input.sort === "updated"
			? { sourceUpdatedAt: "desc" }
			: { sourceCreatedAt: input.sort === "oldest" ? "asc" : "desc" },
		{ shopId: "asc" },
		{ orderId: "asc" },
	];
}

const orderSelect = {
	shopId: true,
	orderId: true,
	customerId: true,
	customerName: true,
	customerPhone: true,
	sellerId: true,
	sellerName: true,
	status: true,
	subStatus: true,
	currency: true,
	totalPrice: true,
	trackingCode: true,
	deliveryStatus: true,
	returnReason: true,
	sourceCreatedAt: true,
	sourceUpdatedAt: true,
} as const;

export async function listOrders(db: Db, userId: string, input: ListInput) {
	const scope = orderScope(await shopGrants(db, userId), input.shopId);
	const where = filteredOrders(scope, input);
	const [rows, total] = await Promise.all([
		db.pancakeOrder.findMany({
			where,
			select: { ...orderSelect, raw: true },
			orderBy: orderSort(input),
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeOrder.count({ where }),
	]);
	const sellerIds = [
		...new Set(rows.flatMap((row) => (row.sellerId ? [row.sellerId] : []))),
	];
	const shopIds = [...new Set(rows.map((row) => row.shopId))];
	const sellers = sellerIds.length
		? await db.pancakeEmployee.findMany({
				where: {
					shopId: { in: shopIds },
					employeeId: { in: sellerIds },
				},
				select: { shopId: true, employeeId: true, raw: true },
			})
		: [];
	const sellerAvatars = new Map(
		sellers.map((s) => [
			`${s.shopId}:${s.employeeId}`,
			parseEmployeeMeta(s.raw).avatarUrl,
		]),
	);
	return {
		rows: rows.map(({ raw, ...row }) => {
			const parsed = orderWire.safeParse(raw);
			const itemsSummary = parsed.success
				? parsed.data.items
						.map(
							(item) =>
								`${item.variation_info?.name ?? item.product_id ?? item.variation_id ?? "Sản phẩm"} x${item.quantity}`,
						)
						.join(", ")
				: "";
			const discount =
				parsed.success && parsed.data.total_discount
					? String(parsed.data.total_discount)
					: "0";
			const source = parsed.success
				? (parsed.data.order_sources_name ??
					parsed.data.page?.name ??
					parsed.data.ads_source ??
					null)
				: null;
			const note = parsed.success ? (parsed.data.note ?? null) : null;
			return {
				...row,
				totalPrice: row.totalPrice.toString(),
				sourceCreatedAt: row.sourceCreatedAt.toISOString(),
				sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
				itemsSummary,
				discount,
				source,
				note,
				sellerAvatarUrl: row.sellerId
					? (sellerAvatars.get(`${row.shopId}:${row.sellerId}`) ?? null)
					: null,
			};
		}),
		total,
	};
}

export async function orderDetail(
	db: Db,
	userId: string,
	shopId: string,
	orderId: string,
) {
	const grants = await shopGrants(db, userId);
	const scope = orderScope(grants, shopId);
	const row = await db.pancakeOrder.findFirst({
		where: { AND: [scope, { shopId, orderId }] },
		include: { history: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] } },
	});
	if (!row) throw new PancakeAccessError();
	const incoming = orderWire.parse(row.raw);
	const returns = await db.pancakeReturn.findMany({
		where: { shopId, orderId },
		select: {
			returnId: true,
			status: true,
			returnedFee: true,
			sourceUpdatedAt: true,
		},
	});
	const actorIds = row.history.flatMap((event) =>
		event.actorId ? [event.actorId] : [],
	);
	const actors = await db.pancakeEmployee.findMany({
		where: { shopId, employeeId: { in: actorIds } },
		select: { employeeId: true, name: true },
	});
	const actorNames = new Map(actors.map((a) => [a.employeeId, a.name]));
	return {
		shopId,
		orderId,
		canCreateTask: canWrite(grants, shopId),
		customerId: row.customerId,
		customerName: row.customerName,
		shippingHistory: (incoming.partner?.extend_update ?? []).map((event) => ({
			key: event.key ?? null,
			status: event.status ?? null,
			trackingId: event.tracking_id ?? null,
			note: event.note ?? null,
			updatedAt: event.update_at
				? sourceDate(event.update_at).toISOString()
				: null,
		})),
		items: incoming.items.map((item, position) => ({
			lineNumber: position + 1,
			variationId: item.variation_id ?? null,
			productId: item.product_id ?? null,
			name:
				item.variation_info?.name ??
				item.product_id ??
				item.variation_id ??
				null,
			quantity: item.quantity,
			returnedCount: item.returned_count ?? 0,
		})),
		history: row.history.map((event) => ({
			id: event.id,
			status: event.status,
			oldStatus: event.oldStatus,
			subStatus: event.subStatus,
			deliveryStatus: event.deliveryStatus,
			trackingCode: event.trackingCode,
			actorName: event.actorId ? (actorNames.get(event.actorId) ?? null) : null,
			occurredAt: event.occurredAt.toISOString(),
			source: event.source,
		})),
		returns: returns.map((entry) => ({
			...entry,
			returnedFee: entry.returnedFee?.toString() ?? null,
			sourceUpdatedAt: entry.sourceUpdatedAt.toISOString(),
		})),
	};
}

function spendAmounts(
	groups: readonly {
		currency: string;
		_sum: { totalPrice: Prisma.Decimal | null };
	}[],
) {
	return groups.map((g) => ({
		currency: g.currency,
		amount: g._sum.totalPrice?.toString() ?? "0",
	}));
}

export function customerScope(
	grants: ShopGrant[],
	shopId?: string,
): Prisma.PancakeCustomerWhereInput {
	orderScope(grants, shopId);
	const selected = shopId
		? grants.filter((grant) => grant.shopId === shopId)
		: grants;
	return {
		OR: selected.map((grant) =>
			grant.role === "TELESALE"
				? {
						shopId: grant.shopId,
						OR: [
							{ assignedEmployeeId: grant.employeeId ?? "__unmapped__" },
							{
								orders: {
									some: { sellerId: grant.employeeId ?? "__unmapped__" },
								},
							},
						],
					}
				: { shopId: grant.shopId },
		),
	};
}

export async function listCustomers(db: Db, userId: string, input: ListInput) {
	const grants = await shopGrants(db, userId);
	const oScope = orderScope(grants, input.shopId);
	const selected = input.shopId
		? grants.filter((grant) => grant.shopId === input.shopId)
		: grants;
	const created = dateRange(input.from, input.to);
	const now = new Date();
	const where: Prisma.PancakeCustomerWhereInput = {
		AND: [
			customerScope(grants, input.shopId),
			inListOrNone(
				input.sellerId,
				(ids) => ({ assignedEmployeeId: { in: ids } }),
				{ assignedEmployeeId: null },
			),
			input.q
				? {
						OR: [
							{ name: { contains: input.q, mode: "insensitive" } },
							{ phone: { contains: input.q } },
							{ email: { contains: input.q, mode: "insensitive" } },
						],
					}
				: {},
		],
	};
	const [rows, total, orderStats, repeatGroups] = await Promise.all([
		db.pancakeCustomer.findMany({
			where,
			select: {
				shopId: true,
				customerId: true,
				name: true,
				phone: true,
				email: true,
				assignedEmployeeId: true,
				sourceUpdatedAt: true,
				fetchedAt: true,
				raw: true,
			},
			orderBy: [
				{ sourceUpdatedAt: "desc" },
				{ name: "asc" },
				{ customerId: "asc" },
			],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeCustomer.count({ where }),
		db.pancakeOrder.groupBy({
			by: ["currency"],
			where: { AND: [oScope, recentSpendWhere(now)] },
			_sum: { totalPrice: true },
		}),
		db.pancakeOrder.groupBy({
			by: ["customerPhone"],
			where: {
				AND: [
					oScope,
					{ customerPhone: { not: null } },
					created ? { sourceCreatedAt: created } : {},
				],
			},
			_count: { _all: true },
		}),
	]);
	const staff = await db.pancakeEmployee.findMany({
		where: {
			shopId: { in: selected.map((grant) => grant.shopId) },
			employeeId: {
				in: rows.flatMap((r) =>
					r.assignedEmployeeId ? [r.assignedEmployeeId] : [],
				),
			},
		},
		select: { shopId: true, employeeId: true, name: true, raw: true },
	});
	const staffMap = new Map(
		staff.map((s) => [
			`${s.shopId}:${s.employeeId}`,
			{ name: s.name, avatarUrl: parseEmployeeMeta(s.raw).avatarUrl },
		]),
	);
	const customerIds = rows.map((r) => r.customerId);
	const customerOrders: Prisma.PancakeOrderWhereInput = {
		AND: [oScope, { customerId: { in: customerIds } }],
	};
	const [countGroups, spendGroups] = customerIds.length
		? await Promise.all([
				db.pancakeOrder.groupBy({
					by: ["shopId", "customerId"],
					where: { AND: [customerOrders, bookedWhere()] },
					_count: { _all: true },
				}),
				db.pancakeOrder.groupBy({
					by: ["shopId", "customerId", "currency"],
					where: { AND: [customerOrders, recentSpendWhere(now)] },
					_sum: { totalPrice: true },
				}),
			])
		: [[], []];
	const orderCounts = new Map(
		countGroups.map((g) => [`${g.shopId}:${g.customerId}`, g._count._all]),
	);
	const spentByCustomer = new Map<string, ReturnType<typeof spendAmounts>>();
	for (const g of spendGroups) {
		const key = `${g.shopId}:${g.customerId}`;
		spentByCustomer.set(key, [
			...(spentByCustomer.get(key) ?? []),
			...spendAmounts([g]),
		]);
	}
	const buyersWithPhone = repeatGroups.length;
	const returningBuyers = repeatGroups.filter((g) => g._count._all > 1).length;
	const returningRate = buyersWithPhone
		? Number(((100 * returningBuyers) / buyersWithPhone).toFixed(1))
		: 0;
	const currency = input.shopId
		? (PANCAKE.shopCurrency.get(input.shopId) ?? PANCAKE.defaultCurrency)
		: PANCAKE.defaultCurrency;
	return {
		rows: rows.map(
			({ assignedEmployeeId, raw, sourceUpdatedAt, fetchedAt, ...row }) => {
				const parsed = customerWire.safeParse(raw);
				const emp = assignedEmployeeId
					? staffMap.get(`${row.shopId}:${assignedEmployeeId}`)
					: undefined;
				const key = `${row.shopId}:${row.customerId}`;
				const orderCount = orderCounts.get(key) ?? 0;
				const purchasedAmounts = spentByCustomer.get(key) ?? [];
				const source = parsed.success
					? (parsed.data.pages_customers?.[0]?.platform ??
						parsed.data.pages_customers?.[0]?.name ??
						null)
					: null;
				const birthday = parsed.success
					? (parsed.data.date_of_birth ?? null)
					: null;
				const gender = parsed.success ? (parsed.data.gender ?? null) : null;
				const tags = parsed.success ? (parsed.data.tags ?? []) : [];
				const address = parsed.success
					? (parsed.data.shop_customer_addresses?.[0]?.full_address ??
						parsed.data.shop_customer_addresses?.[0]?.address ??
						null)
					: null;
				const conversationLink = parsed.success
					? (parsed.data.conversation_link ?? null)
					: null;
				const createdAt = (
					parsed.success && parsed.data.inserted_at
						? sourceDate(parsed.data.inserted_at)
						: (sourceUpdatedAt ?? fetchedAt)
				).toISOString();
				return {
					...row,
					assignedEmployeeId,
					assignedEmployeeName: emp?.name ?? null,
					assignedEmployeeAvatarUrl: emp?.avatarUrl ?? null,
					source,
					birthday,
					gender,
					tags,
					address,
					orderCount,
					purchasedAmounts,
					conversationLink,
					createdAt,
				};
			},
		),
		total,
		summary: {
			newContacts: total,
			totalSpent: spendAmounts(orderStats),
			spendWindowDays: PANCAKE.spendWindowDays,
			returningRate,
			currency,
		},
	};
}

export async function customerDetail(
	db: Db,
	userId: string,
	shopId: string,
	customerId: string,
) {
	const grants = await shopGrants(db, userId);
	const scope = orderScope(grants, shopId);
	const customer = await db.pancakeCustomer.findUnique({
		where: { shopId_customerId: { shopId, customerId } },
	});
	if (!customer) throw new PancakeAccessError();
	const parsed = customerWire.safeParse(customer.raw);
	const employee = customer.assignedEmployeeId
		? await db.pancakeEmployee.findUnique({
				where: {
					shopId_employeeId: {
						shopId,
						employeeId: customer.assignedEmployeeId,
					},
				},
				select: { employeeId: true, name: true, raw: true },
			})
		: null;
	const tail = phoneTail(customer.phone, PANCAKE.shopDialCode.get(shopId));
	const personWhere: Prisma.PancakeOrderWhereInput = tail
		? { OR: [{ customerId }, { customerPhone: { endsWith: tail } }] }
		: { customerId };
	const personOrders: Prisma.PancakeOrderWhereInput = {
		AND: [scope, { shopId }, personWhere],
	};
	const now = new Date();
	const [orders, notes, appointments, tickets, statusCounts, recent] =
		await Promise.all([
			db.pancakeOrder.findMany({
				where: personOrders,
				select: { ...orderSelect, raw: true },
				orderBy: [{ sourceCreatedAt: "desc" }, { orderId: "desc" }],
				take: 50,
			}),
			db.pancakeNote.findMany({
				where: { shopId, customerId },
				orderBy: { createdAt: "desc" },
				take: 50,
			}),
			db.pancakeAppointment.findMany({
				where: { shopId, customerId },
				orderBy: { startAt: "desc" },
				take: 50,
			}),
			db.pancakeTicket.findMany({
				where: { shopId, customerId },
				orderBy: { createdAt: "desc" },
				take: 50,
			}),
			db.pancakeOrder.groupBy({
				by: ["status"],
				where: personOrders,
				_count: { _all: true },
			}),
			db.pancakeOrder.groupBy({
				by: ["currency"],
				where: { AND: [personOrders, recentSpendWhere(now)] },
				_sum: { totalPrice: true },
				_count: { _all: true },
			}),
		]);
	const orderIds = orders.map((o) => o.orderId);
	const tasks = orderIds.length
		? await db.pancakeTask.findMany({
				where: { shopId, orderId: { in: orderIds } },
				include: { assignee: { select: { id: true, name: true } } },
				orderBy: { dueAt: "asc" },
			})
		: [];
	const countStatuses = (statuses: readonly number[], include: boolean) =>
		statusCounts.reduce(
			(sum, row) =>
				statuses.includes(row.status) === include ? sum + row._count._all : sum,
			0,
		);
	const orderCount = countStatuses(PANCAKE.bookedExcludedStatuses, false);
	const deliveredCount = countStatuses(PANCAKE.receivedStatuses, true);
	const empMeta = employee ? parseEmployeeMeta(employee.raw) : null;
	const currency =
		orders[0]?.currency ??
		PANCAKE.shopCurrency.get(shopId) ??
		PANCAKE.defaultCurrency;
	return {
		shopId,
		customerId: customer.customerId,
		name: customer.name,
		phone: customer.phone,
		email: customer.email,
		assignedEmployeeId: customer.assignedEmployeeId,
		assignedEmployeeName: employee?.name ?? null,
		assignedEmployeeAvatarUrl: empMeta?.avatarUrl ?? null,
		birthday: parsed.success ? (parsed.data.date_of_birth ?? null) : null,
		gender: parsed.success ? (parsed.data.gender ?? null) : null,
		tags: parsed.success ? (parsed.data.tags ?? []) : [],
		source: parsed.success
			? (parsed.data.pages_customers?.[0]?.platform ??
				parsed.data.pages_customers?.[0]?.name ??
				null)
			: null,
		address: parsed.success
			? (parsed.data.shop_customer_addresses?.[0]?.full_address ??
				parsed.data.shop_customer_addresses?.[0]?.address ??
				null)
			: null,
		conversationLink: parsed.success
			? (parsed.data.conversation_link ?? null)
			: null,
		createdAt: (parsed.success && parsed.data.inserted_at
			? sourceDate(parsed.data.inserted_at)
			: (customer.sourceUpdatedAt ?? customer.fetchedAt)
		).toISOString(),
		updatedAt: (customer.sourceUpdatedAt ?? customer.fetchedAt).toISOString(),
		canWrite: canWrite(grants, shopId),
		orderCount,
		deliveredCount,
		totalSpent: spendAmounts(recent),
		recentOrderCount: recent.reduce((sum, g) => sum + g._count._all, 0),
		spendWindowDays: PANCAKE.spendWindowDays,
		currency,
		orders: orders.map(({ raw, ...ord }) => {
			const p = orderWire.safeParse(raw);
			return {
				...ord,
				totalPrice: ord.totalPrice.toString(),
				sourceCreatedAt: ord.sourceCreatedAt.toISOString(),
				sourceUpdatedAt: ord.sourceUpdatedAt.toISOString(),
				itemsSummary: p.success
					? p.data.items
							.map(
								(item) =>
									`${item.variation_info?.name ?? item.product_id ?? "SP"} x${item.quantity}`,
							)
							.join(", ")
					: "",
			};
		}),
		notes: notes.map((n) => ({
			...n,
			createdAt: n.createdAt.toISOString(),
		})),
		appointments: appointments.map((a) => ({
			...a,
			startAt: a.startAt.toISOString(),
			endAt: a.endAt?.toISOString() ?? null,
			createdAt: a.createdAt.toISOString(),
		})),
		tickets: tickets.map((t) => ({
			...t,
			dueAt: t.dueAt?.toISOString() ?? null,
			createdAt: t.createdAt.toISOString(),
		})),
		tasks: tasks.map((t) => ({
			id: t.id,
			orderId: t.orderId,
			title: t.title,
			note: t.note,
			status: t.status,
			dueAt: t.dueAt.toISOString(),
			assigneeName: t.assignee.name,
		})),
	};
}

export async function customerPurchases(
	db: Db,
	userId: string,
	shopId: string,
	customerId: string,
	input: ListInput,
) {
	const grants = await shopGrants(db, userId);
	const scope = orderScope(grants, shopId);
	const grant = grants.find((item) => item.shopId === shopId);
	const customer = await db.pancakeCustomer.findUnique({
		where: { shopId_customerId: { shopId, customerId } },
		select: { name: true, phone: true, assignedEmployeeId: true },
	});
	if (!customer) throw new PancakeAccessError();
	if (
		grant?.role === "TELESALE" &&
		customer.assignedEmployeeId !== grant.employeeId &&
		!(await db.pancakeOrder.count({ where: { AND: [scope, { customerId }] } }))
	)
		throw new PancakeAccessError();
	const tail = phoneTail(customer.phone, PANCAKE.shopDialCode.get(shopId));
	const person = tail ? { customerPhone: { endsWith: tail } } : { customerId };
	const where = filteredOrders({ AND: [scope, person] }, { ...input, shopId });
	const [rows, total] = await Promise.all([
		db.pancakeOrder.findMany({
			where,
			select: orderSelect,
			orderBy: orderSort(input),
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeOrder.count({ where }),
	]);
	return {
		customer: { name: customer.name, phone: customer.phone },
		total,
		rows: rows.map((row) => ({
			...row,
			totalPrice: row.totalPrice.toString(),
			sourceCreatedAt: row.sourceCreatedAt.toISOString(),
			sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
		})),
	};
}

export async function listProducts(db: Db, userId: string, input: ListInput) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const where: Prisma.PancakeProductWhereInput = {
		shopId: input.shopId ?? { in: grants.map((grant) => grant.shopId) },
		OR: input.q
			? [
					{ name: { contains: input.q, mode: "insensitive" } },
					{ sku: { contains: input.q } },
					{ productId: { contains: input.q } },
				]
			: undefined,
	};
	const [rows, total] = await Promise.all([
		db.pancakeProduct.findMany({
			where,
			select: {
				shopId: true,
				productId: true,
				variationId: true,
				name: true,
				sku: true,
				price: true,
				stock: true,
				hidden: true,
				raw: true,
			},
			orderBy: [{ name: "asc" }, { variationId: "asc" }],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeProduct.count({ where }),
	]);
	return {
		rows: rows.map(({ raw, ...row }) => {
			const parsed = productWire.safeParse(raw);
			const images = parsed.success
				? (parsed.data.images?.filter(Boolean) ??
					(parsed.data.product.image ? [parsed.data.product.image] : []))
				: [];
			const imageUrl = images[0] ?? null;
			const description = parsed.success
				? (parsed.data.product.note_product ?? null)
				: null;
			const categories = parsed.success
				? (parsed.data.product.categories ?? []).flatMap((c) =>
						c.name ? [c.name] : [],
					)
				: [];
			return {
				...row,
				price: row.price?.toString() ?? null,
				stock: row.stock?.toString() ?? null,
				imageUrl,
				images,
				description,
				categories,
			};
		}),
		total,
	};
}

export async function revenueReport(db: Db, userId: string, input: ListInput) {
	const scope = orderScope(await shopGrants(db, userId), input.shopId);
	const where = filteredOrders(scope, input);
	const groups = await db.pancakeOrder.groupBy({
		by: ["shopId", "sellerId", "sellerName", "currency", "status"],
		where,
		_count: { _all: true },
		_sum: { totalPrice: true },
	});
	return groups.map((group) => ({
		shopId: group.shopId,
		sellerId: group.sellerId,
		sellerName: group.sellerName,
		currency: group.currency,
		status: group.status,
		orders: group._count._all,
		productValue: group._sum.totalPrice?.toString() ?? "0",
	}));
}

export async function operationsOverview(
	db: Db,
	userId: string,
	input: ListInput,
) {
	const scope = orderScope(await shopGrants(db, userId), input.shopId);
	const where = filteredOrders(scope, input);
	const [statuses, unassigned, overdue, recent] = await Promise.all([
		db.pancakeOrder.groupBy({ by: ["status"], where, _count: { _all: true } }),
		db.pancakeOrder.count({ where: { AND: [where, { sellerId: null }] } }),
		db.pancakeTask.count({
			where: { order: scope, status: "OPEN", dueAt: { lt: new Date() } },
		}),
		db.pancakeOrder.findMany({
			where,
			select: orderSelect,
			orderBy: [
				{ sourceUpdatedAt: "desc" },
				{ shopId: "asc" },
				{ orderId: "asc" },
			],
			take: PANCAKE.overviewRows,
		}),
	]);
	const total = (values: readonly number[]) =>
		statuses.reduce(
			(sum, row) => sum + (values.includes(row.status) ? row._count._all : 0),
			0,
		);
	return {
		orders: statuses.reduce((sum, row) => sum + row._count._all, 0),
		pending: total(ORDER_VIEWS.pending.statuses),
		shipping: total(ORDER_VIEWS.shipping.statuses),
		returns: total(ORDER_VIEWS.returns.statuses),
		unassigned,
		overdue,
		statuses: statuses.map((row) => ({
			status: row.status,
			count: row._count._all,
		})),
		recent: recent.map((row) => ({
			...row,
			totalPrice: row.totalPrice.toString(),
			sourceCreatedAt: row.sourceCreatedAt.toISOString(),
			sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
		})),
	};
}

export async function sellerOptions(db: Db, userId: string, shopId?: string) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, shopId);
	const rows = await db.pancakeEmployee.findMany({
		where: {
			OR: grants
				.filter((grant) => !shopId || grant.shopId === shopId)
				.map((grant) => ({
					shopId: grant.shopId,
					employeeId:
						grant.role === "TELESALE"
							? (grant.employeeId ?? "__unmapped__")
							: undefined,
				})),
		},
		select: {
			shopId: true,
			employeeId: true,
			name: true,
			email: true,
			raw: true,
		},
		orderBy: [{ name: "asc" }, { shopId: "asc" }, { employeeId: "asc" }],
	});
	return rows.map(({ raw, ...row }) => ({
		...row,
		...parseEmployeeMeta(raw),
	}));
}

const dailyRow = z.object({
	day: z.string(),
	orders: z.number(),
	delivered: z.number(),
	revenue: z.number(),
	received: z.number(),
});

export function orderSqlWhere(
	grants: ShopGrant[],
	input: ListInput,
): Prisma.Sql {
	const selected = input.shopId
		? grants.filter((grant) => grant.shopId === input.shopId)
		: grants;
	const scope = selected.length
		? Prisma.join(
				selected.map((grant) =>
					grant.role === "TELESALE"
						? Prisma.sql`(o."shopId" = ${grant.shopId} AND o."sellerId" = ${grant.employeeId ?? "__unmapped__"})`
						: Prisma.sql`o."shopId" = ${grant.shopId}`,
				),
				" OR ",
			)
		: Prisma.sql`FALSE`;
	const clauses = [Prisma.sql`(${scope})`];
	if (input.status !== undefined)
		clauses.push(Prisma.sql`o.status = ${input.status}`);
	if (input.from)
		clauses.push(
			Prisma.sql`o."sourceCreatedAt" >= (${input.from}::timestamptz AT TIME ZONE 'UTC')`,
		);
	if (input.to)
		clauses.push(
			Prisma.sql`o."sourceCreatedAt" < (${input.to}::timestamptz AT TIME ZONE 'UTC')`,
		);
	const sellers = splitList(input.sellerId);
	const namedSellers = sellers.filter(
		(value) => value !== PANCAKE.unassignedValue,
	);
	const sellerClauses = [
		...(namedSellers.length
			? [Prisma.sql`o."sellerId" IN (${Prisma.join(namedSellers)})`]
			: []),
		...(namedSellers.length < sellers.length
			? [Prisma.sql`o."sellerId" IS NULL`]
			: []),
	];
	if (sellerClauses.length)
		clauses.push(Prisma.sql`(${Prisma.join(sellerClauses, " OR ")})`);
	const view = ORDER_VIEWS[input.view];
	if (input.view === "unassigned")
		clauses.push(Prisma.sql`o."sellerId" IS NULL`);
	else if (view.statuses.length)
		clauses.push(Prisma.sql`o.status IN (${Prisma.join([...view.statuses])})`);
	if (input.q) {
		const like = `%${input.q}%`;
		clauses.push(
			Prisma.sql`(o."orderId" LIKE ${like} OR o."customerName" ILIKE ${like} OR o."customerPhone" LIKE ${like} OR o."trackingCode" LIKE ${like})`,
		);
	}
	return Prisma.join(clauses, " AND ");
}

async function dailyOrderSeries(
	db: Db,
	grants: ShopGrant[],
	input: ListInput,
	now: Date,
	currency: string,
) {
	const received = Prisma.join([...PANCAKE.receivedStatuses]);
	const excluded = Prisma.join([...PANCAKE.bookedExcludedStatuses]);
	const timeZone = shopTimezone(input.shopId);
	const rows = z.array(dailyRow).parse(
		await db.$queryRaw`
			SELECT to_char((o."sourceCreatedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day,
				count(*)::float8 AS orders,
				(count(*) FILTER (WHERE o.status IN (${received})))::float8 AS delivered,
				COALESCE(sum(o."totalPrice") FILTER (WHERE o.currency = ${currency} AND o.status NOT IN (${excluded})), 0)::float8 AS revenue,
				COALESCE(sum(o."totalPrice") FILTER (WHERE o.currency = ${currency} AND o.status IN (${received})), 0)::float8 AS received
			FROM "pancakeOrder" o
			WHERE ${orderSqlWhere(grants, input)}
			GROUP BY 1
			ORDER BY 1`,
	);
	return fillDays(
		new Map(rows.map(({ day, ...row }) => [day, { date: day, ...row }])),
		input,
		now,
		timeZone,
		(day) => ({ date: day, orders: 0, delivered: 0, revenue: 0, received: 0 }),
	);
}

function addAmount(
	totals: Map<string, Prisma.Decimal>,
	currency: string,
	amount: string,
) {
	totals.set(
		currency,
		(totals.get(currency) ?? new Prisma.Decimal(0)).add(amount),
	);
}

function amounts(totals: Map<string, Prisma.Decimal>) {
	return [...totals].map(([currency, amount]) => ({
		currency,
		amount: amount.toString(),
	}));
}

export async function dashboardReport(
	db: Db,
	userId: string,
	input: ListInput & { grouping?: Grouping },
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const now = new Date();
	const [groups, employees] = await Promise.all([
		revenueReport(db, userId, input),
		db.pancakeEmployee.findMany({
			where: {
				shopId: input.shopId ?? { in: grants.map((g) => g.shopId) },
			},
			select: { shopId: true, employeeId: true, raw: true },
		}),
	]);
	const avatarMap = new Map(
		employees.map((e) => [
			`${e.shopId}:${e.employeeId}`,
			parseEmployeeMeta(e.raw).avatarUrl,
		]),
	);
	const performance = new Map<
		string,
		{
			shopId: string;
			sellerId: string | null;
			sellerName: string;
			sellerAvatarUrl: string | null;
			currency: string;
			orders: number;
			delivered: number;
			cancelled: number;
			returned: number;
			revenue: Prisma.Decimal;
			received: Prisma.Decimal;
		}
	>();
	const booked = new Map<string, Prisma.Decimal>();
	const bookedOrders = new Map<string, number>();
	const collected = new Map<string, Prisma.Decimal>();
	let orders = 0;
	let delivered = 0;
	let cancelled = 0;
	let returned = 0;
	for (const group of groups) {
		orders += group.orders;
		const isReceived = PANCAKE.receivedStatuses.includes(group.status);
		const isBooked = !PANCAKE.bookedExcludedStatuses.includes(group.status);
		const isCancelled = PANCAKE.cancelledStatuses.includes(group.status);
		const isReturned = PANCAKE.returnedStatuses.includes(group.status);
		if (isReceived) {
			delivered += group.orders;
			addAmount(collected, group.currency, group.productValue);
		}
		if (isBooked) {
			addAmount(booked, group.currency, group.productValue);
			bookedOrders.set(
				group.currency,
				(bookedOrders.get(group.currency) ?? 0) + group.orders,
			);
		}
		if (isCancelled) cancelled += group.orders;
		if (isReturned) returned += group.orders;
		const key = JSON.stringify([group.shopId, group.sellerId, group.currency]);
		const row = performance.get(key) ?? {
			shopId: group.shopId,
			sellerId: group.sellerId,
			sellerName: group.sellerName ?? "Chưa phân công",
			sellerAvatarUrl: group.sellerId
				? (avatarMap.get(`${group.shopId}:${group.sellerId}`) ?? null)
				: null,
			currency: group.currency,
			orders: 0,
			delivered: 0,
			cancelled: 0,
			returned: 0,
			revenue: new Prisma.Decimal(0),
			received: new Prisma.Decimal(0),
		};
		row.orders += group.orders;
		if (isReceived) {
			row.delivered += group.orders;
			row.received = row.received.add(group.productValue);
		}
		if (isBooked) row.revenue = row.revenue.add(group.productValue);
		if (isCancelled) row.cancelled += group.orders;
		if (isReturned) row.returned += group.orders;
		performance.set(key, row);
	}
	const seriesCurrency =
		[...booked].sort((a, b) => b[1].comparedTo(a[1]))[0]?.[0] ??
		PANCAKE.shopCurrency.get(input.shopId ?? "") ??
		PANCAKE.defaultCurrency;
	const dailySeries = await dailyOrderSeries(
		db,
		grants,
		input,
		now,
		seriesCurrency,
	);
	const grouping = input.grouping ?? "day";
	return {
		orders,
		delivered,
		cancelled,
		returned,
		grouping,
		series: groupSeries(dailySeries, grouping, (into, row) => ({
			date: into.date,
			orders: into.orders + row.orders,
			delivered: into.delivered + row.delivered,
			revenue: into.revenue + row.revenue,
			received: into.received + row.received,
		})),
		timezone: shopTimezone(input.shopId),
		revenue: amounts(booked),
		receivedRevenue: amounts(collected),
		averageOrderValue: [...booked].map(([currency, amount]) => ({
			currency,
			amount: amount.div(bookedOrders.get(currency) || 1).toString(),
		})),
		seriesCurrency,
		dailySeries,
		performance: [...performance.values()].map((row) => ({
			...row,
			revenue: row.revenue.toString(),
			received: row.received.toString(),
			deliveredRate: row.orders
				? `${((100 * row.delivered) / row.orders).toFixed(1)}%`
				: "0%",
		})),
	};
}

export async function connectionStatus(db: Db, userId: string) {
	const grants = await shopGrants(db, userId);
	const shops = await db.pancakeShop.findMany({
		where: { id: { in: grants.map((grant) => grant.shopId) } },
		select: {
			id: true,
			name: true,
			enabled: true,
			lastSyncAt: true,
			lastWebhookAt: true,
			lastError: true,
			liveApprovedAt: true,
			fixtureVerifiedAt: true,
			cursors: {
				select: {
					resource: true,
					phase: true,
					nextPage: true,
					watermark: true,
				},
			},
			_count: {
				select: {
					webhooks: { where: { status: "dead" } },
					orders: true,
					customers: true,
					employees: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});
	return shops.map((shop) => ({
		...shop,
		currency: PANCAKE.shopCurrency.get(shop.id) ?? PANCAKE.defaultCurrency,
		ordersCount: shop._count.orders,
		customersCount: shop._count.customers,
		employeesCount: shop._count.employees,
		syncEnabled: process.env.PANCAKE_LIVE_SYNC_ENABLED === "1" && shop.enabled,
		historyComplete: RESOURCES.every((resource) =>
			shop.cursors.some(
				(cursor) =>
					cursor.resource === resource &&
					cursor.phase !== "history" &&
					cursor.watermark !== null,
			),
		),
		lastSyncAt: shop.lastSyncAt?.toISOString() ?? null,
		lastWebhookAt: shop.lastWebhookAt?.toISOString() ?? null,
		liveApprovedAt: shop.liveApprovedAt?.toISOString() ?? null,
		fixtureVerifiedAt: shop.fixtureVerifiedAt?.toISOString() ?? null,
		canManage:
			grants.find((grant) => grant.shopId === shop.id)?.role === "MANAGER",
		cursors: shop.cursors.map((cursor) => ({
			...cursor,
			watermark: cursor.watermark?.toISOString() ?? null,
		})),
		deadWebhooks: shop._count.webhooks,
	}));
}

export async function setMembership(
	db: Db,
	userId: string,
	input: z.infer<typeof roleInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	if (
		!(await db.member.findUnique({
			where: {
				organizationId_userId: {
					organizationId: "workspace",
					userId: input.userId,
				},
			},
		}))
	)
		throw new PancakeAccessError();
	if (
		input.employeeId &&
		!(await db.pancakeEmployee.findUnique({
			where: {
				shopId_employeeId: {
					shopId: input.shopId,
					employeeId: input.employeeId,
				},
			},
		}))
	)
		throw new PancakeAccessError();
	const result = await db.pancakeShopMember.upsert({
		where: { shopId_userId: { shopId: input.shopId, userId: input.userId } },
		create: {
			shopId: input.shopId,
			userId: input.userId,
			role: input.role,
			employeeId: input.employeeId ?? null,
		},
		update: { role: input.role, employeeId: input.employeeId ?? null },
		select: { shopId: true, userId: true, role: true, employeeId: true },
	});
	clearShopGrantsCache(input.userId);
	const target = await db.user.findUnique({
		where: { id: input.userId },
		select: { name: true },
	});
	await writeAudit(db, {
		shopId: input.shopId,
		userId,
		area: "permission",
		action: "membership",
		summary: `Đặt vai trò ${input.role} cho ${target?.name ?? input.userId}`,
	});
	return result;
}

export async function approveEmployee(
	db: Db,
	userId: string,
	input: z.infer<typeof approveEmployeeInput>,
) {
	await assertShopManager(db, userId, input.shopId);
	const emp = await db.pancakeEmployee.findUnique({
		where: {
			shopId_employeeId: {
				shopId: input.shopId,
				employeeId: input.employeeId,
			},
		},
	});
	if (!emp) throw new PancakeAccessError();
	const meta = parseEmployeeMeta(emp.raw);
	const email = (
		emp.email?.trim() || `pancake.${emp.employeeId}@pancake-crm.local`
	).toLowerCase();
	const existingUser = await db.user.findUnique({ where: { email } });
	const targetUser = existingUser
		? await db.user.update({
				where: { id: existingUser.id },
				data: {
					image: existingUser.image ?? meta.avatarUrl,
				},
			})
		: await db.user.create({
				data: {
					id: randomUUID(),
					name: emp.name,
					email,
					emailVerified: true,
					image: meta.avatarUrl,
				},
			});
	await db.member.upsert({
		where: {
			organizationId_userId: {
				organizationId: "workspace",
				userId: targetUser.id,
			},
		},
		create: {
			id: randomUUID(),
			organizationId: "workspace",
			userId: targetUser.id,
			role: "member",
			createdAt: new Date(),
		},
		update: {},
	});
	const result = await db.pancakeShopMember.upsert({
		where: {
			shopId_userId: { shopId: input.shopId, userId: targetUser.id },
		},
		create: {
			shopId: input.shopId,
			userId: targetUser.id,
			role: input.role,
			employeeId: emp.employeeId,
		},
		update: {
			role: input.role,
			employeeId: emp.employeeId,
		},
		select: { shopId: true, userId: true, role: true, employeeId: true },
	});
	clearShopGrantsCache(targetUser.id);
	await writeAudit(db, {
		shopId: input.shopId,
		userId,
		area: "permission",
		action: "approve",
		summary: `Duyệt nhân viên ${emp.name} với vai trò ${input.role}`,
	});
	return result;
}

export async function approveAllEmployees(
	db: Db,
	userId: string,
	shopId: string,
) {
	await assertShopManager(db, userId, shopId);
	const [employees, members] = await Promise.all([
		db.pancakeEmployee.findMany({ where: { shopId } }),
		db.pancakeShopMember.findMany({ where: { shopId } }),
	]);
	const mappedIds = new Set(
		members.flatMap((m) => (m.employeeId ? [m.employeeId] : [])),
	);
	let approved = 0;
	for (const emp of employees) {
		if (mappedIds.has(emp.employeeId)) continue;
		const meta = parseEmployeeMeta(emp.raw);
		const isManager = meta.roleCode === "1" || meta.roleCode === "2";
		await approveEmployee(db, userId, {
			shopId,
			employeeId: emp.employeeId,
			role: isManager ? "MANAGER" : "TELESALE",
		});
		approved += 1;
	}
	return { approved };
}

export async function pauseShop(db: Db, userId: string, shopId: string) {
	await assertWorkspaceAdmin(db, userId);
	await db.pancakeShop.update({
		where: { id: shopId },
		data: { enabled: false },
	});
	return { paused: true };
}

export async function resumeShop(db: Db, userId: string, shopId: string) {
	await assertWorkspaceAdmin(db, userId);
	await db.pancakeShop.update({
		where: { id: shopId },
		data: { enabled: true },
	});
	return { paused: false };
}

export async function membershipOptions(
	db: Db,
	userId: string,
	shopId: string,
) {
	await assertShopManager(db, userId, shopId);
	const [users, employees, members] = await Promise.all([
		db.user.findMany({
			where: { members: { some: { organizationId: "workspace" } } },
			select: { id: true, name: true, email: true, image: true },
			orderBy: { name: "asc" },
		}),
		db.pancakeEmployee.findMany({
			where: { shopId },
			select: { employeeId: true, name: true, email: true, raw: true },
			orderBy: { name: "asc" },
		}),
		db.pancakeShopMember.findMany({
			where: { shopId },
			select: { userId: true, role: true, employeeId: true },
		}),
	]);
	return {
		users,
		employees: employees.map(({ raw, ...emp }) => ({
			...emp,
			...parseEmployeeMeta(raw),
		})),
		members,
	};
}

const leadFields = z.record(z.string(), z.string()).catch({});

export function leadRow<
	T extends { fields: Prisma.JsonValue; createdAt: Date; updatedAt: Date },
>(row: T) {
	return {
		...row,
		fields: leadFields.parse(row.fields),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function appointmentRow<
	T extends {
		startAt: Date;
		endAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	},
>(row: T) {
	return {
		...row,
		startAt: row.startAt.toISOString(),
		endAt: row.endAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function ticketRow<
	T extends { dueAt: Date | null; createdAt: Date; updatedAt: Date },
>(row: T) {
	return {
		...row,
		dueAt: row.dueAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function nullableDate(value: string | null | undefined) {
	return value === undefined ? undefined : value ? new Date(value) : null;
}

function nullableText(value: string | null | undefined) {
	return value === undefined ? undefined : value || null;
}

async function contactNameFor(
	db: Db,
	shopId: string,
	input: { customerId?: string; contactName?: string },
) {
	if (input.contactName || !input.customerId) return input.contactName ?? null;
	const customer = await db.pancakeCustomer.findUnique({
		where: { shopId_customerId: { shopId, customerId: input.customerId } },
		select: { name: true },
	});
	return customer?.name ?? null;
}

function ownedRecords(
	grants: ShopGrant[],
	shopId: string,
	userId: string,
	assigneeId: string | null | undefined,
) {
	const grant = grants.find((item) => item.shopId === shopId);
	if (grant?.role !== "TELESALE") return {};
	if (assigneeId && assigneeId !== grant.employeeId)
		throw new PancakeAccessError();
	return {
		OR: [
			{ createdById: userId },
			...(grant.employeeId ? [{ assigneeId: grant.employeeId }] : []),
		],
	};
}

function overdueTicket(now: Date): Prisma.PancakeTicketWhereInput {
	return {
		dueAt: { lt: now },
		status: { notIn: [...PANCAKE.ticketDoneStatuses] },
	};
}

async function recordAccess(db: Db, userId: string, input: RecordListInput) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const creators = await creatorUserIds(db, input.shopId, input.creatorId);
	return {
		grants,
		writable: canWrite(grants, input.shopId),
		creator: creators.length ? { createdById: { in: creators } } : {},
	};
}

export async function listLeads(
	db: Db,
	userId: string,
	input: RecordListInput,
) {
	const { grants, writable, creator } = await recordAccess(db, userId, input);
	const now = new Date();
	const employeeId = grants.find(
		(grant) => grant.shopId === input.shopId,
	)?.employeeId;
	const mine: Prisma.PancakeLeadWhereInput = {
		OR: [
			{ createdById: userId },
			...(employeeId ? [{ assigneeId: employeeId }] : []),
		],
	};
	const quick: Prisma.PancakeLeadWhereInput =
		input.quick === "mine-new"
			? { AND: [mine, { status: "new" }] }
			: input.quick === "mine-week"
				? {
						AND: [
							mine,
							{
								createdAt: { gte: weekStart(now, shopTimezone(input.shopId)) },
							},
						],
					}
				: {};
	const where: Prisma.PancakeLeadWhereInput = {
		AND: [
			{ shopId: input.shopId, createdAt: dateRange(input.from, input.to) },
			inList(input.status, (ids) => ({ status: { in: ids } })),
			inListOrNone(input.assigneeId, (ids) => ({ assigneeId: { in: ids } }), {
				assigneeId: null,
			}),
			inListOrNone(input.source, (ids) => ({ source: { in: ids } }), {
				source: null,
			}),
			creator,
			quick,
			input.q
				? {
						OR: [
							{ name: { contains: input.q, mode: "insensitive" } },
							{ phone: { contains: input.q } },
							{ email: { contains: input.q, mode: "insensitive" } },
						],
					}
				: {},
		],
	};
	const [rows, total] = await Promise.all([
		db.pancakeLead.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeLead.count({ where }),
	]);
	return { total, canWrite: writable, rows: rows.map(leadRow) };
}

export async function createLead(
	db: Db,
	userId: string,
	input: z.infer<typeof createLeadInput>,
) {
	await assertShopWriter(db, userId, input.shopId);
	const row = await db.pancakeLead.create({
		data: {
			shopId: input.shopId,
			name: input.name,
			phone: input.phone ?? null,
			email: input.email ?? null,
			assigneeId: input.assigneeId ?? null,
			status: input.status,
			source: input.source ?? null,
			note: input.note,
			fields: input.fields,
			createdById: userId,
		},
	});
	return leadRow(row);
}

export async function updateLead(
	db: Db,
	userId: string,
	input: z.infer<typeof updateLeadInput>,
) {
	const grants = await assertShopWriter(db, userId, input.shopId);
	const { count } = await db.pancakeLead.updateMany({
		where: {
			id: input.id,
			shopId: input.shopId,
			...ownedRecords(grants, input.shopId, userId, input.assigneeId),
		},
		data: {
			status: input.status,
			assigneeId: nullableText(input.assigneeId),
		},
	});
	if (!count) throw new PancakeAccessError();
	return leadRow(
		await db.pancakeLead.findUniqueOrThrow({ where: { id: input.id } }),
	);
}

export async function listAppointments(
	db: Db,
	userId: string,
	input: RecordListInput,
) {
	const { writable, creator } = await recordAccess(db, userId, input);
	const where: Prisma.PancakeAppointmentWhereInput = {
		AND: [
			{
				shopId: input.shopId,
				id: input.id || undefined,
				customerId: input.customerId || undefined,
				startAt: dateRange(input.from, input.to),
			},
			inList(input.status, (ids) => ({ status: { in: ids } })),
			inListOrNone(input.assigneeId, (ids) => ({ assigneeId: { in: ids } }), {
				assigneeId: null,
			}),
			inListOrNone(input.source, (ids) => ({ source: { in: ids } }), {
				source: null,
			}),
			creator,
			input.q
				? {
						OR: [
							{ title: { contains: input.q, mode: "insensitive" } },
							{ contactName: { contains: input.q, mode: "insensitive" } },
							{ phone: { contains: input.q } },
						],
					}
				: {},
		],
	};
	const [rows, total] = await Promise.all([
		db.pancakeAppointment.findMany({
			where,
			orderBy: { startAt: "desc" },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeAppointment.count({ where }),
	]);
	return { total, canWrite: writable, rows: rows.map(appointmentRow) };
}

export async function createAppointment(
	db: Db,
	userId: string,
	input: z.infer<typeof createAppointmentInput>,
) {
	await assertShopWriter(db, userId, input.shopId);
	const row = await db.pancakeAppointment.create({
		data: {
			shopId: input.shopId,
			title: input.title,
			customerId: input.customerId ?? null,
			contactName: await contactNameFor(db, input.shopId, input),
			phone: input.phone ?? null,
			startAt: new Date(input.startAt),
			endAt: input.endAt ? new Date(input.endAt) : null,
			status: input.status,
			assigneeId: input.assigneeId ?? null,
			source: input.source ?? null,
			location: input.location ?? null,
			note: input.note,
			createdById: userId,
		},
	});
	return appointmentRow(row);
}

export async function updateAppointment(
	db: Db,
	userId: string,
	input: z.infer<typeof updateAppointmentInput>,
) {
	const grants = await assertShopWriter(db, userId, input.shopId);
	const { count } = await db.pancakeAppointment.updateMany({
		where: {
			id: input.id,
			shopId: input.shopId,
			...ownedRecords(grants, input.shopId, userId, input.assigneeId),
		},
		data: {
			title: input.title,
			note: input.note,
			status: input.status,
			startAt: input.startAt ? new Date(input.startAt) : undefined,
			endAt: nullableDate(input.endAt),
			assigneeId: nullableText(input.assigneeId),
		},
	});
	if (!count) throw new PancakeAccessError();
	return appointmentRow(
		await db.pancakeAppointment.findUniqueOrThrow({ where: { id: input.id } }),
	);
}

export async function listTickets(
	db: Db,
	userId: string,
	input: RecordListInput,
) {
	const { writable, creator } = await recordAccess(db, userId, input);
	const where: Prisma.PancakeTicketWhereInput = {
		AND: [
			{
				shopId: input.shopId,
				id: input.id || undefined,
				customerId: input.customerId || undefined,
				createdAt: dateRange(input.from, input.to),
			},
			inList(input.status, (ids) => ({ status: { in: ids } })),
			inList(input.priority, (ids) => ({ priority: { in: ids } })),
			inListOrNone(input.category, (ids) => ({ category: { in: ids } }), {
				category: null,
			}),
			inListOrNone(input.assigneeId, (ids) => ({ assigneeId: { in: ids } }), {
				assigneeId: null,
			}),
			inListOrNone(input.source, (ids) => ({ source: { in: ids } }), {
				source: null,
			}),
			creator,
			input.quick === "overdue" ? overdueTicket(new Date()) : {},
			input.q
				? {
						OR: [
							{ title: { contains: input.q, mode: "insensitive" } },
							{ contactName: { contains: input.q, mode: "insensitive" } },
							{ phone: { contains: input.q } },
							{ orderId: { contains: input.q } },
						],
					}
				: {},
		],
	};
	const [rows, total] = await Promise.all([
		db.pancakeTicket.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeTicket.count({ where }),
	]);
	return { total, canWrite: writable, rows: rows.map(ticketRow) };
}

export async function createTicket(
	db: Db,
	userId: string,
	input: z.infer<typeof createTicketInput>,
) {
	await assertShopWriter(db, userId, input.shopId);
	const row = await db.pancakeTicket.create({
		data: {
			shopId: input.shopId,
			title: input.title,
			customerId: input.customerId ?? null,
			contactName: await contactNameFor(db, input.shopId, input),
			phone: input.phone ?? null,
			email: input.email ?? null,
			orderId: input.orderId ?? null,
			category: input.category ?? null,
			priority: input.priority,
			status: input.status,
			assigneeId: input.assigneeId ?? null,
			dueAt: input.dueAt ? new Date(input.dueAt) : null,
			source: input.source ?? null,
			description: input.description,
			createdById: userId,
		},
	});
	return ticketRow(row);
}

export async function updateTicket(
	db: Db,
	userId: string,
	input: z.infer<typeof updateTicketInput>,
) {
	const grants = await assertShopWriter(db, userId, input.shopId);
	const { count } = await db.pancakeTicket.updateMany({
		where: {
			id: input.id,
			shopId: input.shopId,
			...ownedRecords(grants, input.shopId, userId, input.assigneeId),
		},
		data: {
			status: input.status,
			priority: input.priority,
			category: nullableText(input.category),
			assigneeId: nullableText(input.assigneeId),
			dueAt: nullableDate(input.dueAt),
		},
	});
	if (!count) throw new PancakeAccessError();
	return ticketRow(
		await db.pancakeTicket.findUniqueOrThrow({ where: { id: input.id } }),
	);
}

export async function createNote(
	db: Db,
	userId: string,
	input: z.infer<typeof createNoteInput>,
) {
	await assertShopWriter(db, userId, input.shopId);
	const author = await db.user.findUnique({
		where: { id: userId },
		select: { name: true },
	});
	const row = await db.pancakeNote.create({
		data: {
			shopId: input.shopId,
			customerId: input.customerId,
			content: input.content,
			createdById: userId,
			authorName: author?.name ?? "Nhân viên",
		},
	});
	return {
		...row,
		createdAt: row.createdAt.toISOString(),
	};
}

function percent(part: number, whole: number): number {
	return whole ? Number(((100 * part) / whole).toFixed(1)) : 0;
}

function countBy<K extends string>(
	groups: ({ _count: { _all: number } } & Record<K, string | null>)[],
	key: K,
) {
	const counts = new Map<string | null, number>();
	for (const group of groups)
		counts.set(group[key], (counts.get(group[key]) ?? 0) + group._count._all);
	return [...counts]
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count);
}

async function reportAccess(db: Db, userId: string, input: ReportInput) {
	orderScope(await shopGrants(db, userId), input.shopId);
}

export async function appointmentReport(
	db: Db,
	userId: string,
	input: ReportInput,
) {
	await reportAccess(db, userId, input);
	const where: Prisma.PancakeAppointmentWhereInput = {
		shopId: input.shopId,
		startAt: dateRange(input.from, input.to),
	};
	const [groups, sources] = await Promise.all([
		db.pancakeAppointment.groupBy({
			by: ["assigneeId", "status"],
			where,
			_count: { _all: true },
		}),
		db.pancakeAppointment.groupBy({
			by: ["source"],
			where,
			_count: { _all: true },
		}),
	]);
	const done = (status: string) =>
		PANCAKE.appointmentDoneStatuses.includes(status);
	const cancelled = (status: string) =>
		PANCAKE.appointmentCancelledStatuses.includes(status);
	const assignees = new Map<
		string | null,
		{
			assigneeId: string | null;
			assigned: number;
			completed: number;
			cancelled: number;
		}
	>();
	let total = 0;
	let completed = 0;
	let cancelledCount = 0;
	for (const group of groups) {
		const count = group._count._all;
		const row = assignees.get(group.assigneeId) ?? {
			assigneeId: group.assigneeId,
			assigned: 0,
			completed: 0,
			cancelled: 0,
		};
		row.assigned += count;
		total += count;
		if (done(group.status)) {
			row.completed += count;
			completed += count;
		}
		if (cancelled(group.status)) {
			row.cancelled += count;
			cancelledCount += count;
		}
		assignees.set(group.assigneeId, row);
	}
	return {
		total,
		completed,
		cancelled: cancelledCount,
		completionRate: percent(completed, total),
		byStatus: countBy(groups, "status").map(({ value, count }) => ({
			status: value ?? "",
			count,
		})),
		bySource: countBy(sources, "source").map(({ value, count }) => ({
			source: value,
			count,
		})),
		byAssignee: [...assignees.values()].map((row) => ({
			...row,
			completionRate: percent(row.completed, row.assigned),
		})),
	};
}

const ticketMonthRow = z.object({
	month: z.string(),
	total: z.number(),
	completed: z.number(),
	completedWithDue: z.number(),
	onTime: z.number(),
});

export async function ticketReport(db: Db, userId: string, input: ReportInput) {
	await reportAccess(db, userId, input);
	const now = new Date();
	const where: Prisma.PancakeTicketWhereInput = {
		shopId: input.shopId,
		createdAt: dateRange(input.from, input.to),
	};
	const doneStatuses = Prisma.join([...PANCAKE.ticketDoneStatuses]);
	const range = [
		Prisma.sql`t."shopId" = ${input.shopId}`,
		...(input.from
			? [
					Prisma.sql`t."createdAt" >= (${input.from}::timestamptz AT TIME ZONE 'UTC')`,
				]
			: []),
		...(input.to
			? [
					Prisma.sql`t."createdAt" < (${input.to}::timestamptz AT TIME ZONE 'UTC')`,
				]
			: []),
	];
	const [statuses, priorities, categories, sources, overdue, monthRows] =
		await Promise.all([
			db.pancakeTicket.groupBy({
				by: ["status"],
				where,
				_count: { _all: true },
			}),
			db.pancakeTicket.groupBy({
				by: ["priority"],
				where,
				_count: { _all: true },
			}),
			db.pancakeTicket.groupBy({
				by: ["category"],
				where,
				_count: { _all: true },
			}),
			db.pancakeTicket.groupBy({
				by: ["source"],
				where,
				_count: { _all: true },
			}),
			db.pancakeTicket.count({ where: { AND: [where, overdueTicket(now)] } }),
			db.$queryRaw`
				SELECT to_char((t."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${shopTimezone(input.shopId)}, 'YYYY-MM') AS month,
					count(*)::float8 AS total,
					(count(*) FILTER (WHERE t.status IN (${doneStatuses})))::float8 AS "completed",
					(count(*) FILTER (WHERE t.status IN (${doneStatuses}) AND t."dueAt" IS NOT NULL))::float8 AS "completedWithDue",
					(count(*) FILTER (WHERE t.status IN (${doneStatuses}) AND t."dueAt" IS NOT NULL AND t."updatedAt" <= t."dueAt"))::float8 AS "onTime"
				FROM "pancakeTicket" t
				WHERE ${Prisma.join(range, " AND ")}
				GROUP BY 1
				ORDER BY 1`,
		]);
	const monthly = z.array(ticketMonthRow).parse(monthRows);
	const total = statuses.reduce((sum, row) => sum + row._count._all, 0);
	const completed = statuses.reduce(
		(sum, row) =>
			PANCAKE.ticketDoneStatuses.includes(row.status)
				? sum + row._count._all
				: sum,
		0,
	);
	const withDue = monthly.reduce((sum, row) => sum + row.completedWithDue, 0);
	const onTime = monthly.reduce((sum, row) => sum + row.onTime, 0);
	return {
		total,
		open: total - completed,
		overdue,
		completed,
		onTimeRate: percent(onTime, withDue),
		byStatus: countBy(statuses, "status").map(({ value, count }) => ({
			status: value ?? "",
			count,
		})),
		byPriority: countBy(priorities, "priority").map(({ value, count }) => ({
			priority: value ?? "",
			count,
		})),
		byCategory: countBy(categories, "category").map(({ value, count }) => ({
			category: value,
			count,
		})),
		bySource: countBy(sources, "source").map(({ value, count }) => ({
			source: value,
			count,
		})),
		monthly: monthly.map(({ month, total, completed }) => ({
			month,
			total,
			completed,
		})),
	};
}

export async function leadReport(db: Db, userId: string, input: ReportInput) {
	await reportAccess(db, userId, input);
	const statuses = await db.pancakeLead.groupBy({
		by: ["status"],
		where: { shopId: input.shopId, createdAt: dateRange(input.from, input.to) },
		_count: { _all: true },
	});
	return {
		total: statuses.reduce((sum, row) => sum + row._count._all, 0),
		byStatus: countBy(statuses, "status").map(({ value, count }) => ({
			status: value ?? "",
			count,
		})),
	};
}
