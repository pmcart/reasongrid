import { PrismaClient, UserRole, RationaleCategory, RationaleStatus, CheckType, PolicySeverity } from '@prisma/client';
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

  // Seed default policy rules
  console.log('Seeding policy rules...');
  const defaultPolicyRules = [
    {
      checkType: CheckType.GENDER_GAP_IMPACT,
      params: { warningThresholdPct: 4, blockThresholdPct: 5 },
    },
    {
      checkType: CheckType.SALARY_RANGE_COMPLIANCE,
      params: { allowAboveMax: false, allowBelowMin: false },
    },
    {
      checkType: CheckType.MEDIAN_DEVIATION,
      params: { warningDeviationPct: 10, blockDeviationPct: 20 },
    },
    {
      checkType: CheckType.HISTORICAL_CONSISTENCY,
      params: { lookbackMonths: 12, warningDeviationPct: 15 },
    },
    {
      checkType: CheckType.CHANGE_MAGNITUDE,
      params: { warningPct: 15, blockPct: 25 },
    },
  ];

  for (const rule of defaultPolicyRules) {
    await prisma.policyRule.upsert({
      where: {
        organizationId_checkType: {
          organizationId: org.id,
          checkType: rule.checkType,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        checkType: rule.checkType,
        enabled: true,
        params: rule.params,
        severity: PolicySeverity.WARNING,
        appliesToDecisionTypes: [],
        appliesToCountries: [],
      },
    });
    console.log(`  Policy rule: ${rule.checkType}`);
  }

  // ===== DEMO DATA =====
  console.log('\nSeeding demo data...');

  // --- Additional users ---
  const hrHash = await bcrypt.hash('HrManager123!', 12);
  const hrManager = await prisma.user.upsert({
    where: { email: 'hr@cdi.local' },
    update: {},
    create: {
      email: 'hr@cdi.local',
      passwordHash: hrHash,
      role: UserRole.HR_MANAGER,
      organizationId: org.id,
    },
  });
  console.log(`HR Manager user: ${hrManager.email}`);

  const mgrHash = await bcrypt.hash('Manager123!', 12);
  const manager1 = await prisma.user.upsert({
    where: { email: 'manager1@cdi.local' },
    update: {},
    create: {
      email: 'manager1@cdi.local',
      passwordHash: mgrHash,
      role: UserRole.MANAGER,
      organizationId: org.id,
    },
  });
  console.log(`Manager user: ${manager1.email}`);

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@cdi.local' },
    update: {},
    create: {
      email: 'manager2@cdi.local',
      passwordHash: mgrHash,
      role: UserRole.MANAGER,
      organizationId: org.id,
    },
  });
  console.log(`Manager user: ${manager2.email}`);

  // --- Salary Ranges ---
  console.log('Seeding salary ranges...');
  const salaryRanges = [
    { country: 'IE', jobFamily: 'Engineering', level: 'Senior',    currency: 'EUR', min: 75000,  mid: 90000,  max: 105000 },
    { country: 'IE', jobFamily: 'Engineering', level: 'Mid',       currency: 'EUR', min: 55000,  mid: 65000,  max: 78000  },
    { country: 'IE', jobFamily: 'Engineering', level: 'Lead',      currency: 'EUR', min: 95000,  mid: 115000, max: 135000 },
    { country: 'DE', jobFamily: 'Engineering', level: 'Senior',    currency: 'EUR', min: 70000,  mid: 85000,  max: 100000 },
    { country: 'IE', jobFamily: 'Product',     level: 'Senior',    currency: 'EUR', min: 72000,  mid: 87000,  max: 102000 },
  ];

  for (const sr of salaryRanges) {
    await prisma.salaryRange.upsert({
      where: {
        organizationId_country_jobFamily_level: {
          organizationId: org.id,
          country: sr.country,
          jobFamily: sr.jobFamily,
          level: sr.level,
        },
      },
      update: {},
      create: { organizationId: org.id, ...sr },
    });
    console.log(`  Salary range: ${sr.country}/${sr.jobFamily}/${sr.level} (${sr.min}-${sr.max})`);
  }

  // --- Employees ---
  console.log('Seeding employees...');

  // Helper to create/upsert employee
  async function upsertEmployee(data: {
    employeeId: string;
    roleTitle: string;
    jobFamily: string;
    level: string;
    country: string;
    location: string;
    currency: string;
    baseSalary: number;
    bonusTarget?: number;
    gender: string;
    hireDate: Date;
    performanceRating: string;
  }) {
    return prisma.employee.upsert({
      where: {
        organizationId_employeeId: {
          organizationId: org.id,
          employeeId: data.employeeId,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        employeeId: data.employeeId,
        roleTitle: data.roleTitle,
        jobFamily: data.jobFamily,
        level: data.level,
        country: data.country,
        location: data.location,
        currency: data.currency,
        baseSalary: data.baseSalary,
        bonusTarget: data.bonusTarget ?? null,
        gender: data.gender,
        hireDate: data.hireDate,
        performanceRating: data.performanceRating,
        employmentType: 'Full-time',
      },
    });
  }

  // IE / Engineering / Senior — 4 male, 3 female
  // Median male: ~92k, Median female: ~87k => ~5.4% gap (triggers THRESHOLD_ALERT)
  const empSr1 = await upsertEmployee({
    employeeId: 'EMP-001', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 95000, bonusTarget: 10000,
    gender: 'Male', hireDate: new Date('2019-03-15'), performanceRating: 'Exceeds',
  });
  const empSr2 = await upsertEmployee({
    employeeId: 'EMP-002', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 92000,
    gender: 'Male', hireDate: new Date('2020-06-01'), performanceRating: 'Meets',
  });
  const empSr3 = await upsertEmployee({
    employeeId: 'EMP-003', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Cork', currency: 'EUR', baseSalary: 89000,
    gender: 'Male', hireDate: new Date('2021-01-10'), performanceRating: 'Meets',
  });
  const empSr4 = await upsertEmployee({
    employeeId: 'EMP-004', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 91000,
    gender: 'Male', hireDate: new Date('2020-09-01'), performanceRating: 'Exceeds',
  });
  const empSr5 = await upsertEmployee({
    employeeId: 'EMP-005', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 88000, bonusTarget: 8000,
    gender: 'Female', hireDate: new Date('2019-08-20'), performanceRating: 'Exceeds',
  });
  const empSr6 = await upsertEmployee({
    employeeId: 'EMP-006', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Cork', currency: 'EUR', baseSalary: 87000,
    gender: 'Female', hireDate: new Date('2020-11-15'), performanceRating: 'Meets',
  });
  const empSr7 = await upsertEmployee({
    employeeId: 'EMP-007', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 85000,
    gender: 'Female', hireDate: new Date('2021-04-01'), performanceRating: 'Meets',
  });

  // IE / Engineering / Mid — 3 male, 3 female
  // Median male: ~65k, Median female: ~63k => ~3.1% gap (WITHIN_EXPECTED_RANGE)
  const empMd1 = await upsertEmployee({
    employeeId: 'EMP-008', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 68000,
    gender: 'Male', hireDate: new Date('2021-06-01'), performanceRating: 'Exceeds',
  });
  const empMd2 = await upsertEmployee({
    employeeId: 'EMP-009', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 65000,
    gender: 'Male', hireDate: new Date('2022-01-15'), performanceRating: 'Meets',
  });
  const empMd3 = await upsertEmployee({
    employeeId: 'EMP-010', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'IE', location: 'Cork', currency: 'EUR', baseSalary: 62000,
    gender: 'Male', hireDate: new Date('2022-09-01'), performanceRating: 'Meets',
  });
  const empMd4 = await upsertEmployee({
    employeeId: 'EMP-011', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 64000,
    gender: 'Female', hireDate: new Date('2021-08-15'), performanceRating: 'Exceeds',
  });
  const empMd5 = await upsertEmployee({
    employeeId: 'EMP-012', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 63000,
    gender: 'Female', hireDate: new Date('2022-03-01'), performanceRating: 'Meets',
  });
  const empMd6 = await upsertEmployee({
    employeeId: 'EMP-013', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'IE', location: 'Cork', currency: 'EUR', baseSalary: 60000,
    gender: 'Female', hireDate: new Date('2023-01-10'), performanceRating: 'Developing',
  });

  // DE / Engineering / Senior — small group for cross-country comparison
  const empDe1 = await upsertEmployee({
    employeeId: 'EMP-014', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'DE', location: 'Berlin', currency: 'EUR', baseSalary: 88000,
    gender: 'Male', hireDate: new Date('2020-04-01'), performanceRating: 'Meets',
  });
  const empDe2 = await upsertEmployee({
    employeeId: 'EMP-015', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'DE', location: 'Munich', currency: 'EUR', baseSalary: 84000,
    gender: 'Female', hireDate: new Date('2021-02-01'), performanceRating: 'Exceeds',
  });
  const empDe3 = await upsertEmployee({
    employeeId: 'EMP-016', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'DE', location: 'Berlin', currency: 'EUR', baseSalary: 86000,
    gender: 'Male', hireDate: new Date('2020-10-15'), performanceRating: 'Exceeds',
  });

  // IE / Product / Senior — different job family
  const empProd1 = await upsertEmployee({
    employeeId: 'EMP-017', roleTitle: 'Senior Product Manager', jobFamily: 'Product', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 92000,
    gender: 'Female', hireDate: new Date('2019-11-01'), performanceRating: 'Exceeds',
  });
  const empProd2 = await upsertEmployee({
    employeeId: 'EMP-018', roleTitle: 'Senior Product Manager', jobFamily: 'Product', level: 'Senior',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 89000,
    gender: 'Male', hireDate: new Date('2020-05-15'), performanceRating: 'Meets',
  });

  // FR / Engineering / Senior — NO salary range defined (showcases uncovered groups)
  await upsertEmployee({
    employeeId: 'EMP-019', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'FR', location: 'Paris', currency: 'EUR', baseSalary: 78000,
    gender: 'Male', hireDate: new Date('2021-03-01'), performanceRating: 'Meets',
  });
  await upsertEmployee({
    employeeId: 'EMP-020', roleTitle: 'Senior Software Engineer', jobFamily: 'Engineering', level: 'Senior',
    country: 'FR', location: 'Lyon', currency: 'EUR', baseSalary: 74000,
    gender: 'Female', hireDate: new Date('2022-01-15'), performanceRating: 'Exceeds',
  });

  // IE / Design / Mid — NO salary range defined
  await upsertEmployee({
    employeeId: 'EMP-021', roleTitle: 'UX Designer', jobFamily: 'Design', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 58000,
    gender: 'Female', hireDate: new Date('2022-06-01'), performanceRating: 'Meets',
  });
  await upsertEmployee({
    employeeId: 'EMP-022', roleTitle: 'Product Designer', jobFamily: 'Design', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 61000,
    gender: 'Male', hireDate: new Date('2021-09-15'), performanceRating: 'Exceeds',
  });

  // DE / Engineering / Mid — NO salary range defined
  await upsertEmployee({
    employeeId: 'EMP-023', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'DE', location: 'Berlin', currency: 'EUR', baseSalary: 62000,
    gender: 'Female', hireDate: new Date('2023-02-01'), performanceRating: 'Meets',
  });
  await upsertEmployee({
    employeeId: 'EMP-024', roleTitle: 'Software Engineer', jobFamily: 'Engineering', level: 'Mid',
    country: 'DE', location: 'Munich', currency: 'EUR', baseSalary: 65000,
    gender: 'Male', hireDate: new Date('2022-08-01'), performanceRating: 'Meets',
  });

  // IE / Product / Mid — NO salary range defined
  await upsertEmployee({
    employeeId: 'EMP-025', roleTitle: 'Product Manager', jobFamily: 'Product', level: 'Mid',
    country: 'IE', location: 'Dublin', currency: 'EUR', baseSalary: 67000,
    gender: 'Male', hireDate: new Date('2022-04-01'), performanceRating: 'Meets',
  });

  console.log(`  Created/verified 25 employees`);

  // --- FINALISED Pay Decisions ---
  // These provide historical consistency data and demonstrate the full workflow
  console.log('Seeding pay decisions...');

  // Look up rationale definitions for linking
  const ratDefs = await prisma.rationaleDefinition.findMany({
    where: { organizationId: org.id, version: 1 },
  });
  const ratByCode = new Map(ratDefs.map(r => [r.code, r]));

  // Helper to create a finalised pay decision with rationales
  async function createFinalisedDecision(data: {
    employeeId: string;
    decisionType: 'ANNUAL_INCREASE' | 'PROMOTION' | 'ADJUSTMENT' | 'NEW_HIRE';
    effectiveDate: Date;
    payBeforeBase: number;
    payAfterBase: number;
    supportingContext: string;
    rationaleCodes: string[];
    ownerId: string;
    approverId: string;
  }) {
    // Check if a decision already exists for this employee+type+date
    const existing = await prisma.payDecision.findFirst({
      where: {
        employeeId: data.employeeId,
        decisionType: data.decisionType,
        effectiveDate: data.effectiveDate,
        status: 'FINALISED',
      },
    });
    if (existing) {
      console.log(`  Skipping existing decision for ${data.employeeId}`);
      return existing;
    }

    const decision = await prisma.payDecision.create({
      data: {
        employeeId: data.employeeId,
        decisionType: data.decisionType,
        effectiveDate: data.effectiveDate,
        payBeforeBase: data.payBeforeBase,
        payAfterBase: data.payAfterBase,
        supportingContext: data.supportingContext,
        status: 'FINALISED',
        finalisedAt: data.effectiveDate,
        submittedAt: new Date(data.effectiveDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        approvedAt: new Date(data.effectiveDate.getTime() - 3 * 24 * 60 * 60 * 1000),
        accountableOwnerUserId: data.ownerId,
        approverUserId: data.approverId,
      },
    });

    // Attach rationales with snapshots
    for (const code of data.rationaleCodes) {
      const ratDef = ratByCode.get(code);
      if (!ratDef) continue;
      await prisma.payDecisionRationale.create({
        data: {
          payDecisionId: decision.id,
          rationaleDefinitionId: ratDef.id,
          rationaleSnapshot: {
            code: ratDef.code,
            name: ratDef.name,
            category: ratDef.category,
            legalDescription: ratDef.legalDescription,
            version: ratDef.version,
          },
        },
      });
    }

    return decision;
  }

  // Annual increases for Senior engineers (recent — within last 12 months)
  await createFinalisedDecision({
    employeeId: empSr1.id, decisionType: 'ANNUAL_INCREASE',
    effectiveDate: new Date('2025-07-01'),
    payBeforeBase: 90000, payAfterBase: 95000,
    supportingContext: 'Annual review: strong delivery on platform migration project. 5.6% increase reflects sustained exceeds-level performance.',
    rationaleCodes: ['PERFORMANCE_HISTORY', 'SENIORITY_TENURE'],
    ownerId: manager1.id, approverId: hrManager.id,
  });

  await createFinalisedDecision({
    employeeId: empSr2.id, decisionType: 'ANNUAL_INCREASE',
    effectiveDate: new Date('2025-07-01'),
    payBeforeBase: 89000, payAfterBase: 92000,
    supportingContext: 'Annual review: consistent delivery across all objectives. 3.4% increase aligned with meets-expectations band.',
    rationaleCodes: ['PERFORMANCE_HISTORY', 'INTERNAL_EQUITY_ALIGNMENT'],
    ownerId: manager1.id, approverId: hrManager.id,
  });

  await createFinalisedDecision({
    employeeId: empSr5.id, decisionType: 'ANNUAL_INCREASE',
    effectiveDate: new Date('2025-07-01'),
    payBeforeBase: 84000, payAfterBase: 88000,
    supportingContext: 'Annual review: led technical design of new API gateway. 4.8% increase recognises exceeds-level contribution and addresses internal equity gap.',
    rationaleCodes: ['PERFORMANCE_HISTORY', 'INTERNAL_EQUITY_ALIGNMENT', 'SCOPE_OF_ROLE'],
    ownerId: manager1.id, approverId: hrManager.id,
  });

  await createFinalisedDecision({
    employeeId: empSr6.id, decisionType: 'ANNUAL_INCREASE',
    effectiveDate: new Date('2025-07-01'),
    payBeforeBase: 84000, payAfterBase: 87000,
    supportingContext: 'Annual review: solid delivery on assigned workstreams. 3.6% increase within meets-expectations band.',
    rationaleCodes: ['PERFORMANCE_HISTORY'],
    ownerId: manager2.id, approverId: hrManager.id,
  });

  // Annual increases for Mid engineers
  await createFinalisedDecision({
    employeeId: empMd1.id, decisionType: 'ANNUAL_INCREASE',
    effectiveDate: new Date('2025-07-01'),
    payBeforeBase: 64000, payAfterBase: 68000,
    supportingContext: 'Annual review: took on mentoring responsibilities and delivered key features independently. 6.3% increase reflects exceeds-level performance.',
    rationaleCodes: ['PERFORMANCE_HISTORY', 'SCOPE_OF_ROLE'],
    ownerId: manager1.id, approverId: hrManager.id,
  });

  await createFinalisedDecision({
    employeeId: empMd4.id, decisionType: 'ANNUAL_INCREASE',
    effectiveDate: new Date('2025-07-01'),
    payBeforeBase: 61000, payAfterBase: 64000,
    supportingContext: 'Annual review: consistently exceeded sprint targets with high quality output. 4.9% increase reflects strong performance.',
    rationaleCodes: ['PERFORMANCE_HISTORY', 'INTERNAL_EQUITY_ALIGNMENT'],
    ownerId: manager2.id, approverId: hrManager.id,
  });

  // A promotion decision (Mid -> Senior)
  await createFinalisedDecision({
    employeeId: empSr3.id, decisionType: 'PROMOTION',
    effectiveDate: new Date('2025-04-01'),
    payBeforeBase: 72000, payAfterBase: 89000,
    supportingContext: 'Promoted from Mid to Senior following 18 months of Senior-level contributions. New salary positions at P40 of Senior range.',
    rationaleCodes: ['PROMOTION_HIGHER_RESPONSIBILITY', 'RELEVANT_EXPERIENCE', 'SCOPE_OF_ROLE'],
    ownerId: manager1.id, approverId: hrManager.id,
  });

  // A market adjustment
  await createFinalisedDecision({
    employeeId: empDe1.id, decisionType: 'ADJUSTMENT',
    effectiveDate: new Date('2025-09-01'),
    payBeforeBase: 83000, payAfterBase: 88000,
    supportingContext: 'Market adjustment to align with updated Berlin engineering benchmarks. Retention risk flagged by hiring manager.',
    rationaleCodes: ['MARKET_CONDITIONS', 'GEOGRAPHIC_FACTORS'],
    ownerId: manager2.id, approverId: hrManager.id,
  });

  console.log('  Created 8 finalised pay decisions with rationales');

  console.log('\n=== Seed complete ===');
  console.log('Demo accounts:');
  console.log('  admin@cdi.local / Admin123! (ADMIN)');
  console.log('  hr@cdi.local / HrManager123! (HR_MANAGER)');
  console.log('  manager1@cdi.local / Manager123! (MANAGER)');
  console.log('  manager2@cdi.local / Manager123! (MANAGER)');
  console.log(`  25 employees across 8 comparator groups`);
  console.log(`  5 salary ranges defined (4 groups uncovered — showcases coverage feature)`);
  console.log(`  8 finalised pay decisions with rationale links`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
