/**
 * HRIS Integration routes — manage provider connections and trigger syncs.
 *
 * Provider support: BambooHR (extensible for Workday, SAP etc. later)
 *
 * All routes are org-scoped. CRUD requires ADMIN or HR_MANAGER.
 */

import { Router } from 'express';
import { UserRole } from '@cdi/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { testBambooHrConnection, fetchBambooHrEmployees } from '../services/bamboohr.js';
import { testHiBobConnection, fetchHiBobEmployees } from '../services/hibob.js';
import { testRipplingConnection, fetchRipplingEmployees } from '../services/rippling.js';
import { testPersonioConnection, fetchPersonioEmployees } from '../services/personio.js';
import { processHrisImport } from '../services/csv-processor.js';
import { logAudit } from '../services/audit.js';

export const hrisRouter = Router();
hrisRouter.use(authenticate);

// ── List connections ──────────────────────────────────────────────────────────

hrisRouter.get('/connections', async (req, res, next) => {
  try {
    const connections = await prisma.hrisConnection.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        provider: true,
        name: true,
        subdomain: true,
        isActive: true,
        lastSyncAt: true,
        fieldMappingJson: true,
        createdAt: true,
        updatedAt: true,
        // Never return apiKey
      },
    });
    res.json(connections);
  } catch (err) {
    next(err);
  }
});

// ── Get single connection ─────────────────────────────────────────────────────

hrisRouter.get('/connections/:id', async (req, res, next) => {
  try {
    const connection = await prisma.hrisConnection.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      select: {
        id: true,
        provider: true,
        name: true,
        subdomain: true,
        isActive: true,
        lastSyncAt: true,
        fieldMappingJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json(connection);
  } catch (err) {
    next(err);
  }
});

// ── Create connection ─────────────────────────────────────────────────────────

hrisRouter.post('/connections', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const { provider, name, subdomain, apiKey, fieldMappingJson } = req.body as {
      provider: string;
      name: string;
      subdomain: string;
      apiKey: string;
      fieldMappingJson?: Record<string, string>;
    };

    if (!provider || !name || !subdomain || !apiKey) {
      res.status(400).json({ error: 'provider, name, subdomain, and apiKey are required' });
      return;
    }

    if (provider !== 'bamboohr' && provider !== 'hibob' && provider !== 'rippling' && provider !== 'personio') {
      res.status(400).json({ error: `Unsupported provider: ${provider}. Supported: bamboohr, hibob, rippling, personio` });
      return;
    }

    const connection = await prisma.hrisConnection.create({
      data: {
        organizationId: req.user!.organizationId!,
        provider,
        name: name.trim(),
        subdomain: subdomain.trim().toLowerCase(),
        apiKey,
        fieldMappingJson: fieldMappingJson ?? Prisma.JsonNull,
        isActive: true,
      },
      select: {
        id: true, provider: true, name: true, subdomain: true,
        isActive: true, lastSyncAt: true, fieldMappingJson: true,
        createdAt: true, updatedAt: true,
      },
    });

    res.status(201).json(connection);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'A connection with this provider and name already exists for your organisation.' });
      return;
    }
    next(err);
  }
});

// ── Update connection ─────────────────────────────────────────────────────────

