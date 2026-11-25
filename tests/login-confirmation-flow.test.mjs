import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function compile(relativePath) {
  return ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}

const feedbackExports = {};
vm.runInThisContext(`(function(exports) { ${compile('../lib/auth-feedback.ts')} })`)(feedbackExports);
const hookSource = compile('../app/login/login_logic.ts');
const unconfirmed = { code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 };
const event = () => ({ preventDefault() {} });

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

/** Runs the real hook with persistent React state/refs, effect cleanup and a local clock. */
function setup({ pathname = '/store', query = '', stayOnPage = true } = {}) {
  const slots = [], effectSlots = [], timers = new Map();
  const calls = { signIn: [], signUp: [], resend: [], queries: [], toasts: [], notifications: [], audit: [], contacts: [], success: 0, refresh: 0, redirects: [] };
  const user = { id: 'fixture-user', email: 'customer@example.test', user_metadata: { full_name: 'Fixture Customer', phone: '01000000000' } };
  const response = {
    signIn: { data: { user: null, session: null }, error: unconfirmed },
    signUp: { data: { user, session: null }, error: null },
    resend: { data: {}, error: null },
    usernameEmail: 'resolved@example.test',
    profile: { id: user.id, role: 'client', is_admin: false },
  };
  let index = 0, effectIndex = 0, nextTimerId = 0, clock = 0, current, disposed = false;
  const pendingEffects = [];
  const schedule = (callback, delay = 0) => { const id = ++nextTimerId; timers.set(id, { at: clock + delay, callback }); return id; };
  const cancel = id => timers.delete(id);
  const react = {
    useState(initialValue) {
      const position = index++;
      if (!Object.hasOwn(slots, position)) slots[position] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [slots[position], value => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }];
    },
    useRef(initialValue) {
      const position = index++;
      if (!Object.hasOwn(slots, position)) slots[position] = { current: initialValue };
      return slots[position];
    },
    useEffect(effect, dependencies) {
      const position = effectIndex++;
      const previous = effectSlots[position];
      if (!previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effectSlots[position] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async credentials => { calls.signIn.push(credentials); return await response.signIn; },
      signUp: async credentials => { calls.signUp.push(credentials); return await response.signUp; },
      resend: async payload => { calls.resend.push(payload); return await response.resend; },
    },
    from(table) {
      assert.equal(table, 'profiles');
      const query = { table };
      calls.queries.push(query);
      const chain = {
        select(columns) { query.columns = columns; return chain; },
        or(filter) { query.filter = filter; return chain; },
        eq(key, value) { query.eq = [key, value]; return chain; },
        limit(value) { query.limit = value; return chain; },
        async maybeSingle() { return { data: query.columns === 'email' ? { email: response.usernameEmail } : response.profile, error: null }; },
      };
      return chain;
    },
  };
  const router = { replace: value => calls.redirects.push(value), refresh: () => { calls.refresh++; } };
  const searchParams = new URLSearchParams(query);
  const imports = {
    react,
    'next/navigation': { useRouter: () => router, useSearchParams: () => searchParams },
    '@/lib/supabase': { supabase },
    '@/lib/toast-context': { useToast: () => ({ showToast: (message, tone) => calls.toasts.push({ message, tone }) }) },
    '@/lib/roleRouter': { getDestinationForUser: () => '/Dashboard' },
    '@/lib/auth-feedback': feedbackExports,
    '@/lib/client-device-info': { collectClientDeviceDetails: async () => ({ fixture: true }), rememberVisitorContact: value => calls.contacts.push(value) },
    '@/lib/audit': { logCustomAuditEvent: (...args) => calls.audit.push(args) },
  };
  const exports = {};
  const execute = vm.runInThisContext(`(function(exports, require, window, fetch, setTimeout, clearTimeout) { ${hookSource} })`);
  execute(exports, name => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected hook dependency: ${name}`);
    return imports[name];
  }, { location: { origin: 'https://www.phi-tech.org', pathname }, setTimeout: schedule, clearTimeout: cancel }, async (url, options) => {
    assert.equal(url, '/api/notify/login', 'No real network requests are permitted');
    calls.notifications.push(JSON.parse(options.body));
    return { ok: true };
  }, schedule, cancel);
  const options = { stayOnPage, onSuccess: () => { calls.success++; } };

  function render() {
    assert.equal(disposed, false);
    index = effectIndex = 0;
    current = exports.useLoginLogic(options);
    while (pendingEffects.length) pendingEffects.shift()();
    return current;
  }
  async function flush() {
    // Drains effect promises and the transpiled dynamic audit import.
    for (let i = 0; i < 4; i++) await Promise.resolve();
    return render();
  }
  function set(values) {
    for (const [key, value] of Object.entries(values)) current[`set${key[0].toUpperCase()}${key.slice(1)}`](value);
    return render();
  }
  async function submit() { await current.handleSubmit(event()); return flush(); }
  async function resend() { await current.handleResendConfirmation(); return flush(); }
  function advance(seconds) {
    for (let i = 0; i < seconds; i++) {
      const target = clock + 1000;
      const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at);
      for (const [id, timer] of due) { if (!timers.delete(id)) continue; clock = timer.at; timer.callback(); }
      clock = target;
      render();
    }
  }
  function dispose() {
    effectSlots.forEach(effect => effect?.cleanup?.());
    timers.clear();
    disposed = true;
  }
  render();
  return { get view() { return current; }, calls, response, user, render, flush, set, submit, resend, advance, dispose };
}

test('unconfirmed login keeps a persistent warning and never completes or silently resends', async t => {
  const h = setup(); t.after(h.dispose);
  h.set({ email: '  customer@example.test  ', password: 'fixture-password' });
  await h.submit();
  assert.equal(h.view.confirmationEmail, 'customer@example.test');
  assert.equal(h.view.isLoading, false);
  assert.equal(h.calls.toasts.at(-1).tone, 'warning');
  assert.equal(h.calls.signIn[0].email, 'customer@example.test');
  assert.equal(h.calls.signUp.length, 0);
  assert.equal(h.calls.resend.length, 0);
  assert.equal(h.calls.queries.length, 0, 'No profile/authorization lookup follows a failed email login');
  assert.equal(h.calls.success, 0);
  assert.equal(h.calls.audit.length, 0);
  assert.equal(h.calls.notifications.length, 0);
  assert.deepEqual(h.calls.redirects, []);
  h.render();
  assert.equal(h.view.confirmationEmail, 'customer@example.test', 'The notice survives ordinary rerenders');
});

test('username login uses the resolved email for confirmation and explicit signup resend', async t => {
  const h = setup(); t.after(h.dispose);
  h.set({ email: 'customer-name', password: 'fixture-password' });
  await h.submit();
  assert.equal(h.calls.queries.length, 1);
  assert.equal(h.calls.queries[0].columns, 'email');
  assert.equal(h.calls.signIn[0].email, 'resolved@example.test');
  assert.equal(h.view.confirmationEmail, 'resolved@example.test');
  await h.resend();
  assert.equal(h.calls.resend.length, 1);
  assert.deepEqual(h.calls.resend[0], {
    type: 'signup', email: 'resolved@example.test',
    options: { emailRedirectTo: 'https://www.phi-tech.org/login?redirect=%2Fstore' },
  });
  assert.equal(h.calls.signUp.length, 0, 'Resend never creates or admin-confirms an account');
  assert.equal(h.calls.success, 0);
  assert.equal(h.calls.audit.length, 0);
  assert.equal(h.view.confirmationFeedback.tone, 'success');
  assert.equal(h.view.resendCooldown, 60);
});

test('failed login separates expected credentials or rate limits from unexpected technical failures', async t => {
  for (const [error, tone] of [
    [{ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }, 'warning'],
    [{ status: 429, message: 'Too many attempts' }, 'warning'],
    [{ code: 'unexpected_failure', status: 500, message: 'Auth database unavailable' }, 'error'],
  ]) {
    const h = setup(); t.after(h.dispose);
    h.response.signIn = { data: { user: null, session: null }, error };
    h.set({ email: 'customer@example.test', password: 'fixture-password' }); await h.submit();
    assert.equal(h.calls.toasts.at(-1).tone, tone);
    if (tone === 'error') assert.equal(h.calls.toasts.at(-1).message, error.message);
    assert.equal(h.view.confirmationEmail, '');
    assert.equal(h.view.isLoading, false);
    assert.equal(h.calls.success, 0);
    assert.equal(h.calls.audit.length, 0);
    assert.equal(h.calls.resend.length, 0);
  }
});

test('resend prevents stale-handler double clicks, concurrent submit and requests during cooldown', async t => {
  const h = setup(); t.after(h.dispose);
  h.set({ email: 'customer@example.test', password: 'fixture-password' });
  await h.submit();
  const pending = deferred(); h.response.resend = pending.promise;
  const staleHandler = h.view.handleResendConfirmation;
  const first = staleHandler();
  const duplicate = staleHandler();
  await h.view.handleSubmit(event());
  h.render();
  assert.equal(h.view.isResendingConfirmation, true);
  assert.equal(h.calls.resend.length, 1);
  assert.equal(h.calls.signIn.length, 1, 'Submit is blocked while resend is pending');
  pending.resolve({ data: {}, error: null });
  await Promise.all([first, duplicate]); await h.flush();
  assert.equal(h.view.isResendingConfirmation, false);
  await h.resend();
  assert.equal(h.calls.resend.length, 1);
  h.advance(59); await h.resend();
  assert.equal(h.view.resendCooldown, 1);
  assert.equal(h.calls.resend.length, 1);
  h.advance(1);
  h.response.resend = { data: {}, error: null };
  await h.resend();
  assert.equal(h.calls.resend.length, 2);
});

test('submit uses a synchronous lock and blocks resend while login is pending', async t => {
  const h = setup(); t.after(h.dispose);
  h.set({ email: 'customer@example.test', password: 'fixture-password' });
  await h.submit();
  const pending = deferred(); h.response.signIn = pending.promise;
  const handler = h.view.handleSubmit;
  const first = handler(event()), duplicate = handler(event());
  h.render();
  assert.equal(h.view.isLoading, true);
  await h.resend();
  assert.equal(h.calls.signIn.length, 2);
  assert.equal(h.calls.resend.length, 0);
  pending.resolve({ data: { user: null, session: null }, error: unconfirmed });
  await Promise.all([first, duplicate]); await h.flush();
  assert.equal(h.view.isLoading, false);
});

test('resend throttling warns and starts backoff while a mailer outage remains a technical error', async t => {
  for (const [error, tone, cooldown] of [
    [{ code: 'over_email_send_rate_limit', status: 429, message: 'Too many emails' }, 'warning', 60],
    [{ code: 'unexpected_failure', status: 500, message: 'Error sending confirmation email' }, 'error', 0],
  ]) {
    const h = setup(); t.after(h.dispose);
    h.set({ email: 'customer@example.test', password: 'fixture-password' }); await h.submit();
    h.response.resend = { data: null, error };
    await h.resend();
    assert.equal(h.calls.toasts.at(-1).tone, tone);
    assert.equal(h.view.confirmationFeedback.tone, tone);
    assert.equal(h.view.resendCooldown, cooldown);
    assert.equal(h.view.isResendingConfirmation, false);
    assert.equal(h.view.confirmationEmail, 'customer@example.test');
    if (tone === 'error') assert.equal(h.view.confirmationFeedback.message, error.message);
    assert.equal(h.calls.success, 0);
  }
});

test('signup without a session requires confirmation and does not auto-login or resend', async t => {
  const h = setup({ query: '?portal=partner' }); t.after(h.dispose);
  h.view.toggleSignUp(); h.render();
  h.set({ email: '  new@example.test ', fullName: '  New Customer ', phone: ' 01000000000 ', password: 'fixture-password' });
  await h.submit();
  assert.equal(h.calls.signUp.length, 1);
  assert.equal(h.calls.signUp[0].email, 'new@example.test');
  assert.equal(h.calls.signUp[0].options.data.role, 'client');
  assert.equal(h.calls.signUp[0].options.emailRedirectTo, 'https://www.phi-tech.org/login?redirect=%2Fstore&portal=partner');
  assert.equal(h.view.confirmationEmail, 'new@example.test');
  assert.equal(h.view.resendCooldown, 60);
  assert.equal(h.view.isSignUp, false);
  assert.equal(h.view.password, '');
  assert.equal(h.view.isLoading, false);
  assert.equal(h.calls.toasts.at(-1).tone, 'info');
  assert.equal(h.calls.resend.length, 0);
  assert.equal(h.calls.signIn.length, 0);
  assert.equal(h.calls.success, 0);
  assert.equal(h.calls.audit.length, 0);
  assert.equal(h.calls.notifications[0].type, 'signup');
  assert.match(h.calls.notifications[0].status, /انتظار تأكيد/);
  await h.resend();
  assert.equal(h.calls.resend.length, 0, 'Initial signup already sent a confirmation email');
});

test('validation failures do not contact Auth or report a technical error', async t => {
  for (const fields of [
    { email: '', password: 'fixture-password' },
    { email: '  ', password: 'fixture-password' },
    { email: 'customer@example.test', password: '' },
  ]) {
    const h = setup(); t.after(h.dispose); h.set(fields); await h.submit();
    assert.equal(h.calls.toasts.at(-1).tone, 'warning');
    assert.equal(h.calls.signIn.length + h.calls.signUp.length, 0);
  }
  for (const changed of [{ fullName: '' }, { phone: '12' }, { email: 'bad-address' }, { password: 'short' }]) {
    const h = setup(); t.after(h.dispose); h.view.toggleSignUp(); h.render();
    h.set({ email: 'new@example.test', fullName: 'New Customer', phone: '01000000000', password: 'fixture-password', ...changed });
    await h.submit();
    assert.equal(h.calls.toasts.at(-1).tone, 'warning');
    assert.equal(h.calls.signIn.length + h.calls.signUp.length, 0);
    assert.equal(h.view.isLoading, false);
  }
});

test('editing email or changing account mode clears confirmation notice and feedback', async t => {
  const h = setup(); t.after(h.dispose);
  h.set({ email: 'customer@example.test', password: 'fixture-password' }); await h.submit(); await h.resend();
  assert(h.view.confirmationFeedback);
  h.set({ email: 'different@example.test' });
  assert.equal(h.view.confirmationEmail, '');
  assert.equal(h.view.confirmationFeedback, null);
  await h.resend();
  assert.equal(h.calls.resend.length, 1, 'A changed address cannot reuse the previous confirmation action');
  await h.submit();
  assert.equal(h.view.confirmationEmail, 'different@example.test');
  h.view.toggleSignUp(); h.render();
  assert.equal(h.view.confirmationEmail, '');
  assert.equal(h.view.confirmationFeedback, null);
});

test('autofill only reads the local auth form and does not mistake a signup name for an email', t => {
  const h = setup(); t.after(h.dispose);
  h.view.handleAutoFill({ animationName: 'onAutoFillStart', target: { autocomplete: 'name', value: 'New Customer', type: 'text' } }); h.render();
  assert.equal(h.view.email, '');
  h.view.formRef.current = { querySelector(selector) {
    if (selector === 'input[autocomplete="username"]') return { value: 'local-form@example.test' };
    if (selector.includes('current-password')) return { value: 'local-form-password' };
    throw new Error('Unexpected form field selector: ' + selector);
  } };
  h.advance(1);
  assert.equal(h.view.email, 'local-form@example.test');
  assert.equal(h.view.password, 'local-form-password');
});

test('successful login retains session, audit, refresh and store modal completion behavior', async t => {
  const h = setup(); t.after(h.dispose);
  h.set({ email: 'customer@example.test', password: 'fixture-password' }); await h.submit();
  h.response.signIn = { data: { user: h.user, session: { user: h.user } }, error: null };
  await h.submit();
  assert.equal(h.view.confirmationEmail, '');
  assert.equal(h.view.isLoading, false);
  assert.equal(h.calls.success, 1);
  assert.equal(h.calls.refresh, 1);
  assert.equal(h.calls.audit.length, 1);
  assert.equal(h.calls.audit[0][1], 'LOGIN');
  assert.equal(h.calls.contacts.length, 1);
  assert.equal(h.calls.notifications.length, 1);
  assert.equal(h.calls.notifications[0].type, 'login');
  assert.equal(h.calls.toasts.at(-1).tone, 'success');
  assert.deepEqual(h.calls.redirects, []);
});

test('unconfirmed login never completes an employee portal redirect', async t => {
  const h = setup({ pathname: '/login', query: '?portal=employee&redirect=%2FDashboard', stayOnPage: false }); t.after(h.dispose);
  h.set({ email: 'customer@example.test', password: 'fixture-password' }); await h.submit();
  h.advance(1); await h.flush();
  assert.deepEqual(h.calls.redirects, []);
  assert.equal(h.calls.success, 0);
  assert.equal(h.calls.audit.length, 0);
  await h.resend();
  assert.equal(h.calls.resend[0].options.emailRedirectTo, 'https://www.phi-tech.org/login?redirect=%2FDashboard&portal=employee');
});
