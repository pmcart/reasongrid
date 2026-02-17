import { PrismaClient, UserRole, RationaleCategory, RationaleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_RATIONALE_DEFINITIONS = [
  {
    code: 'SENIORITY_TENURE',
    name: 'Seniority / tenure',
    category: RationaleCategory.STRUCTURAL,
    legalDescription:
      'Pay differentiation based on length of service and accumulated organisational tenure, reflecting experience gained over time within the organisation.',
    plainLanguageDescription:
      "Used when the employee's length of service justifies the pay level or change.",
    objectiveCriteriaTags: ['Seniority', 'Tenure'],
    applicableDecisionTypes: ['ANNUAL_INCREASE', 'ADJUSTMENT', 'OTHER'],
  },
  {
    code: 'RELEVANT_EXPERIENCE',
    name: 'Relevant experience',
    category: RationaleCategory.STRUCTURAL,
    legalDescription:
      'Pay differentiation based on demonstrable prior experience directly relevant to the role requirements, including industry-specific knowledge and transferable skills.',
    plainLanguageDescription:
      "Used when the employee's relevant prior experience justifies the pay level or change.",
    objectiveCriteriaTags: ['Experience'],
    applicableDecisionTypes: ['NEW_HIRE', 'PROMOTION', 'ADJUSTMENT'],
  },
  {
    code: 'PERFORMANCE_HISTORY',
    name: 'Performance history',
    category: RationaleCategory.PERFORMANCE,
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
    category: RationaleCategory.STRUCTURAL,
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
    category: RationaleCategory.MARKET,
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
    category: RationaleCategory.MARKET,
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
    category: RationaleCategory.STRUCTURAL,
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
    category: RationaleCategory.STRUCTURAL,
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
    category: RationaleCategory.TEMPORARY,
    legalDescription:
      'Time-limited pay modification tied to a specific, documented circumstance with a defined review or expiry date.',
    plainLanguageDescription:
      'Used for time-limited pay changes tied to specific temporary circumstances.',
    objectiveCriteriaTags: ['Temporary'],
    applicableDecisionTypes: ['ADJUSTMENT', 'OTHER'],
  },
];

async function main() {
  console.log('Seeding database...');

  // Create super admin user (no organization)
  const superAdminEmail = process.env['SUPER_ADMIN_EMAIL'] || 'superadmin@cdi.local';
  const superAdminPassword = process.env['SUPER_ADMIN_PASSWORD'] || 'SuperAdmin123!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash: superAdminHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: null,
    },
  });
  console.log(`Super Admin user: ${superAdmin.email} (${superAdmin.id})`);

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default',
    },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  // Create admin user
  const adminEmail = process.env['ADMIN_EMAIL'] || 'admin@cdi.local';
  const adminPassword = process.env['ADMIN_PASSWORD'] || 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      organizationId: org.id,
    },
  });
  console.log(`Admin user: ${admin.email} (${admin.id})`);

  // Seed default rationale definitions
  console.log('Seeding rationale definitions...');
  for (const def of DEFAULT_RATIONALE_DEFINITIONS) {
    await prisma.rationaleDefinition.upsert({
      where: {
        organizationId_code_version: {
          organizationId: org.id,
          code: def.code,
          version: 1,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        code: def.code,
        name: def.name,
        category: def.category,
        legalDescription: def.legalDescription,
        plainLanguageDescription: def.plainLanguageDescription,
        objectiveCriteriaTags: def.objectiveCriteriaTags,
        applicableDecisionTypes: def.applicableDecisionTypes,
        jurisdictionScope: [],
        requiresSubstantiation: false,
        status: RationaleStatus.ACTIVE,
        version: 1,
      },
    });
    console.log(`  Rationale: ${def.code} v1`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
