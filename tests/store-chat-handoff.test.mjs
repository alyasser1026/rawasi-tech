import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(relativePath, imports = {}, globals = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  const run = vm.runInNewContext(`(function(exports, require) { ${outputText}\n })`, {
    Request, Response, URL, URLSearchParams, console, process: { env: {} }, ...globals,
  });
  run(exports, specifier => {
    assert(Object.hasOwn(imports, specifier), `Unmocked dependency: ${specifier}`);
    return imports[specifier];
  });
  return exports;
}

const handoff = loadModule('../lib/copilot/handoff.ts');
const contact = { customerName:'أحمد محمود', customerPhone:'01012345678' };
const userMessages = ['👨‍💼 تواصل مع مهندس', 'اسمي أحمد محمود', 'رقمي ٠١٠١٢٣٤٥٦٧٨'];

test('contact gate rejects anonymous labels, missing data and invalid phones', () => {
  for (const [name,phone] of [['',''],['زائر','01012345678'],['عميل المتجر','01012345678'],['أحمد',''],['أحمد','00000000'],['أحمد','1234'],['أحمد','12345678ext']]) {
    const result=handoff.getHandoffContact(name,phone);
    assert.equal(result.ready,false,JSON.stringify({name,phone}));
    assert(result.missingFields.length);
    assert(result.prompt);
  }
  const ready=handoff.getHandoffContact('أحمد محمود','٠١٠١٢٣٤٥٦٧٨');
  assert.equal(ready.ready,true);
  assert.equal(ready.phone,'01012345678');
});

test('discount, wholesale and complaint messages are not handoff or order consent', () => {
  for(const message of ['لقيته في موقع تاني بـ8000 جنيه، تقدر تعملي خصم وخليه 7500؟','ولو خدت 20 عبوة لمشروع، في سعر جملة؟','المنتج وصل مكسور وأنا متضايق']) {
    assert.equal(handoff.resolveHandoffConsent([message]),false,message);
    assert.equal(handoff.resolveSubmissionConsent([message]),false,message);
  }
});

test('explicit quick replies and multistep contact collection preserve consent and honor refusal', () => {
  for(const message of ['👨‍💼 تواصل مع مهندس','تحويل لمهندس','تواصل مع المبيعات','عايز أكلم مهندس','Please connect me with an engineer']) assert.equal(handoff.resolveHandoffConsent([message]),true,message);
  assert.equal(handoff.resolveHandoffConsent(userMessages),true);
  assert.equal(handoff.resolveHandoffConsent([...userMessages,'مش عايز تواصل مع مهندس']),false);
  assert.equal(handoff.resolveHandoffConsent([...userMessages,'متتصلش بيا']),false);
  assert.equal(handoff.resolveHandoffConsent([...userMessages,'do not contact me']),false);
  assert.equal(handoff.resolveHandoffConsent([...userMessages,'لا شكرا']),false);
  assert.equal(handoff.resolveHandoffConsent([...userMessages,'ما تحولنيش']),false);
  assert.equal(handoff.resolveSubmissionConsent(['احجزلي معاينة','اسمي أحمد','01012345678']),true);
  assert.equal(handoff.resolveSubmissionConsent(['أكد الطلب','الغي الطلب']),false);
});

test('model contact arguments need customer evidence, while real form values take precedence', () => {
  assert.equal(handoff.getVerifiedActionContact(contact,{}).ready,false);
  assert.equal(handoff.getVerifiedActionContact(contact,{customerMessages:userMessages}).ready,true);
  const result=handoff.getVerifiedActionContact({customerName:'اسم مختلف',customerPhone:'01299999999'},contact);
  assert.equal(result.name,contact.customerName);
  assert.equal(result.phone,contact.customerPhone);
});

test('success claims require the corresponding actual action confirmation', () => {
  const pending={...contact,handoffConfirmed:false,submissionConfirmed:false};
  for(const message of ['أنا حولت طلبك فوراً لمهندس المبيعات المختص','تم تحويل استفسارك للمهندس المختص','سجلتلك طلب معاينة وتواصل','حجزت المعاينة','Your booking is confirmed']) assert.notEqual(handoff.enforceActionClaims(message,pending),message,message);
  const followup='تم تسجيل طلب التواصل للفريق.';
  assert.equal(handoff.enforceActionClaims(followup,{...pending,handoffConfirmed:true}),followup);
  const booking='تم حجز المعاينة';
  assert.notEqual(handoff.enforceActionClaims(booking,{...pending,handoffConfirmed:true}),booking);
  assert.equal(handoff.enforceActionClaims(booking,{...pending,submissionConfirmed:true}),booking);
  assert.equal(handoff.enforceActionClaims('السعر المسجل للمنتج 1500 جنيه',pending),'السعر المسجل للمنتج 1500 جنيه');
});

function makeContext(overrides={}) {
  return {sessionId:'COP-TEST-123',pageUrl:'/store',...contact,products:[],estimate:null,cartAction:null,submittedOrder:null,escalated:false,actions:[],toolsUsed:[],handoffRequested:true,submissionRequested:true,...overrides};
}

