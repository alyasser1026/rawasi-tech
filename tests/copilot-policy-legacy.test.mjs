import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/copilot/response-policy.ts';

function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const result = {};
  vm.runInThisContext(`(function(exports,require){${output}\n})`)(result, name => {
    assert(Object.hasOwn(imports,name), `Unmocked dependency ${name}`);
    return imports[name];
  });
  return result;
}

const catalog = { DEFAULT_PRODUCTS:[], DEFAULT_PROPERTIES:[], DEFAULT_MAINTENANCE_SERVICES:[], PRODUCT_CATEGORIES:[{id:'safety_sensors',title:'حساسات الأمان',shortTitle:'الأمان'}], SMART_BUNDLES:[] };
const config = load('../app/site/chat-bot-config.ts');
const responder = load('../lib/copilot/chat-auto-responder.ts', {'@/app/site/store-catalog':catalog, '@/app/site/chat-bot-config':config, './response-policy':policy});
const knowledge = load('../lib/copilot/chat-knowledge.ts', {'@/app/site/checklist-data':{CHECKLIST:[]}, '@/app/site/execution-guide-data':{EXECUTION_GUIDE_ITEMS:[]}, '@/app/site/section-defs':{PORTAL_SECTIONS:[]}, '@/app/site/store-catalog':catalog,'./response-policy':policy});

test('legacy delivery, COD and branch pickup questions cannot invent company policy', () => {
  for(const messageText of ['بتوصلوا للمنصورة؟','فيه كاش عند الاستلام؟','عندكم فرع أستلم منه؟']) {
    const result=responder.generateSmartAutoReply({messageText});
    assert.equal(result.intent,'company_policy');
    assert.equal(result.needsHuman,false);
    assert.equal(result.nextStage,'active');
    assert.match(result.replyText,/مش عندي سياسة معتمدة/);
    assert.doesNotMatch(result.replyText,/بنوصل لكل المحافظات|بنوفر الدفع كاش|اونلاين فقط/);
  }
});

test('legacy negotiation and wholesale inquiries do not become automatic handoffs', () => {
  for(const messageText of ['لقيته بثمانية آلاف، تقدر تعملي خصم خاص؟','ولو خدت 20 عبوة فيه سعر الجملة؟']) {
    const result=responder.generateSmartAutoReply({messageText});
    assert.equal(result.intent,'company_policy');
    assert.equal(result.needsHuman,false);
    assert.doesNotMatch(result.replyText,/سجلت|حوّلت|تم تحويل|هيتواصل/);
  }
});

test('published FAQ policy is quoted exactly and is not broadened to other services', () => {
  const result=responder.generateSmartAutoReply({messageText:'عندكم استلام من الفرع؟',siteContent:{FAQS:[{q:'الاستلام من الفرع',a:'الاستلام من فرع القاهرة بموعد مسبق فقط.'}]}});
  assert.match(result.replyText,/الاستلام من فرع القاهرة بموعد مسبق فقط/);
  assert.doesNotMatch(result.replyText,/كل الفروع/);
});

test('policy response avoids the generative rewrite even when model credentials exist', async t => {
  const previousKey=process.env.GEMINI_API_KEY, previousFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='test-only';
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('No model call allowed');};
  t.after(()=>{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;});
  const result=await responder.generateEgyptianColloquialAiReply({messageText:'فيه ضمان؟'});
  assert.equal(result.intent,'company_policy');
  assert.equal(calls,0);
});

test('legacy handoff copy never claims prior dispatch before server handling', () => {
  const result=responder.generateSmartAutoReply({messageText:'حولني لمهندس',requestHuman:true});
  assert.equal(result.needsHuman,true);
  assert.doesNotMatch(result.replyText,/تم تسجيل|تم تحويل|بعتها|فوراً/);
  assert.match(result.replyText,/بعد اكتمال بياناتك وتأكيد الإرسال/);
});

test('knowledge digest reflects policy and price edits with unchanged item counts', () => {
  const product={id:'p1',name:'سنسور أمان',category:'safety_sensors',brand:'Fixture',unit:'قطعة',price:100,currency:'جنيه',description:'تجريبي',inStock:true,specs:[]};
  const site={PRODUCTS:[product],PROPERTIES:[],MAINTENANCE_SERVICES:[],FAQS:[{q:'طرق الدفع',a:'سياسة الدفع القديمة'}]};
  const first=knowledge.buildSiteKnowledgeDigest(site);
  assert.match(first,/100 جنيه/);
  product.price=250;
  site.FAQS[0].a='سياسة الدفع المحدثة';
  const second=knowledge.buildSiteKnowledgeDigest(site);
  assert.match(second,/250 جنيه/);
  assert.match(second,/سياسة الدفع المحدثة/);
  assert.doesNotMatch(second,/سياسة الدفع القديمة|100 جنيه/);
  assert.doesNotMatch(second,/safety_sensors/);
});

test('unknown product category identifiers are never printed as customer labels', () => {
  const digest=knowledge.buildSiteKnowledgeDigest({PRODUCTS:[{id:'p1',name:'منتج تجريبي',category:'internal_unknown_code',unit:'قطعة',price:100}],PROPERTIES:[],MAINTENANCE_SERVICES:[]});
  assert.match(digest,/المنتجات/);
  assert.doesNotMatch(digest,/internal_unknown_code/);
});
