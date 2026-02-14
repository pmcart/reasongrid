import { z } from 'zod';
import { DecisionType, DecisionStatus } from '../enums.js';

export const createPayDecisionSchema = z.object({
  decisionType: z.nativeEnum(DecisionType),
  effectiveDate: z.string(),
  payBeforeBase: z.number(),
  payAfterBase: z.number(),
  payBeforeBonus: z.number().nullable().default(null),
  payAfterBonus: z.number().nullable().default(null),
  payBeforeLti: z.number().nullable().default(null),
  payAfterLti: z.number().nullable().default(null),
  rationaleSelections: z.array(z.string().uuid()).min(1),
  supportingContext: z.string().min(1),
  evidenceReference: z.string().nullable().default(null),
  accountableOwnerUserId: z.string().optional(),
  approverUserId: z.string(),
});

export const payDecisionSchema = createPayDecisionSchema.extend({
  id: z.string(),
  employeeId: z.string(),
  snapshotId: z.string().nullable().default(null),
  status: z.nativeEnum(DecisionStatus),
  finalisedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updatePayDecisionSchema = createPayDecisionSchema.partial();

export type CreatePayDecision = z.infer<typeof createPayDecisionSchema>;
export type PayDecision = z.infer<typeof payDecisionSchema>;
export type UpdatePayDecision = z.infer<typeof updatePayDecisionSchema>;
