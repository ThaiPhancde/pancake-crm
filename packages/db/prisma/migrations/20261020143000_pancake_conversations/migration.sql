-- CreateTable
CREATE TABLE "pancakeAccountConnection" (
    "shopId" TEXT NOT NULL,
    "encryptedUserToken" TEXT NOT NULL,
    "tokenMasked" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeAccountConnection_pkey" PRIMARY KEY ("shopId")
);

-- CreateTable
CREATE TABLE "pancakePage" (
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "username" TEXT,
    "avatarUrl" TEXT,
    "sourceShopId" TEXT,
    "roleInPage" TEXT,
    "isActivated" BOOLEAN NOT NULL DEFAULT true,
    "hasSubscription" BOOLEAN NOT NULL DEFAULT true,
    "needFixWebhook" BOOLEAN NOT NULL DEFAULT false,
    "assigned" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedAccessToken" TEXT,
    "tokenMasked" TEXT,
    "tokenStatus" TEXT NOT NULL DEFAULT 'missing',
    "tokenSource" TEXT,
    "tokenReason" TEXT,
    "connectStatus" TEXT NOT NULL DEFAULT 'connected',
    "importFrom" TIMESTAMP(3),
    "importUntil" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorCode" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakePage_pkey" PRIMARY KEY ("shopId","pageId")
);

-- CreateTable
CREATE TABLE "pancakePageSyncCursor" (
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'idle',
    "lastConversationId" TEXT,
    "pendingConversationId" TEXT,
    "pendingMessageCount" INTEGER NOT NULL DEFAULT 0,
    "importFrom" TIMESTAMP(3),
    "importUntil" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "watermark" TIMESTAMP(3),
    "syncedConversations" INTEGER NOT NULL DEFAULT 0,
    "syncedMessages" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakePageSyncCursor_pkey" PRIMARY KEY ("shopId","pageId")
);

-- CreateTable
CREATE TABLE "pancakeConversation" (
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INBOX',
    "customerId" TEXT,
    "linkStatus" TEXT NOT NULL DEFAULT 'unlinked',
    "sourceCustomerId" TEXT,
    "pageCustomerId" TEXT,
    "psid" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "phoneTail" TEXT,
    "snippet" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "isReplied" BOOLEAN NOT NULL DEFAULT false,
    "canInbox" BOOLEAN NOT NULL DEFAULT true,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "assigneeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER,
    "messagesComplete" BOOLEAN NOT NULL DEFAULT false,
    "nextMessageCount" INTEGER NOT NULL DEFAULT 0,
    "sourceInsertedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "pancakeConversation_pkey" PRIMARY KEY ("shopId","pageId","conversationId")
);

-- CreateTable
CREATE TABLE "pancakeMessage" (
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INBOX',
    "senderType" TEXT NOT NULL DEFAULT 'customer',
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "originalMessage" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "hasPhone" BOOLEAN NOT NULL DEFAULT false,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "sourceInsertedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "pancakeMessage_pkey" PRIMARY KEY ("shopId","pageId","conversationId","messageId")
);

-- CreateTable
CREATE TABLE "pancakeOutboundMessage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'reply_inbox',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "remoteMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentByUserId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeOutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakePageWebhookEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "requestId" TEXT,
    "eventTimestamp" INTEGER,
    "version" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "pancakePageWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pancakePage_shopId_assigned_syncEnabled_idx" ON "pancakePage"("shopId", "assigned", "syncEnabled");

-- CreateIndex
CREATE INDEX "pancakePage_pageId_idx" ON "pancakePage"("pageId");

-- CreateIndex
CREATE INDEX "pancakeConversation_shopId_customerId_sourceUpdatedAt_idx" ON "pancakeConversation"("shopId", "customerId", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "pancakeConversation_shopId_sourceUpdatedAt_idx" ON "pancakeConversation"("shopId", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "pancakeConversation_shopId_pageId_sourceUpdatedAt_idx" ON "pancakeConversation"("shopId", "pageId", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "pancakeConversation_shopId_linkStatus_sourceUpdatedAt_idx" ON "pancakeConversation"("shopId", "linkStatus", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "pancakeConversation_shopId_phoneTail_idx" ON "pancakeConversation"("shopId", "phoneTail");

-- CreateIndex
CREATE INDEX "pancakeMessage_shopId_pageId_conversationId_sourceInsertedAt_idx" ON "pancakeMessage"("shopId", "pageId", "conversationId", "sourceInsertedAt");

-- CreateIndex
CREATE INDEX "pancakeOutboundMessage_shopId_pageId_conversationId_createdAt_idx" ON "pancakeOutboundMessage"("shopId", "pageId", "conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeOutboundMessage_shopId_pageId_conversationId_clientM_key" ON "pancakeOutboundMessage"("shopId", "pageId", "conversationId", "clientMessageId");

-- CreateIndex
CREATE INDEX "pancakePageWebhookEvent_shopId_pageId_receivedAt_idx" ON "pancakePageWebhookEvent"("shopId", "pageId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pancakePageWebhookEvent_shopId_pageId_dedupeKey_key" ON "pancakePageWebhookEvent"("shopId", "pageId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "pancakeAccountConnection" ADD CONSTRAINT "pancakeAccountConnection_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakePage" ADD CONSTRAINT "pancakePage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakePageSyncCursor" ADD CONSTRAINT "pancakePageSyncCursor_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakePageSyncCursor" ADD CONSTRAINT "pancakePageSyncCursor_shopId_pageId_fkey" FOREIGN KEY ("shopId", "pageId") REFERENCES "pancakePage"("shopId", "pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeConversation" ADD CONSTRAINT "pancakeConversation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeConversation" ADD CONSTRAINT "pancakeConversation_shopId_pageId_fkey" FOREIGN KEY ("shopId", "pageId") REFERENCES "pancakePage"("shopId", "pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeConversation" ADD CONSTRAINT "pancakeConversation_shopId_customerId_fkey" FOREIGN KEY ("shopId", "customerId") REFERENCES "pancakeCustomer"("shopId", "customerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeMessage" ADD CONSTRAINT "pancakeMessage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeMessage" ADD CONSTRAINT "pancakeMessage_shopId_pageId_fkey" FOREIGN KEY ("shopId", "pageId") REFERENCES "pancakePage"("shopId", "pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeMessage" ADD CONSTRAINT "pancakeMessage_shopId_pageId_conversationId_fkey" FOREIGN KEY ("shopId", "pageId", "conversationId") REFERENCES "pancakeConversation"("shopId", "pageId", "conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeOutboundMessage" ADD CONSTRAINT "pancakeOutboundMessage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeOutboundMessage" ADD CONSTRAINT "pancakeOutboundMessage_shopId_pageId_fkey" FOREIGN KEY ("shopId", "pageId") REFERENCES "pancakePage"("shopId", "pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeOutboundMessage" ADD CONSTRAINT "pancakeOutboundMessage_shopId_pageId_conversationId_fkey" FOREIGN KEY ("shopId", "pageId", "conversationId") REFERENCES "pancakeConversation"("shopId", "pageId", "conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakePageWebhookEvent" ADD CONSTRAINT "pancakePageWebhookEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakePageWebhookEvent" ADD CONSTRAINT "pancakePageWebhookEvent_shopId_pageId_fkey" FOREIGN KEY ("shopId", "pageId") REFERENCES "pancakePage"("shopId", "pageId") ON DELETE CASCADE ON UPDATE CASCADE;
