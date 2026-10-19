-- AlterTable
ALTER TABLE "pancakeShopMember" ADD COLUMN     "profileId" TEXT;

-- CreateTable
CREATE TABLE "pancakeShopSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "displayName" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dialCode" TEXT,
    "showSamePhoneOnConversation" BOOLEAN NOT NULL DEFAULT false,
    "mergeOrdersByPhone" BOOLEAN NOT NULL DEFAULT false,
    "customerSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeRevenueTarget" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeRevenueTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeUserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "disableAppNotifications" BOOLEAN NOT NULL DEFAULT false,
    "browserNotifications" BOOLEAN NOT NULL DEFAULT false,
    "sound" TEXT NOT NULL DEFAULT 'silent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeUserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeAutomation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "trigger" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeSavedFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeSavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeBranch" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeBranchMember" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeBranchMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakePermissionProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matrix" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakePermissionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancakeAuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT,
    "area" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pancakeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pancakeShopSettings_shopId_key" ON "pancakeShopSettings"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeRevenueTarget_shopId_month_currency_key" ON "pancakeRevenueTarget"("shopId", "month", "currency");

-- CreateIndex
CREATE INDEX "pancakeUserPreference_shopId_idx" ON "pancakeUserPreference"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeUserPreference_userId_shopId_key" ON "pancakeUserPreference"("userId", "shopId");

-- CreateIndex
CREATE INDEX "pancakeNotification_userId_shopId_createdAt_idx" ON "pancakeNotification"("userId", "shopId", "createdAt");

-- CreateIndex
CREATE INDEX "pancakeNotification_userId_shopId_readAt_idx" ON "pancakeNotification"("userId", "shopId", "readAt");

-- CreateIndex
CREATE INDEX "pancakeNotification_shopId_idx" ON "pancakeNotification"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeNotification_userId_dedupeKey_key" ON "pancakeNotification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "pancakeAutomation_shopId_trigger_entity_enabled_idx" ON "pancakeAutomation"("shopId", "trigger", "entity", "enabled");

-- CreateIndex
CREATE INDEX "pancakeAutomation_createdById_idx" ON "pancakeAutomation"("createdById");

-- CreateIndex
CREATE INDEX "pancakeSavedFilter_userId_shopId_page_idx" ON "pancakeSavedFilter"("userId", "shopId", "page");

-- CreateIndex
CREATE INDEX "pancakeSavedFilter_shopId_idx" ON "pancakeSavedFilter"("shopId");

-- CreateIndex
CREATE INDEX "pancakeBranch_shopId_archivedAt_idx" ON "pancakeBranch"("shopId", "archivedAt");

-- CreateIndex
CREATE INDEX "pancakeBranchMember_shopId_idx" ON "pancakeBranchMember"("shopId");

-- CreateIndex
CREATE INDEX "pancakeBranchMember_userId_idx" ON "pancakeBranchMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeBranchMember_branchId_userId_key" ON "pancakeBranchMember"("branchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "pancakeBranchMember_branchId_employeeId_key" ON "pancakeBranchMember"("branchId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "pancakePermissionProfile_shopId_name_key" ON "pancakePermissionProfile"("shopId", "name");

-- CreateIndex
CREATE INDEX "pancakeAuditLog_shopId_area_at_idx" ON "pancakeAuditLog"("shopId", "area", "at");

-- CreateIndex
CREATE INDEX "pancakeAuditLog_shopId_at_idx" ON "pancakeAuditLog"("shopId", "at");

-- CreateIndex
CREATE INDEX "pancakeAuditLog_userId_idx" ON "pancakeAuditLog"("userId");

-- AddForeignKey
ALTER TABLE "pancakeShopMember" ADD CONSTRAINT "pancakeShopMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "pancakePermissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeShopSettings" ADD CONSTRAINT "pancakeShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeRevenueTarget" ADD CONSTRAINT "pancakeRevenueTarget_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeUserPreference" ADD CONSTRAINT "pancakeUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeUserPreference" ADD CONSTRAINT "pancakeUserPreference_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeNotification" ADD CONSTRAINT "pancakeNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeNotification" ADD CONSTRAINT "pancakeNotification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeAutomation" ADD CONSTRAINT "pancakeAutomation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeAutomation" ADD CONSTRAINT "pancakeAutomation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeSavedFilter" ADD CONSTRAINT "pancakeSavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeSavedFilter" ADD CONSTRAINT "pancakeSavedFilter_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeBranch" ADD CONSTRAINT "pancakeBranch_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeBranchMember" ADD CONSTRAINT "pancakeBranchMember_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeBranchMember" ADD CONSTRAINT "pancakeBranchMember_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "pancakeBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeBranchMember" ADD CONSTRAINT "pancakeBranchMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakePermissionProfile" ADD CONSTRAINT "pancakePermissionProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeAuditLog" ADD CONSTRAINT "pancakeAuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancakeAuditLog" ADD CONSTRAINT "pancakeAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
