export const API_URL = (
	process.env.NEXT_PUBLIC_API_URL ||
	process.env.API_URL ||
	"http://localhost:3001"
).replace(/\/+$/, "");

export function isMarketing(): boolean {
	return process.env.IS_MARKETING === "true";
}
