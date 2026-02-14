-- AlterTable
ALTER TABLE "EmployeeSnapshot" ADD COLUMN     "compaRatio" DOUBLE PRECISION,
ADD COLUMN     "comparatorGroupKey" TEXT,
ADD COLUMN     "lastPromotionDate" TIMESTAMP(3),
ADD COLUMN     "positionInRange" DOUBLE PRECISION,
ADD COLUMN     "priorIncreaseCount" INTEGER,
ADD COLUMN     "priorIncreaseTotalPct" DOUBLE PRECISION,
ADD COLUMN     "priorPromotionCount" INTEGER,
ADD COLUMN     "tenureYears" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SalaryRange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "jobFamily" TEXT,
    "level" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "min" DOUBLE PRECISION NOT NULL,
    "mid" DOUBLE PRECISION NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryRange_organizationId_idx" ON "SalaryRange"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRange_organizationId_country_jobFamily_level_key" ON "SalaryRange"("organizationId", "country", "jobFamily", "level");

-- CreateIndex
CREATE INDEX "EmployeeSnapshot_comparatorGroupKey_idx" ON "EmployeeSnapshot"("comparatorGroupKey");
