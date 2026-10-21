import {
	approveEmployeeInput,
	bulkUpdateInput,
	businessReportInput,
	contactCountsInput,
	createAppointmentInput,
	createLeadInput,
	createNoteInput,
	createTicketInput,
	customerDetailInput,
	listInput,
	recordListInput,
	recordRefInput,
	reportInput,
	roleInput,
	updateAppointmentInput,
	updateLeadInput,
	updateTicketInput,
} from "@crm/pancake/contracts";
import {
	customerConversationInput,
	sendCustomerMessageInput,
} from "@crm/pancake/conversations";
import { exportInput } from "@crm/pancake/exports";
import { searchInput } from "@crm/pancake/insights";
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
	@Query({ input: contactCountsInput })
	contactCounts(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactCountsInput>,
	) {
		return this.pancake.contactCounts(ctx.user.id, input);
	}
	@Query({ input: customerDetailInput })
	customerDetail(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof customerDetailInput>,
	) {
		return this.pancake.customerDetail(
			ctx.user.id,
			input.shopId,
			input.customerId,
		);
	}
	@Query({ input: listInput })
	products(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof listInput>,
	) {
		return this.pancake.products(ctx.user.id, input);
	}
	@Query({ input: businessReportInput })
	report(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof businessReportInput>,
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
	@Mutation({ input: approveEmployeeInput })
	approveEmployee(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof approveEmployeeInput>,
	) {
		return this.pancake.approveEmployee(ctx.user.id, input);
	}
	@Mutation({ input: shopInput })
	approveAllEmployees(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.approveAllEmployees(ctx.user.id, input.shopId);
	}
	@Mutation({ input: shopInput })
	pause(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.pause(ctx.user.id, input.shopId);
	}
	@Query({ input: recordListInput })
	leads(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordListInput>,
	) {
		return this.pancake.leads(ctx.user.id, input);
	}
	@Mutation({ input: createLeadInput })
	createLead(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createLeadInput>,
	) {
		return this.pancake.createLead(ctx.user.id, input);
	}
	@Query({ input: recordListInput })
	appointments(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordListInput>,
	) {
		return this.pancake.appointments(ctx.user.id, input);
	}
	@Mutation({ input: createAppointmentInput })
	createAppointment(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createAppointmentInput>,
	) {
		return this.pancake.createAppointment(ctx.user.id, input);
	}
	@Query({ input: recordListInput })
	tickets(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordListInput>,
	) {
		return this.pancake.tickets(ctx.user.id, input);
	}
	@Mutation({ input: createTicketInput })
	createTicket(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createTicketInput>,
	) {
		return this.pancake.createTicket(ctx.user.id, input);
	}
	@Mutation({ input: createNoteInput })
	createNote(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createNoteInput>,
	) {
		return this.pancake.createNote(ctx.user.id, input);
	}
	@Mutation({ input: shopInput })
	resume(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shopInput>,
	) {
		return this.pancake.resume(ctx.user.id, input.shopId);
	}
	@Mutation({ input: updateLeadInput })
	updateLead(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateLeadInput>,
	) {
		return this.pancake.updateLead(ctx.user.id, input);
	}
	@Mutation({ input: updateAppointmentInput })
	updateAppointment(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateAppointmentInput>,
	) {
		return this.pancake.updateAppointment(ctx.user.id, input);
	}
	@Mutation({ input: updateTicketInput })
	updateTicket(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateTicketInput>,
	) {
		return this.pancake.updateTicket(ctx.user.id, input);
	}
	@Query({ input: reportInput })
	appointmentReport(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportInput>,
	) {
		return this.pancake.appointmentReport(ctx.user.id, input);
	}
	@Query({ input: reportInput })
	ticketReport(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportInput>,
	) {
		return this.pancake.ticketReport(ctx.user.id, input);
	}
	@Query({ input: reportInput })
	leadReport(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportInput>,
	) {
		return this.pancake.leadReport(ctx.user.id, input);
	}
	@Query({ input: recordRefInput })
	leadDetail(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordRefInput>,
	) {
		return this.pancake.leadDetail(ctx.user.id, input);
	}
	@Mutation({ input: recordRefInput })
	convertLead(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordRefInput>,
	) {
		return this.pancake.convertLead(ctx.user.id, input);
	}
	@Mutation({ input: bulkUpdateInput })
	bulkUpdate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof bulkUpdateInput>,
	) {
		return this.pancake.bulkUpdate(ctx.user.id, input);
	}
	@Query({ input: searchInput })
	search(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof searchInput>,
	) {
		return this.pancake.search(ctx.user.id, input);
	}
	@Query({ input: exportInput })
	exportCsv(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof exportInput>,
	) {
		return this.pancake.exportCsv(ctx.user.id, input);
	}
	@Query({ input: reportInput })
	customerReport(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportInput>,
	) {
		return this.pancake.customerReport(ctx.user.id, input);
	}
	@Query({ input: reportInput })
	taskReport(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportInput>,
	) {
		return this.pancake.taskReport(ctx.user.id, input);
	}
	@Query({ input: customerConversationInput })
	customerConversation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof customerConversationInput>,
	) {
		return this.pancake.customerConversation(ctx.user.id, input);
	}
	@Mutation({ input: sendCustomerMessageInput })
	sendCustomerMessage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof sendCustomerMessageInput>,
	) {
		return this.pancake.sendCustomerMessage(ctx.user.id, input);
	}
}
