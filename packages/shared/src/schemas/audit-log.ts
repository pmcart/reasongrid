import { z } from 'zod';
import { AuditAction } from '../enums.js';

export const auditLogSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable(),
  action: z.nativeEnum(AuditAction),
  entityType: z.string(),
  entityId: z.string().nullable(),
  metadata: z.any().nullable(),
  createdAt: z.string(),
});

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditLogEntry = z.infer<typeof auditLogSchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
