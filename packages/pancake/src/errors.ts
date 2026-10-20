import { z } from "zod";
import { PancakeApiError } from "./client";
import { PANCAKE } from "./config";

export type Failure = {
	code: string;
	retryable: boolean;
	detail: string[];
};

const UNAVAILABLE = [
	/connection terminated/i,
	/can't reach database/i,
	/econnreset/i,
	/econnrefused/i,
	/etimedout/i,
	/socket disconnected/i,
	/connection timeout/i,
	/server closed the connection/i,
	/max_client_conn/i,
	/08P01/,
];

const TIMEOUT = [
	/expired transaction/i,
	/transaction api error/i,
	/statement timeout/i,
	/query read timeout/i,
];

function matches(patterns: readonly RegExp[], text: string) {
	return patterns.some((pattern) => pattern.test(text));
}

function operation(message: string) {
	const found = /prisma\.(\w+)\.(\w+)\(\)/.exec(message);
	return found ? `${found[1]}.${found[2]}` : undefined;
}

export function zodDetail(error: z.ZodError) {
	return error.issues
		.slice(0, PANCAKE.logIssuesMax)
		.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

export function classifyFailure(error: Error | undefined): Failure {
	if (error instanceof PancakeApiError)
		return { code: error.code, retryable: false, detail: [] };
	if (error instanceof z.ZodError)
		return {
			code: "PAYLOAD_INVALID",
			retryable: false,
			detail: zodDetail(error),
		};
	if (!(error instanceof Error))
		return { code: "UNKNOWN_ERROR", retryable: false, detail: [] };
	const message = error.message;
	const code = "code" in error ? String(error.code) : undefined;
	const detail = [operation(message), code, error.name].filter(
		(part): part is string => Boolean(part),
	);
	if (matches(TIMEOUT, message))
		return { code: "DATABASE_TIMEOUT", retryable: false, detail };
	if (matches(UNAVAILABLE, `${message} ${code ?? ""}`))
		return {
			code: "DATABASE_UNAVAILABLE",
			retryable: true,
			detail: [...detail, message.split("\n")[0]?.slice(0, 120) ?? ""].filter(
				Boolean,
			),
		};
	if (operation(message) || code?.startsWith("P"))
		return { code: "DATABASE_ERROR", retryable: false, detail };
	return { code: "UNKNOWN_ERROR", retryable: false, detail };
}

export function logSync(
	entry: { event: string; shopId: string } & {
		[key: string]: string | number | string[] | undefined;
	},
) {
	process.stderr.write(
		`${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
	);
}

export async function withDbRetry<T>(
	work: () => Promise<T>,
	delayMs: number = PANCAKE.dbRetryMs,
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await work();
		} catch (error) {
			if (
				!classifyFailure(error instanceof Error ? error : undefined)
					.retryable ||
				attempt >= PANCAKE.dbRetryAttempts
			)
				throw error;
			await Bun.sleep(delayMs * attempt);
		}
	}
}
