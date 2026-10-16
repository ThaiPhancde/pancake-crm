export function initials(name: string | null | undefined): string {
	const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
	const first = parts[0];
	if (!first) return "?";
	if (parts.length === 1) return first.slice(0, 2).toUpperCase();
	const last = parts[parts.length - 1] ?? first;
	return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
