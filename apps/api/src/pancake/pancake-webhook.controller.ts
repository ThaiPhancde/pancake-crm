import type { Db } from "@crm/db";
import { PANCAKE } from "@crm/pancake/config";
import { assertLiveAllowed } from "@crm/pancake/sync";
import { queueWebhook, webhookTokenValid } from "@crm/pancake/webhook";
import {
	BadRequestException,
	Controller,
	ForbiddenException,
	Headers,
	HttpCode,
	Param,
	PayloadTooLargeException,
	Post,
	Req,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { ZodError } from "zod";
import { InjectDatabase } from "../database/database.constants";

@Controller("api/integrations/pancake/webhook")
export class PancakeWebhookController {
	constructor(@InjectDatabase() private readonly db: Db) {}
	@Post(":shopId")
	@AllowAnonymous()
	@HttpCode(202)
	async receive(
		@Param("shopId") shopId: string,
		@Headers("x-pancake-webhook-token") token: string | undefined,
		@Req() request: Request,
	) {
		const shop = await this.db.pancakeShop.findUnique({
			where: { id: shopId },
		});
		if (
			!shop ||
			!webhookTokenValid(
				shop.webhookTokenEnv ? process.env[shop.webhookTokenEnv] : undefined,
				token,
			)
		)
			throw new ForbiddenException();
		try {
			assertLiveAllowed(shop);
		} catch {
			throw new ServiceUnavailableException("Live sync is locked.");
		}
		let raw: string;
		if (request.body !== undefined) {
			raw = JSON.stringify(request.body);
		} else {
			const chunks: Buffer[] = [];
			let size = 0;
			for await (const chunk of request) {
				const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				size += bytes.length;
				if (size > PANCAKE.webhookMaxBytes)
					throw new PayloadTooLargeException();
				chunks.push(bytes);
			}
			raw = Buffer.concat(chunks).toString("utf8");
		}
		if (Buffer.byteLength(raw) > PANCAKE.webhookMaxBytes)
			throw new PayloadTooLargeException();
		try {
			await queueWebhook(this.db, shopId, raw);
		} catch (error) {
			if (
				error instanceof ZodError ||
				error instanceof SyntaxError ||
				(error instanceof Error && error.message === "SHOP_MISMATCH")
			)
				throw new BadRequestException(
					"Unsupported or invalid Pancake webhook.",
				);
			throw new ServiceUnavailableException(
				"Webhook storage is unavailable. Retry this event.",
			);
		}
		return { accepted: true };
	}
}
