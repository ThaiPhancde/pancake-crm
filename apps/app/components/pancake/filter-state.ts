import { listInput } from "@crm/pancake/contracts";
import { z } from "zod";

export type SearchValues = { [key: string]: string | string[] | undefined };

export function pancakeUrl(
	base: string,
	values: SearchValues,
	change: { [key: string]: string },
) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(values)) {
		const parsed = z.string().min(1).safeParse(value);
		if (parsed.success) params.set(key, parsed.data);
	}
	for (const [key, value] of Object.entries(change)) {
		if (value) params.set(key, value);
		else params.delete(key);
	}
	return `${base}?${params}`;
}

export function parseFilters(values: SearchValues) {
	const text = (key: string) => z.string().catch("").parse(values[key]);
	const from = text("from");
	const to = text("to");
	const datesValid =
		(!from || z.iso.date().safeParse(from).success) &&
		(!to || z.iso.date().safeParse(to).success);
	const end = datesValid && to ? new Date(`${to}T00:00:00+07:00`) : undefined;
	if (end) end.setTime(end.getTime() + 86_400_000);
	const parsed = listInput.safeParse({
		shopId:
			text("shopId") && text("shopId") !== "all" ? text("shopId") : undefined,
		q: text("q"),
		status:
			text("status") && text("status") !== "all"
				? Number(text("status"))
				: undefined,
		sellerId:
			text("sellerId") && text("sellerId") !== "all"
				? text("sellerId")
				: undefined,
		from:
			datesValid && from
				? new Date(`${from}T00:00:00+07:00`).toISOString()
				: undefined,
		to: end?.toISOString(),
		page: text("page") ? Number(text("page")) : 1,
		pageSize: 25,
		view: text("view") || "all",
		sort: text("sort") || "newest",
	});
	const valid = datesValid && parsed.success;
	const input = valid ? parsed.data : listInput.parse({});
	const tab = [
		"overview",
		"tasks",
		"orders",
		"customers",
		"products",
		"report",
		"connections",
	].includes(text("tab"))
		? text("tab")
		: text("customerId") || text("orderId")
			? "orders"
			: "overview";
	const taskView = z
		.enum(["open", "overdue", "mine", "done", "all"])
		.catch("open")
		.parse(text("taskView"));
	return {
		input,
		tab,
		from: valid ? from : "",
		to: valid ? to : "",
		customerId: text("customerId"),
		orderId: text("orderId"),
		taskView,
		invalid: !valid,
	};
}
