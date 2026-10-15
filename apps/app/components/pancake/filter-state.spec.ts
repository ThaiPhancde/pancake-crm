import { describe, expect, test } from "bun:test";
import { pancakeUrl, parseFilters } from "./filter-state";
import { formatAmount } from "./format";

describe("Pancake navigation", () => {
	test("invalid shared URLs recover without crashing the page", () => {
		for (const values of [
			{ from: "not-a-date" },
			{ page: "NaN" },
			{ from: "2026-10-16", to: "2026-10-01" },
			{ page: "0" },
		]) {
			const filter = parseFilters(values);
			expect(filter.invalid).toBe(true);
			expect(filter.input.page).toBe(1);
		}
	});
	test("Vietnam date filters cover an inclusive local day", () => {
		const filter = parseFilters({ from: "2026-10-15", to: "2026-10-15" });
		expect(filter.input.from).toBe("2026-10-14T17:00:00.000Z");
		expect(filter.input.to).toBe("2026-10-15T17:00:00.000Z");
		expect(parseFilters({ orderId: "1" }).tab).toBe("orders");
	});
	test("link updates preserve filters and clear stale paging", () => {
		const url = pancakeUrl(
			"/sample/pancake",
			{ shopId: "1", q: "Sample", page: "5" },
			{ page: "", tab: "tasks" },
		);
		expect(url).toContain("shopId=1");
		expect(url).not.toContain("page=");
	});
	test("Kuwait prices keep all three currency decimal places", () => {
		expect(formatAmount("1.234", "KWD")).toContain("1,234");
	});
});
