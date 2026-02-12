import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getDeterministicMapping, tryAIMapping } from '../services/ollama.js';
import { parseHeaders, parseSampleRows, generatePreview, processImport } from '../services/csv-processor.js';

const upload = multer({ dest: 'uploads/' });

export const importRouter = Router();
importRouter.use(authenticate);
importRouter.use(authorize(UserRole.ADMIN, UserRole.HR_MANAGER));

// Upload CSV — parse headers, return deterministic mappings immediately, kick off AI in background
importRouter.post('/employees/csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    console.log('[Import] File received:', req.file.originalname, 'path:', req.file.path);
    const headers = await parseHeaders(req.file.path);
    console.log('[Import] Detected headers:', headers);
    if (headers.length === 0) {
      res.status(400).json({ error: 'CSV file has no columns' });
      return;
    }

    const { rows: sampleRows, totalRows } = await parseSampleRows(req.file.path, 5);
    console.log('[Import] Parsed', totalRows, 'total rows,', sampleRows.length, 'sample rows');
    if (totalRows === 0) {
      res.status(400).json({ error: 'CSV file has no data rows' });
      return;
    }

    // Try AI mapping first (60s timeout), fall back to deterministic
    console.log('[Import] Attempting AI mapping (60s timeout)...');
    const aiStart = Date.now();
    const aiResult = await tryAIMapping(headers, sampleRows, 60000);
    console.log(`[Import] AI mapping ${aiResult ? 'succeeded' : 'failed/skipped'} in ${((Date.now() - aiStart) / 1000).toFixed(1)}s`);
    const mapping = aiResult?.mapping ?? getDeterministicMapping(headers).mapping;
    const confidence = aiResult?.confidence ?? getDeterministicMapping(headers).confidence;
    const mappingSource = aiResult ? 'ai' : 'deterministic';
    console.log(`[Import] Using ${mappingSource} mapping`);

    const importJob = await prisma.importJob.create({
      data: {
        uploadedByUserId: req.user!.userId,
        organizationId: req.user!.organizationId,
        status: 'PENDING_MAPPING',
        filePath: req.file.path,
      },
    });

    res.status(201).json({
      importId: importJob.id,
      status: importJob.status,
      fileName: req.file.originalname,
      rowCount: totalRows,
      detectedColumns: headers,
      suggestedMapping: mapping,
      sampleData: sampleRows,
      aiConfidence: confidence,
      mappingSource,
    });
  } catch (err) {
    next(err);
  }
});


// Preview — apply mapping + normalization to sample rows without actually importing
importRouter.post('/:importId/preview', async (req, res, next) => {
  try {
    const importJob = await prisma.importJob.findFirst({
      where: { id: req.params['importId'], organizationId: req.user!.organizationId },
    });

    if (!importJob) {
      res.status(404).json({ error: 'Import job not found' });
      return;
    }

    if (!importJob.filePath) {
      res.status(400).json({ error: 'Import file not found' });
      return;
    }

    const mapping = req.body.mapping as Record<string, string>;
    if (!mapping || typeof mapping !== 'object') {
      res.status(400).json({ error: 'Mapping is required' });
      return;
    }

    const preview = await generatePreview(importJob.filePath, mapping);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

// Confirm mapping and run import
importRouter.post('/:importId/confirm-mapping', async (req, res, next) => {
  try {
    const importJob = await prisma.importJob.findFirst({
      where: { id: req.params['importId'], organizationId: req.user!.organizationId },
    });

    if (!importJob) {
      res.status(404).json({ error: 'Import job not found' });
      return;
    }

    if (importJob.status !== 'PENDING_MAPPING') {
      res.status(400).json({ error: 'Import is not in PENDING_MAPPING status' });
      return;
    }

    const mapping = req.body.mapping as Record<string, string>;
    if (!mapping || typeof mapping !== 'object') {
      res.status(400).json({ error: 'Mapping is required' });
      return;
    }

    // Set status to PROCESSING and save mapping
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: 'PROCESSING',
        mappingJson: mapping,
      },
    });

    // Process CSV in background (don't block the response)
    processImport(importJob.id, mapping, req.user!.organizationId).catch((err) => {
      console.error(`Background import processing failed for ${importJob.id}:`, err);
    });

    res.json({ importId: importJob.id, status: 'PROCESSING', message: 'Import started' });
  } catch (err) {
    next(err);
  }
});

// List import history
importRouter.get('/', async (req, res, next) => {
  try {
    const imports = await prisma.importJob.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(imports);
  } catch (err) {
    next(err);
  }
});

// Get import details
importRouter.get('/:id', async (req, res, next) => {
  try {
    const importJob = await prisma.importJob.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId },
    });
    if (!importJob) {
      res.status(404).json({ error: 'Import job not found' });
      return;
    }
    res.json(importJob);
  } catch (err) {
    next(err);
  }
});
