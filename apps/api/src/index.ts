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
import { errorHandler } from './middleware/error-handler.js';
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
app.use('/employees', employeeRouter);
app.use('/pay-decisions', payDecisionRouter);
app.use('/imports', importRouter);
app.use('/risk', riskRouter);
app.use('/reports', reportRouter);
app.use('/audit', auditRouter);
app.use('/salary-ranges', salaryRangeRouter);
app.use('/rationale-definitions', rationaleDefinitionRouter);

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
