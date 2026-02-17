import { z } from 'zod';
import { UserRole } from '../enums.js';

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).refine(
    (r) => r !== UserRole.SUPER_ADMIN,
    { message: 'Cannot create SUPER_ADMIN users' },
  ),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).refine(
    (r) => r !== UserRole.SUPER_ADMIN,
    { message: 'Cannot assign SUPER_ADMIN role' },
  ).optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
