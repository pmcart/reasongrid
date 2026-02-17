import { Router } from 'express';
import { riskGroupQuerySchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { startRiskComputation } from '../services/risk-computation.js';
import { generateRiskAnalysis } from '../services/risk-analysis-ai.js';

export const riskRouter = Router();
riskRouter.use(authenticate);

// Trigger a risk run manually
riskRouter.post('/run', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    // Await run creation, computation runs in background
    const riskRunId = await startRiskComputation(req.user!.organizationId!, req.user!.userId);
    res.status(202).json({ riskRunId, status: 'RUNNING' });
  } catch (err) {
    next(err);
  }
});

// Get status of a specific risk run
riskRouter.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await prisma.riskRun.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      include: {
        importJob: { select: { id: true, createdAt: true, createdCount: true, updatedCount: true } },
      },
    });
    if (!run) {
      res.status(404).json({ error: 'Risk run not found' });
      return;
    }
    const groups =
      run.status === 'COMPLETED'
        ? await prisma.riskGroupResult.findMany({ where: { riskRunId: run.id } })
        : [];
    res.json({ run, groups });
  } catch (err) {
    next(err);
  }
});

// Get latest risk run summary
riskRouter.get('/latest', async (req, res, next) => {
  try {
    const latestRun = await prisma.riskRun.findFirst({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { startedAt: 'desc' },
      include: {
        importJob: { select: { id: true, createdAt: true, createdCount: true, updatedCount: true } },
      },
    });
    if (!latestRun) {
      res.json({ run: null, groups: [] });
      return;
    }
    const groups =
      latestRun.status === 'COMPLETED'
        ? await prisma.riskGroupResult.findMany({ where: { riskRunId: latestRun.id } })
        : [];
    res.json({ run: latestRun, groups });
  } catch (err) {
    next(err);
  }
});

// List risk groups with filters
riskRouter.get('/groups', async (req, res, next) => {
  try {
    const query = riskGroupQuerySchema.parse(req.query);
    const latestRun = await prisma.riskRun.findFirst({
      where: { status: 'COMPLETED', organizationId: req.user!.organizationId! },
      orderBy: { finishedAt: 'desc' },
    });
    if (!latestRun) {
      res.json([]);
      return;
    }

    const where: Record<string, unknown> = { riskRunId: latestRun.id };
    if (query.riskState) where['riskState'] = query.riskState;
    if (query.country) where['country'] = query.country;
    if (query.jobFamily) where['jobFamily'] = query.jobFamily;
    if (query.level) where['level'] = query.level;

    const groups = await prisma.riskGroupResult.findMany({ where });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// Get group drilldown with impacted employees and recent decisions
riskRouter.get('/groups/:groupKey', async (req, res, next) => {
  try {
    const latestRun = await prisma.riskRun.findFirst({
      where: { status: 'COMPLETED', organizationId: req.user!.organizationId! },
      orderBy: { finishedAt: 'desc' },
    });
    if (!latestRun) {
      res.status(404).json({ error: 'No completed risk runs' });
      return;
    }

    const group = await prisma.riskGroupResult.findFirst({
      where: { riskRunId: latestRun.id, groupKey: req.params['groupKey'] },
    });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Build employee filter matching the comparator group
    const employeeWhere: Record<string, unknown> = {
      organizationId: req.user!.organizationId!,
      country: group.country,
      level: group.level,
    };
    if (group.jobFamily) {
      employeeWhere['jobFamily'] = group.jobFamily;
    } else if (group.roleTitleFallback) {
      employeeWhere['jobFamily'] = null;
      employeeWhere['roleTitle'] = group.roleTitleFallback;
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        employeeId: true,
        roleTitle: true,
        baseSalary: true,
        currency: true,
        gender: true,
        level: true,
        jobFamily: true,
      },
      orderBy: { baseSalary: 'desc' },
    });

    // Fetch recent finalised pay decisions for these employees
    const employeeIds = employees.map((e) => e.id);
    const recentDecisions =
      employeeIds.length > 0
        ? await prisma.payDecision.findMany({
            where: {
              employeeId: { in: employeeIds },
              status: 'FINALISED',
            },
            select: {
              id: true,
              employeeId: true,
              decisionType: true,
              effectiveDate: true,
              payBeforeBase: true,
              payAfterBase: true,
              status: true,
              finalisedAt: true,
              employee: { select: { employeeId: true } },
            },
            orderBy: { effectiveDate: 'desc' },
            take: 20,
          })
        : [];

    res.json({ group, employees, recentDecisions });
  } catch (err) {
    next(err);
  }
});

// List all AI risk reports
riskRouter.get('/reports', async (req, res, next) => {
  try {
    const reports = await prisma.aiRiskReport.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { generatedAt: 'desc' },
      include: {
        riskRun: {
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            triggeredBy: true,
            importJobId: true,
            importJob: { select: { id: true, createdAt: true, createdCount: true, updatedCount: true } },
          },
        },
      },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// Get a single AI risk report
riskRouter.get('/reports/:id', async (req, res, next) => {
  try {
    const report = await prisma.aiRiskReport.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      include: {
        riskRun: {
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            triggeredBy: true,
            importJobId: true,
            importJob: { select: { id: true, createdAt: true, createdCount: true, updatedCount: true } },
          },
        },
      },
    });
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// Generate AI risk analysis report from latest completed run
riskRouter.post('/analyze', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const latestRun = await prisma.riskRun.findFirst({
      where: { status: 'COMPLETED', organizationId: req.user!.organizationId! },
      orderBy: { finishedAt: 'desc' },
      include: {
        importJob: { select: { id: true, createdAt: true, createdCount: true, updatedCount: true } },
      },
    });
    if (!latestRun) {
      res.status(404).json({ error: 'No completed risk runs to analyze' });
      return;
    }

    const groups = await prisma.riskGroupResult.findMany({
      where: { riskRunId: latestRun.id },
    });
    if (groups.length === 0) {
      res.status(404).json({ error: 'No risk groups found in latest run' });
      return;
    }

    // Get org name for context
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { name: true },
    });

    const report = await generateRiskAnalysis(groups, org?.name);
    if (!report) {
      res.status(503).json({ error: 'AI analysis unavailable. Ensure Ollama is running.' });
      return;
    }

    // Persist the report to DB
    const saved = await prisma.aiRiskReport.create({
      data: {
        riskRunId: latestRun.id,
        organizationId: req.user!.organizationId!,
        summary: report.summary,
        model: report.model,
      },
    });

    res.json({
      id: saved.id,
      summary: report.summary,
      generatedAt: saved.generatedAt.toISOString(),
      model: report.model,
      riskRunId: latestRun.id,
      importJobId: latestRun.importJobId,
      importJob: latestRun.importJob,
    });
  } catch (err) {
    next(err);
  }
});
