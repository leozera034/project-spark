select cron.schedule(
  'comandiva-crm-segment-scan',
  '17 */6 * * *',
  $$select private.scan_customer_growth_segments(null, 5000, now());$$
);
