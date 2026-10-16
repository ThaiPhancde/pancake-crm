import { STATUS_NAMES } from "@crm/pancake/config";
import type { BadgeTone, FieldOption } from "./collections";

const TONES = new Map<number, BadgeTone>([
	[0, "blue"],
	[17, "blue"],
	[1, "navy"],
	[11, "orange"],
	[12, "orange"],
	[13, "orange"],
	[20, "orange"],
	[8, "orange"],
	[9, "orange"],
	[2, "teal"],
	[3, "green"],
	[16, "green"],
	[4, "brown"],
	[15, "brown"],
	[5, "red"],
	[6, "gray"],
	[7, "gray"],
]);

export function orderStatusTone(status: number): BadgeTone {
	return TONES.get(status) ?? "gray";
}

export function orderStatusName(status: number): string {
	return STATUS_NAMES.get(status) ?? `Trạng thái ${status}`;
}

export const ORDER_STATUS_OPTIONS: FieldOption[] = [...STATUS_NAMES].map(
	([id, name]) => ({
		value: String(id),
		label: name,
		color: orderStatusTone(id),
	}),
);
