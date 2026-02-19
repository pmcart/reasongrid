import { z } from 'zod';
import { DecisionType, DecisionStatus, CheckType, PolicySeverity } from '../enums.js';

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

export const evaluatePayDecisionSchema = z.object({
  employeeId: z.string(),
  decisionType: z.nativeEnum(DecisionType),
  payAfterBase: z.number(),
  payAfterBonus: z.number().nullable().optional(),
  payAfterLti: z.number().nullable().optional(),
});

export const checkResultSchema = z.object({
  checkType: z.nativeEnum(CheckType),
  status: z.enum(['PASS', 'WARNING', 'BLOCK']),
  severity: z.nativeEnum(PolicySeverity),
  headline: z.string(),
  detail: z.string(),
  currentValue: z.number().optional(),
  projectedValue: z.number().optional(),
  threshold: z.number().optional(),
});

export const evaluationResultSchema = z.object({
  overallStatus: z.enum(['PASS', 'WARNING', 'BLOCK']),
  checks: z.array(checkResultSchema),
});

export const submitPayDecisionSchema = z.object({
  warningAcknowledgements: z.array(z.nativeEnum(CheckType)).optional(),
});

export const returnPayDecisionSchema = z.object({
  returnReason: z.string().min(1),
});

export type CreatePayDecision = z.infer<typeof createPayDecisionSchema>;
export type PayDecision = z.infer<typeof payDecisionSchema>;
export type UpdatePayDecision = z.infer<typeof updatePayDecisionSchema>;
export type EvaluatePayDecision = z.infer<typeof evaluatePayDecisionSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type SubmitPayDecision = z.infer<typeof submitPayDecisionSchema>;
export type ReturnPayDecision = z.infer<typeof returnPayDecisionSchema>;
