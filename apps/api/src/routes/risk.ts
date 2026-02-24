import { Router } from 'express';
import { riskGroupQuerySchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { startRiskComputation } from '../services/risk-computation.js';
import { generateRiskReport } from '../services/risk-analysis-ai.js';
import { runRegressionAnalysis } from '../services/regression-engine.js';

export const riskRouter = Router();
riskRouter.use(authenticate);

// Trigger a risk run manually
riskRouter.post('/run', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
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

    const employeeIds = employees.map((e) => e.id);
    const recentDecisions =
      employeeIds.length > 0
        ? await prisma.payDecision.findMany({
            where: { employeeId: { in: employeeIds }, status: 'FINALISED' },
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

// List all risk reports
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

// Get a single risk report
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

// Generate risk analysis report from latest completed run
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
      res.status(404).json({ error: 'No completed risk runs to analyse' });
      return;
    }

    const groups = await prisma.riskGroupResult.findMany({
      where: { riskRunId: latestRun.id },
    });
    if (groups.length === 0) {
      res.status(404).json({ error: 'No risk groups found in latest run' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { name: true },
    });

    const report = await generateRiskReport(groups, org?.name);
    if (!report) {
      res.status(422).json({ error: 'Unable to generate report — no groups available' });
      return;
    }

    const saved = await prisma.aiRiskReport.create({
      data: {
        riskRunId: latestRun.id,
        organizationId: req.user!.organizationId!,
        summary: JSON.stringify(report.reportData),
        reportData: report.reportData as object,
        model: report.model,
      },
    });

    res.json({
      id: saved.id,
      summary: saved.summary,
      reportData: saved.reportData,
      generatedAt: saved.generatedAt.toISOString(),
      model: report.model,
      riskRunId: latestRun.id,
      importJobId: latestRun.importJobId,
      importJob: latestRun.importJob,
      riskRun: {
        id: latestRun.id,
        startedAt: latestRun.startedAt,
        finishedAt: latestRun.finishedAt,
        triggeredBy: latestRun.triggeredBy,
        importJobId: latestRun.importJobId,
        importJob: latestRun.importJob,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Regression analysis endpoints
// ---------------------------------------------------------------------------

// Run regression analysis and persist result
riskRouter.post(
  '/regression',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId!;
      const userId = req.user!.userId;

      // Create a run record
      const run = await prisma.regressionRun.create({
        data: { organizationId: orgId, triggeredBy: userId, status: 'RUNNING' },
      });

      try {
        const result = await runRegressionAnalysis(orgId);

        await prisma.regressionRun.update({
          where: { id: run.id },
          data: {
            status: result.status,
            message: result.message ?? null,
            finishedAt: new Date(),
            resultJson: JSON.stringify(result),
          },
        });

        res.json({ id: run.id, ...result });
      } catch (computeErr) {
        await prisma.regressionRun.update({
          where: { id: run.id },
          data: { status: 'FAILED', message: String(computeErr), finishedAt: new Date() },
        }).catch(() => {});
        throw computeErr;
      }
    } catch (err) {
      next(err);
    }
  },
);

// Get latest regression run for this org
riskRouter.get('/regression/latest', async (req, res, next) => {
  try {
    const run = await prisma.regressionRun.findFirst({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { startedAt: 'desc' },
    });
    if (!run) {
      res.json(null);
      return;
    }
    const result = run.resultJson ? JSON.parse(run.resultJson) : null;
    res.json({ id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, ...result });
  } catch (err) {
    next(err);
  }
});

// Get a specific regression run
riskRouter.get('/regression/:id', async (req, res, next) => {
  try {
    const run = await prisma.regressionRun.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!run) {
      res.status(404).json({ error: 'Regression run not found' });
      return;
    }
    const result = run.resultJson ? JSON.parse(run.resultJson) : null;
    res.json({ id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, ...result });
  } catch (err) {
    next(err);
  }
});
