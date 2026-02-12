import { z } from 'zod';
import { RiskState, RiskRunStatus } from '../enums.js';

export const riskGroupResultSchema = z.object({
  id: z.string(),
  riskRunId: z.string(),
  country: z.string(),
  jobFamily: z.string().nullable(),
  level: z.string(),
  roleTitleFallback: z.string().nullable(),
  groupKey: z.string(),
  womenCount: z.number(),
  menCount: z.number(),
  gapPct: z.number(),
  riskState: z.nativeEnum(RiskState),
  notes: z.string().nullable(),
  computedAt: z.string(),
});

export const riskRunSchema = z.object({
  id: z.string(),
  triggeredBy: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.nativeEnum(RiskRunStatus),
});

export const riskGroupQuerySchema = z.object({
  riskState: z.nativeEnum(RiskState).optional(),
  country: z.string().optional(),
  jobFamily: z.string().optional(),
  level: z.string().optional(),
});

export type RiskGroupResult = z.infer<typeof riskGroupResultSchema>;
export type RiskRun = z.infer<typeof riskRunSchema>;
export type RiskGroupQuery = z.infer<typeof riskGroupQuerySchema>;
