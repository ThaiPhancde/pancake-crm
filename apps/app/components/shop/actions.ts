import type { CollectionKey } from "./collections";

export class NotConnectedError extends Error {
	readonly collection: CollectionKey;

	constructor(collection: CollectionKey) {
		super(`Chưa nối API cho ${collection}`);
		this.name = "NotConnectedError";
		this.collection = collection;
	}
}

export async function submitRecord(
	collection: CollectionKey,
	values: Record<string, FormDataEntryValue>,
): Promise<{ id: string }> {
	void values;
	throw new NotConnectedError(collection);
}
