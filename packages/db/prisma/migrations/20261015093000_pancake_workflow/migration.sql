CREATE TYPE "PancakeTaskStatus" AS ENUM ('OPEN', 'DONE');

CREATE TABLE "pancakeTask" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "PancakeTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pancakeTask_shopId_status_dueAt_idx" ON "pancakeTask"("shopId", "status", "dueAt");

CREATE INDEX "pancakeTask_assigneeId_status_dueAt_idx" ON "pancakeTask"("assigneeId", "status", "dueAt");

CREATE INDEX "pancakeOrder_shopId_sourceUpdatedAt_idx" ON "pancakeOrder"("shopId", "sourceUpdatedAt");

CREATE INDEX "pancakeOrder_shopId_sellerId_sourceCreatedAt_idx" ON "pancakeOrder"("shopId", "sellerId", "sourceCreatedAt");

ALTER TABLE "pancakeTask" ADD CONSTRAINT "pancakeTask_shopId_orderId_fkey" FOREIGN KEY ("shopId", "orderId") REFERENCES "pancakeOrder"("shopId", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pancakeTask" ADD CONSTRAINT "pancakeTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pancakeTask" ADD CONSTRAINT "pancakeTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
