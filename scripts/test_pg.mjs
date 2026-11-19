import { openMaintenanceDatabase, reportDatabaseFailure } from './maintenance-db.mjs';

async function test() {
  const sql = openMaintenanceDatabase({ connect_timeout: 4 });
  try {
    await sql`SELECT 1`;
    console.log('Database connection verified.');
  } catch (error) {
    reportDatabaseFailure('Database connection', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

test().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
