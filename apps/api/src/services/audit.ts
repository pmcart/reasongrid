/**
 * Audit logging service — records significant actions for compliance and traceability.
 * Fire-and-forget: errors are logged but never thrown to avoid disrupting the main flow.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AuditAction } from '@prisma/client';

export interface AuditLogParams {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: (params.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
