import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import type { CollectionKey } from "./collections";

export class NotConnectedError extends Error {
	readonly collection: CollectionKey;

	constructor(collection: CollectionKey) {
		super(`Chưa nối API cho ${collection}`);
		this.name = "NotConnectedError";
		this.collection = collection;
	}
}

function str(value: FormDataEntryValue | undefined): string | undefined {
	if (!value || value instanceof File) return undefined;
	const v = value.trim();
	return v ? v : undefined;
}

function isoDateTime(value: FormDataEntryValue | undefined): string {
	const v = str(value);
	if (!v) return new Date(Date.now() + 3_600_000).toISOString();
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function submitRecord(
	collection: CollectionKey,
	values: Record<string, FormDataEntryValue>,
	shopId?: string,
): Promise<{ id: string }> {
	if (!shopId) throw new NotConnectedError(collection);
	const client = createTRPCClient<AppRouter>({
		links: [httpBatchLink({ url: "/api/trpc" })],
	});
	switch (collection) {
		case "lead": {
			const extra: Record<string, string> = {};
			for (const [key, val] of Object.entries(values)) {
				const s = str(val);
				if (
					s &&
					![
						"name",
						"phone",
						"email",
						"assigneeId",
						"status",
						"source",
						"note",
					].includes(key)
				) {
					extra[key] = s;
				}
			}
			const created = await client.pancake.createLead.mutate({
				shopId,
				name: str(values.name) ?? "Khách tiềm năng",
				phone: str(values.phone),
				email: str(values.email),
				assigneeId: str(values.assigneeId),
				status: str(values.status) ?? "new",
				source: str(values.source),
				note: str(values.note) ?? "",
				fields: extra,
			});
			return { id: created.id };
		}
		case "appointment": {
			const created = await client.pancake.createAppointment.mutate({
				shopId,
				title: str(values.title) ?? "Lịch hẹn khách hàng",
				customerId: str(values.customerId) ?? str(values.contact),
				contactName: str(values.contactName) ?? str(values.contact),
				phone: str(values.phone),
				startAt: isoDateTime(values.startAt),
				endAt: values.endAt ? isoDateTime(values.endAt) : undefined,
				status: str(values.status) ?? "scheduled",
				assigneeId: str(values.assigneeId),
				source: str(values.channel),
				note: str(values.note) ?? "",
			});
			return { id: created.id };
		}
		case "ticket": {
			const created = await client.pancake.createTicket.mutate({
				shopId,
				title: str(values.title) ?? "Vấn đề khách hàng",
				customerId: str(values.customerId) ?? str(values.contact),
				contactName: str(values.contactName) ?? str(values.contact),
				phone: str(values.phone),
				email: str(values.email),
				orderId: str(values.related) ?? str(values.orderId),
				category: str(values.category),
				priority: str(values.priority) ?? "low",
				status: str(values.status) ?? "new",
				assigneeId: str(values.assigneeId),
				dueAt: values.dueAt ? isoDateTime(values.dueAt) : undefined,
				source: str(values.source),
				description: str(values.description) ?? "",
			});
			return { id: created.id };
		}
		case "task": {
			const orderId = str(values.order) ?? str(values.orderId);
			if (!orderId) throw new NotConnectedError(collection);
			const created = await client.pancake.createTask.mutate({
				requestId: crypto.randomUUID(),
				shopId,
				orderId,
				title: str(values.title) ?? "Việc cần làm",
				note: str(values.note) ?? "",
				dueAt: isoDateTime(values.dueAt),
				assigneeId: str(values.assigneeId),
			});
			return { id: created.id };
		}
		default:
			throw new NotConnectedError(collection);
	}
}
