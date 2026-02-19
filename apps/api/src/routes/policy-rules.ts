import { Router } from 'express';
import { updatePolicyRuleSchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const policyRuleRouter = Router();
policyRuleRouter.use(authenticate);

// List all policy rules for the org
policyRuleRouter.get('/', async (req, res, next) => {
  try {
    const rules = await prisma.policyRule.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { checkType: 'asc' },
    });
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// Update a policy rule (ADMIN only)
policyRuleRouter.patch(
  '/:id',
  authorize(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const existing = await prisma.policyRule.findUnique({
        where: { id: req.params['id'] },
      });
      if (!existing || existing.organizationId !== req.user!.organizationId!) {
        res.status(404).json({ error: 'Policy rule not found' });
        return;
      }

      const body = updatePolicyRuleSchema.parse(req.body);

      const updated = await prisma.policyRule.update({
        where: { id: req.params['id'] },
        data: {
          ...body,
          params: body.params !== undefined ? body.params as any : undefined,
        },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
