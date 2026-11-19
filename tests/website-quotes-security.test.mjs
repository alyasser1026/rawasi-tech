import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

function loadModule(relativePath, imports) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const exports = {};
  const run = runInThisContext(`(function (exports, require, process) { ${outputText} })`);
  run(exports, (specifier) => {
    assert.ok(Object.hasOwn(imports, specifier), `Unmocked import: ${specifier}`);
    return imports[specifier];
  }, {
    cwd: () => '/test-quotes',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    },
  });
  return exports;
}

const server = { NextResponse: { json: Response.json } };
const adminAuth = loadModule('../lib/admin-authorization.ts', { 'next/server': server });

function setup({ user = { id: 'actor-id' }, profile, authError, profileError, unavailable = false } = {}) {
  const savedQuotes = [{ id: 'fixture-quote', name: 'Test Customer' }];
  const io = { reads: 0, writes: 0 };
  const accounts = { verified: [], queried: [] };
  const routes = loadModule('../app/api/website-quotes/route.ts', {
    'next/server': server,
    '@supabase/supabase-js': {
      createClient() {
        if (unavailable) throw new Error('Auth service unavailable');
        return {
          auth: {
            async getUser(token) {
              accounts.verified.push(token);
              return { data: { user }, error: authError };
            },
          },
          from(table) {
            assert.equal(table, 'profiles');
            return {
              select(columns) {
                assert.match(columns, /is_active/);
                return {
                  eq(field, value) {
                    assert.equal(field, 'id');
                    accounts.queried.push(value);
                    return { async single() { return { data: profile, error: profileError }; } };
                  },
                };
              },
            };
          },
        };
      },
    },
    'fs/promises': {
      async mkdir() {},
      async access() {},
      async readFile() {
        io.reads++;
        return JSON.stringify(savedQuotes);
      },
      async writeFile() { io.writes++; },
    },
    path: { join: (...parts) => parts.join('/') },
    '@/lib/admin-authorization': adminAuth,
    '@/lib/supabase': {
      supabase: {
        from: () => ({ select: () => ({ or: () => ({ limit: async () => ({ data: [] }) }) }) }),
      },
    },
  });
  return { routes, savedQuotes, accounts, io };
}

const quotesURL = 'https://example.invalid/api/website-quotes';
const bearer = { headers: { Authorization: 'Bearer test-token' } };

test('quote reads fail closed before touching customer data', async () => {
  for (const [options, request, status] of [
    [{}, {}, 401],
    [{ user: null, authError: new Error('Invalid session') }, bearer, 401],
    [{ profile: { role: 'client', is_admin: false, is_active: true } }, bearer, 403],
    [{ profile: { role: 'admin', is_admin: true, is_active: false } }, bearer, 403],
    [{ profileError: new Error('Profile unavailable') }, bearer, 403],
    [{ unavailable: true }, bearer, 503],
  ]) {
    const { routes, io } = setup(options);
    const response = await routes.GET(new Request(quotesURL, request));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(io.reads, 0);
    assert.equal(io.writes, 0);
  }
});

test('active administrators can read quotes using their verified profile', async () => {
  const { routes, accounts, savedQuotes } = setup({
    profile: { role: 'admin', is_admin: true, is_active: true },
  });
  const response = await routes.GET(new Request(quotesURL, bearer));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(accounts.verified, ['test-token']);
  assert.deepEqual(accounts.queried, ['actor-id']);
  assert.deepEqual(await response.json(), { quotes: savedQuotes });
});

test('customers can still submit quotes anonymously', async () => {
  const { routes, accounts, io } = setup();
  const response = await routes.POST(new Request(quotesURL, {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Customer', phone: '01012345678' }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(io.writes, 1);
  assert.deepEqual(accounts.verified, []);
});
