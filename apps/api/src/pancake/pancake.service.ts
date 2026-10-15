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
	orderDetail,
	pauseShop,
	setMembership,
} from "@crm/pancake/queries";
import { ForbiddenException, Injectable } from "@nestjs/common";
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
			if (error instanceof PancakeAccessError)
				throw new ForbiddenException(error.message);
			throw error;
		}
	}
}
