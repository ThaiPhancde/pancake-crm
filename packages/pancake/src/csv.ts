import { PANCAKE } from "./config";

export type CsvCell = string | number | boolean | null | undefined;

export function csvCell(value: CsvCell): string {
	const text = value === null || value === undefined ? "" : String(value);
	const safe =
		/^[=@\t\r]/.test(text) || /^[+-](?![\d\s().]*$)/.test(text)
			? `'${text}`
			: text;
	return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(header: readonly string[], rows: readonly CsvCell[][]) {
	return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function csvFile(
	name: string,
	header: readonly string[],
	rows: readonly CsvCell[][],
) {
	const kept = rows.slice(0, PANCAKE.exportMaxRows);
	return {
		filename: `${name}.csv`,
		mimeType: "text/csv;charset=utf-8",
		content: toCsv(header, kept),
		rows: kept.length,
		truncated: rows.length > kept.length,
	};
}
