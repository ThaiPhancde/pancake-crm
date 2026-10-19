import { PANCAKE, shopTimezone } from "@crm/pancake/config";
import { listInput } from "@crm/pancake/contracts";
import { z } from "zod";
import { zonedMidnight } from "@/components/shop/range";

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
	const timeZone = shopTimezone(text("shopId"));
	const end =
		datesValid && to
			? zonedMidnight(
					new Date(Date.parse(`${to}T00:00:00Z`) + PANCAKE.dayMs)
						.toISOString()
						.slice(0, 10),
					timeZone,
				)
			: undefined;
	const safeView = z
		.enum(["all", "pending", "shipping", "returns", "unassigned"])
		.catch("all")
		.parse(text("view"));
	const safeSort = z
		.enum(["newest", "updated", "oldest"])
		.catch("newest")
		.parse(text("sort"));
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
				? zonedMidnight(from, timeZone).toISOString()
				: undefined,
		to: end?.toISOString(),
		page: text("page") ? Number(text("page")) : 1,
		pageSize: 25,
		view: safeView,
		sort: safeSort,
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
