-- AlterTable
ALTER TABLE "RiskRun" ADD COLUMN     "importJobId" TEXT;

-- CreateTable
CREATE TABLE "AiRiskReport" (
    "id" TEXT NOT NULL,
    "riskRunId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRiskReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRiskReport_organizationId_idx" ON "AiRiskReport"("organizationId");

-- CreateIndex
CREATE INDEX "AiRiskReport_riskRunId_idx" ON "AiRiskReport"("riskRunId");

-- AddForeignKey
ALTER TABLE "RiskRun" ADD CONSTRAINT "RiskRun_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRiskReport" ADD CONSTRAINT "AiRiskReport_riskRunId_fkey" FOREIGN KEY ("riskRunId") REFERENCES "RiskRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRiskReport" ADD CONSTRAINT "AiRiskReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
