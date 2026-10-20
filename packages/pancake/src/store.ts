import { createHash } from "node:crypto";
import type { Db, Prisma } from "@crm/db";
import { z } from "zod";
import { PANCAKE, type Resource } from "./config";
import {
	customerWire,
	employeeWire,
	type IncomingOrder,
	isNewer,
	orderWire,
	productWire,
	returnWire,
	sourceDate,
} from "./contracts";

export async function storeRecord(
	tx: Prisma.TransactionClient,
	shopId: string,
	resource: Resource,
	value: Prisma.InputJsonValue,
	fetchedAt: Date,
): Promise<boolean> {
	if (resource === "customers") {
		const item = customerWire.parse(value);
		await entityLock(tx, shopId, resource, item.id);
		const key = { shopId_customerId: { shopId, customerId: item.id } };
		const current = await tx.pancakeCustomer.findUnique({ where: key });
		const updated = item.updated_at ? sourceDate(item.updated_at) : null;
		if (!isNewer(current, updated, fetchedAt)) return false;
		const data = {
			name: item.name ?? "Khách hàng",
			phone: item.phone_numbers?.[0] ?? null,
			email: item.emails?.[0] ?? null,
			assignedEmployeeId: item.assigned_user_id ?? null,
			sourceCreatedAt: item.inserted_at ? sourceDate(item.inserted_at) : null,
			sourceUpdatedAt: updated,
			fetchedAt,
			raw: value,
		};
		await tx.pancakeCustomer.upsert({
			where: key,
			create: { shopId, customerId: item.id, ...data },
			update: data,
		});
		return true;
	}
	if (resource === "products") {
		const item = productWire.parse(value);
		await entityLock(tx, shopId, resource, item.id);
		const key = { shopId_variationId: { shopId, variationId: item.id } };
		const current = await tx.pancakeProduct.findUnique({ where: key });
		const updated = item.updated_at ? sourceDate(item.updated_at) : null;
		if (!isNewer(current, updated, fetchedAt)) return false;
		const data = {
			productId: item.product_id,
			name: item.product.name,
			sku: item.display_id ?? null,
			price: item.retail_price ?? null,
			stock: item.remain_quantity ?? null,
			hidden: item.is_hidden ?? false,
			sourceUpdatedAt: updated,
			fetchedAt,
			raw: value,
		};
		await tx.pancakeProduct.upsert({
			where: key,
			create: { shopId, variationId: item.id, ...data },
			update: data,
		});
		return true;
	}
	if (resource === "employees") {
		const item = employeeWire.parse(value);
		assertSourceShop(shopId, item.shop_id);
		await entityLock(tx, shopId, resource, item.user_id);
		const key = { shopId_employeeId: { shopId, employeeId: item.user_id } };
		const current = await tx.pancakeEmployee.findUnique({ where: key });
		if (!isNewer(current, null, fetchedAt)) return false;
		const data = {
			name: item.user.name,
			email: item.user.email ?? null,
			sourceUpdatedAt: null,
			fetchedAt,
			raw: value,
		};
		await tx.pancakeEmployee.upsert({
			where: key,
			create: { shopId, employeeId: item.user_id, ...data },
			update: data,
		});
		return true;
	}
	if (resource === "returns") {
		const item = returnWire.parse(value);
		assertSourceShop(shopId, item.shop_id);
		await entityLock(tx, shopId, resource, item.id);
		const key = { shopId_returnId: { shopId, returnId: item.id } };
		const current = await tx.pancakeReturn.findUnique({ where: key });
		const updated = sourceDate(item.updated_at);
		if (!isNewer(current, updated, fetchedAt)) return false;
		const data = {
			orderId: item.order_id_to_returned ?? item.order_id ?? null,
			status: item.status,
			returnedFee: item.returned_fee ?? null,
			sourceUpdatedAt: updated,
			fetchedAt,
			raw: value,
		};
		await tx.pancakeReturn.upsert({
			where: key,
			create: { shopId, returnId: item.id, ...data },
			update: data,
		});
		return true;
	}
	const prepared = prepareOrder(shopId, value, fetchedAt);
	await entityLock(tx, shopId, resource, prepared.orderId);
	const key = { shopId_orderId: { shopId, orderId: prepared.orderId } };
	const current = await tx.pancakeOrder.findUnique({ where: key });
	if (!isNewer(current, prepared.updated, fetchedAt)) return false;
	if (prepared.stub)
		await tx.pancakeCustomer.upsert({
			where: {
				shopId_customerId: { shopId, customerId: prepared.stub.customerId },
			},
			create: prepared.stub,
			update: {},
		});
	await tx.pancakeOrder.upsert({
		where: key,
		create: { shopId, orderId: prepared.orderId, ...prepared.data },
		update: prepared.data,
	});
	const history = orderHistory(shopId, prepared, current);
	if (history.length)
		await tx.pancakeOrderHistory.createMany({
			data: history,
			skipDuplicates: true,
		});
	return true;
}

