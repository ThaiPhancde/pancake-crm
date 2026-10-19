import { API_KEY_HEADER, AUTH_COOKIE_PREFIX, auth } from "@crm/auth";
import { Injectable } from "@nestjs/common";
import { getSessionCookie } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import type { ContextOptions, TRPCContext } from "nestjs-trpc";
import type { BaseTrpcContext } from "./context.types";

const requestSessions = new WeakMap<
	Request,
	Promise<BaseTrpcContext["session"]>
>();

async function resolveRequestSession(
	req: Request,
): Promise<BaseTrpcContext["session"]> {
	const existing = requestSessions.get(req);
	if (existing) return existing;

	const headers = fromNodeHeaders(req.headers);
	if (
		!headers.has(API_KEY_HEADER) &&
		getSessionCookie(headers, { cookiePrefix: AUTH_COOKIE_PREFIX }) === null
	) {
		return null;
	}

	const lookup = auth.api
		.getSession({ headers })
		.catch(async () => {
			await new Promise((resolve) => setTimeout(resolve, 120));
			return auth.api.getSession({ headers });
		})
		.catch(() => null);

	requestSessions.set(req, lookup);
	return lookup;
}

export async function createBaseTrpcContext(
	req: Request | undefined,
): Promise<BaseTrpcContext> {
	const session = req ? await resolveRequestSession(req) : null;
	return { req, session };
}

@Injectable()
export class TrpcContext implements TRPCContext {
	async create(opts: ContextOptions): Promise<BaseTrpcContext> {
		const req = "req" in opts ? opts.req : undefined;
		return createBaseTrpcContext(req);
	}
}
