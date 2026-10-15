export function formatAmount(value: string, currency: string) {
	return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(
		Number(value),
	);
}

export function formatDate(value: string | null) {
	return value
		? new Intl.DateTimeFormat("vi-VN", {
				dateStyle: "short",
				timeStyle: "short",
				timeZone: "Asia/Ho_Chi_Minh",
			}).format(new Date(value))
		: "Chưa có";
}
