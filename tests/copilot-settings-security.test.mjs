import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const nextServer = {
  NextResponse: {
    json(body, options) {
      return Response.json(body, options);
    },
  },
};

function loadTypeScript(relativePath, dependencies, processValue) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const exports = {};
  const evaluate = vm.runInThisContext(`(function(require, exports, process) { ${outputText} })`);
  evaluate(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected import: ${name}`);
    return dependencies[name];
  }, exports, processValue);
  return exports;
}

function loadRoute({ serviceKey = 'test-service-key', failWrite = false } = {}) {
  const root = path.resolve('test-copilot-settings');
  const settingsFile = path.join(root, 'config', 'copilot_bot_settings.json');
  const memoryFile = path.join(root, 'config', 'copilot_learned_memory.json');
  const operationsFile = path.join(root, 'work', 'copilot_operations_index.json');
  const files = new Map([
    [settingsFile, '{"botName":"Existing name"}'],
    [memoryFile, '{"rules":[{"id":"RULE-1","rule":"Existing rule"}]}'],
    [operationsFile, '{"nextSeq":103,"operations":[{"opNumber":102}]}'],
    [path.dirname(settingsFile), 'directory'],
  ]);
  const fileAccesses = [];
  const mockFs = {
    existsSync(file) {
      fileAccesses.push(file);
      return files.has(file);
    },
    readFileSync(file) {
      fileAccesses.push(file);
      return files.get(file);
    },
    writeFileSync(file, data) {
      fileAccesses.push(file);
      if (failWrite) throw new Error('read-only filesystem');
      files.set(file, data);
    },
  };

  const profiles = {
    staff: { role: 'staff', is_active: true },
    inactive: { role: 'admin', is_admin: true, is_active: false },
    admin: { role: 'admin', is_active: true },
  };
  const authModule = loadTypeScript('../lib/admin-authorization.ts', { 'next/server': nextServer });
  const handlers = loadTypeScript('../app/api/copilot/settings/route.ts', {
    'next/server': nextServer,
    '@/lib/admin-authorization': authModule,
    fs: mockFs,
    path,
    '@supabase/supabase-js': {
      createClient(url, key) {
        assert.equal(url, 'https://auth.example.test');
        assert.equal(key, 'test-service-key');
        return {
          auth: {
            async getUser(token) {
              if (!Object.hasOwn(profiles, token)) return { data: { user: null }, error: new Error('invalid token') };
              return { data: { user: { id: token } }, error: null };
            },
          },
          from(table) {
            assert.equal(table, 'profiles');
            return {
              select() {
                return {
                  eq(column, id) {
                    assert.equal(column, 'id');
                    return { async single() { return { data: profiles[id], error: null }; } };
                  },
                };
              },
            };
          },
        };
      },
    },
  }, {
    cwd: () => root,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.test', SUPABASE_SERVICE_ROLE_KEY: serviceKey },
  });
  return { ...handlers, fileAccesses, files, settingsFile, memoryFile };
}

function settingsRequest(method, token, body) {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return new Request('https://app.example.test/api/copilot/settings', { method, headers, body });
}

test('GET and POST refuse anonymous, invalid, staff, and disabled admin requests before touching bot files', async () => {
  const { GET, POST, fileAccesses } = loadRoute();
  for (const [token, status] of [[null, 401], ['invalid', 401], ['staff', 403], ['inactive', 403]]) {
    const read = await GET(settingsRequest('GET', token));
    // Malformed JSON proves POST authorizes before attempting to parse any action.
    const write = await POST(settingsRequest('POST', token, '{'));
    assert.equal(read.status, status);
    assert.equal(write.status, status);
    for (const response of [read, write]) {
      const data = await response.json();
      assert.equal(typeof data.error, 'string');
      assert.equal('learnedRules' in data || 'recentOperations' in data, false);
    }
  }
  assert.deepEqual(fileAccesses, []);
});

test('An active admin can read settings privately and save settings, add rules, and remove rules', async () => {
  const { GET, POST, files, settingsFile, memoryFile } = loadRoute();
  const read = await GET(settingsRequest('GET', 'admin'));
  assert.equal(read.headers.get('cache-control'), 'no-store');
  const initial = await read.json();
  assert.equal(initial.settings.botName, 'Existing name');
  assert.equal(initial.recentOperations[0].opNumber, 102);

  for (const body of [
    { action: 'save_settings', settings: { botName: 'Updated name' } },
    { action: 'add_rule', ruleText: 'Added rule' },
    { action: 'delete_rule', ruleId: 'RULE-1' },
  ]) {
    const response = await POST(settingsRequest('POST', 'admin', JSON.stringify(body)));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  }
  assert.equal(JSON.parse(files.get(settingsFile)).botName, 'Updated name');
  assert.deepEqual(JSON.parse(files.get(memoryFile)).rules.map(entry => entry.rule), ['Added rule']);
});

test('A missing admin service key blocks all access and a failed write reports failure', async () => {
  const unconfigured = loadRoute({ serviceKey: '' });
  assert.equal((await unconfigured.GET(settingsRequest('GET', 'admin'))).status, 503);
  assert.equal((await unconfigured.POST(settingsRequest('POST', 'admin', '{}'))).status, 503);
  assert.deepEqual(unconfigured.fileAccesses, []);

  const readOnly = loadRoute({ failWrite: true });
  const result = await readOnly.POST(settingsRequest('POST', 'admin', '{"settings":{"botName":"Never saved"}}'));
  assert.equal(result.status, 500);
  assert.equal((await result.json()).ok, false);
  assert.equal(JSON.parse(readOnly.files.get(readOnly.settingsFile)).botName, 'Existing name');
});
