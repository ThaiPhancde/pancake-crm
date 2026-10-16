export function shopUrl(slug: string, shopId: string, path = ""): string {
	const suffix = path && !path.startsWith("/") ? `/${path}` : path;
	return `/${slug}/shop/${shopId}${suffix}`;
}
