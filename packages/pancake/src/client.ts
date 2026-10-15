import { PANCAKE, type Resource } from "./config";
import { pageEnvelope, type SourcePage } from "./contracts";

export class PancakeApiError extends Error {
	constructor(
		readonly code: string,
		readonly retryAfterMs = 0,
	) {
		super(code);
		this.name = "PancakeApiError";
	}
}

export type PageRequest = {
	resource: Resource;
	page: number;
	start: Date | null;
	end: Date;
};
export interface PancakeReader {
	readPage(request: PageRequest): Promise<SourcePage>;
}

export function pagePath(shopId: string, request: PageRequest): string {
	const { resource, page, start, end } = request;
	const endpoints = {
		employees: "users",
		customers: "customers",
		products: "products/variations",
		orders: "orders",
		returns: "orders_returned",
	} as const satisfies Record<Resource, string>;
	const params = new URLSearchParams();
	if (resource !== "employees") {
		params.set(resource === "returns" ? "page" : "page_number", String(page));
		params.set("page_size", String(PANCAKE.pageSize));
	}
	const seconds = (date: Date) => String(Math.floor(date.getTime() / 1000));
	if (resource === "orders") {
		params.set("include_removed", "1");
		params.set("updateStatus", "updated_at");
		params.set("option_sort", "last_updated_order_asc");
		params.set("startDateTime", start ? seconds(start) : "0");
		params.set("endDateTime", seconds(end));
	}
	if (resource === "customers" && start) {
		params.set("start_time_updated_at", seconds(start));
		params.set("end_time_updated_at", seconds(end));
	}
	if (resource === "products" && start) {
		params.set("start_time_update", seconds(start));
		params.set("end_time_update", seconds(end));
	}
	if (resource === "returns") {
		params.set("update_status", "updated_at");
		params.set("start_time", start ? seconds(start) : "0");
		params.set("end_time", seconds(end));
	}
	return `/shops/${encodeURIComponent(shopId)}/${endpoints[resource]}?${params}`;
}

export class PancakeClient implements PancakeReader {
	constructor(
		private readonly shopId: string,
		private readonly apiKey: string,
		private readonly fetcher: typeof fetch = fetch,
	) {
		if (!/^\d+$/.test(shopId) || !apiKey)
			throw new PancakeApiError("CONFIGURATION_REQUIRED");
	}

	async readPage(request: PageRequest): Promise<SourcePage> {
		const url = new URL(`${PANCAKE.baseUrl}${pagePath(this.shopId, request)}`);
		url.searchParams.set("api_key", this.apiKey);
		for (let attempt = 0; attempt < PANCAKE.attempts; attempt++) {
			let response: Response;
			try {
				response = await this.fetcher(url, {
					method: "GET",
					redirect: "error",
					signal: AbortSignal.timeout(PANCAKE.timeoutMs),
				});
			} catch {
				if (attempt + 1 === PANCAKE.attempts)
					throw new PancakeApiError("NETWORK_OR_TIMEOUT");
				await Bun.sleep(PANCAKE.retryMs * 2 ** attempt);
				continue;
			}
			if (response.status === 401 || response.status === 403)
				throw new PancakeApiError("CREDENTIALS_OR_PERMISSION");
			if (response.status === 429 || response.status >= 500) {
				const header = response.headers.get("retry-after");
				const retry = header
					? Number(header) * 1000 || Date.parse(header) - Date.now()
					: 0;
				const delay = Math.max(PANCAKE.retryMs * 2 ** attempt, retry);
				if (attempt + 1 === PANCAKE.attempts || delay > PANCAKE.maxRetryMs)
					throw new PancakeApiError(`HTTP_${response.status}`, delay);
				await Bun.sleep(delay);
				continue;
			}
			if (!response.ok) throw new PancakeApiError(`HTTP_${response.status}`);
			let page: SourcePage;
			try {
				page = pageEnvelope.parse(await response.json());
			} catch (error) {
				throw new PancakeApiError(
					error instanceof SyntaxError
						? "INVALID_JSON"
						: "INVALID_API_RESPONSE",
				);
			}
			await Bun.sleep(PANCAKE.requestGapMs);
			return page;
		}
		throw new PancakeApiError("RETRIES_EXHAUSTED");
	}
}

export function pageComplete(
	page: SourcePage,
	pageNumber: number,
	resource: Resource,
): boolean {
	if (resource === "employees") return true;
	if (page.total_pages !== undefined) return pageNumber >= page.total_pages;
	if (page.total_entries !== undefined)
		return (
			pageNumber * (page.page_size ?? PANCAKE.pageSize) >= page.total_entries
		);
	return page.data.length < (page.page_size ?? PANCAKE.pageSize);
}
