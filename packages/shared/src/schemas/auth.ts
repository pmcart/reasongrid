import { z } from 'zod';
import { UserRole } from '../enums.js';

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).default(UserRole.VIEWER),
  organizationId: z.string().uuid().optional(),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.nativeEnum(UserRole),
    organizationId: z.string().nullable(),
    organizationName: z.string().nullable(),
  }),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
