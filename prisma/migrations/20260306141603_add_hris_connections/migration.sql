-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN     "hrisConnectionId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'csv';

-- CreateTable
CREATE TABLE "HrisConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "fieldMappingJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrisConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrisConnection_organizationId_idx" ON "HrisConnection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrisConnection_organizationId_provider_name_key" ON "HrisConnection"("organizationId", "provider", "name");

-- AddForeignKey
ALTER TABLE "HrisConnection" ADD CONSTRAINT "HrisConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_hrisConnectionId_fkey" FOREIGN KEY ("hrisConnectionId") REFERENCES "HrisConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
