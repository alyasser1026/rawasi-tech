import postgres from 'postgres';

async function test() {
  const hosts = [
    'postgres://postgres:Mooya12345!@db.tarhvoszqjfzmfgzuctu.supabase.co:5432/postgres',
    'postgres://postgres:Mooya12345!@db.tarhvoszqjfzmfgzuctu.supabase.co:6543/postgres',
    'postgres://postgres.tarhvoszqjfzmfgzuctu:Mooya12345!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    'postgres://postgres.tarhvoszqjfzmfgzuctu:Mooya12345!@aws-0-me-central-1.pooler.supabase.com:6543/postgres',
    'postgres://postgres.tarhvoszqjfzmfgzuctu:Mooya12345!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgres://postgres.tarhvoszqjfzmfgzuctu:Mooya12345!@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ];
  for (const h of hosts) {
    try {
      console.log('Testing host:', h.split('@')[1]);
      const sql = postgres(h, { ssl: 'require', connect_timeout: 4 });
      const res = await sql`SELECT 1 as num`;
      console.log('🎉 SUCCESS with:', h.split('@')[1], res);
      await sql.end();
      return h;
    } catch (e) {
      console.log('Failed:', e.message);
    }
  }
}

test();
