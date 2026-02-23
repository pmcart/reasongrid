-- CreateEnum
CREATE TYPE "ScaleType" AS ENUM ('NUMERIC_1_5', 'NUMERIC_1_10', 'LEVEL_LOW_MED_HIGH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ClassificationStatus" AS ENUM ('UNCLASSIFIED', 'AI_SUGGESTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "DisclosureTemplateType" AS ENUM ('JOB_AD_FULL', 'JOB_AD_BRIEF', 'OFFER_LETTER', 'TRANSPARENCY_REPORT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CLASSIFICATION_DIMENSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CLASSIFICATION_DIMENSION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CLASSIFICATION_AI_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CLASSIFICATION_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CLASSIFICATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCLOSURE_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'AUDIT_PACK_EXPORTED';

-- CreateTable
CREATE TABLE "ClassificationDimension" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scaleType" "ScaleType" NOT NULL,
    "scaleConfig" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificationDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleClassification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "jobFamily" TEXT,
    "level" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "jobDescription" TEXT,
    "status" "ClassificationStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleClassificationTag" (
    "id" TEXT NOT NULL,
    "roleClassificationId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "aiConfidence" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleClassificationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "country" TEXT,
    "templateType" "DisclosureTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisclosureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT NOT NULL,
    "apiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassificationDimension_organizationId_sortOrder_idx" ON "ClassificationDimension"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationDimension_organizationId_code_key" ON "ClassificationDimension"("organizationId", "code");

-- CreateIndex
CREATE INDEX "RoleClassification_organizationId_status_idx" ON "RoleClassification"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RoleClassification_organizationId_country_jobFamily_level_idx" ON "RoleClassification"("organizationId", "country", "jobFamily", "level");

-- CreateIndex
CREATE UNIQUE INDEX "RoleClassification_organizationId_country_jobFamily_level_r_key" ON "RoleClassification"("organizationId", "country", "jobFamily", "level", "roleTitle");

-- CreateIndex
CREATE INDEX "RoleClassificationTag_dimensionId_idx" ON "RoleClassificationTag"("dimensionId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleClassificationTag_roleClassificationId_dimensionId_key" ON "RoleClassificationTag"("roleClassificationId", "dimensionId");

-- CreateIndex
CREATE INDEX "DisclosureTemplate_organizationId_templateType_isActive_idx" ON "DisclosureTemplate"("organizationId", "templateType", "isActive");

-- CreateIndex
CREATE INDEX "DisclosureTemplate_country_templateType_idx" ON "DisclosureTemplate"("country", "templateType");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_organizationId_key" ON "AiProviderConfig"("organizationId");

-- AddForeignKey
ALTER TABLE "ClassificationDimension" ADD CONSTRAINT "ClassificationDimension_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleClassification" ADD CONSTRAINT "RoleClassification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleClassification" ADD CONSTRAINT "RoleClassification_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleClassificationTag" ADD CONSTRAINT "RoleClassificationTag_roleClassificationId_fkey" FOREIGN KEY ("roleClassificationId") REFERENCES "RoleClassification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleClassificationTag" ADD CONSTRAINT "RoleClassificationTag_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "ClassificationDimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureTemplate" ADD CONSTRAINT "DisclosureTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
