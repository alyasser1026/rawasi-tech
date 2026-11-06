import assert from 'node:assert/strict';
import test from 'node:test';
import { createCopilotCompanyAccess } from '../scripts/copilot-company-access.mjs';

const company = '55555555-5555-4555-8555-555555555555';
const otherCompany = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const userId = '12345678-1234-4234-8234-123456789012';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (role, revision = 0) => `${encode({ alg: 'HS256' })}.${encode({ role, revision })}.synthetic`;
const expiry = seconds => Math.floor(Date.now() / 1000) + seconds;

function fixture(overrides = {}) {
  const user = { id: userId, role: 'authenticated' };
  const calls = [];
  const state = {
    loginError: null,
    profileError: null,
    membershipError: null,
    authError: null,
    user,
    profile: { id: userId, role: 'staff', is_active: true, is_admin: false, permissions: { expenses: ['view'] } },
    memberships: [{ id: company, is_active: true, role: 'member' }],
    loginSession: { user, access_token: jwt('authenticated'), refresh_token: 'synthetic-refresh', expires_at: expiry(600) },
    refreshedSession: { user, access_token: jwt('authenticated', 1), refresh_token: 'synthetic-refresh-2', expires_at: expiry(600) },
  };
  const createClient = (url, key, options) => {
    calls.push(['createClient', url, key, options]);
    return {
      auth: {
        async signInWithPassword(credentials) {
          calls.push(['login', credentials]);
          return { data: { session: state.loginSession }, error: state.loginError };
        },
        async refreshSession(credentials) {
          calls.push(['refresh', credentials]);
          return { data: { session: state.refreshedSession }, error: state.refreshError };
        },
        async getUser(accessToken) {
          calls.push(['getUser', accessToken]);
          return { data: { user: state.user }, error: state.authError };
        },
      },
      from(table) {
        assert.equal(table, 'profiles');
        return {
          select(columns) {
            assert.equal(columns, 'id,role,is_active,is_admin,permissions');
            return {
              eq(column, value) {
                assert.equal(column, 'id');
                assert.equal(value, userId);
                return { async single() {
                  calls.push(['profile']);
                  return { data: state.profile, error: state.profileError };
                } };
              },
            };
          },
        };
      },
      async rpc(name) {
        calls.push(['rpc', name]);
        return { data: state.memberships, error: state.membershipError };
      },
    };
  };
  const resolve = createCopilotCompanyAccess({
    supabaseUrl: 'https://supabase.test',
    publicKey: 'sb_publishable_synthetic',
    email: 'bot@example.test',
    password: ' synthetic password ',
    companyId: company,
    createClient,
    ...overrides,
  });
  return { resolve, state, calls };
}

test('returns the authenticated user and pinned company with profile permissions', async () => {
  const { resolve, state, calls } = fixture();
  assert.deepEqual(await resolve(), {
    userId,
    companyId: company,
    accessToken: state.loginSession.access_token,
    permissions: { expenses: ['view'] },
  });
  assert.equal(typeof calls[0][3].global.fetch, 'function');
  const [createCall, ...remaining] = calls;
  const options = { ...createCall[3], global: { headers: createCall[3].global.headers } };
  assert.deepEqual([[...createCall.slice(0, 3), options], ...remaining], [
    ['createClient', 'https://supabase.test', 'sb_publishable_synthetic', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-company-id': company } },
    }],
    ['login', { email: 'bot@example.test', password: ' synthetic password ' }],
    ['getUser', state.loginSession.access_token],
    ['profile'],
    ['rpc', 'get_user_accessible_companies'],
  ]);
});

test('fails closed without invoking Supabase on missing company or credentials, unsafe URL or privileged key', async () => {
  for (const overrides of [
    { companyId: undefined }, { companyId: 'not-a-company' }, { email: '' }, { password: '' },
    { publicKey: undefined }, { publicKey: 'sb_secret_synthetic' }, { publicKey: jwt('service_role') },
    { supabaseUrl: 'http://supabase.test' }, { supabaseUrl: 'https://a:b@supabase.test' },
  ]) {
    const { resolve, calls } = fixture(overrides);
    assert.equal(await resolve(), null);
    assert.deepEqual(calls, []);
  }
  assert.ok(await fixture({ publicKey: jwt('anon') }).resolve());
});

test('does not fall back to another company or a company admin identity', async () => {
  for (const memberships of [
    [{ id: otherCompany, role: 'member', is_active: true, is_user_default: true }],
    [{ id: company, role: 'member', is_active: false }],
    [{ id: company, role: 'admin', is_active: true }],
    null,
  ]) {
    const { resolve, state } = fixture();
    state.memberships = memberships;
    assert.equal(await resolve(), null);
  }
});

test('reports only the explicitly verified company name', async () => {
  const { resolve, state } = fixture();
  state.memberships = [
    { id: otherCompany, role: 'member', is_active: true, is_user_default: true, name: 'شركة أخرى' },
    { id: company, role: 'member', is_active: true, name: 'الشركة المربوطة' },
  ];
  const access = await resolve();
  assert.equal(access?.companyId, company);
  assert.equal(access?.companyName, 'الشركة المربوطة');
});

test('rejects inactive, admin and mismatched profiles, or unverified Auth users', async () => {
  for (const profile of [null, { is_active: false }, { is_admin: true }, { role: 'admin' }, { id: otherCompany }]) {
    const { resolve, state } = fixture();
    state.profile = profile && { ...state.profile, ...profile };
    assert.equal(await resolve(), null);
  }
  for (const changes of [null, { role: 'service_role' }, { id: otherCompany }]) {
    const { resolve, state, calls } = fixture();
    state.user = changes && { ...state.user, ...changes };
    assert.equal(await resolve(), null);
    assert.ok(!calls.some(([name]) => name === 'profile'));
  }
});

test('verifies current permissions and membership on every request without signing in each time', async () => {
  const { resolve, state, calls } = fixture();
  assert.ok(await resolve());
  state.profile.permissions = { labor: { view: true } };
  assert.deepEqual((await resolve()).permissions, state.profile.permissions);
  state.memberships = [];
  assert.equal(await resolve(), null);
  assert.equal(calls.filter(([name]) => name === 'login').length, 1);
  assert.equal(calls.filter(([name]) => name === 'getUser').length, 3);
  assert.equal(calls.filter(([name]) => name === 'rpc').length, 3);
});

test('refreshes a session near expiry and fails closed on a refresh failure', async () => {
  const { resolve, state, calls } = fixture();
  state.loginSession.expires_at = expiry(25);
  assert.equal((await resolve()).accessToken, state.loginSession.access_token);
  assert.equal((await resolve()).accessToken, state.refreshedSession.access_token);
  assert.deepEqual(calls.find(([name]) => name === 'refresh'), ['refresh', { refresh_token: 'synthetic-refresh' }]);
  state.refreshedSession.expires_at = expiry(15);
  state.refreshError = { message: 'synthetic failure' };
  assert.equal(await resolve(), null);
});

test('does not authorize when Auth or either database lookup fails', async () => {
  for (const field of ['loginError', 'authError', 'profileError', 'membershipError']) {
    const { resolve, state } = fixture();
    state[field] = { message: 'synthetic failure' };
    assert.equal(await resolve(), null);
  }
});

test('coalesces concurrent sign-in and authorization checks', async () => {
  const { resolve, calls } = fixture();
  const results = await Promise.all([resolve(), resolve(), resolve()]);
  assert.ok(results.every(Boolean));
  assert.equal(calls.filter(([name]) => name === 'login').length, 1);
  assert.equal(calls.filter(([name]) => name === 'rpc').length, 1);
});
