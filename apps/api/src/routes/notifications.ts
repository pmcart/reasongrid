import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

// List notifications for current user
notificationRouter.get('/', async (req, res, next) => {
  try {
    const readFilter = req.query['read'];
    const where: any = { recipientUserId: req.user!.userId };
    if (readFilter === 'true') where.read = true;
    if (readFilter === 'false') where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// Get unread count
notificationRouter.get('/unread-count', async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { recipientUserId: req.user!.userId, read: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// Mark one as read
notificationRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params['id'] },
    });
    if (!notification || notification.recipientUserId !== req.user!.userId) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    const updated = await prisma.notification.update({
      where: { id: req.params['id'] },
      data: { read: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Mark all as read
notificationRouter.post('/mark-all-read', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { recipientUserId: req.user!.userId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
