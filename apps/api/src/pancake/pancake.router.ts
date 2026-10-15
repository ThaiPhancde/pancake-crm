import { listInput, roleInput } from "@crm/pancake/contracts";
import {
	createTaskInput,
	taskListInput,
	updateTaskInput,
} from "@crm/pancake/tasks";
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
const orderInput = shopInput.extend({ orderId: z.string().min(1) });
const purchaseInput = z.object({
	shopId: z.string().min(1),
	customerId: z.string().min(1),
	filters: listInput,
});

@Router({ alias: "pancake" })
@UseMiddlewares(AuthMiddleware)
export class PancakeRouter {
	constructor(
		@Inject(PancakeService) private readonly pancake: PancakeService,
	) {}
	@Query({ input: listInput })
	overview(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listInput>,
	) {
		return this.pancake.overview(ctx.user.id, input);
	}
	@Query({ input: z.object({ shopId: z.string().min(1).optional() }) })
	sellers(@Ctx() ctx: AuthedTrpcContext, @Input() input: { shopId?: string }) {
		return this.pancake.sellers(ctx.user.id, input.shopId);
	}
	@Query({ input: taskListInput })
	tasks(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof taskListInput>,
	) {
		return this.pancake.tasks(ctx.user.id, input);
	}
	@Query({ input: orderInput })
	taskAssignees(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof orderInput>,
	) {
		return this.pancake.taskAssignees(ctx.user.id, input.shopId, input.orderId);
	}
	@Mutation({ input: createTaskInput })
	createTask(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createTaskInput>,
	) {
		return this.pancake.createTask(ctx.user.id, input);
	}
	@Mutation({ input: updateTaskInput })
	updateTask(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateTaskInput>,
	) {
		return this.pancake.updateTask(ctx.user.id, input);
	}
	@Query({ input: listInput })
	orders(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listInput>,
	) {
		return this.pancake.orders(ctx.user.id, input);
	}
	@Query({ input: listInput })
	customers(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listInput>,
	) {
		return this.pancake.customers(ctx.user.id, input);
	}
	@Query({ input: listInput })
	products(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listInput>,
	) {
		return this.pancake.products(ctx.user.id, input);
	}
	@Query({ input: listInput })
	report(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listInput>,
	) {
		return this.pancake.report(ctx.user.id, input);
	}
	@Query({ input: orderInput })
	detail(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof orderInput>,
	) {
		return this.pancake.detail(ctx.user.id, input.shopId, input.orderId);
	}
	@Query({ input: purchaseInput })
	purchases(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof purchaseInput>,
	) {
		return this.pancake.purchases(
			ctx.user.id,
			input.shopId,
			input.customerId,
			input.filters,
		);
	}
	@Query()
	status(@Ctx() ctx: AuthedTrpcContext) {
		return this.pancake.status(ctx.user.id);
	}
	@Query({ input: shopInput })
	options(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.options(ctx.user.id, input.shopId);
	}
	@Mutation({ input: roleInput })
	setMembership(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof roleInput>,
	) {
		return this.pancake.membership(ctx.user.id, input);
	}
	@Mutation({ input: shopInput })
	pause(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.pause(ctx.user.id, input.shopId);
	}
}
