import { type Db, Prisma } from "@crm/db";
import { PancakeAccessError } from "@crm/pancake/access";
import {
	archiveBranch,
	assignProfile,
	type assignProfileInput,
	type branchInput,
	type branchMembersInput,
	type branchRefInput,
	createBranch,
	createProfile,
	deleteProfile,
	exportHistory,
	type historyExportInput,
	type historyListInput,
	listBranches,
	listHistory,
	listProfiles,
	type profileInput,
	type profileRefInput,
	setBranchMembers,
	updateBranch,
	type updateBranchInput,
	updateProfile,
	type updateProfileInput,
} from "@crm/pancake/admin";
import type {
	approveEmployeeInput,
	bulkUpdateInput,
	businessReportInput,
	contactCountsInput,
	createAppointmentInput,
	createLeadInput,
	createNoteInput,
	createTicketInput,
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
	confirmGeneratePageToken,
	type confirmGeneratePageTokenInput,
	connectAndDiscoverPages,
	type connectUserTokenInput,
	customerConversation,
	type customerConversationInput,
	listWorkspacePages,
	type pagesListInput,
	sendCustomerMessage,
	type sendCustomerMessageInput,
	setPageManualToken,
	type setPageManualTokenInput,
} from "@crm/pancake/conversations";
import { type ExportInput, exportCsv } from "@crm/pancake/exports";
import {
	bulkUpdate,
	convertLead,
	customerReport,
	globalSearch,
	leadDetail,
	type searchInput,
	taskReport,
} from "@crm/pancake/insights";
import {
	archiveAutomation,
	type automationListInput,
	type automationRefInput,
	createAutomation,
	type createAutomationInput,
	listAutomations,
	listNotifications,
	markAllNotificationsRead,
	type markAllReadInput,
	markNotificationRead,
	type markReadInput,
	notificationCounts,
	type notificationListInput,
	PancakeAutomationInvalid,
	type RecordEvent,
	recordEffects,
	recordLink,
	toggleAutomation,
	type toggleAutomationInput,
	updateAutomation,
	type updateAutomationInput,
} from "@crm/pancake/notifications";
import { PancakePagesApiError } from "@crm/pancake/pages-client";
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
	newContactCounts,
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
	copySettings,
	type copySettingsInput,
	createSavedFilter,
	type createSavedFilterInput,
	deleteSavedFilter,
	getPreferences,
	getSettings,
	listSavedFilters,
	PancakeSavedFilterLimit,
	revenueTargets,
	type revenueTargetsInput,
	type savedFilterListInput,
	type savedFilterRefInput,
	setDefaultSavedFilter,
	type setDefaultSavedFilterInput,
	setRevenueTarget,
	type setRevenueTargetInput,
	type updatePreferenceInput,
	updatePreferences,
	updateSettings,
	type updateSettingsInput,
} from "@crm/pancake/settings";
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
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";

type RecordRow = {
	id: string;
	shopId: string;
	assigneeId: string | null;
	name?: string;
	title?: string;
};

