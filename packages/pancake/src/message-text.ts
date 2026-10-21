const entities: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

export function messageText(value: string): string {
	return value
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
		.replace(/<br\b[^>]*\/?>/gi, "\n")
		.replace(/<\/(?:div|p|li|tr|h[1-6])\s*>/gi, "\n")
		.replace(/<\/?[a-z][^>]*>/gi, "")
		.replace(
			/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
			(match, entity: string) => {
				if (!entity.startsWith("#"))
					return entities[entity.toLowerCase()] ?? match;
				const hex = entity[1]?.toLowerCase() === "x";
				const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
				return code > 0 &&
					code <= 0x10ffff &&
					!(code >= 0xd800 && code <= 0xdfff)
					? String.fromCodePoint(code)
					: "\uFFFD";
			},
		)
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
