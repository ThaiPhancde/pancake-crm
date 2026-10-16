CREATE TABLE "pancakeLead" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "assigneeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pancakeAppointment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "assigneeId" TEXT,
    "source" TEXT,
    "location" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pancakeTicket" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "orderId" TEXT,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'new',
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "source" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancakeTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pancakeNote" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pancakeNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pancakeLead_shopId_status_createdAt_idx" ON "pancakeLead"("shopId", "status", "createdAt");

CREATE INDEX "pancakeAppointment_shopId_startAt_idx" ON "pancakeAppointment"("shopId", "startAt");

CREATE INDEX "pancakeAppointment_shopId_customerId_idx" ON "pancakeAppointment"("shopId", "customerId");

CREATE INDEX "pancakeTicket_shopId_status_createdAt_idx" ON "pancakeTicket"("shopId", "status", "createdAt");

CREATE INDEX "pancakeTicket_shopId_customerId_idx" ON "pancakeTicket"("shopId", "customerId");

CREATE INDEX "pancakeNote_shopId_customerId_createdAt_idx" ON "pancakeNote"("shopId", "customerId", "createdAt");

ALTER TABLE "pancakeLead" ADD CONSTRAINT "pancakeLead_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pancakeAppointment" ADD CONSTRAINT "pancakeAppointment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pancakeTicket" ADD CONSTRAINT "pancakeTicket_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pancakeNote" ADD CONSTRAINT "pancakeNote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "pancakeShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