type OrderCurrent = {
	status: number;
	subStatus: number | null;
	deliveryStatus: string | null;
	trackingCode: string | null;
	sourceUpdatedAt: Date | null;
	fetchedAt: Date;
};

function prepareOrder(
	shopId: string,
	value: Prisma.InputJsonValue,
	fetchedAt: Date,
) {
	const item = orderWire.parse(value);
	assertSourceShop(shopId, item.shop_id);
	const updated = sourceDate(item.updated_at);
	const deliveryStatus = shippingStatus(item);
	const currency =
		item.order_currency ?? PANCAKE.shopCurrency.get(shopId) ?? "VND";
	const data = {
		customerId: item.customer?.id ?? null,
		customerName:
			item.bill_full_name ?? item.customer?.name ?? "Khách vãng lai",
		customerPhone: item.bill_phone_number ?? null,
		sellerId: item.assigning_seller?.id ?? null,
		sellerName: item.assigning_seller?.name ?? null,
		careId: item.assigning_care?.id ?? null,
		creatorId: item.creator_id ?? item.creator?.id ?? null,
		lastEditorId: item.last_editor_id ?? null,
		status: item.status,
		subStatus: item.sub_status ?? null,
		currency,
		// Foreign-currency shops send amounts in minor units (x100); VND has none.
		totalPrice: (item.shipping_fee ?? 0) / (currency === "VND" ? 1 : 100),
		trackingCode: item.partner?.extend_code ?? null,
		trackingUrl: item.tracking_link ?? null,
		deliveryStatus,
		returnReason: item.returned_reason_name ?? null,
		sourceCreatedAt: sourceDate(item.inserted_at),
		sourceUpdatedAt: updated,
		fetchedAt,
		raw: compactOrderRaw(value),
	};
	const stub = item.customer
		? {
				shopId,
				customerId: item.customer.id,
				name: item.customer.name ?? item.bill_full_name ?? "Khách hàng",
				phone: item.bill_phone_number ?? null,
				fetchedAt: new Date(0),
				raw: {},
			}
		: null;
	return { item, orderId: item.id, updated, data, stub };
}

const rawObject = z.record(z.string(), z.json());

function compactOrderRaw(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
	const parsed = rawObject.safeParse(value);
	if (!parsed.success) return value;
	return Object.fromEntries(
		Object.entries(parsed.data).filter(
			([key]) => !PANCAKE.orderRawDrop.includes(key),
		),
	);
}

type PreparedOrder = ReturnType<typeof prepareOrder>;

function orderHistory(
	shopId: string,
	prepared: PreparedOrder,
	current: OrderCurrent | null,
): Prisma.PancakeOrderHistoryCreateManyInput[] {
	const { item, orderId, data, updated } = prepared;
	const history: Prisma.PancakeOrderHistoryCreateManyInput[] = [];
	for (const event of item.status_history ?? []) {
		const occurredAt = event.updated_at ?? event.inserted_at;
		if (!occurredAt) continue;
		history.push({
			shopId,
			orderId,
			eventKey: hash(
				`${event.status}:${event.old_status}:${occurredAt}:${event.editor_id ?? ""}`,
			),
			oldStatus: event.old_status ?? null,
			status: event.status,
			actorId: event.editor_id ?? null,
			occurredAt: sourceDate(occurredAt),
			source: "pancake-history",
		});
	}
	if (
		!current ||
		current.status !== data.status ||
		current.subStatus !== data.subStatus ||
		current.deliveryStatus !== data.deliveryStatus ||
		current.trackingCode !== data.trackingCode
	) {
		history.push({
			shopId,
			orderId,
			eventKey: hash(
				`snapshot:${item.updated_at}:${data.status}:${data.subStatus}:${data.deliveryStatus}:${data.trackingCode}`,
			),
			oldStatus: current?.status ?? null,
			status: data.status,
			subStatus: data.subStatus,
			deliveryStatus: data.deliveryStatus,
			trackingCode: data.trackingCode,
			actorId: data.lastEditorId,
			occurredAt: updated,
			source: "poll-snapshot",
		});
	}
	return history;
}

