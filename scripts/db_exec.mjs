import postgres from 'postgres';
import fs from 'node:fs';

const connStr = 'postgresql://postgres.tarhvoszqjfzmfgzuctu:Mm1020304050607080@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
const sql = postgres(connStr, { ssl: 'require', max: 1 });

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

  try {
    const res = await sql.unsafe(sqlText);
    console.log('Success. Result rows count:', Array.isArray(res) ? res.length : res);
    if (Array.isArray(res) && res.length > 0) {
      console.log(JSON.stringify(res.slice(0, 10), null, 2));
    }
  } catch (err) {
    console.error('SQL Execution Error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
