import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const env = {};
const lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
for (const l of lines) {
  const idx = l.indexOf('=');
  if (idx > 0 && !l.trim().startsWith('#')) {
    env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: accounts } = await supabase.from('accounts').select('id, code, name, account_type').order('code');
  const matched = (accounts || []).filter(a =>
    a.name.includes('خزن') || a.name.includes('صندوق') || a.name.includes('نقد') || a.name.includes('عمال') || a.name.includes('أجور') || a.name.includes('اجور') || a.name.includes('مرتب') || String(a.code).startsWith('121') || String(a.code).startsWith('512') || String(a.code).startsWith('212')
  );
  console.log('--- TREASURY & LABOR ACCOUNTS ---');
  console.log(matched);

  // Check partners
  const { data: partners } = await supabase.from('partners').select('id, name, type, phone, role').limit(10);
  console.log('--- SAMPLE PARTNERS ---');
  console.log(partners);
}
run();