export async function storeOrders(
	tx: Prisma.TransactionClient,
	shopId: string,
	values: readonly Prisma.InputJsonValue[],
	fetchedAt: Date,
): Promise<number> {
	const byId = new Map<string, PreparedOrder>();
	for (const value of values) {
		const prepared = prepareOrder(shopId, value, fetchedAt);
		const previous = byId.get(prepared.orderId);
		if (
			!previous?.updated ||
			(prepared.updated && prepared.updated >= previous.updated)
		)
			byId.set(prepared.orderId, prepared);
	}
	if (!byId.size) return 0;
	await entityLock(tx, shopId, "orders", "page");
	const existing = new Map(
		(
			await tx.pancakeOrder.findMany({
				where: { shopId, orderId: { in: [...byId.keys()] } },
				select: {
					orderId: true,
					status: true,
					subStatus: true,
					deliveryStatus: true,
					trackingCode: true,
					sourceUpdatedAt: true,
					fetchedAt: true,
				},
			})
		).map((row) => [row.orderId, row] as const),
	);
	const todo = [...byId.values()].filter((prepared) =>
		isNewer(
			existing.get(prepared.orderId) ?? null,
			prepared.updated,
			fetchedAt,
		),
	);
	if (!todo.length) return 0;
	const stubs = new Map(
		todo.flatMap((prepared) =>
			prepared.stub ? [[prepared.stub.customerId, prepared.stub] as const] : [],
		),
	);
	if (stubs.size)
		await tx.pancakeCustomer.createMany({
			data: [...stubs.values()],
			skipDuplicates: true,
		});
	const fresh = todo.filter((prepared) => !existing.has(prepared.orderId));
	if (fresh.length)
		await tx.pancakeOrder.createMany({
			data: fresh.map((prepared) => ({
				shopId,
				orderId: prepared.orderId,
				...prepared.data,
			})),
			skipDuplicates: true,
		});
	for (const prepared of todo) {
		if (!existing.has(prepared.orderId)) continue;
		await tx.pancakeOrder.update({
			where: { shopId_orderId: { shopId, orderId: prepared.orderId } },
			data: prepared.data,
		});
	}
	const history = todo.flatMap((prepared) =>
		orderHistory(shopId, prepared, existing.get(prepared.orderId) ?? null),
	);
	if (history.length)
		await tx.pancakeOrderHistory.createMany({
			data: history,
			skipDuplicates: true,
		});
	return todo.length;
}

type Probe = { id: string; updated: Date | null };

function probe(resource: Resource, value: Prisma.InputJsonValue): Probe | null {
	try {
		if (resource === "orders") {
			const item = orderWire.parse(value);
			return { id: item.id, updated: sourceDate(item.updated_at) };
		}
		if (resource === "customers") {
			const item = customerWire.parse(value);
			return {
				id: item.id,
				updated: item.updated_at ? sourceDate(item.updated_at) : null,
			};
		}
	} catch {
		return null;
	}
	return null;
}

export async function changedRecords(
	db: Db,
	shopId: string,
	resource: Resource,
	items: readonly (Prisma.InputJsonValue | null)[],
	fetchedAt: Date,
): Promise<(Prisma.InputJsonValue | null)[]> {
	if (resource !== "orders" && resource !== "customers") return [...items];
	const probes = items.map((item) =>
		item === null ? null : probe(resource, item),
	);
	const ids = probes.flatMap((entry) => (entry ? [entry.id] : []));
	if (!ids.length) return [...items];
	const rows =
		resource === "orders"
			? (
					await db.pancakeOrder.findMany({
						where: { shopId, orderId: { in: ids } },
						select: { orderId: true, sourceUpdatedAt: true, fetchedAt: true },
					})
				).map((row) => [row.orderId, row] as const)
			: (
					await db.pancakeCustomer.findMany({
						where: { shopId, customerId: { in: ids } },
						select: {
							customerId: true,
							sourceUpdatedAt: true,
							fetchedAt: true,
						},
					})
				).map((row) => [row.customerId, row] as const);
	const known = new Map<
		string,
		{ sourceUpdatedAt: Date | null; fetchedAt: Date }
	>(rows);
	return items.filter((_, index) => {
		const entry = probes[index];
		if (!entry) return true;
		return isNewer(known.get(entry.id) ?? null, entry.updated, fetchedAt);
	});
}

function hash(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function shippingStatus(item: IncomingOrder): string | null {
	const updates = [...(item.partner?.extend_update ?? [])].sort(
		(left, right) =>
			(left.update_at ? sourceDate(left.update_at).getTime() : 0) -
			(right.update_at ? sourceDate(right.update_at).getTime() : 0),
	);
	return item.partner?.status == null
		? (updates.at(-1)?.status ?? null)
		: String(item.partner.status);
}

async function entityLock(
	tx: Prisma.TransactionClient,
	shopId: string,
	resource: Resource,
	id: string,
): Promise<void> {
	const key = `pancake:${shopId}:${resource}:${id}`;
	await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

function assertSourceShop(
	shopId: string,
	sourceShopId: string | undefined,
): void {
	if (sourceShopId && sourceShopId !== shopId) throw new Error("SHOP_MISMATCH");
}
