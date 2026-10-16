import { describe, expect, it } from "bun:test";
import { legacyShopUrl } from "./legacy-url";

describe("legacy shop links", () => {
	it("keeps order details and filters in the selected workspace", () => {
		expect(
			legacyShopUrl("sample", "10001", {
				tab: "orders",
				shopId: "10001",
				orderId: "42",
				q: "khách mẫu",
				page: "2",
			}),
		).toBe(
			"/sample/shop/10001/orders?orderId=42&q=kh%C3%A1ch+m%E1%BA%ABu&page=2",
		);
	});
	it("maps existing tabs to workspace pages", () => {
		for (const [tab, path] of [
			["customers", "/contacts"],
			["products", "/products"],
			["tasks", "/reports/tasks"],
			["report", "/reports/business"],
			["connections", "/settings/connections"],
		]) {
			expect(legacyShopUrl("sample", "10001", { tab })).toBe(
				`/sample/shop/10001${path}`,
			);
		}
	});
	it("opens the overview for invalid tabs and ignores repeated query values", () => {
		expect(
			legacyShopUrl("sample", "10001", {
				tab: ["orders", "products"],
				q: ["a", "b"],
			}),
		).toBe("/sample/shop/10001");
	});
});
