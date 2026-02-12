import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

export const reportRouter = Router();
reportRouter.use(authenticate);

// Employee snapshot report
reportRouter.get('/employee-snapshot/:employeeId', async (_req, res) => {
  // TODO: implement PDF generation
  res.status(501).json({ error: 'Not yet implemented' });
});

// Pay decision summary report
reportRouter.get('/pay-decision-summary', async (_req, res) => {
  // TODO: implement PDF generation with date range filter
  res.status(501).json({ error: 'Not yet implemented' });
});
