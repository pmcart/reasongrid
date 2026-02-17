import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from '@cdi/shared';
import { prisma } from '../lib/prisma.js';

export const adminRouter = Router();

// ── Organization CRUD ──────────────────────────────────────────────

adminRouter.get('/organizations', async (_req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });
    res.json(
      orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        userCount: o._count.users,
        employeeCount: o._count.employees,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/organizations/:id', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      userCount: org._count.users,
      employeeCount: org._count.employees,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/organizations', async (req, res, next) => {
  try {
    const body = createOrganizationSchema.parse(req.body);
    const org = await prisma.organization.create({
      data: { name: body.name, slug: body.slug },
    });
    res.status(201).json(org);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'An organization with this slug already exists' });
      return;
    }
    next(err);
  }
});

adminRouter.patch('/organizations/:id', async (req, res, next) => {
  try {
    const body = updateOrganizationSchema.parse(req.body);
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(org);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'An organization with this slug already exists' });
      return;
    }
    next(err);
  }
});

adminRouter.delete('/organizations/:id', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true, employees: true } } },
    });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    if (org._count.users > 0 || org._count.employees > 0) {
      res.status(409).json({
        error: 'Cannot delete organization with existing users or employees. Remove them first.',
      });
      return;
    }
    await prisma.organization.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── User Management ────────────────────────────────────────────────

adminRouter.get('/organizations/:orgId/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.params.orgId },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { email: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/organizations/:orgId/users', async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);

    // Verify the org exists
    const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
        organizationId: req.params.orgId,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    next(err);
  }
});

adminRouter.patch('/users/:userId', async (req, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: body,
    });
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      updatedAt: user.updatedAt,
    });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    next(err);
  }
});

adminRouter.delete('/users/:userId', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Cannot delete super admin users' });
      return;
    }
    await prisma.user.delete({ where: { id: req.params.userId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/users/:userId/reset-password', async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.user.update({
      where: { id: req.params.userId },
      data: { passwordHash },
    });
    res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    next(err);
  }
});

// ── Stats ──────────────────────────────────────────────────────────

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [orgCount, userCount, employeeCount] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
      prisma.employee.count(),
    ]);
    res.json({ orgCount, userCount, employeeCount });
  } catch (err) {
    next(err);
  }
});
