import type { Db } from "@crm/db";
import { PANCAKE } from "@crm/pancake/config";
import { ingestPageWebhook } from "@crm/pancake/conversations";
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
	Query,
	Req,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { ZodError } from "zod";
import { InjectDatabase } from "../database/database.constants";

async function readWebhookRaw(request: Request): Promise<string> {
	let raw: string;
	if (request.body !== undefined) {
		raw = JSON.stringify(request.body);
	} else {
		const chunks: Buffer[] = [];
		let size = 0;
		for await (const chunk of request) {
			const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += bytes.length;
			if (size > PANCAKE.webhookMaxBytes) throw new PayloadTooLargeException();
			chunks.push(bytes);
		}
		raw = Buffer.concat(chunks).toString("utf8");
	}
	if (Buffer.byteLength(raw) > PANCAKE.webhookMaxBytes)
		throw new PayloadTooLargeException();
	return raw;
}

@Controller("api/integrations/pancake/webhook")
export class PancakeWebhookController {
	constructor(@InjectDatabase() private readonly db: Db) {}

	@Post("page/:shopId")
	@AllowAnonymous()
	@HttpCode(200)
	async receivePageForShop(
		@Param("shopId") shopId: string,
		@Headers("x-pancake-webhook-token") headerToken: string | undefined,
		@Query("token") queryToken: string | undefined,
		@Req() request: Request,
	) {
		return this.handlePageWebhook(
			request,
			headerToken ?? queryToken,
			shopId,
		);
	}

	@Post("page")
	@AllowAnonymous()
	@HttpCode(200)
	async receivePage(
		@Headers("x-pancake-webhook-token") headerToken: string | undefined,
		@Query("token") queryToken: string | undefined,
		@Query("shopId") shopId: string | undefined,
		@Req() request: Request,
	) {
		return this.handlePageWebhook(
			request,
			headerToken ?? queryToken,
			shopId,
		);
	}

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
		const raw = await readWebhookRaw(request);
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

	private async handlePageWebhook(
		request: Request,
		providedToken: string | undefined,
		explicitShopId?: string,
	) {
		const shop = explicitShopId
			? await this.db.pancakeShop.findUnique({
					where: { id: explicitShopId },
				})
			: null;
		if (explicitShopId && !shop) {
			throw new ForbiddenException();
		}
		const expectedToken =
			(shop?.webhookTokenEnv ? process.env[shop.webhookTokenEnv] : undefined) ??
			process.env.PANCAKE_PAGE_WEBHOOK_TOKEN;
		if (expectedToken && !webhookTokenValid(expectedToken, providedToken)) {
			throw new ForbiddenException();
		}
		const raw = await readWebhookRaw(request);
		try {
			return await ingestPageWebhook(this.db, raw, explicitShopId);
		} catch (error) {
			if (
				error instanceof ZodError ||
				error instanceof SyntaxError ||
				(error instanceof Error &&
					(error.message === "PAGE_ID_REQUIRED" ||
						error.message === "SHOP_NOT_FOUND"))
			) {
				throw new BadRequestException("Invalid Pancake Page webhook payload.");
			}
			throw new ServiceUnavailableException(
				"Page webhook processing unavailable.",
			);
		}
	}
}