function toolsFixture(options={}) {
  const calls={inserts:[],stockReads:[],rpc:[],telegram:0,orderTelegram:0};
  const rows=options.rows ?? [{id:'p1',code:'P-1',in_stock:true}];
  const sb={
    from(table) {
      if(table==='store_catalog_products')return {select(){return {async in(field,values){calls.stockReads.push({field,values});return {data:rows.filter(row=>values.includes(row[field])),error:options.stockError||null};}};}};
      assert.equal(table,'user_requests');
      return {insert(payload){calls.inserts.push(payload);return {select(){return {async single(){if(options.saveWait)await options.saveWait;return {data:options.noSavedId?null:{id:'saved-chat'},error:options.saveError||null};}};}};}};
    },
    async rpc(name,args){calls.rpc.push({name,args});if(options.rpcWait)await options.rpcWait;return options.rpcResult ?? {data:{ok:true,id:'saved-order',refCode:'ORD-TEST',order:{items:[{}],totalAmount:100}},error:null};},
  };
  const tools=loadModule('../lib/store-copilot-tools.ts',{
    '@supabase/supabase-js':{createClient(){throw Error('Unexpected live client');}},
    '@/lib/copilot/chat-knowledge':{searchSiteKnowledge:()=>[]},
    '@/lib/copilot/training-store':{getCachedCopilotTraining:()=>({}),matchCopilotKnowledge:()=>[]},
    '@/app/site/store-catalog':{DEFAULT_MAINTENANCE_SERVICES:[],PRODUCT_CATEGORIES:[],SMART_BUNDLES:[],getProductImageUrl:()=>''},
    '@/lib/store-catalog-server':{normalizeArabicSearch:value=>value,queryStoreCatalog(){throw Error('Unexpected fallback read');}},
    '@/lib/copilot/handoff':handoff,
    '@/lib/copilot/catalog-relevance':{},
    '@/lib/store-order-telegram':{async sendCopilotEscalationTelegram(){calls.telegram++;return options.telegramSent??false;},async sendStoreTelegramNotification(){calls.orderTelegram++;}},
  });
  return {calls,sb,tools};
}

test('engineer tool stops before writes or notifications without contact or explicit consent', async()=>{
  for(const override of [{customerName:'',customerPhone:''},{customerName:'عميل المتجر'},{customerPhone:''},{handoffRequested:false}]) {
    const fixture=toolsFixture();const ctx=makeContext(override);
    const result=await fixture.tools.execEscalateToEngineer(fixture.sb,{},ctx);
    assert.equal(result.ok,false);
    assert.equal(ctx.escalated,false);
    assert.equal(fixture.calls.inserts.length,0);
    assert.equal(fixture.calls.telegram,0);
  }
});

test('engineer tool confirms only a real saved id or an acknowledged team notification', async()=>{
  for(const options of [{noSavedId:true},{saveError:{message:'db error'}},{noSavedId:true,telegramSent:true},{}]) {
    const fixture=toolsFixture(options),ctx=makeContext();
    const result=await fixture.tools.execEscalateToEngineer(fixture.sb,{},ctx);
    const expected=Boolean(options.telegramSent||(!options.noSavedId&&!options.saveError));
    assert.equal(result.ok,expected,JSON.stringify(options));
    assert.equal(ctx.escalated,expected);
  }
});

test('parallel and repeated handoff calls share one mutation and notification', async()=>{
  let release;const saveWait=new Promise(resolve=>{release=resolve;});
  const fixture=toolsFixture({saveWait}),ctx=makeContext();
  const first=fixture.tools.execEscalateToEngineer(fixture.sb,{},ctx);
  const second=fixture.tools.execEscalateToEngineer(fixture.sb,{},ctx);
  assert.equal(fixture.calls.inserts.length,1);
  release();await Promise.all([first,second]);
  await fixture.tools.execEscalateToEngineer(fixture.sb,{},ctx);
  assert.equal(fixture.calls.inserts.length,1);
  assert.equal(fixture.calls.telegram,1);
});

test('order tool requires explicit action, contact and authoritative available products', async()=>{
  for(const [options,override] of [[{},{submissionRequested:false}],[{},{customerName:''}],[{rows:[{id:'p1',code:'P-1',in_stock:false}]},{}],[{rows:[]},{}],[{stockError:{message:'read failed'}},{}]]) {
    const fixture=toolsFixture(options),ctx=makeContext(override);
    const result=await fixture.tools.execSubmitOrderOrService(fixture.sb,{items:[{productId:'p1',qty:1}]},ctx);
    assert.equal(result.ok,false);
    assert.equal(ctx.submittedOrder,null);
    assert.equal(fixture.calls.rpc.length,0);
    assert.equal(fixture.calls.orderTelegram,0);
  }
});

