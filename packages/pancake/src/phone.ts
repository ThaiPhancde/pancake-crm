// National number without the leading 0 or dial code; null when too short to trust.
export function phoneTail(phone: string | null, dial?: string): string | null {
	let digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
	if (dial && digits.startsWith(dial)) digits = digits.slice(dial.length);
	digits = digits.replace(/^0+/, "");
	return digits.length >= 7 ? digits : null;
}
