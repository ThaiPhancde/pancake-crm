import "server-only";
import { getServerTrpcClient } from "@/lib/trpc/server";
import type { SavedFilterPage, SavedFilterState } from "./config";

export async function loadSavedFilters(
	shopId: string,
	page: SavedFilterPage,
): Promise<SavedFilterState | undefined> {
	const result = await getServerTrpcClient()
		.pancakeSettings.savedFilters.query({ shopId, page })
		.catch(() => null);
	if (!result) return undefined;
	return {
		shopId,
		page,
		max: result.max,
		rows: result.rows.map((row) => ({
			id: row.id,
			name: row.name,
			params: row.params,
			isDefault: row.isDefault,
		})),
	};
}
