import { describe, expect, test } from "bun:test";
import {
	PancakeApiError,
	PancakeClient,
	pageComplete,
	pagePath,
} from "../src/client";
import { PANCAKE, RESOURCES } from "../src/config";

const request = {
	page: 2,
	start: new Date("2026-10-01T00:00:00Z"),
	end: new Date("2026-10-14T00:00:00Z"),
};

describe("official read-only API contract", () => {
	test("orders use documented updated_at filters and include removed orders", () => {
		const url = new URL(
			pagePath("123", { ...request, resource: "orders" }),
			PANCAKE.baseUrl,
		);
		expect(url.pathname).toBe("/shops/123/orders");
		expect(url.searchParams.get("page_number")).toBe("2");
		expect(url.searchParams.get("updateStatus")).toBe("updated_at");
		expect(url.searchParams.get("include_removed")).toBe("1");
		expect(url.searchParams.get("startDateTime")).toBe("1790812800");
		expect(url.searchParams.get("option_sort")).toBe("last_updated_order_asc");
	});
	test("products use variations, never the create-products endpoint", () => {
		const url = new URL(
			pagePath("123", { ...request, resource: "products" }),
			PANCAKE.baseUrl,
		);
		expect(url.pathname).toBe("/shops/123/products/variations");
		expect(url.searchParams.has("start_time_update")).toBe(true);
	});
	test("returns use page and snake_case date fields", () => {
		const url = new URL(
			pagePath("123", { ...request, resource: "returns" }),
			PANCAKE.baseUrl,
		);
		expect(url.searchParams.get("page")).toBe("2");
		expect(url.searchParams.has("page_number")).toBe(false);
		expect(url.searchParams.get("update_status")).toBe("updated_at");
	});
	test("customer and employee parameter names match the official spec", () => {
		expect(pagePath("123", { ...request, resource: "customers" })).toContain(
			"start_time_updated_at=",
		);
		expect(pagePath("123", { ...request, resource: "employees" })).toBe(
			"/shops/123/users?",
		);
	});
	test("explicit page totals override a short page", () => {
		expect(
			pageComplete({ success: true, data: [{}], total_pages: 3 }, 1, "orders"),
		).toBe(false);
		expect(
			pageComplete({ success: true, data: [], total_pages: 0 }, 1, "orders"),
		).toBe(true);
	});
	test("return pagination uses total_entries and actual page_size", () => {
		expect(
			pageComplete(
				{ success: true, data: [{}], total_entries: 3, page_size: 2 },
				1,
				"returns",
			),
		).toBe(false);
		expect(
			pageComplete(
				{ success: true, data: [{}], total_entries: 3, page_size: 2 },
				2,
				"returns",
			),
		).toBe(true);
	});
	test("every resource sends GET to the pinned official origin", async () => {
		const calls: { url: string; method: string; redirect: string }[] = [];
		const fake = Object.assign(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({
					url: String(input),
					method: init?.method ?? "",
					redirect: init?.redirect ?? "",
				});
				return Response.json({ success: true, data: [] });
			},
			{ preconnect: () => undefined },
		);
		const client = new PancakeClient("123", "SAFE_SAMPLE_SECRET", fake);
		for (const resource of RESOURCES)
			await client.readPage({ ...request, resource });
		expect(calls).toHaveLength(5);
		for (const call of calls) {
			expect(call.method).toBe("GET");
			expect(call.redirect).toBe("error");
			expect(new URL(call.url).origin).toBe("https://pos.pages.fm");
			expect(new URL(call.url).searchParams.get("api_key")).toBe(
				"SAFE_SAMPLE_SECRET",
			);
		}
	});
	test("authentication failures do not leak credentials or response bodies", async () => {
		const fake = Object.assign(
			async () =>
				Response.json({ message: "SAFE_SAMPLE_SECRET" }, { status: 401 }),
			{ preconnect: () => undefined },
		);
		try {
			await new PancakeClient("123", "SAFE_SAMPLE_SECRET", fake).readPage({
				...request,
				resource: "orders",
			});
			throw new Error("Expected rejection");
		} catch (error) {
			expect(error).toBeInstanceOf(PancakeApiError);
			expect(String(error)).toContain("CREDENTIALS_OR_PERMISSION");
			expect(String(error)).not.toContain("SAFE_SAMPLE_SECRET");
		}
	});
	test("success:false does not silently advance a cursor", async () => {
		const fake = Object.assign(
			async () => Response.json({ success: false, data: [] }),
			{ preconnect: () => undefined },
		);
		await expect(
			new PancakeClient("123", "safe", fake).readPage({
				...request,
				resource: "orders",
			}),
		).rejects.toThrow("INVALID_API_RESPONSE");
	});
	test("a long Retry-After returns a retryable error instead of blocking", async () => {
		const fake = Object.assign(
			async () =>
				new Response("", { status: 429, headers: { "retry-after": "120" } }),
			{ preconnect: () => undefined },
		);
		await expect(
			new PancakeClient("123", "safe", fake).readPage({
				...request,
				resource: "orders",
			}),
		).rejects.toThrow("HTTP_429");
	});
});
