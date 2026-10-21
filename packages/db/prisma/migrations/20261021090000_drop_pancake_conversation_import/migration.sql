DROP TABLE "pancakePageWebhookEvent";
DROP TABLE "pancakeOutboundMessage";
DROP TABLE "pancakeMessage";
DROP TABLE "pancakeConversation";
DROP TABLE "pancakePageSyncCursor";

DROP INDEX "pancakePage_shopId_assigned_syncEnabled_idx";

ALTER TABLE "pancakePage"
  DROP COLUMN "assigned",
  DROP COLUMN "syncEnabled",
  DROP COLUMN "connectStatus",
  DROP COLUMN "importFrom",
  DROP COLUMN "importUntil",
  DROP COLUMN "lastSyncAt",
  DROP COLUMN "lastSuccessAt",
  DROP COLUMN "lastWebhookAt";

ALTER TABLE "appSetting" ADD COLUMN "agentModelAuto" BOOLEAN NOT NULL DEFAULT false;
