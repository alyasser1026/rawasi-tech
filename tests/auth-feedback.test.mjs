import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/auth-feedback.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleExports = {};
const evaluate = vm.runInThisContext(`(function (exports, require) { ${outputText} })`);
evaluate(moduleExports, name => { throw new Error(`Unexpected dependency: ${name}`); });
const { getAuthErrorFeedback, getAuthEmailRedirectTo, getSafeAuthRedirect } = moduleExports;

test('unconfirmed email is an actionable warning rather than a technical error', () => {
  for (const error of [
    { code: 'email_not_confirmed', message: 'Auth message may change', status: 400 },
    new Error('Email not confirmed'),
    { message: 'EMAIL NOT CONFIRMED' },
  ]) {
    const feedback = getAuthErrorFeedback(error);
    assert.equal(feedback.tone, 'warning');
    assert.equal(feedback.requiresConfirmation, true);
    assert.equal(typeof feedback.message, 'string');
    assert.match(feedback.message, /البريد|بريدك/);
  }
});

test('incorrect credentials warn without suggesting an email confirmation', () => {
  for (const error of [
    { code: 'invalid_credentials', message: 'Auth message may change', status: 400 },
    new Error('Invalid login credentials'),
    new Error('Invalid credentials'),
  ]) {
    const feedback = getAuthErrorFeedback(error);
    assert.equal(feedback.tone, 'warning');
    assert.equal(feedback.requiresConfirmation, false);
    assert(feedback.message.trim());
  }
});

test('Auth resend throttling is a warning, including HTTP 429 without an Auth code', () => {
  for (const error of [
    { code: 'over_email_send_rate_limit', message: 'Slow down' },
    { code: 'over_request_rate_limit', message: 'Slow down' },
    { status: 429, message: 'Too Many Requests' },
  ]) {
    const feedback = getAuthErrorFeedback(error);
    assert.equal(feedback.tone, 'warning');
    assert.equal(feedback.requiresConfirmation, false);
    assert(feedback.message.trim());
  }
});

test('expected signup validation failures stay user warnings', () => {
  for (const code of ['email_address_invalid', 'user_already_exists', 'email_exists', 'weak_password']) {
    const feedback = getAuthErrorFeedback({ code, message: 'Auth validation feedback', status: 422 });
    assert.equal(feedback.tone, 'warning', code);
    assert.equal(feedback.requiresConfirmation, false, code);
    assert(feedback.message.trim(), code);
  }
});

test('unexpected Auth, network and mailer failures remain technical errors with their message intact', () => {
  for (const error of [
    { code: 'unexpected_failure', status: 500, message: 'Error sending confirmation email' },
    { code: 'unexpected_failure', status: 500, message: 'Auth database unavailable' },
    { code: 'unknown_mailer_error', status: 503, message: 'SMTP provider unavailable' },
    new Error('Failed to fetch'),
    new Error('Unexpected runtime failure'),
  ]) {
    const feedback = getAuthErrorFeedback(error);
    assert.equal(feedback.tone, 'error', error.message);
    assert.equal(feedback.requiresConfirmation, false, error.message);
    assert.equal(feedback.message, error.message);
  }
});

test('missing error details still produce a usable technical error', () => {
  for (const error of [null, undefined, {}]) {
    const feedback = getAuthErrorFeedback(error);
    assert.equal(feedback.tone, 'error');
    assert.equal(feedback.requiresConfirmation, false);
    assert.equal(typeof feedback.message, 'string');
    assert(feedback.message.trim());
  }
});

const origin = 'https://www.phi-tech.org';

function callback(redirect, portal, base = origin) {
  const result = new URL(getAuthEmailRedirectTo(base, redirect, portal));
  assert.equal(result.origin, base);
  assert.equal(result.pathname, '/login');
  assert.equal(result.username, '');
  assert.equal(result.password, '');
  assert.equal(result.hash, '');
  return result;
}

test('confirmation callbacks always return to the local login page', () => {
  const result = callback(null, null);
  assert.equal(result.searchParams.get('redirect'), null);
  assert.equal(result.searchParams.get('portal'), null);
  const preview = callback('/store', null, 'https://preview.phi-tech.org');
  assert.equal(preview.searchParams.get('redirect'), '/store');
});

test('confirmation retains a safe local destination, including its query and hash', () => {
  for (const destination of ['/store', '/PartnerBalances', '/projects/details?id=123', '/store?category=electrical#products']) {
    assert.equal(callback(destination, null).searchParams.get('redirect'), destination);
  }
});

test('employee and partner portal choices are preserved without accepting arbitrary portal values', () => {
  for (const portal of ['employee', 'partner']) {
    const result = callback('/store', portal);
    assert.equal(result.searchParams.get('portal'), portal);
    assert.equal(result.searchParams.get('redirect'), '/store');
  }
  for (const portal of ['admin', 'super_admin', 'https://outside.example', '//outside.example', 'employee&redirect=https://outside.example']) {
    assert.equal(callback('/store', portal).searchParams.get('portal'), null);
  }
});

test('confirmation callback rejects external and malformed redirect targets', () => {
  for (const destination of [
    'https://outside.example/path',
    'https://www.phi-tech.org@outside.example/path',
    '//outside.example/path',
    '///outside.example/path',
    'javascript:alert(1)',
    'store',
    '\\outside.example\\path',
    '/\\outside.example/path',
    '/store\\outside',
    '/store\n//outside.example',
    '/store\r\nLocation: https://outside.example',
    '/store\u0000',
  ]) {
    assert.equal(callback(destination, 'employee').searchParams.get('redirect'), null, JSON.stringify(destination));
  }
});

test('safe Auth destinations reject encoded separators, controls and malformed URI escapes', () => {
  for (const destination of [
    '//outside.example/path',
    '/%2foutside.example/path',
    '/%5coutside.example/path',
    '/store%0aoutside',
    '/store%0doutside',
    '/store%00outside',
    '/store%ZZ',
    '/store%',
  ]) {
    assert.equal(getSafeAuthRedirect(destination), null, destination);
    assert.equal(callback(destination, null).searchParams.get('redirect'), null, destination);
  }
  assert.equal(getSafeAuthRedirect('/store?search=%D8%A8'), '/store?search=%D8%A8');
  assert.equal(getSafeAuthRedirect('/store?x=1'), '/store?x=1');
  assert.equal(getSafeAuthRedirect(), null);
});

test('confirmation callbacks omit login and signup targets to avoid redirect loops', () => {
  for (const destination of ['/login', '/signup', '/login?portal=employee', '/signup#form']) {
    assert.equal(callback(destination, 'employee').searchParams.get('redirect'), null, destination);
  }
});

test('query-looking local destinations cannot inject callback credentials, portal or redirect parameters', () => {
  const destination = '/store?redirect=https://outside.example&portal=admin&username=visitor';
  const result = callback(destination, 'partner');
  assert.equal(result.searchParams.get('redirect'), destination);
  assert.equal(result.searchParams.get('portal'), 'partner');
  assert.equal(result.searchParams.get('username'), null);
  assert.equal([...result.searchParams.getAll('redirect')].length, 1);
});
