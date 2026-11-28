import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadTsModule(relativePath, imports = {}, env = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const exports = {};
  const sandbox = {
    Request,
    Response,
    Headers,
    console,
    process: { env },
  };
  const fn = vm.runInNewContext(`(function(exports, require) { ${outputText}\n })`, sandbox);
  fn(exports, (specifier) => {
    assert(Object.hasOwn(imports, specifier), `Unmocked dependency: ${specifier}`);
    return imports[specifier];
  });
  return exports;
}

test('6.1 filterCustomerVisibleRequests hides soft-deleted requests even after rollback flag is turned ON', () => {
  const rules = loadTsModule('../app/profile/customer-request-rules.ts', {}, {});
  const initialRows = [
    { id: '1', type: 'maintenance_request', status: 'جديد' },
    { id: '2', type: 'site_visitor', status: 'online' },
    { id: '3', type: 'agent_dialogue', status: 'نشط' },
  ];
  assert.deepEqual(rules.filterCustomerVisibleRequests(initialRows).map((r) => r.id), ['1']);

  // After customer soft-deletes request #1 -> counter drops 1 -> 0
  const afterSoftDelete = [
    { id: '1', type: 'maintenance_request', status: rules.CUSTOMER_DELETED_STATUS },
    { id: '2', type: 'site_visitor', status: 'online' },
  ];
  assert.equal(rules.filterCustomerVisibleRequests(afterSoftDelete).length, 0);

  // Even when Feature Flag is switched ON (kill-switch rollback), row #1 stays hidden from customer
  const disabledRules = loadTsModule(
    '../app/profile/customer-request-rules.ts',
    {},
    { NEXT_PUBLIC_DISABLE_CUSTOMER_REQUEST_SOFT_DELETE: 'true' }
  );
  assert.equal(disabledRules.isCustomerRequestSoftDeleteDisabled(), true);
  assert.equal(disabledRules.filterCustomerVisibleRequests(afterSoftDelete).length, 0);
});

test('6.2 canCustomerSoftDeleteRequest allows only new/جديد when enabled and hides button otherwise', () => {
  const rules = loadTsModule('../app/profile/customer-request-rules.ts', {}, {});

  assert.equal(rules.canCustomerSoftDeleteRequest({ status: 'جديد' }, false), true);
  assert.equal(rules.canCustomerSoftDeleteRequest({ status: 'new' }, false), true);
  for (const lockedStatus of [
    'جاري التواصل والتجهيز',
    'تم التوريد',
    'مكتمل',
    'ملغي',
    'محذوف بواسطة العميل',
    'approved',
    'rejected',
  ]) {
    assert.equal(rules.canCustomerSoftDeleteRequest({ status: lockedStatus }, false), false, lockedStatus);
  }

  // Feature flag kill-switch disables the button immediately
  assert.equal(rules.canCustomerSoftDeleteRequest({ status: 'جديد' }, true), false);
  const storeMock = { getItem: (k) => (k === rules.DISABLE_CUSTOMER_SOFT_DELETE_KEY ? 'true' : null) };
  assert.equal(rules.isCustomerRequestSoftDeleteDisabled(storeMock), true);
});

test('6.3 resolveOptionalRequestUserId binds verified JWT user and preserves anonymous visitors as null', async () => {
  const authMod = loadTsModule(
    '../lib/admin-authorization.ts',
    { 'next/server': { NextResponse: { json: Response.json } } },
    {}
  );

  const clientMock = {
    auth: {
      async getUser(token) {
        if (token === 'valid-lolo-jwt') {
          return { data: { user: { id: '268b316a-03c8-401a-8b02-479ca3a2a9e1' } } };
        }
        return { data: { user: null } };
      },
    },
  };

  // Verified Bearer token overrides spoofed body userId
  const reqAuthed = new Request('https://example.invalid/api/website-quotes', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-lolo-jwt' },
  });
  const authedUid = await authMod.resolveOptionalRequestUserId(
    clientMock,
    reqAuthed,
    'bccfb7ac-784d-42fe-9590-f2b5b0fa203b'
  );
  assert.equal(authedUid, '268b316a-03c8-401a-8b02-479ca3a2a9e1');

  // Anonymous visitor (no token, no userId) resolves cleanly to null
  const reqAnon = new Request('https://example.invalid/api/website-quotes', { method: 'POST' });
  const anonUid = await authMod.resolveOptionalRequestUserId(clientMock, reqAnon, null);
  assert.equal(anonUid, null);

  // Invalid / expired token without valid fallback also degrades safely to null (never blocks guest quote/order)
  const reqExpired = new Request('https://example.invalid/api/website-quotes', {
    method: 'POST',
    headers: { Authorization: 'Bearer expired-token' },
  });
  const expiredUid = await authMod.resolveOptionalRequestUserId(clientMock, reqExpired, 'not-a-uuid');
  assert.equal(expiredUid, null);
});
