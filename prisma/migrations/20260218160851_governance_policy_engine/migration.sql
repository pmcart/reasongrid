-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('GENDER_GAP_IMPACT', 'SALARY_RANGE_COMPLIANCE', 'MEDIAN_DEVIATION', 'HISTORICAL_CONSISTENCY', 'CHANGE_MAGNITUDE');

-- CreateEnum
CREATE TYPE "PolicySeverity" AS ENUM ('INFO', 'WARNING', 'BLOCK');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DECISION_SUBMITTED_FOR_REVIEW', 'DECISION_APPROVED', 'DECISION_RETURNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PAY_DECISION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PAY_DECISION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'PAY_DECISION_RETURNED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DecisionStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "DecisionStatus" ADD VALUE 'APPROVED';
ALTER TYPE "DecisionStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "PayDecision" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "evaluationSnapshot" JSONB,
ADD COLUMN     "returnReason" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "checkType" "CheckType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB NOT NULL,
    "severity" "PolicySeverity" NOT NULL DEFAULT 'WARNING',
    "appliesToDecisionTypes" JSONB NOT NULL DEFAULT '[]',
    "appliesToCountries" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyRule_organizationId_idx" ON "PolicyRule"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_organizationId_checkType_key" ON "PolicyRule"("organizationId", "checkType");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_read_idx" ON "Notification"("recipientUserId", "read");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_createdAt_idx" ON "Notification"("recipientUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
