import { describe, expect, test } from "bun:test";
import { pancakeUrl, parseFilters } from "./filter-state";
import { formatAmount } from "./format";

const plain = (text: string) => text.replace(/\s/g, " ");

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
	test("shop date filters cover an inclusive day in the shop time zone", () => {
		const filter = parseFilters({
			shopId: "1635200759",
			from: "2026-10-15",
			to: "2026-10-15",
		});
		expect(filter.input.from).toBe("2026-10-14T20:00:00.000Z");
		expect(filter.input.to).toBe("2026-10-15T20:00:00.000Z");
	});
	test("money shows at most one fraction digit and only when non-zero", () => {
		expect(plain(formatAmount("1.234", "KWD"))).toBe("1,2 KWD");
		expect(plain(formatAmount("4162753.61", "SAR"))).toBe("4.162.753,6 SAR");
		expect(plain(formatAmount("120", "SAR"))).toBe("120 SAR");
		expect(plain(formatAmount("120.04", "SAR"))).toBe("120 SAR");
		expect(plain(formatAmount("0", "SAR"))).toBe("0 SAR");
	});
	test("an invalid currency code falls back instead of throwing", () => {
		expect(plain(formatAmount("12.5", "not-a-code"))).toBe("12,5 not-a-code");
	});
});
