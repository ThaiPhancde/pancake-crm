import type { Db, PancakeRole, Prisma } from "@crm/db";

export class PancakeAccessError extends Error {
	constructor() {
		super("Pancake shop access denied");
		this.name = "PancakeAccessError";
	}
}

export type ShopGrant = {
	shopId: string;
	role: PancakeRole;
	employeeId: string | null;
};

const GRANTS_TTL_MS = 5_000;
const grantsCache = new Map<
	string,
	{ expiresAt: number; promise: Promise<ShopGrant[]> }
>();

export function clearShopGrantsCache(userId?: string): void {
	if (userId) {
		grantsCache.delete(userId);
	} else {
		grantsCache.clear();
	}
}

async function fetchShopGrants(db: Db, userId: string): Promise<ShopGrant[]> {
	const member = await db.member.findUnique({
		where: { organizationId_userId: { organizationId: "workspace", userId } },
		select: { role: true },
	});
	if (!member) throw new PancakeAccessError();
	if (member.role === "owner" || member.role === "admin") {
		return (await db.pancakeShop.findMany({ select: { id: true } })).map(
			(shop) => ({ shopId: shop.id, role: "MANAGER", employeeId: null }),
		);
	}
	return db.pancakeShopMember.findMany({
		where: { userId },
		select: { shopId: true, role: true, employeeId: true },
	});
}

export async function shopGrants(db: Db, userId: string): Promise<ShopGrant[]> {
	if (process.env.NODE_ENV === "test") {
		return fetchShopGrants(db, userId);
	}
	const now = Date.now();
	const cached = grantsCache.get(userId);
	if (cached && cached.expiresAt > now) {
		return cached.promise;
	}
	const promise = fetchShopGrants(db, userId).catch((error) => {
		grantsCache.delete(userId);
		throw error;
	});
	grantsCache.set(userId, { expiresAt: now + GRANTS_TTL_MS, promise });
	return promise;
}

export function orderScope(
	grants: ShopGrant[],
	requestedShop?: string,
): Prisma.PancakeOrderWhereInput {
	if (requestedShop && !grants.some((grant) => grant.shopId === requestedShop))
		throw new PancakeAccessError();
	const selected = requestedShop
		? grants.filter((grant) => grant.shopId === requestedShop)
		: grants;
	return {
		OR: selected.map((grant) =>
			grant.role === "TELESALE"
				? { shopId: grant.shopId, sellerId: grant.employeeId ?? "__unmapped__" }
				: { shopId: grant.shopId },
		),
	};
}

export function canWrite(grants: ShopGrant[], shopId: string): boolean {
	return grants.some(
		(grant) => grant.shopId === shopId && grant.role !== "VIEWER",
	);
}

export async function assertShopWriter(
	db: Db,
	userId: string,
	shopId: string,
): Promise<ShopGrant[]> {
	const grants = await shopGrants(db, userId);
	if (!canWrite(grants, shopId)) throw new PancakeAccessError();
	return grants;
}

export async function assertShopManager(
	db: Db,
	userId: string,
	shopId: string,
): Promise<void> {
	const grants = await shopGrants(db, userId);
	if (
		!grants.some((grant) => grant.shopId === shopId && grant.role === "MANAGER")
	)
		throw new PancakeAccessError();
}

export async function assertWorkspaceAdmin(
	db: Db,
	userId: string,
): Promise<void> {
	const member = await db.member.findUnique({
		where: { organizationId_userId: { organizationId: "workspace", userId } },
		select: { role: true },
	});
	if (!member || !["owner", "admin"].includes(member.role))
		throw new PancakeAccessError();
}
