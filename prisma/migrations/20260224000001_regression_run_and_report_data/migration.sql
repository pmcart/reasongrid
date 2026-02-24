-- AlterTable: add reportData to AiRiskReport
ALTER TABLE "AiRiskReport" ADD COLUMN "reportData" JSONB;

-- CreateTable: RegressionRun
CREATE TABLE "RegressionRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "resultJson" TEXT,

    CONSTRAINT "RegressionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegressionRun_organizationId_idx" ON "RegressionRun"("organizationId");

-- AddForeignKey
ALTER TABLE "RegressionRun" ADD CONSTRAINT "RegressionRun_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
