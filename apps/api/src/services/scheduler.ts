import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { runRiskComputation } from './risk-computation.js';

export function initScheduler() {
  // Nightly risk computation at 2am
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled risk computation...');
    try {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        await runRiskComputation(org.id, 'SYSTEM');
      }
      console.log(`Scheduled risk computation complete for ${orgs.length} org(s)`);
    } catch (err) {
      console.error('Scheduled risk computation failed:', err);
    }
  });

  console.log('Scheduler initialized');
}
