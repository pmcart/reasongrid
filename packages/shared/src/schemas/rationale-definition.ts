import { z } from 'zod';
import { RationaleCategory, RationaleStatus, DecisionType } from '../enums.js';

export const rationaleDefinitionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  legalDescription: z.string(),
  plainLanguageDescription: z.string(),
  category: z.nativeEnum(RationaleCategory),
  objectiveCriteriaTags: z.array(z.string()),
  applicableDecisionTypes: z.array(z.nativeEnum(DecisionType)),
  status: z.nativeEnum(RationaleStatus),
  version: z.number().int().positive(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  jurisdictionScope: z.array(z.string()),
  requiresSubstantiation: z.boolean(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createRationaleDefinitionSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(200),
  legalDescription: z.string().min(1),
  plainLanguageDescription: z.string().default(''),
  category: z.nativeEnum(RationaleCategory),
  objectiveCriteriaTags: z.array(z.string()).default([]),
  applicableDecisionTypes: z.array(z.nativeEnum(DecisionType)).default([]),
  jurisdictionScope: z.array(z.string()).default([]),
  requiresSubstantiation: z.boolean().default(false),
  effectiveFrom: z.string().optional(),
});

export const updateRationaleDefinitionSchema = createRationaleDefinitionSchema
  .omit({ code: true })
  .partial();

export type RationaleDefinition = z.infer<typeof rationaleDefinitionSchema>;
export type CreateRationaleDefinition = z.infer<typeof createRationaleDefinitionSchema>;
export type UpdateRationaleDefinition = z.infer<typeof updateRationaleDefinitionSchema>;
