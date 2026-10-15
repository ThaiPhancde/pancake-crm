import { createHash } from "node:crypto";
import type { Prisma } from "@crm/db";
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
	const item = orderWire.parse(value);
	assertSourceShop(shopId, item.shop_id);
	await entityLock(tx, shopId, resource, item.id);
	const key = { shopId_orderId: { shopId, orderId: item.id } };
	const current = await tx.pancakeOrder.findUnique({ where: key });
	const updated = sourceDate(item.updated_at);
	if (!isNewer(current, updated, fetchedAt)) return false;
	if (item.customer) {
		await tx.pancakeCustomer.upsert({
			where: { shopId_customerId: { shopId, customerId: item.customer.id } },
			create: {
				shopId,
				customerId: item.customer.id,
				name: item.customer.name ?? item.bill_full_name ?? "Khách hàng",
				phone: item.bill_phone_number ?? null,
				fetchedAt: new Date(0),
				raw: {},
			},
			update: {},
		});
	}
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
		totalPrice:
			(item.shipping_fee ?? 0) /
			(currency === "VND" ? 1 : 100),
		trackingCode: item.partner?.extend_code ?? null,
		trackingUrl: item.tracking_link ?? null,
		deliveryStatus,
		returnReason: item.returned_reason_name ?? null,
		sourceCreatedAt: sourceDate(item.inserted_at),
		sourceUpdatedAt: updated,
		fetchedAt,
		raw: value,
	};
	await tx.pancakeOrder.upsert({
		where: key,
		create: { shopId, orderId: item.id, ...data },
		update: data,
	});
	for (const event of item.status_history ?? []) {
		const occurredAt = event.updated_at ?? event.inserted_at;
		if (!occurredAt) continue;
		const eventKey = hash(
			`${event.status}:${event.old_status}:${occurredAt}:${event.editor_id ?? ""}`,
		);
		await tx.pancakeOrderHistory.createMany({
			data: [
				{
					shopId,
					orderId: item.id,
					eventKey,
					oldStatus: event.old_status ?? null,
					status: event.status,
					actorId: event.editor_id ?? null,
					occurredAt: sourceDate(occurredAt),
					source: "pancake-history",
				},
			],
			skipDuplicates: true,
		});
	}
	if (
		!current ||
		current.status !== data.status ||
		current.subStatus !== data.subStatus ||
		current.deliveryStatus !== data.deliveryStatus ||
		current.trackingCode !== data.trackingCode
	) {
		await tx.pancakeOrderHistory.createMany({
			data: [
				{
					shopId,
					orderId: item.id,
					eventKey: hash(
						`snapshot:${item.updated_at}:${data.status}:${data.subStatus}:${deliveryStatus}:${data.trackingCode}`,
					),
					oldStatus: current?.status ?? null,
					status: data.status,
					subStatus: data.subStatus,
					deliveryStatus,
					trackingCode: data.trackingCode,
					actorId: data.lastEditorId,
					occurredAt: updated,
					source: "poll-snapshot",
				},
			],
			skipDuplicates: true,
		});
	}
	return true;
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
