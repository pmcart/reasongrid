/**
 * Backfill script: creates EmployeeSnapshots for existing employees
 * and links existing PayDecisions to those snapshots.
 *
 * Run with: npx tsx prisma/backfill-snapshots.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany();
  console.log(`Found ${employees.length} employees to backfill...`);

  let snapshotCount = 0;
  let linkedDecisions = 0;

  for (const emp of employees) {
    // Check if this employee already has a snapshot
    const existingSnapshot = await prisma.employeeSnapshot.findFirst({
      where: { employeeId: emp.id },
    });

    if (existingSnapshot) {
      console.log(`  Employee ${emp.employeeId} already has snapshots, skipping creation...`);
      // Still link unlinked decisions
      const updated = await prisma.payDecision.updateMany({
        where: { employeeId: emp.id, snapshotId: null },
        data: { snapshotId: existingSnapshot.id },
      });
      linkedDecisions += updated.count;
      continue;
    }

    // Create a snapshot from the current employee data
    const snapshot = await prisma.employeeSnapshot.create({
      data: {
        employeeId: emp.id,
        importJobId: null,
        organizationId: emp.organizationId,
        employeeExternalId: emp.employeeId,
        roleTitle: emp.roleTitle,
        jobFamily: emp.jobFamily,
        level: emp.level,
        country: emp.country,
        location: emp.location,
        currency: emp.currency,
        baseSalary: emp.baseSalary,
        bonusTarget: emp.bonusTarget,
        ltiTarget: emp.ltiTarget,
        hireDate: emp.hireDate,
        employmentType: emp.employmentType,
        gender: emp.gender,
        performanceRating: emp.performanceRating,
        snapshotAt: emp.createdAt,
      },
    });
    snapshotCount++;

    // Link existing pay decisions to this snapshot
    const updated = await prisma.payDecision.updateMany({
      where: { employeeId: emp.id, snapshotId: null },
      data: { snapshotId: snapshot.id },
    });
    linkedDecisions += updated.count;

    console.log(`  Created snapshot for ${emp.employeeId}, linked ${updated.count} decisions`);
  }

  console.log(`\nBackfill complete: ${snapshotCount} snapshots created, ${linkedDecisions} decisions linked`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
