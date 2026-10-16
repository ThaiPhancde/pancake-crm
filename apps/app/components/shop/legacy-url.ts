import { z } from "zod";
import type { SearchValues } from "../pancake/filter-state";
import { shopUrl } from "./url";

const TAB_PATHS = new Map([
	["overview", ""],
	["orders", "/orders"],
	["customers", "/contacts"],
	["products", "/products"],
	["tasks", "/reports/tasks"],
	["report", "/reports/business"],
	["connections", "/settings/connections"],
]);

export function legacyShopUrl(
	slug: string,
	shopId: string,
	values: SearchValues,
): string {
	const parsed = z.record(z.string(), z.string().catch("")).parse(values);
	const tab = parsed.tab || "overview";
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(parsed)) {
		if (key !== "tab" && key !== "shopId" && value) {
			query.set(key, value);
		}
	}
	return `${shopUrl(slug, shopId)}${TAB_PATHS.get(tab) ?? ""}${query.size ? `?${query}` : ""}`;
}
