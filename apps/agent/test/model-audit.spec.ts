import { describe, expect, it } from "bun:test";
import { auditCandidates, chooseModel } from "../agent/lib/model-audit";

function entry(
	id: string,
	input: string,
	output: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		id,
		type: "language",
		context_window: 200_000,
		tags: ["tool-use"],
		pricing: { input, output },
		...overrides,
	};
}

describe("auditCandidates", () => {
	it("keeps cheap tool-capable models and drops the unsuitable ones", () => {
		const found = auditCandidates({
			data: [
				entry("openai/gpt-4o-mini", "0.00000015", "0.0000006"),
				entry("openai/gpt-4o", "0.0000025", "0.00001"),
				entry("google/flash-reasoner", "0.0000001", "0.0000005", {
					tags: ["tool-use", "reasoning"],
				}),
				entry("openai/gpt-nano-batch", "0.00000005", "0.0000005"),
				entry("mistral/tiny", "0.00000002", "0.00000003"),
				entry("openai/no-tools", "0.0000001", "0.0000005", { tags: [] }),
				entry("openai/short", "0.0000001", "0.0000005", {
					context_window: 32_000,
				}),
				entry("unknown/cheap", "0.0000001", "0.0000005"),
				entry("openai/zero", "0", "0"),
				entry("openai/embed", "0.0000001", "0.0000005", { type: "embedding" }),
				{ id: "broken" },
			],
		});
		expect(found.map((model) => model.id)).toEqual([
			"openai/gpt-4o-mini",
			"openai/gpt-4o",
		]);
	});

	it("estimates the month from both input and output price", () => {
		const [model] = auditCandidates({
			data: [entry("openai/gpt-4o-mini", "0.00000015", "0.0000006")],
		});
		expect(model?.monthlyUsd).toBeCloseTo(5 * 0.15 + 2 * 0.6, 6);
	});

	it("returns nothing for a malformed catalog", () => {
		expect(auditCandidates(null)).toEqual([]);
		expect(auditCandidates({ data: "x" })).toEqual([]);
	});
});

describe("chooseModel", () => {
	const cheap = {
		id: "a/cheap",
		contextWindowTokens: 1,
		inputPerMillion: 0,
		outputPerMillion: 0,
		monthlyUsd: 1,
	};
	const close = { ...cheap, id: "a/close", monthlyUsd: 1.1 };
	const dear = { ...cheap, id: "a/dear", monthlyUsd: 3 };

	it("switches when the current model is clearly more expensive", () => {
		expect(chooseModel([cheap, close, dear], "a/dear")).toEqual({
			model: cheap,
			switched: true,
		});
	});

	it("keeps the current model when it is within the tolerance", () => {
		expect(chooseModel([cheap, close, dear], "a/close")).toEqual({
			model: close,
			switched: false,
		});
	});

	it("switches when the current model left the catalog", () => {
		expect(chooseModel([cheap, dear], "a/gone")?.switched).toBe(true);
		expect(chooseModel([], "a/gone")).toBeNull();
	});
});
