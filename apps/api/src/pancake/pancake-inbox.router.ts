import {
	automationListInput,
	automationRefInput,
	createAutomationInput,
	markAllReadInput,
	markReadInput,
	notificationListInput,
	notificationShopInput,
	toggleAutomationInput,
	updateAutomationInput,
} from "@crm/pancake/notifications";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { PancakeService } from "./pancake.service";

@Router({ alias: "pancakeInbox" })
@UseMiddlewares(AuthMiddleware)
export class PancakeInboxRouter {
	constructor(
		@Inject(PancakeService) private readonly pancake: PancakeService,
	) {}
	@Query({ input: notificationListInput })
	notifications(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof notificationListInput>,
	) {
		return this.pancake.notifications(ctx.user.id, input);
	}
	@Query({ input: notificationShopInput })
	counts(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof notificationShopInput>,
	) {
		return this.pancake.notificationCounts(ctx.user.id, input.shopId);
	}
	@Mutation({ input: markReadInput })
	markRead(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof markReadInput>,
	) {
		return this.pancake.markRead(ctx.user.id, input);
	}
	@Mutation({ input: markAllReadInput })
	markAllRead(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof markAllReadInput>,
	) {
		return this.pancake.markAllRead(ctx.user.id, input);
	}
	@Query({ input: automationListInput })
	automations(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof automationListInput>,
	) {
		return this.pancake.automations(ctx.user.id, input);
	}
	@Mutation({ input: createAutomationInput })
	createAutomation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createAutomationInput>,
	) {
		return this.pancake.createAutomation(ctx.user.id, input);
	}
	@Mutation({ input: updateAutomationInput })
	updateAutomation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateAutomationInput>,
	) {
		return this.pancake.updateAutomation(ctx.user.id, input);
	}
	@Mutation({ input: toggleAutomationInput })
	toggleAutomation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof toggleAutomationInput>,
	) {
		return this.pancake.toggleAutomation(ctx.user.id, input);
	}
	@Mutation({ input: automationRefInput })
	archiveAutomation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof automationRefInput>,
	) {
		return this.pancake.archiveAutomation(ctx.user.id, input);
	}
}
