import {
	assignProfileInput,
	branchInput,
	branchMembersInput,
	branchRefInput,
	historyExportInput,
	historyListInput,
	profileInput,
	profileRefInput,
	updateBranchInput,
	updateProfileInput,
} from "@crm/pancake/admin";
import {
	bulkAssignPagesInput,
	configurePageSyncInput,
	confirmGeneratePageTokenInput,
	connectUserTokenInput,
	pagesListInput,
	setPageManualTokenInput,
	syncPagesNowInput,
} from "@crm/pancake/conversations";
import {
	copySettingsInput,
	createSavedFilterInput,
	revenueTargetsInput,
	savedFilterListInput,
	savedFilterRefInput,
	setDefaultSavedFilterInput,
	setRevenueTargetInput,
	updatePreferenceInput,
	updateSettingsInput,
} from "@crm/pancake/settings";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { PancakeService } from "./pancake.service";

const shopInput = z.object({ shopId: z.string().min(1) });

@Router({ alias: "pancakeSettings" })
@UseMiddlewares(AuthMiddleware)
export class PancakeSettingsRouter {
	constructor(
		@Inject(PancakeService) private readonly pancake: PancakeService,
	) {}
	@Query({ input: shopInput })
	get(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.settings(ctx.user.id, input.shopId);
	}
	@Mutation({ input: updateSettingsInput })
	update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateSettingsInput>,
	) {
		return this.pancake.updateSettings(ctx.user.id, input);
	}
	@Mutation({ input: copySettingsInput })
	copyFrom(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof copySettingsInput>,
	) {
		return this.pancake.copySettings(ctx.user.id, input);
	}
	@Query({ input: revenueTargetsInput })
	revenueTargets(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof revenueTargetsInput>,
	) {
		return this.pancake.revenueTargets(ctx.user.id, input);
	}
	@Mutation({ input: setRevenueTargetInput })
	setRevenueTarget(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setRevenueTargetInput>,
	) {
		return this.pancake.setRevenueTarget(ctx.user.id, input);
	}
	@Query({ input: shopInput })
	preferences(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.preferences(ctx.user.id, input.shopId);
	}
	@Mutation({ input: updatePreferenceInput })
	updatePreferences(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updatePreferenceInput>,
	) {
		return this.pancake.updatePreferences(ctx.user.id, input);
	}
	@Query({ input: savedFilterListInput })
	savedFilters(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof savedFilterListInput>,
	) {
		return this.pancake.savedFilters(ctx.user.id, input);
	}
	@Mutation({ input: createSavedFilterInput })
	createSavedFilter(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createSavedFilterInput>,
	) {
		return this.pancake.createSavedFilter(ctx.user.id, input);
	}
	@Mutation({ input: savedFilterRefInput })
	deleteSavedFilter(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof savedFilterRefInput>,
	) {
		return this.pancake.deleteSavedFilter(ctx.user.id, input);
	}
	@Mutation({ input: setDefaultSavedFilterInput })
	setDefaultSavedFilter(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setDefaultSavedFilterInput>,
	) {
		return this.pancake.setDefaultSavedFilter(ctx.user.id, input);
	}
	@Query({ input: shopInput })
	branches(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.branches(ctx.user.id, input.shopId);
	}
	@Mutation({ input: branchInput })
	createBranch(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof branchInput>,
	) {
		return this.pancake.createBranch(ctx.user.id, input);
	}
	@Mutation({ input: updateBranchInput })
	updateBranch(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateBranchInput>,
	) {
		return this.pancake.updateBranch(ctx.user.id, input);
	}
	@Mutation({ input: branchRefInput })
	archiveBranch(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof branchRefInput>,
	) {
		return this.pancake.archiveBranch(ctx.user.id, input);
	}
	@Mutation({ input: branchMembersInput })
	setBranchMembers(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof branchMembersInput>,
	) {
		return this.pancake.setBranchMembers(ctx.user.id, input);
	}
	@Query({ input: shopInput })
	profiles(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.profiles(ctx.user.id, input.shopId);
	}
	@Mutation({ input: profileInput })
	createProfile(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof profileInput>,
	) {
		return this.pancake.createProfile(ctx.user.id, input);
	}
	@Mutation({ input: updateProfileInput })
	updateProfile(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateProfileInput>,
	) {
		return this.pancake.updateProfile(ctx.user.id, input);
	}
	@Mutation({ input: profileRefInput })
	deleteProfile(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof profileRefInput>,
	) {
		return this.pancake.deleteProfile(ctx.user.id, input);
	}
	@Mutation({ input: assignProfileInput })
	assignProfile(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof assignProfileInput>,
	) {
		return this.pancake.assignProfile(ctx.user.id, input);
	}
	@Query({ input: historyListInput })
	history(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof historyListInput>,
	) {
		return this.pancake.history(ctx.user.id, input);
	}
	@Query({ input: historyExportInput })
	exportHistory(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof historyExportInput>,
	) {
		return this.pancake.exportHistory(ctx.user.id, input);
	}
	@Mutation({ input: connectUserTokenInput })
	connectPagesAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof connectUserTokenInput>,
	) {
		return this.pancake.connectPagesAccount(ctx.user.id, input);
	}
	@Query({ input: pagesListInput })
	pages(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof pagesListInput>,
	) {
		return this.pancake.pages(ctx.user.id, input);
	}
	@Mutation({ input: bulkAssignPagesInput })
	bulkAssignPages(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof bulkAssignPagesInput>,
	) {
		return this.pancake.bulkAssignPages(ctx.user.id, input);
	}
	@Mutation({ input: configurePageSyncInput })
	configurePageSync(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof configurePageSyncInput>,
	) {
		return this.pancake.configurePageSync(ctx.user.id, input);
	}
	@Mutation({ input: setPageManualTokenInput })
	setPageManualToken(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setPageManualTokenInput>,
	) {
		return this.pancake.setPageManualToken(ctx.user.id, input);
	}
	@Mutation({ input: confirmGeneratePageTokenInput })
	confirmGeneratePageToken(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof confirmGeneratePageTokenInput>,
	) {
		return this.pancake.confirmGeneratePageToken(ctx.user.id, input);
	}
	@Mutation({ input: syncPagesNowInput })
	syncPagesNow(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof syncPagesNowInput>,
	) {
		return this.pancake.syncPagesNow(ctx.user.id, input);
	}
}
