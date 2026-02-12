import cron from 'node-cron';

export function initScheduler() {
  // Nightly risk computation at 2am
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled risk computation...');
    // TODO: call risk computation service
  });

  console.log('Scheduler initialized');
}