hrisRouter.put('/connections/:id', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const existing = await prisma.hrisConnection.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!existing) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const { name, subdomain, apiKey, fieldMappingJson, isActive } = req.body as {
      name?: string;
      subdomain?: string;
      apiKey?: string;
      fieldMappingJson?: Record<string, string> | null;
      isActive?: boolean;
    };

    const updated = await prisma.hrisConnection.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(subdomain !== undefined && { subdomain: subdomain.trim().toLowerCase() }),
        ...(apiKey !== undefined && { apiKey }),
        ...(fieldMappingJson !== undefined && { fieldMappingJson: fieldMappingJson ?? Prisma.JsonNull }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true, provider: true, name: true, subdomain: true,
        isActive: true, lastSyncAt: true, fieldMappingJson: true,
        createdAt: true, updatedAt: true,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── Delete connection ─────────────────────────────────────────────────────────

hrisRouter.delete('/connections/:id', authorize(UserRole.ADMIN), async (req, res, next) => {
  try {
    const existing = await prisma.hrisConnection.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!existing) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    await prisma.hrisConnection.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Test connection ───────────────────────────────────────────────────────────

hrisRouter.post('/connections/:id/test', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const connection = await prisma.hrisConnection.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    let result;
    if (connection.provider === 'hibob') {
      result = await testHiBobConnection(connection.subdomain, connection.apiKey);
    } else if (connection.provider === 'rippling') {
      result = await testRipplingConnection(connection.apiKey);
    } else if (connection.provider === 'personio') {
      result = await testPersonioConnection(connection.subdomain, connection.apiKey);
    } else {
      result = await testBambooHrConnection(connection.subdomain, connection.apiKey);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Test credentials before saving (no ID needed) ────────────────────────────

hrisRouter.post('/test-credentials', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const { provider = 'bamboohr', subdomain, apiKey } = req.body as { provider?: string; subdomain?: string; apiKey?: string };
    if (!subdomain || !apiKey) {
      res.status(400).json({ error: 'subdomain and apiKey are required' });
      return;
    }

    let result;
    if (provider === 'hibob') {
      result = await testHiBobConnection(subdomain.trim(), apiKey);
    } else if (provider === 'rippling') {
      result = await testRipplingConnection(apiKey);
    } else if (provider === 'personio') {
      result = await testPersonioConnection(subdomain.trim(), apiKey);
    } else {
      result = await testBambooHrConnection(subdomain.trim().toLowerCase(), apiKey);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Preview sync (fetch data without importing) ───────────────────────────────

hrisRouter.get('/connections/:id/preview', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const connection = await prisma.hrisConnection.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const fieldMapping = connection.fieldMappingJson as Record<string, string> | null ?? undefined;
    let employees, errors;
    if (connection.provider === 'hibob') {
      ({ employees, errors } = await fetchHiBobEmployees(connection.subdomain, connection.apiKey, fieldMapping));
    } else if (connection.provider === 'rippling') {
      ({ employees, errors } = await fetchRipplingEmployees(connection.apiKey, fieldMapping));
    } else if (connection.provider === 'personio') {
      ({ employees, errors } = await fetchPersonioEmployees(connection.subdomain, connection.apiKey, fieldMapping));
    } else {
      ({ employees, errors } = await fetchBambooHrEmployees(connection.subdomain, connection.apiKey, fieldMapping));
    }

    // Return a preview (first 10 rows + stats)
    res.json({
      totalEmployees: employees.length,
      fetchErrors: errors.length,
      sample: employees.slice(0, 10).map((e) => ({
        employeeId: e.employeeId,
        roleTitle: e.roleTitle,
        jobFamily: e.jobFamily,
        level: e.level,
        country: e.country,
        currency: e.currency,
        baseSalary: e.baseSalary,
        hireDate: e.hireDate,
      })),
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    next(err);
  }
});

// ── Trigger sync (create ImportJob + run in background) ──────────────────────

hrisRouter.post('/connections/:id/sync', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const connection = await prisma.hrisConnection.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (!connection.isActive) {
      res.status(400).json({ error: 'This connection is disabled. Enable it before syncing.' });
      return;
    }

    const organizationId = req.user!.organizationId!;

    // Create ImportJob to track this sync
    const importJob = await prisma.importJob.create({
      data: {
        uploadedByUserId: req.user!.userId,
        organizationId,
        status: 'PROCESSING',
        source: connection.provider,
        hrisConnectionId: connection.id,
      },
    });

    logAudit({
      organizationId,
      userId: req.user!.userId,
      action: 'IMPORT_STARTED',
      entityType: 'ImportJob',
      entityId: importJob.id,
      metadata: { source: connection.provider, connectionId: connection.id },
    });

    // Run in background — don't block the response
    (async () => {
      try {
        const fieldMapping = connection.fieldMappingJson as Record<string, string> | null ?? undefined;
        let employees, errors;
        if (connection.provider === 'hibob') {
          ({ employees, errors } = await fetchHiBobEmployees(connection.subdomain, connection.apiKey, fieldMapping));
        } else if (connection.provider === 'rippling') {
          ({ employees, errors } = await fetchRipplingEmployees(connection.apiKey, fieldMapping));
        } else if (connection.provider === 'personio') {
          ({ employees, errors } = await fetchPersonioEmployees(connection.subdomain, connection.apiKey, fieldMapping));
        } else {
          ({ employees, errors } = await fetchBambooHrEmployees(connection.subdomain, connection.apiKey, fieldMapping));
        }

        await processHrisImport(importJob.id, employees, errors, organizationId);

        // Update lastSyncAt on connection
        await prisma.hrisConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      } catch (err) {
        console.error(`[HRIS] Background sync failed for import ${importJob.id}:`, err);
        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'FAILED' },
        }).catch(() => undefined);
      }
    })();

    res.status(202).json({
      importId: importJob.id,
      status: 'PROCESSING',
      message: 'Sync started. Poll /imports/:id for status.',
    });
  } catch (err) {
    next(err);
  }
});
