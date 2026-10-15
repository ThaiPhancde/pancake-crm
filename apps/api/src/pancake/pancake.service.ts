import type { Db } from "@crm/db";
import { PancakeAccessError } from "@crm/pancake/access";
import { listInput, roleInput } from "@crm/pancake/contracts";
import {
	connectionStatus,
	customerPurchases,
	dashboardReport,
	listCustomers,
	listOrders,
	listProducts,
	membershipOptions,
	operationsOverview,
	orderDetail,
	pauseShop,
	sellerOptions,
	setMembership,
} from "@crm/pancake/queries";
import {
	createTask,
	createTaskInput,
	listTasks,
	PancakeTaskConflict,
	taskAssignees,
	taskListInput,
	updateTask,
	updateTaskInput,
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
	pause(userId: string, shopId: string) {
		return this.authorize(() => pauseShop(this.db, userId, shopId));
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
