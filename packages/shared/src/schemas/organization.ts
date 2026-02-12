import { z } from 'zod';

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Organization = z.infer<typeof organizationSchema>;
