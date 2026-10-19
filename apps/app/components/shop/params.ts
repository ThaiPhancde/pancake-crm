import { shopTimezone } from "@crm/pancake/config";
import { z } from "zod";
import {
	pancakeUrl,
	parseFilters,
	type SearchValues,
} from "@/components/pancake/filter-state";
import { isRangeKey, type RangeKey, rangeBounds } from "./range";

export type { SearchValues };

export function text(values: SearchValues, key: string): string {
	return z.string().catch("").parse(values[key]);
}

export function withParams(
	base: string,
	values: SearchValues,
	change: { [key: string]: string },
): string {
	return pancakeUrl(base, values, change);
}

export function shopFilters(
	values: SearchValues,
	shopId: string,
	defaultRange?: RangeKey,
) {
	const explicit = Boolean(text(values, "from") || text(values, "to"));
	const range = isRangeKey(text(values, "range"))
		? (text(values, "range") as RangeKey)
		: explicit
			? undefined
			: defaultRange;
	const timeZone = shopTimezone(shopId);
	const bounds =
		range && !explicit ? rangeBounds(range, new Date(), timeZone) : undefined;
	const merged: SearchValues = {
		...values,
		shopId,
		from: bounds?.from ?? text(values, "from"),
		to: bounds?.to ?? text(values, "to"),
	};
	const parsed = parseFilters(merged);
	return {
		...parsed,
		input: { ...parsed.input, shopId },
		range,
		timeZone,
		q: text(values, "q"),
		status: text(values, "status"),
		sellerId: text(values, "sellerId"),
		view: text(values, "view"),
		stats: text(values, "stats") === "1",
		mode: text(values, "mode"),
		date: text(values, "date"),
	};
}
