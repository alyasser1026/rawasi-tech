import fs from 'node:fs';

import { openMaintenanceDatabase, reportDatabaseFailure } from './maintenance-db.mjs';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Provide a query or a sql file path.');
    process.exit(1);
  }

  let sqlText = arg;
  if (fs.existsSync(arg)) {
    sqlText = fs.readFileSync(arg, 'utf-8');
  }

  const sql = openMaintenanceDatabase();
  try {
    const res = await sql.unsafe(sqlText);
    console.log('Success. Result rows count:', Array.isArray(res) ? res.length : res);
    if (Array.isArray(res) && res.length > 0) {
      console.log(JSON.stringify(res.slice(0, 10), null, 2));
    }
  } catch (err) {
    reportDatabaseFailure('SQL execution', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
