import { z } from 'zod';
import { NotificationType } from '../enums.js';

export const notificationSchema = z.object({
  id: z.string(),
  recipientUserId: z.string(),
  type: z.nativeEnum(NotificationType),
  entityType: z.string(),
  entityId: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;