@Injectable()
export class PancakeService {
	private readonly logger = new Logger(PancakeService.name);
	constructor(@InjectDatabase() private readonly db: Db) {}
	orders(userId: string, input: z.infer<typeof listInput>) {
		return this.authorize(() => listOrders(this.db, userId, input));
	}
	contactCounts(userId: string, input: z.infer<typeof contactCountsInput>) {
		return this.authorize(() => newContactCounts(this.db, userId, input));
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
	report(userId: string, input: z.infer<typeof businessReportInput>) {
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
		return this.authorize(async () => {
			const row = await createTask(this.db, userId, input);
			await this.effects(userId, {
				shopId: input.shopId,
				entity: "task",
				trigger: "record_created",
				id: row.id,
				title: input.title,
				link: recordLink("task", row.id, input.orderId),
				assigneeEmployeeId: null,
				assigneeUserId: input.assigneeId ?? userId,
				assignedNow: true,
			});
			return row;
		});
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
		return this.authorize(async () => {
			const row = await createLead(this.db, userId, input);
			await this.recordEvent(userId, "lead", "record_created", row, true);
			return row;
		});
	}
	appointments(userId: string, input: z.infer<typeof recordListInput>) {
		return this.authorize(() => listAppointments(this.db, userId, input));
	}
	createAppointment(
		userId: string,
		input: z.infer<typeof createAppointmentInput>,
	) {
		return this.authorize(async () => {
			const row = await createAppointment(this.db, userId, input);
			await this.recordEvent(
				userId,
				"appointment",
				"record_created",
				row,
				true,
			);
			return row;
		});
	}
	tickets(userId: string, input: z.infer<typeof recordListInput>) {
		return this.authorize(() => listTickets(this.db, userId, input));
	}
	createTicket(userId: string, input: z.infer<typeof createTicketInput>) {
		return this.authorize(async () => {
			const row = await createTicket(this.db, userId, input);
			await this.recordEvent(userId, "ticket", "record_created", row, true);
			return row;
		});
	}
	createNote(userId: string, input: z.infer<typeof createNoteInput>) {
		return this.authorize(() => createNote(this.db, userId, input));
	}
	resume(userId: string, shopId: string) {
		return this.authorize(() => resumeShop(this.db, userId, shopId));
	}
	updateLead(userId: string, input: z.infer<typeof updateLeadInput>) {
		return this.authorize(async () => {
			const row = await updateLead(this.db, userId, input);
			await this.recordEvent(
				userId,
				"lead",
				"record_updated",
				row,
				Boolean(input.assigneeId),
			);
			return row;
		});
	}
	updateAppointment(
		userId: string,
		input: z.infer<typeof updateAppointmentInput>,
	) {
		return this.authorize(async () => {
			const row = await updateAppointment(this.db, userId, input);
			await this.recordEvent(
				userId,
				"appointment",
				"record_updated",
				row,
				Boolean(input.assigneeId),
			);
			return row;
		});
	}
	updateTicket(userId: string, input: z.infer<typeof updateTicketInput>) {
		return this.authorize(async () => {
			const row = await updateTicket(this.db, userId, input);
			await this.recordEvent(
				userId,
				"ticket",
				"record_updated",
				row,
				Boolean(input.assigneeId),
			);
			return row;
		});
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
	leadDetail(userId: string, input: z.infer<typeof recordRefInput>) {
		return this.authorize(() => leadDetail(this.db, userId, input));
	}
	convertLead(userId: string, input: z.infer<typeof recordRefInput>) {
		return this.authorize(async () => {
			const row = await convertLead(this.db, userId, input);
			await this.recordEvent(userId, "lead", "converted", row, false);
			return row;
		});
	}
	bulkUpdate(userId: string, input: z.infer<typeof bulkUpdateInput>) {
		return this.authorize(async () => {
			const result = await bulkUpdate(this.db, userId, input);
			for (const row of result.updated)
				await this.effects(userId, {
					shopId: input.shopId,
					entity: input.entity,
					trigger: "record_updated",
					id: row.id,
					title: row.title,
					link: recordLink(input.entity, row.id),
					assigneeEmployeeId: row.assigneeId,
					assignedNow: Boolean(input.assigneeId),
				});
			return {
				updated: result.updated.map((row) => row.id),
				failed: result.failed,
			};
		});
	}
	search(userId: string, input: z.infer<typeof searchInput>) {
		return this.authorize(() => globalSearch(this.db, userId, input));
	}
	exportCsv(userId: string, input: ExportInput) {
		return this.authorize(() => exportCsv(this.db, userId, input));
	}
	customerReport(userId: string, input: z.infer<typeof reportInput>) {
		return this.authorize(() => customerReport(this.db, userId, input));
	}
	taskReport(userId: string, input: z.infer<typeof reportInput>) {
		return this.authorize(() => taskReport(this.db, userId, input));
	}
	settings(userId: string, shopId: string) {
		return this.authorize(() => getSettings(this.db, userId, shopId));
	}
	updateSettings(userId: string, input: z.infer<typeof updateSettingsInput>) {
		return this.authorize(() => updateSettings(this.db, userId, input));
	}
	copySettings(userId: string, input: z.infer<typeof copySettingsInput>) {
		return this.authorize(() => copySettings(this.db, userId, input));
	}
	revenueTargets(userId: string, input: z.infer<typeof revenueTargetsInput>) {
		return this.authorize(() => revenueTargets(this.db, userId, input));
	}
	setRevenueTarget(
		userId: string,
		input: z.infer<typeof setRevenueTargetInput>,
	) {
		return this.authorize(() => setRevenueTarget(this.db, userId, input));
	}
	preferences(userId: string, shopId: string) {
		return this.authorize(() => getPreferences(this.db, userId, shopId));
	}
	updatePreferences(
		userId: string,
		input: z.infer<typeof updatePreferenceInput>,
	) {
		return this.authorize(() => updatePreferences(this.db, userId, input));
	}
	savedFilters(userId: string, input: z.infer<typeof savedFilterListInput>) {
		return this.authorize(() => listSavedFilters(this.db, userId, input));
	}
	createSavedFilter(
		userId: string,
		input: z.infer<typeof createSavedFilterInput>,
	) {
		return this.authorize(() => createSavedFilter(this.db, userId, input));
	}
	deleteSavedFilter(
		userId: string,
		input: z.infer<typeof savedFilterRefInput>,
	) {
		return this.authorize(() => deleteSavedFilter(this.db, userId, input));
	}
	setDefaultSavedFilter(
		userId: string,
		input: z.infer<typeof setDefaultSavedFilterInput>,
	) {
		return this.authorize(() => setDefaultSavedFilter(this.db, userId, input));
	}
	branches(userId: string, shopId: string) {
		return this.authorize(() => listBranches(this.db, userId, shopId));
	}
	createBranch(userId: string, input: z.infer<typeof branchInput>) {
		return this.authorize(() => createBranch(this.db, userId, input));
	}
	updateBranch(userId: string, input: z.infer<typeof updateBranchInput>) {
		return this.authorize(() => updateBranch(this.db, userId, input));
	}
	archiveBranch(userId: string, input: z.infer<typeof branchRefInput>) {
		return this.authorize(() => archiveBranch(this.db, userId, input));
	}
	setBranchMembers(userId: string, input: z.infer<typeof branchMembersInput>) {
		return this.authorize(() => setBranchMembers(this.db, userId, input));
	}
	profiles(userId: string, shopId: string) {
		return this.authorize(() => listProfiles(this.db, userId, shopId));
	}
	createProfile(userId: string, input: z.infer<typeof profileInput>) {
		return this.authorize(() => createProfile(this.db, userId, input));
	}
	updateProfile(userId: string, input: z.infer<typeof updateProfileInput>) {
		return this.authorize(() => updateProfile(this.db, userId, input));
	}
	deleteProfile(userId: string, input: z.infer<typeof profileRefInput>) {
		return this.authorize(() => deleteProfile(this.db, userId, input));
	}
	assignProfile(userId: string, input: z.infer<typeof assignProfileInput>) {
		return this.authorize(() => assignProfile(this.db, userId, input));
	}
	history(userId: string, input: z.infer<typeof historyListInput>) {
		return this.authorize(() => listHistory(this.db, userId, input));
	}
	exportHistory(userId: string, input: z.infer<typeof historyExportInput>) {
		return this.authorize(() => exportHistory(this.db, userId, input));
	}
	notifications(userId: string, input: z.infer<typeof notificationListInput>) {
		return this.authorize(() => listNotifications(this.db, userId, input));
	}
	notificationCounts(userId: string, shopId: string) {
		return this.authorize(() => notificationCounts(this.db, userId, shopId));
	}
	markRead(userId: string, input: z.infer<typeof markReadInput>) {
		return this.authorize(() => markNotificationRead(this.db, userId, input));
	}
	markAllRead(userId: string, input: z.infer<typeof markAllReadInput>) {
		return this.authorize(() =>
			markAllNotificationsRead(this.db, userId, input),
		);
	}
	automations(userId: string, input: z.infer<typeof automationListInput>) {
		return this.authorize(() => listAutomations(this.db, userId, input));
	}
	createAutomation(
		userId: string,
		input: z.infer<typeof createAutomationInput>,
	) {
		return this.authorize(() => createAutomation(this.db, userId, input));
	}
	updateAutomation(
		userId: string,
		input: z.infer<typeof updateAutomationInput>,
	) {
		return this.authorize(() => updateAutomation(this.db, userId, input));
	}
	toggleAutomation(
		userId: string,
		input: z.infer<typeof toggleAutomationInput>,
	) {
		return this.authorize(() => toggleAutomation(this.db, userId, input));
	}
	archiveAutomation(userId: string, input: z.infer<typeof automationRefInput>) {
		return this.authorize(() => archiveAutomation(this.db, userId, input));
	}
	connectPagesAccount(
		userId: string,
		input: z.infer<typeof connectUserTokenInput>,
	) {
		return this.authorize(() =>
			connectAndDiscoverPages(this.db, userId, input),
		);
	}
	pages(userId: string, input: z.infer<typeof pagesListInput>) {
		return this.authorize(() => listWorkspacePages(this.db, userId, input));
	}
	setPageManualToken(
		userId: string,
		input: z.infer<typeof setPageManualTokenInput>,
	) {
		return this.authorize(() => setPageManualToken(this.db, userId, input));
	}
	confirmGeneratePageToken(
		userId: string,
		input: z.infer<typeof confirmGeneratePageTokenInput>,
	) {
		return this.authorize(() =>
			confirmGeneratePageToken(this.db, userId, input),
		);
	}
	customerConversation(
		userId: string,
		input: z.infer<typeof customerConversationInput>,
	) {
		return this.authorize(() => customerConversation(this.db, userId, input));
	}
	sendCustomerMessage(
		userId: string,
		input: z.infer<typeof sendCustomerMessageInput>,
	) {
		return this.authorize(() => sendCustomerMessage(this.db, userId, input));
	}
	private recordEvent(
		userId: string,
		entity: "lead" | "appointment" | "ticket",
		trigger: RecordEvent["trigger"],
		row: RecordRow,
		assignedNow: boolean,
	) {
		return this.effects(userId, {
			shopId: row.shopId,
			entity,
			trigger,
			id: row.id,
			title: row.title ?? row.name ?? "",
			link: recordLink(entity, row.id),
			assigneeEmployeeId: row.assigneeId,
			assignedNow,
		});
	}
	private async effects(userId: string, event: RecordEvent) {
		try {
			const result = await recordEffects(this.db, userId, event);
			if (result.automations.length)
				this.logger.log({
					message: "Pancake automations ran",
					shopId: event.shopId,
					entity: event.entity,
					trigger: event.trigger,
					automations: result.automations.length,
				});
		} catch (error) {
			this.logger.error(
				{
					message: "Pancake record effects failed",
					shopId: event.shopId,
					entity: event.entity,
					trigger: event.trigger,
				},
				error instanceof Error ? error.stack : undefined,
			);
		}
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
			if (error instanceof PancakePagesApiError) {
				if (
					error.code === "PERMISSION_DENIED" ||
					error.code === "TOKEN_EXPIRED_OR_REVOKED"
				)
					throw new ForbiddenException(error.message);
				throw new BadRequestException(error.message);
			}
			if (error instanceof PancakeSavedFilterLimit)
				throw new BadRequestException("Đã đạt số bộ lọc tối đa.");
			if (error instanceof PancakeAutomationInvalid)
				throw new BadRequestException(
					"Phân công tự động chỉ dùng cho tiềm năng, lịch hẹn hoặc vấn đề.",
				);
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			)
				throw new ConflictException("Tên đã tồn tại.");
			throw error;
		}
	}
}
