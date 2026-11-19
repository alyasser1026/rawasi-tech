import fs from 'node:fs';
import { loadEnvFile } from 'node:process';
import postgres from 'postgres';

export function openMaintenanceDatabase(options = {}) {
  if (fs.existsSync('.env.local')) loadEnvFile('.env.local');
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('Set DATABASE_URL in the environment or in the ignored .env.local file.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return postgres(connectionString, { max: 1, ssl: local ? false : 'require', ...options });
}

export function reportDatabaseFailure(operation, error) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
    ? ' (' + error.code + ')'
    : '';
  console.error(operation + ' failed' + code + '.');
}