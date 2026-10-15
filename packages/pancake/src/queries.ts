import { type Db, Prisma } from "@crm/db";
import type { z } from "zod";
import {
	assertShopManager,
	assertWorkspaceAdmin,
	orderScope,
	PancakeAccessError,
	shopGrants,
} from "./access";
import { ORDER_VIEWS, PANCAKE, RESOURCES } from "./config";
import {
	type ListInput,
	orderWire,
	type roleInput,
	sourceDate,
} from "./contracts";
import { phoneTail } from "./phone";

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
			select: orderSelect,
			orderBy: orderSort(input),
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeOrder.count({ where }),
	]);
	return {
		rows: rows.map((row) => ({
			...row,
			totalPrice: row.totalPrice.toString(),
			sourceCreatedAt: row.sourceCreatedAt.toISOString(),
			sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
		})),
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
	orderScope(grants, input.shopId);
	const selected = input.shopId
		? grants.filter((grant) => grant.shopId === input.shopId)
		: grants;
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
	const [rows, total] = await db.$transaction([
		db.pancakeCustomer.findMany({
			where,
			select: {
				shopId: true,
				customerId: true,
				name: true,
				phone: true,
				email: true,
				assignedEmployeeId: true,
			},
			orderBy: [{ name: "asc" }, { customerId: "asc" }],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeCustomer.count({ where }),
	]);
	const staff = await db.pancakeEmployee.findMany({
		where: {
			shopId: { in: selected.map((grant) => grant.shopId) },
			employeeId: { in: rows.flatMap((r) => r.assignedEmployeeId ?? []) },
		},
		select: { shopId: true, employeeId: true, name: true },
	});
	const names = new Map(
		staff.map((s) => [`${s.shopId}:${s.employeeId}`, s.name]),
	);
	return {
		rows: rows.map(({ assignedEmployeeId, ...row }) => ({
			...row,
			assignedEmployeeName: assignedEmployeeId
				? (names.get(`${row.shopId}:${assignedEmployeeId}`) ?? null)
				: null,
		})),
		total,
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
	// Names collide; phone numbers do not. Match on the national number so
	// 0553409828 and 971553409828 are one person; fall back to the id.
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
			},
			orderBy: [{ name: "asc" }, { variationId: "asc" }],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
		db.pancakeProduct.count({ where }),
	]);
	return {
		rows: rows.map((row) => ({
			...row,
			price: row.price?.toString() ?? null,
			stock: row.stock?.toString() ?? null,
		})),
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
	return db.pancakeEmployee.findMany({
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
		select: { shopId: true, employeeId: true, name: true },
		orderBy: [{ name: "asc" }, { shopId: "asc" }, { employeeId: "asc" }],
	});
}

export async function dashboardReport(
	db: Db,
	userId: string,
	input: ListInput,
) {
	const groups = await revenueReport(db, userId, input);
	const performance = new Map<
		string,
		{
			shopId: string;
			sellerId: string | null;
			sellerName: string;
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
	return {
		orders,
		delivered,
		cancelled,
		returned,
		revenue: [...currencies].map(([currency, amount]) => ({
			currency,
			amount: amount.toString(),
		})),
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
			_count: { select: { webhooks: { where: { status: "dead" } } } },
		},
		orderBy: { name: "asc" },
	});
	return shops.map((shop) => ({
		...shop,
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
			select: { id: true, name: true, email: true },
			orderBy: { name: "asc" },
		}),
		db.pancakeEmployee.findMany({
			where: { shopId },
			select: { employeeId: true, name: true },
			orderBy: { name: "asc" },
		}),
		db.pancakeShopMember.findMany({
			where: { shopId },
			select: { userId: true, role: true, employeeId: true },
		}),
	]);
	return { users, employees, members };
}
