import { Router } from 'express';
import { createPayDecisionSchema, updatePayDecisionSchema, DecisionStatus, UserRole } from '@cdi/shared';
import { Prisma, RationaleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { computeSnapshotContext } from '../services/snapshot-context.js';
import { runRiskComputation } from '../services/risk-computation.js';

export const payDecisionRouter = Router();
payDecisionRouter.use(authenticate);

/**
 * Look up rationale definitions by IDs, verify they are ACTIVE and org-scoped.
 * Returns the definitions or throws a descriptive error.
 */
async function resolveRationales(rationaleIds: string[], organizationId: string) {
  const definitions = await prisma.rationaleDefinition.findMany({
    where: {
      id: { in: rationaleIds },
      organizationId,
    },
  });

  if (definitions.length !== rationaleIds.length) {
    const foundIds = new Set(definitions.map((d) => d.id));
    const missing = rationaleIds.filter((id) => !foundIds.has(id));
    throw Object.assign(new Error(`Rationale definitions not found: ${missing.join(', ')}`), {
      status: 400,
    });
  }

  const archived = definitions.filter((d) => d.status === RationaleStatus.ARCHIVED);
  if (archived.length > 0) {
    throw Object.assign(
      new Error(
        `Archived rationale definitions cannot be used: ${archived.map((d) => d.name).join(', ')}`,
      ),
      { status: 400 },
    );
  }

  return definitions;
}

/**
 * Create a rationale snapshot (frozen copy) from a RationaleDefinition.
 */
function makeRationaleSnapshot(def: {
  id: string;
  code: string;
  name: string;
  version: number;
  category: string;
  legalDescription: string;
  plainLanguageDescription: string;
  objectiveCriteriaTags: unknown;
  applicableDecisionTypes: unknown;
  requiresSubstantiation: boolean;
}): Prisma.InputJsonValue {
  return {
    id: def.id,
    code: def.code,
    name: def.name,
    version: def.version,
    category: def.category,
    legalDescription: def.legalDescription,
    plainLanguageDescription: def.plainLanguageDescription,
    objectiveCriteriaTags: def.objectiveCriteriaTags as Prisma.InputJsonValue,
    applicableDecisionTypes: def.applicableDecisionTypes as Prisma.InputJsonValue,
    requiresSubstantiation: def.requiresSubstantiation,
  };
}

// Get all decisions for an employee
payDecisionRouter.get('/employee/:employeeId', async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params['employeeId'], organizationId: req.user!.organizationId! },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const decisions = await prisma.payDecision.findMany({
      where: { employeeId: employee.id },
      include: {
        rationales: { include: { rationaleDefinition: true } },
        snapshot: true,
        owner: { select: { id: true, email: true, role: true } },
        approver: { select: { id: true, email: true, role: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    res.json(decisions);
  } catch (err) {
    next(err);
  }
});

// Create a draft pay decision
payDecisionRouter.post(
  '/employee/:employeeId',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER),
  async (req, res, next) => {
    try {
      const employee = await prisma.employee.findFirst({
        where: { id: req.params['employeeId'], organizationId: req.user!.organizationId! },
      });
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const body = createPayDecisionSchema.parse(req.body);
      const { rationaleSelections, accountableOwnerUserId, ...decisionData } = body;

      // Resolve and validate rationale definitions
      const definitions = await resolveRationales(
        rationaleSelections,
        req.user!.organizationId!,
      );

      // Always create a fresh snapshot with computed decision context
      const context = await computeSnapshotContext({
        employeeId: employee.id,
        organizationId: req.user!.organizationId!,
        employee: {
          country: employee.country,
          jobFamily: employee.jobFamily,
          level: employee.level,
          roleTitle: employee.roleTitle,
          currency: employee.currency,
          baseSalary: employee.baseSalary,
          hireDate: employee.hireDate,
        },
      });

      const snapshot = await prisma.employeeSnapshot.create({
        data: {
          employeeId: employee.id,
          organizationId: req.user!.organizationId!,
          employeeExternalId: employee.employeeId,
          roleTitle: employee.roleTitle,
          jobFamily: employee.jobFamily,
          level: employee.level,
          country: employee.country,
          location: employee.location,
          currency: employee.currency,
          baseSalary: employee.baseSalary,
          bonusTarget: employee.bonusTarget,
          ltiTarget: employee.ltiTarget,
          hireDate: employee.hireDate,
          employmentType: employee.employmentType,
          gender: employee.gender,
          performanceRating: employee.performanceRating,
          tenureYears: context.tenureYears,
          compaRatio: context.compaRatio,
          positionInRange: context.positionInRange,
          comparatorGroupKey: context.comparatorGroupKey,
          priorPromotionCount: context.priorPromotionCount,
          lastPromotionDate: context.lastPromotionDate,
          priorIncreaseCount: context.priorIncreaseCount,
          priorIncreaseTotalPct: context.priorIncreaseTotalPct,
        },
      });

      const decision = await prisma.payDecision.create({
        data: {
          ...decisionData,
          accountableOwnerUserId: accountableOwnerUserId || req.user!.userId,
          employeeId: employee.id,
          snapshotId: snapshot.id,
          status: DecisionStatus.DRAFT,
          rationales: {
            create: definitions.map((def) => ({
              rationaleDefinition: { connect: { id: def.id } },
              rationaleSnapshot: makeRationaleSnapshot(def),
            })),
          },
        },
        include: {
          rationales: { include: { rationaleDefinition: true } },
          snapshot: true,
          owner: { select: { id: true, email: true, role: true } },
          approver: { select: { id: true, email: true, role: true } },
        },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'PAY_DECISION_CREATED',
        entityType: 'PayDecision',
        entityId: decision.id,
        metadata: { employeeId: employee.id, snapshotId: snapshot.id, decisionType: decisionData.decisionType },
      });

      res.status(201).json(decision);
    } catch (err: any) {
      if (err.status === 400) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

// Get a single decision
payDecisionRouter.get('/:id', async (req, res, next) => {
  try {
    const decision = await prisma.payDecision.findUnique({
      where: { id: req.params['id'] },
      include: {
        rationales: { include: { rationaleDefinition: true } },
        employee: true,
        snapshot: true,
        owner: { select: { id: true, email: true, role: true } },
        approver: { select: { id: true, email: true, role: true } },
      },
    });
    if (!decision || decision.employee.organizationId !== req.user!.organizationId!) {
      res.status(404).json({ error: 'Pay decision not found' });
      return;
    }
    res.json(decision);
  } catch (err) {
    next(err);
  }
});

// Update a draft decision
payDecisionRouter.patch(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER),
  async (req, res, next) => {
    try {
      const existing = await prisma.payDecision.findUnique({
        where: { id: req.params['id'] },
        include: { employee: true },
      });
      if (!existing || existing.employee.organizationId !== req.user!.organizationId!) {
        res.status(404).json({ error: 'Pay decision not found' });
        return;
      }
      if (existing.status === DecisionStatus.FINALISED) {
        res.status(400).json({ error: 'Cannot edit a finalised decision' });
        return;
      }

      const body = updatePayDecisionSchema.parse(req.body);
      const { rationaleSelections, ...decisionData } = body;

      const updateData: Record<string, unknown> = { ...decisionData };
      if (rationaleSelections) {
        const definitions = await resolveRationales(
          rationaleSelections,
          req.user!.organizationId!,
        );
        await prisma.payDecisionRationale.deleteMany({ where: { payDecisionId: existing.id } });
        updateData['rationales'] = {
          create: definitions.map((def) => ({
            rationaleDefinition: { connect: { id: def.id } },
            rationaleSnapshot: makeRationaleSnapshot(def),
          })),
        };
      }

      const decision = await prisma.payDecision.update({
        where: { id: req.params['id'] },
        data: updateData,
        include: {
          rationales: { include: { rationaleDefinition: true } },
          snapshot: true,
          owner: { select: { id: true, email: true, role: true } },
          approver: { select: { id: true, email: true, role: true } },
        },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'PAY_DECISION_UPDATED',
        entityType: 'PayDecision',
        entityId: decision.id,
        metadata: { changedFields: Object.keys(decisionData) },
      });

      res.json(decision);
    } catch (err: any) {
      if (err.status === 400) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

// Finalise a decision
payDecisionRouter.post(
  '/:id/finalise',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const existing = await prisma.payDecision.findUnique({
        where: { id: req.params['id'] },
        include: { employee: true },
      });
      if (!existing || existing.employee.organizationId !== req.user!.organizationId!) {
        res.status(404).json({ error: 'Pay decision not found' });
        return;
      }
      if (existing.status === DecisionStatus.FINALISED) {
        res.status(400).json({ error: 'Decision is already finalised' });
        return;
      }

      const decision = await prisma.payDecision.update({
        where: { id: req.params['id'] },
        data: { status: DecisionStatus.FINALISED, finalisedAt: new Date().toISOString() },
        include: {
          rationales: { include: { rationaleDefinition: true } },
          snapshot: true,
          owner: { select: { id: true, email: true, role: true } },
          approver: { select: { id: true, email: true, role: true } },
        },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'PAY_DECISION_FINALISED',
        entityType: 'PayDecision',
        entityId: decision.id,
        metadata: { employeeId: existing.employeeId, finalisedBy: req.user!.userId },
      });

      // Trigger risk re-computation after finalisation (fire-and-forget)
      runRiskComputation(req.user!.organizationId!, req.user!.userId).catch((err) =>
        console.error('Risk computation after finalisation failed:', err),
      );

      res.json(decision);
    } catch (err) {
      next(err);
    }
  },
);
