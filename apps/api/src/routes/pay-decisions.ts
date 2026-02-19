import { Router } from 'express';
import {
  createPayDecisionSchema, updatePayDecisionSchema,
  evaluatePayDecisionSchema, submitPayDecisionSchema, returnPayDecisionSchema,
  DecisionStatus, UserRole,
} from '@cdi/shared';
import { Prisma, RationaleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { computeSnapshotContext } from '../services/snapshot-context.js';
import { runRiskComputation } from '../services/risk-computation.js';
import { runEvaluation } from '../services/evaluation-checks/index.js';
import { createNotification } from '../services/notifications.js';

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
      if (existing.status !== DecisionStatus.DRAFT && existing.status !== DecisionStatus.RETURNED) {
        res.status(400).json({ error: 'Can only edit decisions in DRAFT or RETURNED status' });
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
      if (existing.status !== DecisionStatus.APPROVED && existing.status !== DecisionStatus.DRAFT) {
        res.status(400).json({ error: 'Decision must be APPROVED or DRAFT to finalise' });
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

// Evaluate a proposed pay decision (stateless — does not create records)
payDecisionRouter.post(
  '/evaluate',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER),
  async (req, res, next) => {
    try {
      const body = evaluatePayDecisionSchema.parse(req.body);
      const result = await runEvaluation({
        employeeId: body.employeeId,
        organizationId: req.user!.organizationId!,
        decisionType: body.decisionType,
        payAfterBase: body.payAfterBase,
      });
      res.json(result);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

// Submit a decision for review
payDecisionRouter.post(
  '/:id/submit',
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
      if (existing.status !== DecisionStatus.DRAFT && existing.status !== DecisionStatus.RETURNED) {
        res.status(400).json({ error: 'Can only submit decisions in DRAFT or RETURNED status' });
        return;
      }

      // Run evaluation
      const evaluation = await runEvaluation({
        employeeId: existing.employeeId,
        organizationId: req.user!.organizationId!,
        decisionType: existing.decisionType as any,
        payAfterBase: existing.payAfterBase,
      });

      // If any check is BLOCK, reject submission
      if (evaluation.overallStatus === 'BLOCK') {
        res.status(400).json({
          error: 'Cannot submit — one or more policy checks are blocking',
          evaluation,
        });
        return;
      }

      // If WARNING, require acknowledgements
      if (evaluation.overallStatus === 'WARNING') {
        const body = submitPayDecisionSchema.parse(req.body);
        const warningChecks = evaluation.checks
          .filter((c) => c.status === 'WARNING')
          .map((c) => c.checkType);
        const acknowledged = body.warningAcknowledgements ?? [];
        const missing = warningChecks.filter((ct) => !acknowledged.includes(ct as any));
        if (missing.length > 0) {
          res.status(400).json({
            error: 'Warning acknowledgements required',
            missingAcknowledgements: missing,
            evaluation,
          });
          return;
        }
      }

      const decision = await prisma.payDecision.update({
        where: { id: req.params['id'] },
        data: {
          status: 'PENDING_REVIEW',
          evaluationSnapshot: evaluation as any,
          submittedAt: new Date(),
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
        action: 'PAY_DECISION_SUBMITTED',
        entityType: 'PayDecision',
        entityId: decision.id,
        metadata: { overallStatus: evaluation.overallStatus },
      });

      // Notify approver
      createNotification(
        existing.approverUserId,
        'DECISION_SUBMITTED_FOR_REVIEW',
        'PayDecision',
        decision.id,
        `A pay decision for ${existing.employee.employeeId} has been submitted for your review.`,
      );

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

// Approve a decision
payDecisionRouter.post(
  '/:id/approve',
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
      if (existing.status !== 'PENDING_REVIEW') {
        res.status(400).json({ error: 'Can only approve decisions in PENDING_REVIEW status' });
        return;
      }
      // Must be the named approver or ADMIN
      if (existing.approverUserId !== req.user!.userId && req.user!.role !== 'ADMIN') {
        res.status(403).json({ error: 'Only the named approver or an ADMIN can approve this decision' });
        return;
      }

      // Approve and auto-finalise
      const now = new Date();
      const decision = await prisma.payDecision.update({
        where: { id: req.params['id'] },
        data: {
          status: 'FINALISED',
          approvedAt: now,
          finalisedAt: now,
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
        action: 'PAY_DECISION_APPROVED',
        entityType: 'PayDecision',
        entityId: decision.id,
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'PAY_DECISION_FINALISED',
        entityType: 'PayDecision',
        entityId: decision.id,
        metadata: { approvedBy: req.user!.userId },
      });

      // Notify the owner
      createNotification(
        existing.accountableOwnerUserId,
        'DECISION_APPROVED',
        'PayDecision',
        decision.id,
        `Your pay decision for ${existing.employee.employeeId} has been approved and finalised.`,
      );

      // Trigger risk re-computation
      runRiskComputation(req.user!.organizationId!, req.user!.userId).catch((err) =>
        console.error('Risk computation after approval failed:', err),
      );

      res.json(decision);
    } catch (err) {
      next(err);
    }
  },
);

// Return a decision (send back for revisions)
payDecisionRouter.post(
  '/:id/return',
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
      if (existing.status !== 'PENDING_REVIEW') {
        res.status(400).json({ error: 'Can only return decisions in PENDING_REVIEW status' });
        return;
      }
      // Must be the named approver or ADMIN
      if (existing.approverUserId !== req.user!.userId && req.user!.role !== 'ADMIN') {
        res.status(403).json({ error: 'Only the named approver or an ADMIN can return this decision' });
        return;
      }

      const body = returnPayDecisionSchema.parse(req.body);

      const decision = await prisma.payDecision.update({
        where: { id: req.params['id'] },
        data: {
          status: 'RETURNED',
          returnReason: body.returnReason,
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
        action: 'PAY_DECISION_RETURNED',
        entityType: 'PayDecision',
        entityId: decision.id,
        metadata: { returnReason: body.returnReason },
      });

      // Notify the owner
      createNotification(
        existing.accountableOwnerUserId,
        'DECISION_RETURNED',
        'PayDecision',
        decision.id,
        `Your pay decision for ${existing.employee.employeeId} has been returned for revisions.`,
      );

      res.json(decision);
    } catch (err) {
      next(err);
    }
  },
);
