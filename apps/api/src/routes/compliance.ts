import { Router } from 'express';
import { generateDisclosureRequestSchema, generateAuditPackRequestSchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { calculateReadiness, generateAuditPackData, toCsv } from '../services/compliance.js';
import { interpolateTemplate, formatCurrency } from '../services/disclosure-templates.js';
import archiver from 'archiver';

export const complianceRouter = Router();
complianceRouter.use(authenticate);

// Get readiness dashboard metrics
complianceRouter.get('/readiness', async (req, res, next) => {
  try {
    const metrics = await calculateReadiness(req.user!.organizationId!);
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// List disclosure templates
complianceRouter.get('/disclosure-templates', async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const templates = await prisma.disclosureTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: orgId },
          { organizationId: null },
        ],
      },
      orderBy: [{ templateType: 'asc' }, { name: 'asc' }],
    });
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// Generate disclosure text from template + salary range
complianceRouter.post('/generate-disclosure', async (req, res, next) => {
  try {
    const body = generateDisclosureRequestSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const template = await prisma.disclosureTemplate.findFirst({
      where: {
        id: body.templateId,
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
    });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const salaryRange = await prisma.salaryRange.findFirst({
      where: { id: body.salaryRangeId, organizationId: orgId },
    });
    if (!salaryRange) {
      res.status(404).json({ error: 'Salary range not found' });
      return;
    }

    const variables: Record<string, string | number> = {
      salaryMin: salaryRange.min,
      salaryMid: salaryRange.mid,
      salaryMax: salaryRange.max,
      salaryMinFormatted: formatCurrency(salaryRange.min, salaryRange.currency),
      salaryMidFormatted: formatCurrency(salaryRange.mid, salaryRange.currency),
      salaryMaxFormatted: formatCurrency(salaryRange.max, salaryRange.currency),
      currency: salaryRange.currency,
      country: salaryRange.country,
      jobFamily: salaryRange.jobFamily || '',
      level: salaryRange.level,
      ...(body.variables || {}),
    };

    const text = interpolateTemplate(template.content, variables);

    logAudit({
      organizationId: orgId,
      userId: req.user!.userId,
      action: 'DISCLOSURE_GENERATED',
      entityType: 'DisclosureTemplate',
      entityId: template.id,
      metadata: { templateType: template.templateType, salaryRangeId: body.salaryRangeId },
    });

    res.json({ text, templateName: template.name, variables });
  } catch (err) {
    next(err);
  }
});

// Generate and download audit pack ZIP
complianceRouter.post(
  '/audit-pack',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const body = generateAuditPackRequestSchema.parse(req.body);
      const orgId = req.user!.organizationId!;

      const dateRange = body.dateRange
        ? { from: new Date(body.dateRange.from), to: new Date(body.dateRange.to) }
        : undefined;

      const data = await generateAuditPackData(orgId, dateRange);
      const readiness = await calculateReadiness(orgId);

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const timestamp = new Date().toISOString().slice(0, 10);

      // Build metadata
      const metadata = {
        organizationName: org?.name,
        organizationSlug: org?.slug,
        exportedAt: new Date().toISOString(),
        exportedBy: req.user!.email,
        dateRange: dateRange
          ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }
          : null,
      };

      // Set response headers for ZIP download
      const filename = `audit-pack-${org?.slug || 'org'}-${timestamp}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      archive.append(data.employees, { name: 'employees.csv' });
      archive.append(data.payDecisions, { name: 'pay-decisions.csv' });
      archive.append(data.riskResults, { name: 'risk-results.csv' });
      archive.append(data.auditLog, { name: 'audit-log.csv' });
      archive.append(data.rationaleDefinitions, { name: 'rationale-definitions.csv' });
      archive.append(data.salaryRanges, { name: 'salary-ranges.csv' });
      archive.append(data.roleClassifications, { name: 'role-classifications.csv' });
      archive.append(JSON.stringify(readiness, null, 2), { name: 'readiness-summary.json' });
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      await archive.finalize();

      logAudit({
        organizationId: orgId,
        userId: req.user!.userId,
        action: 'AUDIT_PACK_EXPORTED',
        entityType: 'AuditPack',
        metadata: { dateRange: dateRange || 'all', filename },
      });
    } catch (err) {
      next(err);
    }
  },
);
