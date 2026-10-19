export const LIST_CONFIG = {
	transientParams: [
		"page",
		"leadId",
		"ticketId",
		"appointmentId",
		"orderId",
		"customerId",
		"full",
		"date",
	],
	defaultFilterName: "Bộ lọc mặc định",
	oneWayReason: "Dữ liệu đồng bộ một chiều từ Pancake POS",
	failedIdsShown: 5,
	unassigned: "none",
} as const;

export type SavedFilterPage =
	| "leads"
	| "contacts"
	| "orders"
	| "appointments"
	| "tickets"
	| "products";

export type SavedFilterRow = {
	id: string;
	name: string;
	params: Record<string, string>;
	isDefault: boolean;
};

export type SavedFilterState = {
	shopId: string;
	page: SavedFilterPage;
	max: number;
	rows: SavedFilterRow[];
};

export type FilterField = {
	param: string;
	label: string;
	options: { value: string; label: string }[];
};
