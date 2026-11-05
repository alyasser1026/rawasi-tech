const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const calls=[];
let fail=false, selectedFetch;
const testExports={};
const context={exports:testExports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test'}},Headers,URL,Request,console,
  require:()=>({createClient:(_url,_key,options)=>{selectedFetch=options.global.fetch;return{};}}),
  fetch:async(input,init)=>{calls.push({input,init});if(fail)throw new TypeError('network unavailable');return new Response('[]');}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/supabase.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
(async()=>{
  testExports.setActiveCompanyId('company-a');
  await selectedFetch('https://example.supabase.co/rest/v1/accounts',{headers:{authorization:'Bearer test'}});
  assert.equal(calls.at(-1).init.headers.get('x-company-id'),'company-a');
  assert.equal(calls.at(-1).init.headers.get('authorization'),'Bearer test');
  await selectedFetch('https://example.supabase.co/auth/v1/user',{});
  assert.equal(calls.at(-1).init.headers,undefined);
  fail=true;const before=calls.length;
  await assert.rejects(()=>selectedFetch('https://example.supabase.co/rest/v1/expenses',{method:'POST',body:'{}'}),/network unavailable/);
  assert.equal(calls.length,before+1,'failed writes must never retry without the company header');
  fail=false;
  await selectedFetch('https://example.supabase.co/rest/v1/accounts',{});
  assert.equal(calls.at(-1).init.headers.get('x-company-id'),'company-a','later requests keep their company');
  testExports.setActiveCompanyId('company-b');
  await selectedFetch(new Request('https://example.supabase.co/rest/v1/accounts',{headers:{accept:'application/json'}}));
  assert.equal(calls.at(-1).init.headers.get('x-company-id'),'company-b');
  assert.equal(calls.at(-1).init.headers.get('accept'),'application/json');
  console.log('PASS: REST company headers, auth exclusion, preserved headers, no retry on failure, selected company changes');
})().catch(e=>{console.error(e);process.exitCode=1;});
