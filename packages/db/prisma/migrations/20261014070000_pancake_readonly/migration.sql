-- CreateEnum
CREATE TYPE "PancakeRole" AS ENUM ('MANAGER', 'TELESALE', 'VIEWER');

-- CreateTable
CREATE TABLE "pancakeShop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyEnv" TEXT NOT NULL,
    "webhookTokenEnv" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "liveApprovedAt" TIMESTAMP(3),
    "fixtureVerifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pancakeShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeShopMember" (
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PancakeRole" NOT NULL,
    "employeeId" TEXT,

    CONSTRAINT "pancakeShopMember_pkey" PRIMARY KEY ("shopId","userId")
);

-- CreateTable
CREATE TABLE "pancakeCustomer" (
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "assignedEmployeeId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "pancakeCustomer_pkey" PRIMARY KEY ("shopId","customerId")
);

-- CreateTable
CREATE TABLE "pancakeProduct" (
    "shopId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(24,4),
    "stock" DECIMAL(24,4),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "sourceUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "pancakeProduct_pkey" PRIMARY KEY ("shopId","variationId")
);

-- CreateTable
CREATE TABLE "pancakeEmployee" (
    "shopId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "pancakeEmployee_pkey" PRIMARY KEY ("shopId","employeeId")
);

-- CreateTable
CREATE TABLE "pancakeOrder" (
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "sellerId" TEXT,
    "sellerName" TEXT,
    "careId" TEXT,
    "creatorId" TEXT,
    "lastEditorId" TEXT,
    "status" INTEGER NOT NULL,
    "subStatus" INTEGER,
    "currency" TEXT NOT NULL,
    "totalPrice" DECIMAL(24,4) NOT NULL,
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "deliveryStatus" TEXT,
    "returnReason" TEXT,
    "sourceCreatedAt" TIMESTAMP(3) NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "pancakeOrder_pkey" PRIMARY KEY ("shopId","orderId")
);

-- CreateTable
CREATE TABLE "pancakeOrderHistory" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "oldStatus" INTEGER,
    "status" INTEGER NOT NULL,
    "subStatus" INTEGER,
    "deliveryStatus" TEXT,
    "trackingCode" TEXT,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "pancakeOrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeReturn" (
    "shopId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" INTEGER NOT NULL,
    "returnedFee" DECIMAL(24,4),
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "pancakeReturn_pkey" PRIMARY KEY ("shopId","returnId")
);

-- CreateTable
CREATE TABLE "pancakeSyncCursor" (
    "shopId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'history',
    "nextPage" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "watermark" TIMESTAMP(3),
    "lastFullScanAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeSyncCursor_pkey" PRIMARY KEY ("shopId","resource")
);

-- CreateTable
CREATE TABLE "pancakeWebhookJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "pancakeWebhookJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeSyncRun" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "pages" INTEGER NOT NULL DEFAULT 0,
    "records" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,

    CONSTRAINT "pancakeSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pancakeShopMember_userId_idx" ON "pancakeShopMember"("userId");

-- CreateIndex
CREATE INDEX "pancakeCustomer_shopId_name_idx" ON "pancakeCustomer"("shopId", "name");

-- CreateIndex
CREATE INDEX "pancakeCustomer_shopId_phone_idx" ON "pancakeCustomer"("shopId", "phone");

-- CreateIndex
CREATE INDEX "pancakeProduct_shopId_productId_idx" ON "pancakeProduct"("shopId", "productId");

-- CreateIndex
CREATE INDEX "pancakeOrder_shopId_sourceCreatedAt_idx" ON "pancakeOrder"("shopId", "sourceCreatedAt");

-- CreateIndex
CREATE INDEX "pancakeOrder_shopId_status_sellerId_idx" ON "pancakeOrder"("shopId", "status", "sellerId");

-- CreateIndex
CREATE INDEX "pancakeOrder_shopId_customerId_idx" ON "pancakeOrder"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "pancakeOrderHistory_shopId_orderId_occurredAt_idx" ON "pancakeOrderHistory"("shopId", "orderId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeOrderHistory_shopId_orderId_eventKey_key" ON "pancakeOrderHistory"("shopId", "orderId", "eventKey");

-- CreateIndex
CREATE INDEX "pancakeReturn_shopId_orderId_idx" ON "pancakeReturn"("shopId", "orderId");

-- CreateIndex
CREATE INDEX "pancakeWebhookJob_status_dueAt_idx" ON "pancakeWebhookJob"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeWebhookJob_shopId_resource_dedupeKey_key" ON "pancakeWebhookJob"("shopId", "resource", "dedupeKey");

-- CreateIndex
CREATE INDEX "pancakeSyncRun_shopId_startedAt_idx" ON "pancakeSyncRun"("shopId", "startedAt");

-- AddForeignKey
ALTER TABLE "pancakeShopMember" ADD CONSTRAINT "pancakeShopMember_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeShopMember" ADD CONSTRAINT "pancakeShopMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeCustomer" ADD CONSTRAINT "pancakeCustomer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeProduct" ADD CONSTRAINT "pancakeProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeEmployee" ADD CONSTRAINT "pancakeEmployee_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeOrder" ADD CONSTRAINT "pancakeOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeOrder" ADD CONSTRAINT "pancakeOrder_shopId_customerId_fkey" FOREIGN KEY ("shopId", "customerId") REFERENCES "pancakeCustomer"("shopId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeOrderHistory" ADD CONSTRAINT "pancakeOrderHistory_shopId_orderId_fkey" FOREIGN KEY ("shopId", "orderId") REFERENCES "pancakeOrder"("shopId", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeReturn" ADD CONSTRAINT "pancakeReturn_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeSyncCursor" ADD CONSTRAINT "pancakeSyncCursor_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeWebhookJob" ADD CONSTRAINT "pancakeWebhookJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeSyncRun" ADD CONSTRAINT "pancakeSyncRun_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
