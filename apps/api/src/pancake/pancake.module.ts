import { Module } from "@nestjs/common";
import { PancakeRouter } from "./pancake.router";
import { PancakeService } from "./pancake.service";
import { PancakeWebhookController } from "./pancake-webhook.controller";

@Module({
	providers: [PancakeRouter, PancakeService],
	controllers: [PancakeWebhookController],
})
export class PancakeModule {}
