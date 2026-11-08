import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const connStr = 'postgresql://postgres.tarhvoszqjfzmfgzuctu:Mm1020304050607080@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const migrationsToRun = [
  '20261105170001_job_order_retention.sql',
  '20261105170002_invoice_line_accounting.sql',
  '20261105170003_invoice_adjustment_notes.sql',
  '20261105170004_vat_return.sql',
  '20261105170005_document_numbering_fix.sql',
  '20261105170006_ar_aging_reports.sql',
  '20261105170007_custodies_and_cash_closings.sql',
  '20261105170008_fixed_assets_and_depreciation.sql',
  '20261105170009_purchases_and_three_way_matching.sql',
  '20261105170010_inventory_stocktaking_and_job_orders.sql',
  '20261105170011_health_radar_document_expiry_and_notifications.sql',
  '20261105170012_financial_statements_and_project_profitability.sql',
  '20261105170013_offline_idempotency_and_realtime.sql',
  '20261105170014_project_drawings_and_site_inspections.sql',
  '20261106170015_employee_attendance.sql',
  '20261106200016_smart_attendance_devices.sql'
];

async function run() {
  const sql = postgres(connStr, { ssl: 'require', max: 1 });

  try {
    const appliedRows = await sql`SELECT version FROM supabase_migrations.schema_migrations`;
    const appliedSet = new Set(appliedRows.map(r => r.version));

    for (const filename of migrationsToRun) {
      const match = filename.match(/^(\d+)_(.*)\.sql$/);
      if (!match) continue;
      const [_, version, name] = match;

      if (appliedSet.has(version)) {
        console.log(`[SKIP] Migration ${version} (${name}) is already applied.`);
        continue;
      }

      console.log(`\n========================================`);
      console.log(`[START] Running migration: ${filename}`);
      console.log(`========================================`);

      const filePath = path.join(process.cwd(), 'supabase', 'migrations', filename);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      // Execute SQL content directly
      const startTime = Date.now();
      await sql.unsafe(sqlContent);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Record in supabase_migrations
      await sql`
        INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES (${version}, ${[sqlContent]}, ${name})
        ON CONFLICT (version) DO NOTHING
      `;

      console.log(`[SUCCESS] ${filename} completed in ${duration}s`);
    }

    // Force PostgREST schema cache reload
    console.log('\nReloading PostgREST schema cache...');
    await sql`NOTIFY pgrst, 'reload schema'`;
    console.log('PostgREST schema cache reloaded successfully!');

  } catch (err) {
    console.error('\n[FATAL ERROR] Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
