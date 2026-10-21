import type { Db } from "@crm/db";
import {
	DEFAULT_AGENT_MODEL,
	SETTINGS_ID,
	writeAgentModel,
} from "@crm/db/settings";
import { z } from "zod";
import { MODEL_AUDIT } from "./model-audit-config";

const PER_MILLION = 1_000_000;

const rate = z
	.union([z.number(), z.string()])
	.transform((value) => Number(value))
	.refine((value) => Number.isFinite(value) && value > 0);

const gatewayModel = z.object({
	id: z.string(),
	type: z.string(),
	context_window: z.number(),
	tags: z.array(z.string()).catch([]),
	pricing: z.object({ input: rate, output: rate }),
});

const gatewayCatalog = z.object({ data: z.array(z.unknown()) });

export type AuditCandidate = {
	id: string;
	contextWindowTokens: number;
	inputPerMillion: number;
	outputPerMillion: number;
	monthlyUsd: number;
};

export type AuditResult =
	| { action: "switched" | "kept"; model: AuditCandidate; overBudget: boolean }
	| { action: "manual"; modelId: string }
	| { action: "empty" };

export function auditCandidates(catalog: unknown): AuditCandidate[] {
	const parsed = gatewayCatalog.safeParse(catalog);
	if (!parsed.success) return [];
	const { monthlyTokens } = MODEL_AUDIT;
	const found: AuditCandidate[] = [];
	for (const entry of parsed.data.data) {
		const model = gatewayModel.safeParse(entry);
		if (!model.success) continue;
		const { id, type, tags, context_window, pricing } = model.data;
		const inputPerMillion = pricing.input * PER_MILLION;
		const outputPerMillion = pricing.output * PER_MILLION;
		if (
			type !== "language" ||
			context_window < MODEL_AUDIT.minContextTokens ||
			outputPerMillion < MODEL_AUDIT.minOutputUsdPerMillion ||
			MODEL_AUDIT.excludedIdPattern.test(id) ||
			!(MODEL_AUDIT.providers as readonly string[]).includes(
				id.split("/")[0] ?? "",
			) ||
			!MODEL_AUDIT.requiredTags.every((tag) => tags.includes(tag)) ||
			MODEL_AUDIT.excludedTags.some((tag) => tags.includes(tag))
		)
			continue;
		found.push({
			id,
			contextWindowTokens: context_window,
			inputPerMillion,
			outputPerMillion,
			monthlyUsd:
				(monthlyTokens.input / PER_MILLION) * inputPerMillion +
				(monthlyTokens.output / PER_MILLION) * outputPerMillion,
		});
	}
	return found.sort(
		(a, b) => a.monthlyUsd - b.monthlyUsd || a.id.localeCompare(b.id),
	);
}

export function chooseModel(
	candidates: AuditCandidate[],
	currentId: string,
): { model: AuditCandidate; switched: boolean } | null {
	const best = candidates[0];
	if (!best) return null;
	const current = candidates.find((model) => model.id === currentId);
	if (
		current &&
		current.monthlyUsd <= best.monthlyUsd * MODEL_AUDIT.keepWithinRatio
	)
		return { model: current, switched: false };
	return { model: best, switched: true };
}

export async function runModelAudit(
	db: Db,
	fetcher: typeof fetch = fetch,
): Promise<AuditResult> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { agentModelId: true, agentModelAuto: true },
	});
	if (row?.agentModelId && !row.agentModelAuto)
		return { action: "manual", modelId: row.agentModelId };

	const response = await fetcher(MODEL_AUDIT.url, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(MODEL_AUDIT.timeoutMs),
	});
	if (!response.ok) throw new Error(`AI Gateway returned ${response.status}`);

	const chosen = chooseModel(
		auditCandidates(await response.json()),
		row?.agentModelId ?? DEFAULT_AGENT_MODEL.id,
	);
	if (!chosen) return { action: "empty" };

	const { model, switched } = chosen;
	if (switched)
		await writeAgentModel(
			db,
			{ id: model.id, contextWindowTokens: model.contextWindowTokens },
			{ auto: true },
		);
	return {
		action: switched ? "switched" : "kept",
		model,
		overBudget: model.monthlyUsd > MODEL_AUDIT.budgetUsd,
	};
}
