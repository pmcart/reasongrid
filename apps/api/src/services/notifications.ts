import { prisma } from '../lib/prisma.js';

export async function createNotification(
  recipientUserId: string,
  type: 'DECISION_SUBMITTED_FOR_REVIEW' | 'DECISION_APPROVED' | 'DECISION_RETURNED',
  entityType: string,
  entityId: string,
  message: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        recipientUserId,
        type,
        entityType,
        entityId,
        message,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}
