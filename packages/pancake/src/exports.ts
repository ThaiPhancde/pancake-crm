import type { Db } from "@crm/db";
import { z } from "zod";
import { assertShopReader } from "./access";
import { PANCAKE, STATUS_NAMES } from "./config";
import { listInput, recordListInput } from "./contracts";
import { type CsvCell, csvFile } from "./csv";
import {
	dashboardReport,
	listAppointments,
	listCustomers,
	listLeads,
	listOrders,
	listProducts,
	listTickets,
} from "./queries";

const listExport = z.object({
	kind: z.enum(["contacts", "orders", "products", "business"]),
	shopId: z.string().min(1),
	filters: listInput,
});
const recordExport = z.object({
	kind: z.enum(["leads", "appointments", "tickets"]),
	shopId: z.string().min(1),
	filters: recordListInput,
});
export const exportInput = z.union([listExport, recordExport]);
export type ExportInput = z.infer<typeof exportInput>;

function isRecordExport(
	input: ExportInput,
): input is z.infer<typeof recordExport> {
	return recordExport.shape.kind.safeParse(input.kind).success;
}

type Sheet = { header: string[]; rows: CsvCell[][] };

async function employeeNames(db: Db, shopId: string) {
	const rows = await db.pancakeEmployee.findMany({
		where: { shopId },
		select: { employeeId: true, name: true },
	});
	const names = new Map(rows.map((row) => [row.employeeId, row.name]));
	return (id: string | null) => (id ? (names.get(id) ?? id) : "");
}

async function sheet(
	db: Db,
	userId: string,
	input: ExportInput,
): Promise<Sheet> {
	const take = { page: 1, pageSize: PANCAKE.exportMaxRows + 1 };
	if (isRecordExport(input)) {
		const filters = { ...input.filters, ...take, shopId: input.shopId };
		const staff = await employeeNames(db, input.shopId);
		if (input.kind === "leads") {
			const { rows } = await listLeads(db, userId, filters);
			return {
				header: [
					"Mã",
					"Tên",
					"Số điện thoại",
					"Email",
					"Trạng thái",
					"Nguồn",
					"Phân công",
					"Ghi chú",
					"Ngày tạo",
				],
				rows: rows.map((row) => [
					row.id,
					row.name,
					row.phone,
					row.email,
					row.status,
					row.source,
					staff(row.assigneeId),
					row.note,
					row.createdAt,
				]),
			};
		}
		if (input.kind === "appointments") {
			const { rows } = await listAppointments(db, userId, filters);
			return {
				header: [
					"Mã",
					"Tiêu đề",
					"Liên hệ",
					"Số điện thoại",
					"Bắt đầu",
					"Kết thúc",
					"Trạng thái",
					"Phân công",
					"Nguồn",
					"Địa điểm",
					"Ghi chú",
				],
				rows: rows.map((row) => [
					row.id,
					row.title,
					row.contactName,
					row.phone,
					row.startAt,
					row.endAt,
					row.status,
					staff(row.assigneeId),
					row.source,
					row.location,
					row.note,
				]),
			};
		}
		const { rows } = await listTickets(db, userId, filters);
		return {
			header: [
				"Mã",
				"Tiêu đề",
				"Liên hệ",
				"Số điện thoại",
				"Email",
				"Đơn hàng",
				"Danh mục",
				"Ưu tiên",
				"Trạng thái",
				"Phân công",
				"Hạn xử lý",
				"Nguồn",
				"Mô tả",
				"Ngày tạo",
			],
			rows: rows.map((row) => [
				row.id,
				row.title,
				row.contactName,
				row.phone,
				row.email,
				row.orderId,
				row.category,
				row.priority,
				row.status,
				staff(row.assigneeId),
				row.dueAt,
				row.source,
				row.description,
				row.createdAt,
			]),
		};
	}
	const filters = { ...input.filters, ...take, shopId: input.shopId };
	if (input.kind === "contacts") {
		const { rows } = await listCustomers(db, userId, filters);
		return {
			header: [
				"Mã khách hàng",
				"Tên",
				"Số điện thoại",
				"Email",
				"Nhân viên",
				"Nguồn",
				"Giới tính",
				"Ngày sinh",
				"Địa chỉ",
				"Số đơn",
				"Chi tiêu 30 ngày",
				"Ngày tạo",
			],
			rows: rows.map((row) => [
				row.customerId,
				row.name,
				row.phone,
				row.email,
				row.assignedEmployeeName,
				row.source,
				row.gender,
				row.birthday,
				row.address,
				row.orderCount,
				row.purchasedAmounts.map((a) => `${a.amount} ${a.currency}`).join("; "),
				row.createdAt,
			]),
		};
	}
	if (input.kind === "orders") {
		const { rows } = await listOrders(db, userId, filters);
		return {
			header: [
				"Mã đơn",
				"Ngày tạo",
				"Khách hàng",
				"Số điện thoại",
				"Nhân viên",
				"Trạng thái",
				"Tiền tệ",
				"Tổng tiền",
				"Giảm giá",
				"Sản phẩm",
				"Nguồn",
				"Mã vận đơn",
				"Ghi chú",
			],
			rows: rows.map((row) => [
				row.orderId,
				row.sourceCreatedAt,
				row.customerName,
				row.customerPhone,
				row.sellerName,
				STATUS_NAMES.get(row.status) ?? row.status,
				row.currency,
				row.totalPrice,
				row.discount,
				row.itemsSummary,
				row.source,
				row.trackingCode,
				row.note,
			]),
		};
	}
	if (input.kind === "products") {
		const { rows } = await listProducts(db, userId, filters);
		return {
			header: [
				"Mã sản phẩm",
				"Mã biến thể",
				"Tên",
				"SKU",
				"Giá",
				"Tồn kho",
				"Ẩn",
				"Danh mục",
			],
			rows: rows.map((row) => [
				row.productId,
				row.variationId,
				row.name,
				row.sku,
				row.price,
				row.stock,
				row.hidden,
				row.categories.join("; "),
			]),
		};
	}
	const report = await dashboardReport(db, userId, filters);
	return {
		header: [
			"Nhân viên",
			"Tiền tệ",
			"Đơn",
			"Đã nhận",
			"Đã hủy",
			"Hoàn",
			"Doanh thu chốt",
			"Doanh thu đã nhận",
			"Tỷ lệ giao",
		],
		rows: report.performance.map((row) => [
			row.sellerName,
			row.currency,
			row.orders,
			row.delivered,
			row.cancelled,
			row.returned,
			row.revenue,
			row.received,
			row.deliveredRate,
		]),
	};
}

export async function exportCsv(db: Db, userId: string, input: ExportInput) {
	await assertShopReader(db, userId, input.shopId);
	const { header, rows } = await sheet(db, userId, input);
	return csvFile(
		`${input.kind}-${input.shopId}-${new Date().toISOString().slice(0, 10)}`,
		header,
		rows,
	);
}
