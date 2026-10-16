import { randomUUID } from "node:crypto";
import { type Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopManager,
	assertWorkspaceAdmin,
	orderScope,
	PancakeAccessError,
	shopGrants,
} from "./access";
import { ORDER_VIEWS, PANCAKE, RESOURCES } from "./config";
import {
	type approveEmployeeInput,
	type createAppointmentInput,
	type createLeadInput,
	type createNoteInput,
	type createTicketInput,
	customerWire,
	employeeWire,
	type ListInput,
	orderWire,
	productWire,
	type RecordListInput,
	type roleInput,
	sourceDate,
} from "./contracts";
import { phoneTail } from "./phone";

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
	const created: Prisma.DateTimeFilter = {};
	if (input.from) created.gte = new Date(input.from);
	if (input.to) created.lt = new Date(input.to);
	const filters: Prisma.PancakeOrderWhereInput = {
		status: input.status,
		sellerId: input.sellerId || undefined,
		sourceCreatedAt: input.from || input.to ? created : undefined,
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
	const [rows, total] = await db.$transaction([
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
		canCreateTask: grants.some(
			(grant) => grant.shopId === shopId && grant.role !== "VIEWER",
		),
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

export async function listCustomers(db: Db, userId: string, input: ListInput) {
	const grants = await shopGrants(db, userId);
	const oScope = orderScope(grants, input.shopId);
	const selected = input.shopId
		? grants.filter((grant) => grant.shopId === input.shopId)
		: grants;
	const createdFilter: Prisma.DateTimeFilter = {};
	if (input.from) createdFilter.gte = new Date(input.from);
	if (input.to) createdFilter.lt = new Date(input.to);
	const where: Prisma.PancakeCustomerWhereInput = {
		AND: [
			{
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
			},
			input.sellerId ? { assignedEmployeeId: input.sellerId } : {},
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
		db.pancakeOrder.aggregate({
			where: {
				AND: [
					oScope,
					{ status: { in: [3, 16] } },
					input.from || input.to ? { sourceCreatedAt: createdFilter } : {},
				],
			},
			_sum: { totalPrice: true },
			_count: { _all: true },
		}),
		db.pancakeOrder.groupBy({
			by: ["customerPhone"],
			where: {
				AND: [
					oScope,
					{ customerPhone: { not: null } },
					input.from || input.to ? { sourceCreatedAt: createdFilter } : {},
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
	const customerOrderGroups = customerIds.length
		? await db.pancakeOrder.groupBy({
				by: ["shopId", "customerId"],
				where: {
					shopId: { in: selected.map((grant) => grant.shopId) },
					customerId: { in: customerIds },
				},
				_count: { _all: true },
				_sum: { totalPrice: true },
			})
		: [];
	const orderCountsByCust = new Map(
		customerOrderGroups.map((g) => [
			`${g.shopId}:${g.customerId}`,
			{
				count: g._count._all,
				spent: g._sum.totalPrice?.toString() ?? "0",
			},
		]),
	);
	const buyersWithPhone = repeatGroups.length;
	const returningBuyers = repeatGroups.filter((g) => g._count._all > 1).length;
	const returningRate = buyersWithPhone
		? Number(((100 * returningBuyers) / buyersWithPhone).toFixed(1))
		: 0;
	const currency = input.shopId
		? (PANCAKE.shopCurrency.get(input.shopId) ?? "SAR")
		: "SAR";
	return {
		rows: rows.map(
			({ assignedEmployeeId, raw, sourceUpdatedAt, fetchedAt, ...row }) => {
				const parsed = customerWire.safeParse(raw);
				const emp = assignedEmployeeId
					? staffMap.get(`${row.shopId}:${assignedEmployeeId}`)
					: undefined;
				const ordAgg = orderCountsByCust.get(`${row.shopId}:${row.customerId}`);
				const rawOrderCount = parsed.success
					? (parsed.data.order_count ?? 0)
					: 0;
				const rawSpent = parsed.success
					? (parsed.data.purchased_amount ?? 0)
					: 0;
				const orderCount = Math.max(rawOrderCount, ordAgg?.count ?? 0);
				const purchasedAmount =
					Number(ordAgg?.spent ?? 0) > rawSpent
						? (ordAgg?.spent ?? "0")
						: String(rawSpent);
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
					purchasedAmount,
					conversationLink,
					createdAt,
				};
			},
		),
		total,
		summary: {
			newContacts: total,
			totalSpent: orderStats._sum.totalPrice?.toString() ?? "0",
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
	const [orders, notes, appointments, tickets] = await Promise.all([
		db.pancakeOrder.findMany({
			where: { AND: [scope, { shopId }, personWhere] },
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
	]);
	const orderIds = orders.map((o) => o.orderId);
	const tasks = orderIds.length
		? await db.pancakeTask.findMany({
				where: { shopId, orderId: { in: orderIds } },
				include: { assignee: { select: { id: true, name: true } } },
				orderBy: { dueAt: "asc" },
			})
		: [];
	let totalSpent = new Prisma.Decimal(0);
	let deliveredCount = 0;
	for (const ord of orders) {
		if ([3, 16].includes(ord.status)) {
			deliveredCount += 1;
			totalSpent = totalSpent.add(ord.totalPrice);
		}
	}
	const rawSpent = parsed.success ? (parsed.data.purchased_amount ?? 0) : 0;
	const spentStr =
		totalSpent.toNumber() > rawSpent ? totalSpent.toString() : String(rawSpent);
	const rawCount = parsed.success ? (parsed.data.order_count ?? 0) : 0;
	const orderCount = Math.max(orders.length, rawCount);
	const empMeta = employee ? parseEmployeeMeta(employee.raw) : null;
	const currency =
		orders[0]?.currency ?? PANCAKE.shopCurrency.get(shopId) ?? "SAR";
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
		orderCount,
		deliveredCount,
		totalSpent: spentStr,
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
	const [rows, total] = await db.$transaction([
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
	const [rows, total] = await db.$transaction([
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

export async function dashboardReport(
	db: Db,
	userId: string,
	input: ListInput,
) {
	const grants = await shopGrants(db, userId);
	const scope = orderScope(grants, input.shopId);
	const where = filteredOrders(scope, input);
	const [groups, orderDates, employees] = await Promise.all([
		revenueReport(db, userId, input),
		db.pancakeOrder.findMany({
			where,
			select: {
				sourceCreatedAt: true,
				status: true,
				totalPrice: true,
			},
			orderBy: { sourceCreatedAt: "asc" },
			take: 10000,
		}),
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
		}
	>();
	const currencies = new Map<string, Prisma.Decimal>();
	let orders = 0;
	let delivered = 0;
	let cancelled = 0;
	let returned = 0;
	for (const group of groups) {
		orders += group.orders;
		const received = [3, 16].includes(group.status);
		const cancelledStatus = [6, 7].includes(group.status);
		const returnedStatus = [4, 5, 15].includes(group.status);
		if (received) {
			delivered += group.orders;
			currencies.set(
				group.currency,
				(currencies.get(group.currency) ?? new Prisma.Decimal(0)).add(
					group.productValue,
				),
			);
		}
		if (cancelledStatus) cancelled += group.orders;
		if (returnedStatus) returned += group.orders;
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
		};
		row.orders += group.orders;
		if (received) {
			row.delivered += group.orders;
			row.revenue = row.revenue.add(group.productValue);
		}
		if (cancelledStatus) row.cancelled += group.orders;
		if (returnedStatus) row.returned += group.orders;
		performance.set(key, row);
	}
	const dailyMap = new Map<
		string,
		{ date: string; orders: number; delivered: number; revenue: number }
	>();
	for (const item of orderDates) {
		const day = item.sourceCreatedAt.toISOString().slice(0, 10);
		const bucket = dailyMap.get(day) ?? {
			date: day,
			orders: 0,
			delivered: 0,
			revenue: 0,
		};
		bucket.orders += 1;
		if ([3, 16].includes(item.status)) {
			bucket.delivered += 1;
			bucket.revenue += Number(item.totalPrice);
		}
		dailyMap.set(day, bucket);
	}
	return {
		orders,
		delivered,
		cancelled,
		returned,
		revenue: [...currencies].map(([currency, amount]) => ({
			currency,
			amount: amount.toString(),
		})),
		dailySeries: [...dailyMap.values()],
		performance: [...performance.values()].map((row) => ({
			...row,
			revenue: row.revenue.toString(),
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
		currency: PANCAKE.shopCurrency.get(shop.id) ?? "SAR",
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
	return db.pancakeShopMember.upsert({
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
	return db.pancakeShopMember.upsert({
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

export async function listLeads(
	db: Db,
	userId: string,
	input: RecordListInput,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const where: Prisma.PancakeLeadWhereInput = {
		shopId: input.shopId,
		status: input.status || undefined,
		assigneeId: input.assigneeId || undefined,
		OR: input.q
			? [
					{ name: { contains: input.q, mode: "insensitive" } },
					{ phone: { contains: input.q } },
					{ email: { contains: input.q, mode: "insensitive" } },
				]
			: undefined,
	};
	const [rows, total] = await db.$transaction([
		db.pancakeLead.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeLead.count({ where }),
	]);
	return {
		total,
		rows: rows.map((row) => ({
			...row,
			fields: z.record(z.string(), z.string()).catch({}).parse(row.fields),
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

export async function createLead(
	db: Db,
	userId: string,
	input: z.infer<typeof createLeadInput>,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
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
	return {
		...row,
		fields: z.record(z.string(), z.string()).catch({}).parse(row.fields),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function listAppointments(
	db: Db,
	userId: string,
	input: RecordListInput,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const startFilter: Prisma.DateTimeFilter = {};
	if (input.from) startFilter.gte = new Date(input.from);
	if (input.to) startFilter.lt = new Date(input.to);
	const where: Prisma.PancakeAppointmentWhereInput = {
		shopId: input.shopId,
		status: input.status || undefined,
		assigneeId: input.assigneeId || undefined,
		customerId: input.customerId || undefined,
		startAt: input.from || input.to ? startFilter : undefined,
		OR: input.q
			? [
					{ title: { contains: input.q, mode: "insensitive" } },
					{ contactName: { contains: input.q, mode: "insensitive" } },
					{ phone: { contains: input.q } },
				]
			: undefined,
	};
	const [rows, total] = await db.$transaction([
		db.pancakeAppointment.findMany({
			where,
			orderBy: { startAt: "desc" },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeAppointment.count({ where }),
	]);
	return {
		total,
		rows: rows.map((row) => ({
			...row,
			startAt: row.startAt.toISOString(),
			endAt: row.endAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

export async function createAppointment(
	db: Db,
	userId: string,
	input: z.infer<typeof createAppointmentInput>,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const row = await db.pancakeAppointment.create({
		data: {
			shopId: input.shopId,
			title: input.title,
			customerId: input.customerId ?? null,
			contactName: input.contactName ?? null,
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
	return {
		...row,
		startAt: row.startAt.toISOString(),
		endAt: row.endAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function listTickets(
	db: Db,
	userId: string,
	input: RecordListInput,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const where: Prisma.PancakeTicketWhereInput = {
		shopId: input.shopId,
		status: input.status || undefined,
		assigneeId: input.assigneeId || undefined,
		customerId: input.customerId || undefined,
		OR: input.q
			? [
					{ title: { contains: input.q, mode: "insensitive" } },
					{ contactName: { contains: input.q, mode: "insensitive" } },
					{ phone: { contains: input.q } },
					{ orderId: { contains: input.q } },
				]
			: undefined,
	};
	const [rows, total] = await db.$transaction([
		db.pancakeTicket.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeTicket.count({ where }),
	]);
	return {
		total,
		rows: rows.map((row) => ({
			...row,
			dueAt: row.dueAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

export async function createTicket(
	db: Db,
	userId: string,
	input: z.infer<typeof createTicketInput>,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
	const row = await db.pancakeTicket.create({
		data: {
			shopId: input.shopId,
			title: input.title,
			customerId: input.customerId ?? null,
			contactName: input.contactName ?? null,
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
	return {
		...row,
		dueAt: row.dueAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function createNote(
	db: Db,
	userId: string,
	input: z.infer<typeof createNoteInput>,
) {
	const grants = await shopGrants(db, userId);
	orderScope(grants, input.shopId);
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
