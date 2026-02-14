-- CreateEnum
CREATE TYPE "RationaleCategory" AS ENUM ('STRUCTURAL', 'MARKET', 'PERFORMANCE', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "RationaleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'RATIONALE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'RATIONALE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'RATIONALE_ARCHIVED';

-- CreateTable
CREATE TABLE "RationaleDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalDescription" TEXT NOT NULL,
    "plainLanguageDescription" TEXT NOT NULL DEFAULT '',
    "category" "RationaleCategory" NOT NULL,
    "objectiveCriteriaTags" JSONB NOT NULL DEFAULT '[]',
    "applicableDecisionTypes" JSONB NOT NULL DEFAULT '[]',
    "status" "RationaleStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "jurisdictionScope" JSONB NOT NULL DEFAULT '[]',
    "requiresSubstantiation" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationaleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RationaleDefinition_organizationId_code_version_key" ON "RationaleDefinition"("organizationId", "code", "version");

-- CreateIndex
CREATE INDEX "RationaleDefinition_organizationId_status_idx" ON "RationaleDefinition"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RationaleDefinition_organizationId_code_idx" ON "RationaleDefinition"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "RationaleDefinition" ADD CONSTRAINT "RationaleDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate PayDecisionRationale: add new columns
ALTER TABLE "PayDecisionRationale" ADD COLUMN "rationaleDefinitionId" TEXT;
ALTER TABLE "PayDecisionRationale" ADD COLUMN "rationaleSnapshot" JSONB;

-- Data migration: handled by external script (prisma/migrate-rationales.ts)
-- After running the script, the old 'rationale' column can be dropped.

-- Note: The old 'rationale' column and 'Rationale' enum will be dropped
-- AFTER the data migration script runs. See prisma/migrate-rationales.ts.
