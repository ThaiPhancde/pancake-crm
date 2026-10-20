-- AlterTable
ALTER TABLE "pancakeCustomer" ADD COLUMN     "sourceCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pancakeCustomer_shopId_sourceCreatedAt_idx" ON "pancakeCustomer"("shopId", "sourceCreatedAt");
