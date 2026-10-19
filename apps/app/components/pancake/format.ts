const DIGITS: Intl.NumberFormatOptions = {
	minimumFractionDigits: 0,
	maximumFractionDigits: 1,
	signDisplay: "negative",
};

export function formatAmount(value: string, currency: string) {
	const amount = Number(value) || 0;
	try {
		return new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency,
			...DIGITS,
		}).format(amount);
	} catch {
		return `${new Intl.NumberFormat("vi-VN", DIGITS).format(amount)} ${currency}`.trim();
	}
}

export function formatAmounts(
	rows: readonly { amount: string; currency: string }[],
	fallbackCurrency: string,
) {
	return rows.length
		? rows.map((row) => formatAmount(row.amount, row.currency)).join(" · ")
		: formatAmount("0", fallbackCurrency);
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
