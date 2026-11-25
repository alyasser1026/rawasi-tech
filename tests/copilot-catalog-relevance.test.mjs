import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

function load(relative, imports = {}, append = '') {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8') + append;
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInThisContext(`(function(exports,require){${outputText}\n})`)(exports, name => {
    assert(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  });
  return exports;
}

const relevance = load('../lib/copilot/catalog-relevance.ts');
const { inferCatalogIntent, filterRelevantCatalogProducts, isRelevantCatalogProduct, isProductOrderable, scoreCatalogProduct, toCustomerDisplayText } = relevance;
const product = (id, name, category, extra = {}) => ({ id, name, category, code: id.toUpperCase(), subCategory:'', brand:'Fixture', inStock:true, ...extra });
const heater = product('heater', 'سخان غاز 10 لتر', 'appliances');
const trash = product('trash', 'باسكت قمامة 10 لتر', 'tools_hardware');
const paint = product('paint', 'بستلة دهان 10 لتر', 'paint');
const smartLock = product('smart-lock', 'كالون تاتش سمارت', 'smart_home');
const ordinaryLock = product('ordinary-lock', 'كالون باب عادي بمفتاح', 'doors_windows');
const ups = product('ups', 'يو بي إس APC سمارت', 'low_current');
const air = product('air', 'تكييف ميديا سمارت', 'hvac');
const lamp = product('lamp', 'لمبة إشارة شنايدر', 'electrical');
const cable = product('cable', 'كابل السويدي نحاس 3 × 2.5', 'electrical');
const fixtures = [heater, trash, paint, smartLock, ordinaryLock, ups, air, lamp, cable];

test('10 litre gas heater search cannot be satisfied by shared capacity or units', () => {
  for (const query of ['سخان غاز ١٠ لتر', 'عايز سخان غاز 10 لتر', '10 litre gas water heater']) {
    assert.deepEqual(filterRelevantCatalogProducts(fixtures, query).map(p => p.id), ['heater']);
  }
  assert.equal(isRelevantCatalogProduct(trash, 'سخان غاز 10 لتر'), false);
  assert.equal(isRelevantCatalogProduct(paint, 'سخان غاز 10 لتر'), false);
  assert.equal(scoreCatalogProduct(trash, 'سخان غاز 10 لتر'), 0);
});

test('smart lock requires both lock identity and smart identity rather than either keyword', () => {
  for(const query of ['أرخص كالون سمارت', 'أغلى كالون سمارت', 'smart door lock', 'قفل ذكي ببصمة']) {
    assert.deepEqual(filterRelevantCatalogProducts(fixtures, query).map(p => p.id), ['smart-lock']);
  }
  assert.equal(scoreCatalogProduct(ups, 'كالون سمارت'), 0);
  assert.equal(scoreCatalogProduct(ordinaryLock, 'كالون سمارت'), 0);
});

test('policy questions never attach stray catalog cards, including a product-page context', () => {
  for(const query of ['بتوصلوا للمنصورة؟','فيه كاش عند الاستلام؟','عندكم فرع أستلم منه؟','في ضمان للسخان؟','what is your shipping policy?','سعر جملة للكمية دي؟']) {
    assert.equal(inferCatalogIntent(query).kind, 'policy');
    assert.deepEqual(filterRelevantCatalogProducts(fixtures, query, { activeProductId:'lamp', contextQuery:'لمبات شنايدر' }), []);
  }
});

test('specific family search ignores description and keeps same-brand unrelated products out', () => {
  const withCrossSell = product('bucket', 'باسكت قمامة', 'plumbing', { shortDescription:'بجانب سخان غاز 10 لتر' });
  assert.equal(isRelevantCatalogProduct(withCrossSell, 'سخان غاز 10 لتر'), false);
  assert.deepEqual(filterRelevantCatalogProducts([lamp,cable], 'كابل السويدي 3*2.5').map(p => p.id), ['cable']);
});

test('audited typo, Arabizi and English product questions retain their correct products', () => {
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'سخن').map(p=>p.id), ['heater']);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'عايز سخن غاز 10 لتر').map(p=>p.id), ['heater']);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, '3ayez cable sewedy 3*2.5').map(p=>p.id), ['cable']);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'I need a gas water heater 10 litre').map(p=>p.id), ['heater']);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'الجو سخن وعايز تكييف').map(p=>p.id), ['air']);
});

test('Arabic tokens use Unicode-compatible word boundaries for wire, sockets and policies', () => {
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'سلك').map(p=>p.id), ['cable']);
  assert.equal(inferCatalogIntent('فيش').family,'socket');
  assert.equal(inferCatalogIntent('مفتاح').family,'socket');
  assert.equal(inferCatalogIntent('فيشر').family,null);
  for(const query of ['شحن','الدفع','دفع','كاش','عندكم فرع']) assert.equal(inferCatalogIntent(query).kind,'policy',query);
});

