-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'EMPLOYEE_IMPORTED', 'PAY_DECISION_CREATED', 'PAY_DECISION_UPDATED', 'PAY_DECISION_FINALISED', 'IMPORT_STARTED', 'IMPORT_COMPLETED', 'IMPORT_FAILED', 'RISK_RUN_TRIGGERED', 'RISK_RUN_COMPLETED', 'USER_LOGIN');

-- AlterTable
ALTER TABLE "PayDecision" ADD COLUMN     "snapshotId" TEXT;

-- CreateTable
CREATE TABLE "EmployeeSnapshot" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "importJobId" TEXT,
    "organizationId" TEXT NOT NULL,
    "employeeExternalId" TEXT NOT NULL,
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
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeSnapshot_employeeId_snapshotAt_idx" ON "EmployeeSnapshot"("employeeId", "snapshotAt");

-- CreateIndex
CREATE INDEX "EmployeeSnapshot_importJobId_idx" ON "EmployeeSnapshot"("importJobId");

-- CreateIndex
CREATE INDEX "EmployeeSnapshot_organizationId_idx" ON "EmployeeSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "PayDecision_snapshotId_idx" ON "PayDecision"("snapshotId");

-- AddForeignKey
ALTER TABLE "PayDecision" ADD CONSTRAINT "PayDecision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "EmployeeSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSnapshot" ADD CONSTRAINT "EmployeeSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSnapshot" ADD CONSTRAINT "EmployeeSnapshot_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
