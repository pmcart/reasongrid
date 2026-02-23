/**
 * Role classification service — manages equal-value classification workflow.
 */

import { prisma } from '../lib/prisma.js';
import { getOrgAIProvider } from './ai-provider.js';
import type { ClassificationStatus } from '@prisma/client';

export interface UnclassifiedRole {
  country: string;
  jobFamily: string | null;
  level: string;
  roleTitle: string;
  employeeCount: number;
}

/**
 * Finds distinct role combinations from employees that don't have a RoleClassification yet.
 */
export async function getUnclassifiedRoles(organizationId: string): Promise<UnclassifiedRole[]> {
  const employeeGroups = await prisma.employee.groupBy({
    by: ['country', 'jobFamily', 'level', 'roleTitle'],
    where: { organizationId },
    _count: { id: true },
  });

  const existing = await prisma.roleClassification.findMany({
    where: { organizationId },
    select: { country: true, jobFamily: true, level: true, roleTitle: true },
  });

  const existingKeys = new Set(
    existing.map((e) => `${e.country}|${e.jobFamily ?? ''}|${e.level}|${e.roleTitle}`),
  );

  return employeeGroups
    .filter((g) => !existingKeys.has(`${g.country}|${g.jobFamily ?? ''}|${g.level}|${g.roleTitle}`))
    .map((g) => ({
      country: g.country,
      jobFamily: g.jobFamily,
      level: g.level,
      roleTitle: g.roleTitle,
      employeeCount: g._count.id,
    }));
}

/**
 * Classify a single role using the org's AI provider.
 */
export async function classifyRoleWithAI(
  roleClassificationId: string,
  organizationId: string,
): Promise<{ success: boolean; error?: string }> {
  const provider = await getOrgAIProvider(organizationId);
  if (!provider) {
    return { success: false, error: 'No AI provider configured' };
  }

  const classification = await prisma.roleClassification.findFirst({
    where: { id: roleClassificationId, organizationId },
  });
  if (!classification) {
    return { success: false, error: 'Classification not found' };
  }

  const dimensions = await prisma.classificationDimension.findMany({
    where: { organizationId },
    orderBy: { sortOrder: 'asc' },
  });
  if (dimensions.length === 0) {
    return { success: false, error: 'No classification dimensions configured' };
  }

  try {
    const suggestions = await provider.classifyRole(
      classification.jobDescription || '',
      {
        country: classification.country,
        jobFamily: classification.jobFamily,
        level: classification.level,
        roleTitle: classification.roleTitle,
      },
      dimensions,
    );

    if (suggestions.length === 0) {
      return { success: false, error: 'AI returned no classifications' };
    }

    // Delete existing tags and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.roleClassificationTag.deleteMany({
        where: { roleClassificationId },
      });

      for (const suggestion of suggestions) {
        await tx.roleClassificationTag.create({
          data: {
            roleClassificationId,
            dimensionId: suggestion.dimensionId,
            value: suggestion.value,
            numericValue: suggestion.numericValue ?? null,
            aiConfidence: suggestion.confidence,
            notes: suggestion.reasoning ?? null,
          },
        });
      }

      await tx.roleClassification.update({
        where: { id: roleClassificationId },
        data: {
          status: 'AI_SUGGESTED',
          aiProvider: provider.constructor.name.replace('Provider', '').toLowerCase(),
          aiGeneratedAt: new Date(),
        },
      });
    });

    return { success: true };
  } catch (err) {
    console.error(`[Classification] AI classification failed for ${roleClassificationId}:`, err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Bulk classify all unclassified roles (or specific role IDs).
 */
export async function bulkClassifyRoles(
  organizationId: string,
  roleIds?: string[],
): Promise<{ processed: number; successful: number; failed: number; errors: string[] }> {
  let classifications;

  if (roleIds && roleIds.length > 0) {
    classifications = await prisma.roleClassification.findMany({
      where: { id: { in: roleIds }, organizationId },
    });
  } else {
    // Auto-create RoleClassification records for unclassified roles first
    const unclassified = await getUnclassifiedRoles(organizationId);
    for (const role of unclassified) {
      await prisma.roleClassification.upsert({
        where: {
          organizationId_country_jobFamily_level_roleTitle: {
            organizationId,
            country: role.country,
            jobFamily: role.jobFamily ?? '',
            level: role.level,
            roleTitle: role.roleTitle,
          },
        },
        update: {},
        create: {
          organizationId,
          country: role.country,
          jobFamily: role.jobFamily,
          level: role.level,
          roleTitle: role.roleTitle,
          status: 'UNCLASSIFIED',
        },
      });
    }

    classifications = await prisma.roleClassification.findMany({
      where: {
        organizationId,
        status: { in: ['UNCLASSIFIED'] },
      },
    });
  }

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`[Classification] Starting bulk AI classification for ${classifications.length} roles...`);

  // Process in parallel batches to avoid rate limits while reducing total time
  const BATCH_SIZE = 5;
  for (let i = 0; i < classifications.length; i += BATCH_SIZE) {
    const batch = classifications.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(classifications.length / BATCH_SIZE);
    console.log(`[Classification] Batch ${batchNum}/${totalBatches}: classifying ${batch.map((c) => c.roleTitle).join(', ')}`);

    const results = await Promise.all(
      batch.map((c) => classifyRoleWithAI(c.id, organizationId)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.success) {
        successful++;
        console.log(`[Classification] ✓ ${batch[j]!.roleTitle}`);
      } else {
        failed++;
        errors.push(`${batch[j]!.roleTitle}: ${result.error}`);
        console.warn(`[Classification] ✗ ${batch[j]!.roleTitle}: ${result.error}`);
      }
    }
  }

  console.log(`[Classification] Done: ${successful} successful, ${failed} failed`);
  return { processed: classifications.length, successful, failed, errors };
}

/**
 * Get all role classifications with their tags and employee counts.
 */
export async function getRoleClassificationsWithCounts(
  organizationId: string,
  filters?: { status?: ClassificationStatus; country?: string; jobFamily?: string },
) {
  const where: Record<string, unknown> = { organizationId };
  if (filters?.status) where['status'] = filters.status;
  if (filters?.country) where['country'] = filters.country;
  if (filters?.jobFamily) where['jobFamily'] = filters.jobFamily;

  const classifications = await prisma.roleClassification.findMany({
    where,
    include: {
      tags: {
        include: { dimension: true },
      },
      confirmedBy: { select: { id: true, email: true } },
    },
    orderBy: [{ country: 'asc' }, { jobFamily: 'asc' }, { level: 'asc' }, { roleTitle: 'asc' }],
  });

  // Get employee counts per role combo
  const employeeCounts = await prisma.employee.groupBy({
    by: ['country', 'jobFamily', 'level', 'roleTitle'],
    where: { organizationId },
    _count: { id: true },
  });

  const countMap = new Map(
    employeeCounts.map((g) => [
      `${g.country}|${g.jobFamily ?? ''}|${g.level}|${g.roleTitle}`,
      g._count.id,
    ]),
  );

  return classifications.map((c) => ({
    ...c,
    employeeCount:
      countMap.get(`${c.country}|${c.jobFamily ?? ''}|${c.level}|${c.roleTitle}`) || 0,
  }));
}