test('unavailable cards are excluded from suggestions but an explicit detail can display them disabled', () => {
  const unavailable = { ...smartLock, id:'sold-out', inStock:false };
  assert.deepEqual(filterRelevantCatalogProducts([unavailable], 'كالون سمارت'), []);
  assert.equal(isProductOrderable(unavailable), false);
  assert.equal(isProductOrderable({ inStock:undefined }), false);
  assert.deepEqual(filterRelevantCatalogProducts([unavailable], 'كالون سمارت', { includeUnavailable:true }).map(p=>p.id), ['sold-out']);
});

test('contextual follow-ups keep the active product or previous product family but not unit-only matches', () => {
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, '١٠ لتر'), []);
  assert.deepEqual(filterRelevantCatalogProducts([{name:'بستلة 10 لتر',inStock:true}], '١٠ لتر'), []);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, '١٠ لتر', { contextQuery:'سخان غاز' }).map(p=>p.id), ['heater']);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'تفاصيل', { activeProductId:'smart-lock' }).map(p=>p.id), ['smart-lock']);
  assert.deepEqual(filterRelevantCatalogProducts([heater,heater], 'سخان غاز').map(p=>p.id), ['heater']);
});

test('SKU requests preserve exact identifiers and broad category requests remain usable', () => {
  const model = product('model', 'جهاز كنترول', 'low_current', { code:'LDLZE-600000' });
  assert.equal(isRelevantCatalogProduct(model, 'المواصفات كود LDLZE-600000'), true);
  assert.deepEqual(filterRelevantCatalogProducts(fixtures, 'كهرباء وإنارة').map(p=>p.id), ['lamp','cable']);
  assert.equal(inferCatalogIntent('سمارت هوم').category, 'smart_home');
});