test('order confirmation requires a saved id and reference and is not duplicated', async()=>{
  for(const data of [{ok:true},{ok:true,id:'saved-order'},{ok:false,error:'not saved'}]) {
    const fixture=toolsFixture({rpcResult:{data,error:null}}),ctx=makeContext();
    const result=await fixture.tools.execSubmitOrderOrService(fixture.sb,{items:[{productId:'p1',qty:1}]},ctx);
    assert.equal(result.ok,false);assert.equal(ctx.submittedOrder,null);assert.equal(fixture.calls.orderTelegram,0);
  }
  let release;const rpcWait=new Promise(resolve=>{release=resolve;});
  const fixture=toolsFixture({rpcWait}),ctx=makeContext();
  const args={items:[{productId:'p1',qty:1}]};
  const first=fixture.tools.execSubmitOrderOrService(fixture.sb,args,ctx);
  const second=fixture.tools.execSubmitOrderOrService(fixture.sb,args,ctx);
  release();const result=await first;await second;
  assert.equal(result.ok,true);assert.equal(ctx.submittedOrder.refCode,'ORD-TEST');
  await fixture.tools.execSubmitOrderOrService(fixture.sb,args,ctx);
  assert.equal(fixture.calls.rpc.length,1);assert.equal(fixture.calls.orderTelegram,1);
});

function legacyFixture(options={}) {
  const calls={writes:[],notifications:0};
  const sb={
    async rpc(){return {data:{},error:null};},
    from(table){assert.equal(table,'user_requests');return {
      select(){return {eq(){return this;},async maybeSingle(){return {data:options.existing?{id:'existing',details:JSON.stringify(options.existing)}:null,error:null};}};},
      insert(payload){calls.writes.push(payload);return {select(){return {async single(){return {data:options.failSave?null:{id:'saved'},error:options.failSave?{message:'write failed'}:null};}};}};},
      update(payload){calls.writes.push(payload);return {eq(){return {select(){return {async single(){return {data:options.failSave?null:{id:'saved'},error:options.failSave?{message:'write failed'}:null};}};}};}};},
    };},
  };
  const autoReply={shouldReply:true,senderName:'Bot',replyText:'أنا حولت طلبك فوراً لمهندس المبيعات المختص',intent:'human_handoff',needsHuman:true,nextStage:'active',escalationReason:'طلب متابعة',...options.autoReply};
  const route=loadModule('../app/api/website-chat/route.ts',{
    'next/server':{NextResponse:{json:Response.json}},
    '@supabase/supabase-js':{createClient:()=>sb},
    '@/lib/telegram-notifier':{normalizePhoneForWhatsApp:value=>value.replace(/\D/g,'')},
    '@/app/site/site-content':{mergeContent:()=>({CHAT_BOT:{enabled:true,botName:'Bot',welcomeText:'مرحبًا'}}),sanitizeContent:value=>value},
    '@/lib/copilot/chat-auto-responder':{generateEgyptianColloquialAiReply:async()=>autoReply},
    '@/lib/copilot/chat-knowledge':{buildSiteKnowledgeDigest:()=>'',searchSiteKnowledge:()=>[]},
    '@/lib/copilot/handoff':handoff,
  },{
    process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SECRET_KEY:'fixture-secret',TELEGRAM_BOT_TOKEN:'fixture-token',TELEGRAM_CHAT_ID:'fixture-chat'}},
    fetch:async()=>{calls.notifications++;return Response.json({ok:true});},
  });
  const post=body=>route.POST(new Request('https://fixture.invalid/api/website-chat',{method:'POST',body:JSON.stringify({sessionId:'CHAT-TEST-123',message:'تواصل مع مهندس',...body})}));
  return {post,calls};
}

test('legacy chat does not escalate complaints, discount or wholesale before contact and consent',async()=>{
  for(const message of ['لقيته بـ8000، تقدر تعملي خصم وخليه 7500؟','ولو خدت20 عبوة، في سعر جملة؟','وصلني صنف مكسور']) {
    const fixture=legacyFixture();const response=await fixture.post({message});const body=await response.json();
    assert.equal(response.status,200);assert.equal(body.session.escalatedToHuman,false);assert.equal(body.session.botPaused,false);
    assert.equal(fixture.calls.notifications,0);assert(!body.session.messages.at(-1).text.includes('حولت طلبك'));
  }
});

test('legacy chat collects missing contact while remaining active for further messages',async()=>{
  const fixture=legacyFixture();const response=await fixture.post({requestHuman:true});const body=await response.json();
  assert.equal(body.session.escalatedToHuman,false);assert.equal(body.session.stage,'awaiting_name');assert.equal(body.session.botPaused,false);
  assert.match(body.session.messages.at(-1).text,/اسمك ورقم/);assert.equal(fixture.calls.notifications,0);
});

test('legacy chat confirms handoff only after successful persistence with valid contacts',async()=>{
  for(const failSave of [true,false]) {
    const fixture=legacyFixture({failSave});const response=await fixture.post({requestHuman:true,visitorName:contact.customerName,visitorPhone:contact.customerPhone});const body=await response.json();
    assert.equal(response.status,failSave?503:200);
    if(failSave){assert.equal(body.ok,undefined);assert.equal(fixture.calls.notifications,0);}
    else {assert.equal(body.session.escalatedToHuman,true);assert.equal(fixture.calls.notifications,1);assert.match(body.session.messages.at(-1).text,/تم تسجيل طلب المتابعة/);}
  }
});
