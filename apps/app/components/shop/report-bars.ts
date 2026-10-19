import type { FieldOption } from "./collections";

export function optionLabel(
	options: FieldOption[],
	value: string | null,
	fallback: string,
): string {
	if (!value) return fallback;
	return options.find((option) => option.value === value)?.label ?? value;
}

export function countBars(
	items: { value: string | null; count: number }[],
	options: FieldOption[],
	fallback: string,
) {
	return items
		.filter((item) => item.count > 0)
		.map((item) => ({
			label: optionLabel(options, item.value, fallback),
			value: item.count,
			display: item.count.toLocaleString("vi-VN"),
		}));
}
