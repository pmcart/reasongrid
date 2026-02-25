import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database — deleting all data...');

  // Delete in dependency order (children before parents)
  await prisma.auditLog.deleteMany();
  console.log('  auditLog');

  await prisma.notification.deleteMany();
  console.log('  notification');

  await prisma.regressionRun.deleteMany();
  console.log('  regressionRun');

  await prisma.aiRiskReport.deleteMany();
  console.log('  aiRiskReport');

  await prisma.riskGroupResult.deleteMany();
  console.log('  riskGroupResult');

  await prisma.riskRun.deleteMany();
  console.log('  riskRun');

  await prisma.payDecisionRationale.deleteMany();
  console.log('  payDecisionRationale');

  await prisma.payDecision.deleteMany();
  console.log('  payDecision');

  await prisma.employeeSnapshot.deleteMany();
  console.log('  employeeSnapshot');

  await prisma.importJob.deleteMany();
  console.log('  importJob');

  await prisma.employee.deleteMany();
  console.log('  employee');

  await prisma.roleClassificationTag.deleteMany();
  console.log('  roleClassificationTag');

  await prisma.roleClassification.deleteMany();
  console.log('  roleClassification');

  await prisma.classificationDimension.deleteMany();
  console.log('  classificationDimension');

  await prisma.disclosureTemplate.deleteMany();
  console.log('  disclosureTemplate');

  await prisma.salaryRange.deleteMany();
  console.log('  salaryRange');

  await prisma.policyRule.deleteMany();
  console.log('  policyRule');

  await prisma.rationaleDefinition.deleteMany();
  console.log('  rationaleDefinition');

  await prisma.aiProviderConfig.deleteMany();
  console.log('  aiProviderConfig');

  await prisma.user.deleteMany();
  console.log('  user');

  await prisma.organization.deleteMany();
  console.log('  organization');

  console.log('\nDatabase reset complete — all tables are empty.');
  console.log('Run `npm run db:seed` to re-populate with seed data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
