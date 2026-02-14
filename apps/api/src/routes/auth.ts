import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginRequestSchema, registerRequestSchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginRequestSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { organization: true },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip ?? null,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get users in the same organization (for owner/approver selection)
authRouter.get('/users', authenticate, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', authenticate, authorize(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = registerRequestSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
        organizationId: body.organizationId,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
  } catch (err) {
    next(err);
  }
});
