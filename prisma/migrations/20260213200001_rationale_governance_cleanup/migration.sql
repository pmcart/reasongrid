-- Cleanup: run AFTER prisma/migrate-rationales.ts data migration

-- Drop old unique constraint
ALTER TABLE "PayDecisionRationale" DROP CONSTRAINT IF EXISTS "PayDecisionRationale_payDecisionId_rationale_key";

-- Make new columns NOT NULL (data migration must have populated them)
ALTER TABLE "PayDecisionRationale" ALTER COLUMN "rationaleDefinitionId" SET NOT NULL;
ALTER TABLE "PayDecisionRationale" ALTER COLUMN "rationaleSnapshot" SET NOT NULL;

-- Drop old column
ALTER TABLE "PayDecisionRationale" DROP COLUMN IF EXISTS "rationale";

-- Drop old enum
DROP TYPE IF EXISTS "Rationale";

-- Add new unique constraint
CREATE UNIQUE INDEX "PayDecisionRationale_payDecisionId_rationaleDefinitionId_key" ON "PayDecisionRationale"("payDecisionId", "rationaleDefinitionId");

-- Add foreign key
ALTER TABLE "PayDecisionRationale" ADD CONSTRAINT "PayDecisionRationale_rationaleDefinitionId_fkey" FOREIGN KEY ("rationaleDefinitionId") REFERENCES "RationaleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
