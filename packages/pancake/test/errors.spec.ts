import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { PancakeApiError } from "../src/client";
import { PANCAKE } from "../src/config";
import { customerWire } from "../src/contracts";
import { classifyFailure, withDbRetry } from "../src/errors";
import { safeErrorCode, storePage } from "../src/sync";

describe("classifyFailure", () => {
	test("a Pancake API error keeps its own code", () => {
		const failure = classifyFailure(new PancakeApiError("HTTP_429", 5000));
		expect(failure).toEqual({ code: "HTTP_429", retryable: false, detail: [] });
	});

	test("a schema failure is a payload problem and names the field only", () => {
		const parsed = z.object({ amount: z.number().min(0) }).safeParse({
			amount: -5,
		});
		if (parsed.success) throw new Error("expected a failure");
		const failure = classifyFailure(parsed.error);
		expect(failure.code).toBe("PAYLOAD_INVALID");
		expect(failure.retryable).toBe(false);
		expect(failure.detail[0]).toContain("amount");
		expect(failure.detail.join(" ")).not.toContain("-5");
	});

	test("a dropped connection is a database outage and is retryable", () => {
		for (const message of [
			"Connection terminated unexpectedly",
			"Can't reach database server at host:5432",
			"Database error. Code: `08P01`. Message: `no more connections allowed (max_client_conn)`",
		]) {
			const failure = classifyFailure(new Error(message));
			expect(failure.code).toBe("DATABASE_UNAVAILABLE");
			expect(failure.retryable).toBe(true);
		}
	});

	test("an expired transaction is a timeout and is not retried in place", () => {
		const failure = classifyFailure(
			new Error(
				"Transaction API error: A query cannot be executed on an expired transaction.",
			),
		);
		expect(failure.code).toBe("DATABASE_TIMEOUT");
		expect(failure.retryable).toBe(false);
	});

	test("a Prisma constraint error is a database error without row values", () => {
		const error = Object.assign(
			new Error(
				"Invalid `prisma.pancakeCustomer.upsert()` invocation:\nUnique constraint failed on (`phone`) with value 0123456789",
			),
			{ code: "P2002" },
		);
		const failure = classifyFailure(error);
		expect(failure.code).toBe("DATABASE_ERROR");
		expect(failure.retryable).toBe(false);
		expect(failure.detail).toContain("pancakeCustomer.upsert");
		expect(failure.detail).toContain("P2002");
		expect(failure.detail.join(" ")).not.toContain("0123456789");
	});

	test("anything else is unknown and safeErrorCode agrees", () => {
		expect(classifyFailure(new Error("boom")).code).toBe("UNKNOWN_ERROR");
		expect(classifyFailure(undefined).code).toBe("UNKNOWN_ERROR");
		expect(safeErrorCode(new Error("Connection terminated unexpectedly"))).toBe(
			"DATABASE_UNAVAILABLE",
		);
	});
});

describe("withDbRetry", () => {
	test("retries a database outage and then succeeds", async () => {
		let calls = 0;
		const result = await withDbRetry(async () => {
			calls++;
			if (calls < 2) throw new Error("Connection terminated unexpectedly");
			return "ok";
		}, 1);
		expect(result).toBe("ok");
		expect(calls).toBe(2);
	});

	test("gives up after the configured number of attempts", async () => {
		let calls = 0;
		await expect(
			withDbRetry(async () => {
				calls++;
				throw new Error("Connection terminated unexpectedly");
			}, 1),
		).rejects.toThrow("Connection terminated");
		expect(calls).toBe(PANCAKE.dbRetryAttempts);
	});

	test("never retries a payload or constraint failure", async () => {
		let calls = 0;
		await expect(
			withDbRetry(async () => {
				calls++;
				throw Object.assign(new Error("Invalid `prisma.x.y()` invocation"), {
					code: "P2002",
				});
			}),
		).rejects.toThrow();
		expect(calls).toBe(1);
	});
});

describe("customer payload that stalled the UAE shop", () => {
	test("a negative purchased_amount is accepted", () => {
		const parsed = customerWire.safeParse({
			id: "2cf5c21a-0fc7-44d4-a0d2-f24c780e7b46",
			name: "Customer",
			purchased_amount: -120,
		});
		expect(parsed.success).toBe(true);
	});

	test("a missing id is still rejected", () => {
		expect(customerWire.safeParse({ name: "Customer" }).success).toBe(false);
	});
});

describe("storePage skips one invalid customer and keeps the page", () => {
	function fakeTx(written: string[]) {
		return {
			$queryRaw: async () => [],
			pancakeCustomer: {
				findUnique: async () => null,
				upsert: async (args: { create: { customerId: string } }) => {
					written.push(args.create.customerId);
					return {};
				},
			},
		};
	}

	test("valid customers are written and the invalid one is logged without values", async () => {
		const written: string[] = [];
		const lines: string[] = [];
		const original = process.stderr.write.bind(process.stderr);
		process.stderr.write = ((chunk: string) => {
			lines.push(String(chunk));
			return true;
		}) as typeof process.stderr.write;
		try {
			const count = await storePage(
				fakeTx(written) as never,
				"shop-1",
				"customers",
				[
					{ id: "c1", name: "A" },
					{ id: "c2", name: "B", phone_numbers: "not-a-list" },
					{ id: "c3", name: "C" },
				],
				new Date(),
			);
			expect(count).toBe(2);
			expect(written).toEqual(["c1", "c3"]);
		} finally {
			process.stderr.write = original;
		}
		const entry = JSON.parse(lines.join("").trim());
		expect(entry.event).toBe("record_skipped");
		expect(entry.recordId).toBe("c2");
		expect(entry.code).toBe("PAYLOAD_INVALID");
		expect(JSON.stringify(entry)).not.toContain("not-a-list");
	});

	test("a database failure still aborts the page", async () => {
		const tx = {
			$queryRaw: async () => [],
			pancakeCustomer: {
				findUnique: async () => {
					throw new Error("Connection terminated unexpectedly");
				},
				upsert: async () => ({}),
			},
		};
		await expect(
			storePage(
				tx as never,
				"shop-1",
				"customers",
				[{ id: "c1", name: "A" }],
				new Date(),
			),
		).rejects.toThrow("Connection terminated");
	});
});
