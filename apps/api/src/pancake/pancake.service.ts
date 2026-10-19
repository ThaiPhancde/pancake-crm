import type { Db } from "@crm/db";
import { PancakeAccessError } from "@crm/pancake/access";
import type {
	approveEmployeeInput,
	createAppointmentInput,
	createLeadInput,
	createNoteInput,
	createTicketInput,
	listInput,
	recordListInput,
	reportInput,
	roleInput,
	updateAppointmentInput,
	updateLeadInput,
	updateTicketInput,
} from "@crm/pancake/contracts";
import {
	appointmentReport,
	approveAllEmployees,
	approveEmployee,
	connectionStatus,
	createAppointment,
	createLead,
	createNote,
	createTicket,
	customerDetail,
	customerPurchases,
	dashboardReport,
	leadReport,
	listAppointments,
	listCustomers,
	listLeads,
	listOrders,
	listProducts,
	listTickets,
	membershipOptions,
	operationsOverview,
	orderDetail,
	pauseShop,
	resumeShop,
	sellerOptions,
	setMembership,
	ticketReport,
	updateAppointment,
	updateLead,
	updateTicket,
} from "@crm/pancake/queries";
import {
	createTask,
	type createTaskInput,
	listTasks,
	PancakeTaskConflict,
	taskAssignees,
	type taskListInput,
	updateTask,
	type updateTaskInput,
} from "@crm/pancake/tasks";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class PancakeService {
	constructor(@InjectDatabase() private readonly db: Db) {}
	orders(userId: string, input: z.infer<typeof listInput>) {
		return this.authorize(() => listOrders(this.db, userId, input));
	}
	customers(userId: string, input: z.infer<typeof listInput>) {
		return this.authorize(() => listCustomers(this.db, userId, input));
	}
	customerDetail(userId: string, shopId: string, customerId: string) {
		return this.authorize(() =>
			customerDetail(this.db, userId, shopId, customerId),
		);
	}
	products(userId: string, input: z.infer<typeof listInput>) {
		return this.authorize(() => listProducts(this.db, userId, input));
	}
	report(userId: string, input: z.infer<typeof listInput>) {
		return this.authorize(() => dashboardReport(this.db, userId, input));
	}
	detail(userId: string, shopId: string, orderId: string) {
		return this.authorize(() => orderDetail(this.db, userId, shopId, orderId));
	}
	purchases(
		userId: string,
		shopId: string,
		customerId: string,
		input: z.infer<typeof listInput>,
	) {
		return this.authorize(() =>
			customerPurchases(this.db, userId, shopId, customerId, input),
		);
	}
	status(userId: string) {
		return this.authorize(() => connectionStatus(this.db, userId));
	}
	overview(userId: string, input: z.infer<typeof listInput>) {
		return this.authorize(() => operationsOverview(this.db, userId, input));
	}
	sellers(userId: string, shopId?: string) {
		return this.authorize(() => sellerOptions(this.db, userId, shopId));
	}
	tasks(userId: string, input: z.infer<typeof taskListInput>) {
		return this.authorize(() => listTasks(this.db, userId, input));
	}
	taskAssignees(userId: string, shopId: string, orderId: string) {
		return this.authorize(() =>
			taskAssignees(this.db, userId, shopId, orderId),
		);
	}
	createTask(userId: string, input: z.infer<typeof createTaskInput>) {
		return this.authorize(() => createTask(this.db, userId, input));
	}
	updateTask(userId: string, input: z.infer<typeof updateTaskInput>) {
		return this.authorize(() => updateTask(this.db, userId, input));
	}
	options(userId: string, shopId: string) {
		return this.authorize(() => membershipOptions(this.db, userId, shopId));
	}
	membership(userId: string, input: z.infer<typeof roleInput>) {
		return this.authorize(() => setMembership(this.db, userId, input));
	}
	approveEmployee(userId: string, input: z.infer<typeof approveEmployeeInput>) {
		return this.authorize(() => approveEmployee(this.db, userId, input));
	}
	approveAllEmployees(userId: string, shopId: string) {
		return this.authorize(() => approveAllEmployees(this.db, userId, shopId));
	}
	pause(userId: string, shopId: string) {
		return this.authorize(() => pauseShop(this.db, userId, shopId));
	}
	leads(userId: string, input: z.infer<typeof recordListInput>) {
		return this.authorize(() => listLeads(this.db, userId, input));
	}
	createLead(userId: string, input: z.infer<typeof createLeadInput>) {
		return this.authorize(() => createLead(this.db, userId, input));
	}
	appointments(userId: string, input: z.infer<typeof recordListInput>) {
		return this.authorize(() => listAppointments(this.db, userId, input));
	}
	createAppointment(
		userId: string,
		input: z.infer<typeof createAppointmentInput>,
	) {
		return this.authorize(() => createAppointment(this.db, userId, input));
	}
	tickets(userId: string, input: z.infer<typeof recordListInput>) {
		return this.authorize(() => listTickets(this.db, userId, input));
	}
	createTicket(userId: string, input: z.infer<typeof createTicketInput>) {
		return this.authorize(() => createTicket(this.db, userId, input));
	}
	createNote(userId: string, input: z.infer<typeof createNoteInput>) {
		return this.authorize(() => createNote(this.db, userId, input));
	}
	resume(userId: string, shopId: string) {
		return this.authorize(() => resumeShop(this.db, userId, shopId));
	}
	updateLead(userId: string, input: z.infer<typeof updateLeadInput>) {
		return this.authorize(() => updateLead(this.db, userId, input));
	}
	updateAppointment(
		userId: string,
		input: z.infer<typeof updateAppointmentInput>,
	) {
		return this.authorize(() => updateAppointment(this.db, userId, input));
	}
	updateTicket(userId: string, input: z.infer<typeof updateTicketInput>) {
		return this.authorize(() => updateTicket(this.db, userId, input));
	}
	appointmentReport(userId: string, input: z.infer<typeof reportInput>) {
		return this.authorize(() => appointmentReport(this.db, userId, input));
	}
	ticketReport(userId: string, input: z.infer<typeof reportInput>) {
		return this.authorize(() => ticketReport(this.db, userId, input));
	}
	leadReport(userId: string, input: z.infer<typeof reportInput>) {
		return this.authorize(() => leadReport(this.db, userId, input));
	}
	private async authorize<T>(action: () => Promise<T>): Promise<T> {
		try {
			return await action();
		} catch (error) {
			if (error instanceof PancakeTaskConflict)
				throw new ConflictException(
					"Công việc đã thay đổi. Hãy tải lại trang.",
				);
			if (error instanceof PancakeAccessError)
				throw new ForbiddenException(error.message);
			throw error;
		}
	}
}
