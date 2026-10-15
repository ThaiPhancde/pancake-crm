import type { Prisma } from "@crm/db";

export function sampleOrder(
	shopId: string,
	id = "1",
	status = 0,
	updatedAt = "2026-10-14T02:00:00Z",
): Prisma.InputJsonObject {
	return {
		id,
		shop_id: shopId,
		inserted_at: "2026-10-01T03:00:00Z",
		updated_at: updatedAt,
		status,
		bill_full_name: "Khách mẫu A",
		bill_phone_number: "000000001",
		total_price: 0,
		shipping_fee: 500000,
		order_currency: "VND",
		customer: { id: "sample-customer-a", name: "Khách mẫu A" },
		assigning_seller: { id: "sample-seller-a", name: "Telesale mẫu A" },
		creator_id: "sample-seller-a",
		last_editor_id: "sample-seller-a",
		partner: {
			extend_code: "SAMPLE-TRACKING-01",
			extend_update: [
				{
					key: "received",
					status: "Giao thành công",
					tracking_id: "SAMPLE-TRACKING-01",
					update_at: updatedAt,
				},
			],
		},
		items: [
			{
				product_id: "sample-product-a",
				variation_id: "sample-variation-a",
				quantity: 2,
				returned_count: 0,
				variation_info: { name: "Sản phẩm mẫu A", retail_price: 250000 },
			},
		],
		status_history: [
			{
				status: 0,
				old_status: null,
				updated_at: "2026-10-01T03:00:00Z",
				editor_id: "sample-seller-a",
			},
		],
	};
}

export const sampleCustomer: Prisma.InputJsonObject = {
	id: "sample-customer-a",
	name: "Khách mẫu A",
	phone_numbers: ["000000001"],
	emails: ["customer-a@example.invalid"],
	assigned_user_id: "sample-seller-a",
	updated_at: "2026-10-14T02:00:00Z",
};
export const sampleProduct: Prisma.InputJsonObject = {
	id: "sample-variation-a",
	product_id: "sample-product-a",
	product: { name: "Sản phẩm mẫu A" },
	display_id: "SAMPLE-SKU-A",
	retail_price: 250000,
	remain_quantity: 20,
	updated_at: "2026-10-14T02:00:00Z",
};
export const sampleEmployee: Prisma.InputJsonObject = {
	user_id: "sample-seller-a",
	user: {
		id: "sample-seller-a",
		name: "Telesale mẫu A",
		email: "seller-a@example.invalid",
	},
};
export function sampleReturn(shopId: string): Prisma.InputJsonObject {
	return {
		id: "sample-return-1",
		shop_id: shopId,
		order_id_to_returned: "3",
		inserted_at: "2026-10-12T02:00:00Z",
		updated_at: "2026-10-14T02:00:00Z",
		status: 1,
		returned_fee: 10000,
		returned_items: [
			{
				product_id: "sample-product-a",
				variation_id: "sample-variation-a",
				returned_quantity: 2,
			},
		],
		status_histories: [
			{
				id: "sample-return-history",
				old_status: 0,
				status: 1,
				updated_at: "2026-10-14T02:00:00Z",
				editor_id: "sample-seller-a",
			},
		],
	};
}
