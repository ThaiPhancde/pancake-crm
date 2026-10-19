import "server-only";
import {
	createTRPCClient,
	httpBatchLink,
	retryLink,
	type TRPCClient,
} from "@trpc/client";
import {
	createTRPCOptionsProxy,
	type TRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import type { AppRouter } from "api/app-router";
import { cookies } from "next/headers";
import { cache } from "react";
import { API_URL } from "@/lib/env";
import { makeQueryClient } from "./query-client";

export const getServerQueryClient = cache(makeQueryClient);

export const getServerTrpcClient = cache((): TRPCClient<AppRouter> => {
	return createTRPCClient<AppRouter>({
		links: [
			retryLink({
				retry(opts) {
					if (opts.op.type !== "query") return false;
					if (
						opts.error.data &&
						opts.error.data.code !== "INTERNAL_SERVER_ERROR"
					) {
						return false;
					}
					return opts.attempts <= 2;
				},
				retryDelayMs: (attemptIndex) => attemptIndex * 250,
			}),
			httpBatchLink({
				url: `${API_URL}/api/trpc`,
				maxItems: 4,
				headers: async () => {
					const cookie = (await cookies()).toString();
					return cookie ? { cookie } : {};
				},
			}),
		],
	});
});

export function getServerTrpc(): TRPCOptionsProxy<AppRouter> {
	const client = getServerTrpcClient();

	return createTRPCOptionsProxy<AppRouter>({
		client,
		queryClient: getServerQueryClient,
	});
}
