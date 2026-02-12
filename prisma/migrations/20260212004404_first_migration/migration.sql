-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HR_MANAGER', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('NEW_HIRE', 'PROMOTION', 'ADJUSTMENT', 'ANNUAL_INCREASE', 'OTHER');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('DRAFT', 'FINALISED');

-- CreateEnum
CREATE TYPE "Rationale" AS ENUM ('SENIORITY_TENURE', 'RELEVANT_EXPERIENCE', 'PERFORMANCE_HISTORY', 'SCOPE_OF_ROLE', 'MARKET_CONDITIONS', 'GEOGRAPHIC_FACTORS', 'INTERNAL_EQUITY_ALIGNMENT', 'PROMOTION_HIGHER_RESPONSIBILITY', 'TEMPORARY_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING_MAPPING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RiskRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RiskState" AS ENUM ('WITHIN_EXPECTED_RANGE', 'REQUIRES_REVIEW', 'THRESHOLD_ALERT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "jobFamily" TEXT,
    "level" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "location" TEXT,
    "currency" TEXT NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "bonusTarget" DOUBLE PRECISION,
    "ltiTarget" DOUBLE PRECISION,
    "hireDate" TIMESTAMP(3),
    "employmentType" TEXT,
    "gender" TEXT,
    "performanceRating" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayDecision" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "payBeforeBase" DOUBLE PRECISION NOT NULL,
    "payAfterBase" DOUBLE PRECISION NOT NULL,
    "payBeforeBonus" DOUBLE PRECISION,
    "payAfterBonus" DOUBLE PRECISION,
    "payBeforeLti" DOUBLE PRECISION,
    "payAfterLti" DOUBLE PRECISION,
    "supportingContext" TEXT NOT NULL,
    "evidenceReference" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "accountableOwnerUserId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayDecisionRationale" (
    "id" TEXT NOT NULL,
    "payDecisionId" TEXT NOT NULL,
    "rationale" "Rationale" NOT NULL,

    CONSTRAINT "PayDecisionRationale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING_MAPPING',
    "filePath" TEXT,
    "createdCount" INTEGER,
    "updatedCount" INTEGER,
    "errorCount" INTEGER,
    "mappingJson" JSONB,
    "errorReportPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRun" (
    "id" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "RiskRunStatus" NOT NULL DEFAULT 'RUNNING',

    CONSTRAINT "RiskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskGroupResult" (
    "id" TEXT NOT NULL,
    "riskRunId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "jobFamily" TEXT,
    "level" TEXT NOT NULL,
    "roleTitleFallback" TEXT,
    "groupKey" TEXT NOT NULL,
    "womenCount" INTEGER NOT NULL,
    "menCount" INTEGER NOT NULL,
    "gapPct" DOUBLE PRECISION NOT NULL,
    "riskState" "RiskState" NOT NULL,
    "notes" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskGroupResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

-- CreateIndex
CREATE INDEX "Employee_country_jobFamily_level_idx" ON "Employee"("country", "jobFamily", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_employeeId_key" ON "Employee"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "PayDecision_employeeId_idx" ON "PayDecision"("employeeId");

-- CreateIndex
CREATE INDEX "PayDecision_status_idx" ON "PayDecision"("status");

-- CreateIndex
CREATE INDEX "PayDecision_effectiveDate_idx" ON "PayDecision"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayDecisionRationale_payDecisionId_rationale_key" ON "PayDecisionRationale"("payDecisionId", "rationale");

-- CreateIndex
CREATE INDEX "RiskGroupResult_groupKey_idx" ON "RiskGroupResult"("groupKey");

-- CreateIndex
CREATE INDEX "RiskGroupResult_riskState_idx" ON "RiskGroupResult"("riskState");

-- CreateIndex
CREATE INDEX "RiskGroupResult_computedAt_idx" ON "RiskGroupResult"("computedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayDecision" ADD CONSTRAINT "PayDecision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayDecision" ADD CONSTRAINT "PayDecision_accountableOwnerUserId_fkey" FOREIGN KEY ("accountableOwnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayDecision" ADD CONSTRAINT "PayDecision_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayDecisionRationale" ADD CONSTRAINT "PayDecisionRationale_payDecisionId_fkey" FOREIGN KEY ("payDecisionId") REFERENCES "PayDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRun" ADD CONSTRAINT "RiskRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskGroupResult" ADD CONSTRAINT "RiskGroupResult_riskRunId_fkey" FOREIGN KEY ("riskRunId") REFERENCES "RiskRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
