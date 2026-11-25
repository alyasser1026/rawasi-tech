import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/copilot/runtime-budget.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
vm.runInThisContext(`(function(exports){${compiled}\n})`)(api);

test('an exhausted shared deadline does not start another paid provider request', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('unexpected network'); };
  try {
    assert.equal(await api.fetchCopilotJson('https://provider.example.invalid', {}, 100, { now: () => 100 }), null);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('successful JSON is decoded within the same provider request deadline', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Fixture response' } }] }));
  try {
    const result = await api.fetchCopilotJson('https://provider.example.invalid', {}, 100, { now: () => 0 });
    assert.equal(result.choices[0].message.content, 'Fixture response');
  } finally { globalThis.fetch = original; }
});

test('a stalled response body times out and aborts after headers already arrived', async () => {
  const original = globalThis.fetch;
  let signal;
  globalThis.fetch = async (_url, init) => { signal = init.signal; return { ok: true, json: () => new Promise(() => {}) }; };
  try {
    await assert.rejects(api.fetchCopilotJson('https://provider.example.invalid', {}, 100, { now: () => 0, maxCallMs: 15 }), /copilot_response_timeout/);
    assert.equal(signal.aborted, true);
  } finally { globalThis.fetch = original; }
});

test('failed provider requests return to fallback without decoding error bodies', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: () => { throw Error('must not decode'); } });
  try {
    assert.equal(await api.fetchCopilotJson('https://provider.example.invalid', {}, 100, { now: () => 0 }), null);
  } finally { globalThis.fetch = original; }
});

test('later tool rounds share the original deadline instead of resetting its budget', async () => {
  const original = globalThis.fetch;
  let now = 80, calls = 0;
  globalThis.fetch = async () => { calls++; now = 101; return new Response('{}'); };
  try {
    await api.fetchCopilotJson('https://provider.example.invalid', {}, 100, { now: () => now });
    assert.equal(await api.fetchCopilotJson('https://provider.example.invalid', {}, 100, { now: () => now }), null);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
