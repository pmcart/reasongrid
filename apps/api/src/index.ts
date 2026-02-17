import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { employeeRouter } from './routes/employees.js';
import { payDecisionRouter } from './routes/pay-decisions.js';
import { importRouter } from './routes/imports.js';
import { riskRouter } from './routes/risk.js';
import { reportRouter } from './routes/reports.js';
import { auditRouter } from './routes/audit.js';
import { salaryRangeRouter } from './routes/salary-ranges.js';
import { rationaleDefinitionRouter } from './routes/rationale-definitions.js';
import { adminRouter } from './routes/admin.js';
import { dashboardRouter } from './routes/dashboard.js';
import { errorHandler } from './middleware/error-handler.js';
import { authenticate, superAdminOnly, requireOrgScope } from './middleware/auth.js';
import { initScheduler } from './services/scheduler.js';

const app = express();
const PORT = process.env['PORT'] || 3000;

// CORS configuration
const corsOrigin = process.env['CORS_ORIGIN'] || 'http://localhost:4200';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/auth', authRouter);

// Super admin routes (auth + superAdminOnly applied here; individual routes don't need it)
app.use('/admin', authenticate, superAdminOnly, adminRouter);

// Org-scoped routes — authenticate first (to populate req.user), then requireOrgScope
// (each router also calls authenticate internally which is harmless — it re-verifies the token)
app.use('/employees', authenticate, requireOrgScope, employeeRouter);
app.use('/pay-decisions', authenticate, requireOrgScope, payDecisionRouter);
app.use('/imports', authenticate, requireOrgScope, importRouter);
app.use('/risk', authenticate, requireOrgScope, riskRouter);
app.use('/reports', authenticate, requireOrgScope, reportRouter);
app.use('/audit', authenticate, requireOrgScope, auditRouter);
app.use('/salary-ranges', authenticate, requireOrgScope, salaryRangeRouter);
app.use('/rationale-definitions', authenticate, requireOrgScope, rationaleDefinitionRouter);
app.use('/dashboard', authenticate, requireOrgScope, dashboardRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`CDI API running on port ${PORT}`);
  initScheduler();
});

export default app;
