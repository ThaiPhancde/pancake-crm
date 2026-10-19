import { Module } from "@nestjs/common";
import { PancakeRouter } from "./pancake.router";
import { PancakeService } from "./pancake.service";
import { PancakeInboxRouter } from "./pancake-inbox.router";
import { PancakeSettingsRouter } from "./pancake-settings.router";
import { PancakeWebhookController } from "./pancake-webhook.controller";

@Module({
	providers: [
		PancakeRouter,
		PancakeSettingsRouter,
		PancakeInboxRouter,
		PancakeService,
	],
	controllers: [PancakeWebhookController],
})
export class PancakeModule {}
