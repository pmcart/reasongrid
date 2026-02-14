/**
 * Data migration script: Migrate from Rationale enum to RationaleDefinition table.
 *
 * Run BETWEEN the two migration steps:
 *   1. npx prisma migrate deploy  (applies 20260213200000_rationale_governance)
 *   2. tsx prisma/migrate-rationales.ts
 *   3. npx prisma migrate deploy  (applies 20260213200001_rationale_governance_cleanup)
 *
 * This script:
 *   - Creates RationaleDefinition v1 records for each org
 *   - Updates existing PayDecisionRationale rows to point to the new records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RationaleSeed {
  code: string;
  name: string;
  category: 'STRUCTURAL' | 'MARKET' | 'PERFORMANCE' | 'TEMPORARY' | 'OTHER';
  legalDescription: string;
  plainLanguageDescription: string;
  objectiveCriteriaTags: string[];
  applicableDecisionTypes: string[];
}

const RATIONALE_SEEDS: RationaleSeed[] = [
  {
    code: 'SENIORITY_TENURE',
    name: 'Seniority / tenure',
    category: 'STRUCTURAL',
    legalDescription:
      'Pay differentiation based on length of service and accumulated organisational tenure, reflecting experience gained over time within the organisation.',
    plainLanguageDescription:
      'Used when the employee\'s length of service justifies the pay level or change.',
    objectiveCriteriaTags: ['Seniority', 'Tenure'],
    applicableDecisionTypes: ['ANNUAL_INCREASE', 'ADJUSTMENT', 'OTHER'],
  },
  {
    code: 'RELEVANT_EXPERIENCE',
    name: 'Relevant experience',
    category: 'STRUCTURAL',
    legalDescription:
      'Pay differentiation based on demonstrable prior experience directly relevant to the role requirements, including industry-specific knowledge and transferable skills.',
    plainLanguageDescription:
      'Used when the employee\'s relevant prior experience justifies the pay level or change.',
    objectiveCriteriaTags: ['Experience'],
    applicableDecisionTypes: ['NEW_HIRE', 'PROMOTION', 'ADJUSTMENT'],
  },
  {
    code: 'PERFORMANCE_HISTORY',
    name: 'Performance history',
    category: 'PERFORMANCE',
    legalDescription:
      'Pay differentiation based on documented, objective performance assessments conducted through a consistent and transparent evaluation framework.',
    plainLanguageDescription:
      'Used when documented performance assessment results support the pay level or change.',
    objectiveCriteriaTags: ['Performance'],
    applicableDecisionTypes: ['ANNUAL_INCREASE', 'PROMOTION', 'ADJUSTMENT'],
  },
  {
    code: 'SCOPE_OF_ROLE',
    name: 'Scope of role',
    category: 'STRUCTURAL',
    legalDescription:
      'Pay differentiation based on the breadth, complexity, and organisational impact of the role, including reporting lines, budget responsibility, and decision-making authority.',
    plainLanguageDescription:
      'Used when the scope, complexity, or impact of the role justifies the pay level or change.',
    objectiveCriteriaTags: ['Scope'],
    applicableDecisionTypes: ['NEW_HIRE', 'PROMOTION', 'ADJUSTMENT'],
  },
  {
    code: 'MARKET_CONDITIONS',
    name: 'Market conditions',
    category: 'MARKET',
    legalDescription:
      'Pay differentiation based on external labour market data, including salary benchmarks, talent scarcity indicators, and competitive positioning requirements.',
    plainLanguageDescription:
      'Used when external market data or competitive talent pressures justify the pay level or change.',
    objectiveCriteriaTags: ['Benchmark', 'Market'],
    applicableDecisionTypes: ['NEW_HIRE', 'ANNUAL_INCREASE', 'ADJUSTMENT'],
  },
  {
    code: 'GEOGRAPHIC_FACTORS',
    name: 'Geographic factors',
    category: 'MARKET',
    legalDescription:
      'Pay differentiation based on objective geographic cost-of-living indices, local market conditions, or location-specific regulatory requirements.',
    plainLanguageDescription:
      'Used when geographic cost-of-living or local market conditions justify the pay level or change.',
    objectiveCriteriaTags: ['Geographic'],
    applicableDecisionTypes: ['NEW_HIRE', 'ADJUSTMENT', 'OTHER'],
  },
  {
    code: 'INTERNAL_EQUITY_ALIGNMENT',
    name: 'Internal equity alignment',
    category: 'STRUCTURAL',
    legalDescription:
      'Pay adjustment to align with internal pay structures, ensuring consistency with peers in comparable roles based on objective role evaluation criteria.',
    plainLanguageDescription:
      'Used when aligning pay with internal peers in comparable roles to maintain equity.',
    objectiveCriteriaTags: ['Equity', 'Benchmark'],
    applicableDecisionTypes: ['ADJUSTMENT', 'ANNUAL_INCREASE'],
  },
  {
    code: 'PROMOTION_HIGHER_RESPONSIBILITY',
    name: 'Promotion into higher responsibility',
    category: 'STRUCTURAL',
    legalDescription:
      'Pay increase associated with a documented promotion to a role with demonstrably greater scope, responsibility, or organisational impact.',
    plainLanguageDescription:
      'Used when the employee is promoted to a role with greater responsibility.',
    objectiveCriteriaTags: ['Scope', 'Promotion'],
    applicableDecisionTypes: ['PROMOTION'],
  },
  {
    code: 'TEMPORARY_ADJUSTMENT',
    name: 'Temporary adjustment',
    category: 'TEMPORARY',
    legalDescription:
      'Time-limited pay modification tied to a specific, documented circumstance with a defined review or expiry date.',
    plainLanguageDescription:
      'Used for time-limited pay changes tied to specific temporary circumstances.',
    objectiveCriteriaTags: ['Temporary'],
    applicableDecisionTypes: ['ADJUSTMENT', 'OTHER'],
  },
];

async function main() {
  console.log('Starting rationale data migration...');

  // 1. Get all organizations
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`Found ${orgs.length} organization(s)`);

  // 2. For each org, create RationaleDefinition v1 records
  for (const org of orgs) {
    console.log(`\nProcessing org: ${org.name} (${org.id})`);

    for (const seed of RATIONALE_SEEDS) {
      const existing = await prisma.rationaleDefinition.findUnique({
        where: {
          organizationId_code_version: {
            organizationId: org.id,
            code: seed.code,
            version: 1,
          },
        },
      });

      if (existing) {
        console.log(`  Skipping ${seed.code} v1 (already exists)`);
        continue;
      }

      await prisma.rationaleDefinition.create({
        data: {
          organizationId: org.id,
          code: seed.code,
          name: seed.name,
          category: seed.category,
          legalDescription: seed.legalDescription,
          plainLanguageDescription: seed.plainLanguageDescription,
          objectiveCriteriaTags: seed.objectiveCriteriaTags,
          applicableDecisionTypes: seed.applicableDecisionTypes,
          jurisdictionScope: [],
          requiresSubstantiation: false,
          version: 1,
          status: 'ACTIVE',
        },
      });
      console.log(`  Created ${seed.code} v1`);
    }

    // 3. Migrate existing PayDecisionRationale rows for this org
    // Find all pay decision rationales for decisions in this org that haven't been migrated yet
    const unmigrated = await prisma.$queryRaw<
      Array<{ id: string; rationale: string; payDecisionId: string }>
    >`
      SELECT pdr.id, pdr.rationale::text, pdr."payDecisionId"
      FROM "PayDecisionRationale" pdr
      JOIN "PayDecision" pd ON pd.id = pdr."payDecisionId"
      JOIN "Employee" e ON e.id = pd."employeeId"
      WHERE e."organizationId" = ${org.id}
        AND pdr."rationaleDefinitionId" IS NULL
    `;

    console.log(`  Found ${unmigrated.length} unmigrated PayDecisionRationale rows`);

    // Build a lookup of code -> RationaleDefinition for this org
    const defs = await prisma.rationaleDefinition.findMany({
      where: { organizationId: org.id, version: 1 },
    });
    const defByCode = new Map(defs.map((d) => [d.code, d]));

    for (const row of unmigrated) {
      const def = defByCode.get(row.rationale);
      if (!def) {
        console.error(`  ERROR: No definition found for code "${row.rationale}" in org ${org.id}`);
        continue;
      }

      const snapshot = {
        id: def.id,
        code: def.code,
        name: def.name,
        version: def.version,
        category: def.category,
        legalDescription: def.legalDescription,
        plainLanguageDescription: def.plainLanguageDescription,
        objectiveCriteriaTags: def.objectiveCriteriaTags,
        applicableDecisionTypes: def.applicableDecisionTypes,
        requiresSubstantiation: def.requiresSubstantiation,
      };

      await prisma.$executeRaw`
        UPDATE "PayDecisionRationale"
        SET "rationaleDefinitionId" = ${def.id},
            "rationaleSnapshot" = ${JSON.stringify(snapshot)}::jsonb
        WHERE id = ${row.id}
      `;
    }

    console.log(`  Migrated ${unmigrated.length} rows`);
  }

  console.log('\nRationale data migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
