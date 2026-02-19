import { z } from 'zod';
import { CheckType, PolicySeverity } from '../enums.js';

export const policyRuleSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  checkType: z.nativeEnum(CheckType),
  enabled: z.boolean(),
  params: z.record(z.unknown()),
  severity: z.nativeEnum(PolicySeverity),
  appliesToDecisionTypes: z.array(z.string()),
  appliesToCountries: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updatePolicyRuleSchema = z.object({
  enabled: z.boolean().optional(),
  severity: z.nativeEnum(PolicySeverity).optional(),
  params: z.record(z.unknown()).optional(),
});

export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type UpdatePolicyRule = z.infer<typeof updatePolicyRuleSchema>;