test('customer text translates exact internal categories and removes raw markup without changing SKUs', () => {
  const text = toCustomerDisplayText('راجع قسم low_current وقسم safety_sensors وsmart_home. كود `LDLZE_600000` و**قفل ذكي**.');
  assert.match(text, /أنظمة التيار الخفيف/);
  assert.match(text, /الحساسات وأنظمة الأمان/);
  assert.match(text, /المنزل الذكي/);
  assert.match(text, /LDLZE_600000/);
  assert.match(text, /\*\*قفل ذكي\*\*/);
  assert.doesNotMatch(text, /low_current|safety_sensors|smart_home|`/);
  assert.equal(toCustomerDisplayText('MODEL_smart_home_X'), 'MODEL_smart_home_X');
  assert.equal(toCustomerDisplayText('PAINT-001 and MODEL-low_current-X'), 'PAINT-001 and MODEL-low_current-X');
  assert.equal(toCustomerDisplayText('ﻗﺴﻢ low_current'), 'قسم أنظمة التيار الخفيف');
  assert.equal(toCustomerDisplayText('```text\nLDLZE 600000\n```'), 'LDLZE 600000');
});

const panel = load('../app/site/StoreCopilotPanel.tsx', {
  react: { ...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {} },
  'react/jsx-runtime': jsxRuntime,
  'next/link': { __esModule:true, default: () => null },
  '@/lib/client-device-info': { rememberVisitorContact() {} },
  '@/lib/copilot/catalog-relevance': relevance,
  './copilot-events': { dispatchAddToCartEvent() {}, dispatchOpenCartEvent() {} },
}, '\nexport { ProductCardItem, renderFormattedText };');

function allElements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child=>allElements(child,predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...allElements(node.props?.children, predicate)];
}

test('sold-out card actions stay disabled and cannot invoke order handlers even by programmatic click', () => {
  for(const availability of [false,undefined]) {
    let writes=0;
    const tree = panel.ProductCardItem({ card:{...smartLock,inStock:availability,specs:[],price:100,currency:'ج.م'}, disabled:false, onAddSupply(){writes++;},onAddInstall(){writes++;},onQuickOrder(){writes++;},onAskDetails(){} });
    const buttons = allElements(tree, node=>node.type==='button');
    assert.equal(buttons.length,4);
    for(const button of buttons.slice(0,3)) { assert.equal(button.props.disabled,true);button.props.onClick(); }
    assert.equal(buttons[3].props.disabled,false,'details remain available');
    assert.equal(writes,0);
  }
});

test('busy card blocks all purchase actions while an available idle card retains its three handlers', () => {
  for(const disabled of [true,false]) {
    let writes=0;
    const tree = panel.ProductCardItem({card:{...smartLock,specs:[],price:100,currency:'ج.م'},disabled,onAddSupply(){writes++;},onAddInstall(){writes++;},onQuickOrder(){writes++;},onAskDetails(){}});
    const buttons = allElements(tree,node=>node.type==='button');
    for(const button of buttons.slice(0,3)) { assert.equal(button.props.disabled,disabled);button.props.onClick(); }
    assert.equal(writes,disabled?0:3);
  }
});

function textContent(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  return node && typeof node === 'object' ? textContent(node.props?.children) : '';
}

function setupConversation(t, saved = {}) {
  const slots = [], effects = [], pending = [], io = { requests:[], replies:[] };
  let position=0, effectPosition=0, tree;
  const store = new Map([['phi_store_copilot_session_v1',JSON.stringify(saved)]]);
  const originalWindow=globalThis.window, originalFetch=globalThis.fetch;
  globalThis.window = {
    location:{pathname:'/store'},setTimeout(){return 1;},clearTimeout(){},
    localStorage:{get length(){return store.size;},key(index){return [...store.keys()][index];},getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
  };
  globalThis.fetch=async (_url,init) => {
    io.requests.push(JSON.parse(init.body));
    const reply=io.replies.shift()||{ok:true,sessionId:'COP-FIXTURE',reply:'رد المساعد',provider:'rpc_fallback',products:[],estimate:null,cartAction:null,submittedOrder:null,escalated:false,quickReplies:[],actions:[]};
    return {ok:reply.ok,json:async()=>reply};
  };
  t.after(()=>{globalThis.window=originalWindow;globalThis.fetch=originalFetch;for(const effect of effects)effect?.cleanup?.();});
  const hooks={
    ...React,
    useState(initial){const index=position++;if(!Object.hasOwn(slots,index))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
    useRef(initial){const index=position++;if(!Object.hasOwn(slots,index))slots[index]={current:initial};return slots[index];},
    useCallback(callback){position++;return callback;},
    useEffect(callback,deps){const index=effectPosition++,previous=effects[index];if(!previous||!deps||deps.some((value,index)=>value!==previous.deps?.[index]))pending.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:callback()};});},
  };
  const module=load('../app/site/StoreCopilotPanel.tsx',{
    react:hooks,'react/jsx-runtime':jsxRuntime,'next/link':{__esModule:true,default:()=>null},
    '@/lib/client-device-info':{rememberVisitorContact(){}},'@/lib/copilot/catalog-relevance':relevance,
    './copilot-events':{dispatchAddToCartEvent(){},dispatchOpenCartEvent(){}},
  });
  function render(){position=0;effectPosition=0;tree=module.default({whatsappNumber:'',defaultName:'عميل اختبار',defaultPhone:'01000000000',contextLabel:'المتجر',onClose(){}});while(pending.length)pending.shift()();return tree;}
  render();render();
  return {
    io,store,render,text:()=>textContent(tree),
    async send(text,reply){if(reply)io.replies.push(reply);const input=allElements(tree,node=>node.type==='input'&&node.props.className==='phi-chat-input')[0];input.props.onChange({target:{value:text}});render();const form=allElements(tree,node=>node.type==='form').at(-1);form.props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));render();},
  };
}

test('legacy escalation flag cannot restore a false handoff status', t => {
  const view=setupConversation(t,{sessionId:'COP-LEGACY',escalated:true,messages:[]});
  assert.doesNotMatch(view.text(),/تم إرسال طلب التواصل|طلب التواصل مُرسل/);
  assert.equal(JSON.parse(view.store.get('phi_store_copilot_session_v1')).handoffConfirmed,false);
});

test('confirmed handoff retains the visible user message and keeps the assistant input usable', async t => {
  const view=setupConversation(t,{sessionId:'COP-CONFIRMED',escalated:true,handoffConfirmed:true,messages:[]});
  assert.match(view.text(),/طلب التواصل مُرسل/);
  await view.send('هل أقدر أكمل سؤالي؟');
  assert.equal(view.io.requests.length,1);
  assert.equal(view.io.requests[0].message,'هل أقدر أكمل سؤالي؟');
  assert.match(view.text(),/هل أقدر أكمل سؤالي/);
  assert.match(view.text(),/رد المساعد/);
  const input=allElements(view.render(),node=>node.type==='input'&&node.props.className==='phi-chat-input')[0];
  assert.notEqual(input.props.disabled,true);
});

test('a failed request after handoff keeps the user bubble and exposes an error instead of silently losing it', async t => {
  const view=setupConversation(t,{sessionId:'COP-CONFIRMED',escalated:true,handoffConfirmed:true,messages:[]});
  await view.send('رسالة لم تكتمل',{ok:false,error:'تعذر الاتصال بالخدمة'});
  assert.equal(view.io.requests.length,1);
  assert.match(view.text(),/رسالة لم تكتمل/);
  assert.match(view.text(),/تعذر الاتصال بالخدمة/);
  assert.equal(allElements(view.render(),node=>node.props?.role==='alert').length,1);
});
