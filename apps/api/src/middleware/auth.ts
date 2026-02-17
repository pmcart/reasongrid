import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@cdi/shared';
import { verifyToken } from '../lib/jwt.js';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function superAdminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }
  next();
}

export function requireOrgScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.organizationId) {
    res.status(403).json({ error: 'Organization-scoped access required' });
    return;
  }
  next();
}
