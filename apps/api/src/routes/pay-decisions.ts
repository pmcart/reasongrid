import { Router } from 'express';
import { createPayDecisionSchema, updatePayDecisionSchema, DecisionStatus, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const payDecisionRouter = Router();
payDecisionRouter.use(authenticate);

// Get all decisions for an employee
payDecisionRouter.get('/employee/:employeeId', async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params['employeeId'], organizationId: req.user!.organizationId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const decisions = await prisma.payDecision.findMany({
      where: { employeeId: employee.id },
      include: { rationales: true },
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
        where: { id: req.params['employeeId'], organizationId: req.user!.organizationId },
      });
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const body = createPayDecisionSchema.parse(req.body);
      const { rationaleSelections, ...decisionData } = body;

      const decision = await prisma.payDecision.create({
        data: {
          ...decisionData,
          employeeId: employee.id,
          status: DecisionStatus.DRAFT,
          rationales: {
            create: rationaleSelections.map((r) => ({ rationale: r })),
          },
        },
        include: { rationales: true },
      });

      res.status(201).json(decision);
    } catch (err) {
      next(err);
    }
  },
);

// Get a single decision
payDecisionRouter.get('/:id', async (req, res, next) => {
  try {
    const decision = await prisma.payDecision.findUnique({
      where: { id: req.params['id'] },
      include: { rationales: true, employee: true },
    });
    if (!decision || decision.employee.organizationId !== req.user!.organizationId) {
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
      if (!existing || existing.employee.organizationId !== req.user!.organizationId) {
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
        await prisma.payDecisionRationale.deleteMany({ where: { payDecisionId: existing.id } });
        updateData['rationales'] = {
          create: rationaleSelections.map((r) => ({ rationale: r })),
        };
      }

      const decision = await prisma.payDecision.update({
        where: { id: req.params['id'] },
        data: updateData,
        include: { rationales: true },
      });

      res.json(decision);
    } catch (err) {
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
      if (!existing || existing.employee.organizationId !== req.user!.organizationId) {
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
        include: { rationales: true },
      });

      // TODO: trigger risk analysis after finalisation
      res.json(decision);
    } catch (err) {
      next(err);
    }
  },
);
