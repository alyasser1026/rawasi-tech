import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('store-catalog defines all 9 engineering/finishing categories, default products, bundles, and properties', () => {
  const catalog = read('app/site/store-catalog.ts');

  const requiredCategories = [
    'electrical',
    'plumbing',
    'paint',
    'ceramics',
    'marble',
    'decor',
    'smart_home',
    'low_current',
    'safety_sensors',
  ];

  for (const catId of requiredCategories) {
    assert.match(catalog, new RegExp(`id:\\s*'${catId}'`), `Missing category ${catId}`);
  }

  assert.match(catalog, /export const DEFAULT_PRODUCTS/);
  assert.match(catalog, /export const SMART_BUNDLES/);
  assert.match(catalog, /export const DEFAULT_PROPERTIES/);
  assert.match(catalog, /حساس/);
});

test('site-content merges and sanitizes products, properties, and promoBanner', () => {
  const siteContent = read('app/site/site-content.ts');
  assert.match(siteContent, /products\?:\s*WebsiteProduct\[\]/);
  assert.match(siteContent, /properties\?:\s*WebsiteProperty\[\]/);
  assert.match(siteContent, /promoBanner\?:/);
  assert.match(siteContent, /PRODUCTS:\s*o\.products\s*\?\?\s*DEFAULT_PRODUCTS/);
  assert.match(siteContent, /PROPERTIES:\s*o\.properties\s*\?\?\s*DEFAULT_PROPERTIES/);
});

test('authenticated customer shopping cart and live chat components exist with required features', () => {
  const cartDrawer = read('app/site/CartDrawer.tsx');
  assert.match(cartDrawer, /export function useCustomerCart/);
  assert.match(cartDrawer, /export function CartDrawer/);
  assert.match(cartDrawer, /withInstall/);
  assert.match(cartDrawer, /\/api\/website-store/);
  assert.match(cartDrawer, /phi_pending_cart_add_v1/);

  const floatingChat = read('app/site/FloatingContactChat.tsx');
  assert.match(floatingChat, /wa\.me/);
  assert.match(floatingChat, /\/api\/website-chat/);
  assert.match(floatingChat, /شات حي فوري/);
});

test('store and real-estate pages and clients are wired with cart, live chat, and login modal', () => {
  const storePage = read('app/store/page.tsx');
  assert.match(storePage, /StoreClient/);

  const storeClient = read('app/site/StoreClient.tsx');
  assert.match(storeClient, /PRODUCT_CATEGORIES/);
  assert.match(storeClient, /SMART_BUNDLES/);
  assert.match(storeClient, /CartDrawer/);
  assert.match(storeClient, /FloatingContactChat/);
  assert.match(storeClient, /LoginModal/);

  const realEstatePage = read('app/real-estate/page.tsx');
  assert.match(realEstatePage, /RealEstateClient/);

  const realEstateClient = read('app/site/RealEstateClient.tsx');
  assert.match(realEstateClient, /property_inquiry/);
  assert.match(realEstateClient, /CartDrawer/);
  assert.match(realEstateClient, /FloatingContactChat/);
});

test('website-admin includes full control over products, properties, orders, and livechat', () => {
  const adminPage = read('app/website-admin/page.tsx');
  assert.match(adminPage, /id:\s*'products',\s*label:\s*'📦 المنتجات والعروض'/);
  assert.match(adminPage, /id:\s*'properties',\s*label:\s*'🏢 عروض العقارات'/);
  assert.match(adminPage, /id:\s*'orders',\s*label:\s*'🛍️ طلبات السلة والعقارات'/);
  assert.match(adminPage, /id:\s*'livechat',\s*label:\s*'💬 الشات الحي مع الزوار'/);
  assert.match(adminPage, /compressImageToDataUrl/);
  assert.match(adminPage, /\/api\/website-store/);
  assert.match(adminPage, /\/api\/website-chat/);
});

test('backend APIs for website-store and website-chat notify Telegram and store records', () => {
  const storeApi = read('app/api/website-store/route.ts');
  assert.match(storeApi, /api\.telegram\.org/);
  assert.match(storeApi, /store_order/);
  assert.match(storeApi, /property_inquiry/);

  const chatApi = read('app/api/website-chat/route.ts');
  assert.match(chatApi, /api\.telegram\.org/);
  assert.match(chatApi, /live_chat/);
});

test('execution & maintenance services tab covers all trades with recommendations and CMS/API support', () => {
  const catalog = read('app/site/store-catalog.ts');
  assert.match(catalog, /export const DEFAULT_MAINTENANCE_SERVICES/);
  assert.match(catalog, /category:\s*'hvac'/);
  assert.match(catalog, /executionScope:/);
  assert.match(catalog, /maintenanceScope:/);
  assert.match(catalog, /recommendation:/);
  assert.match(catalog, /visitFee:\s*0/);

  const siteContent = read('app/site/site-content.ts');
  assert.match(siteContent, /maintenanceServices\?:\s*WebsiteMaintenanceService\[\]/);
  assert.match(siteContent, /MAINTENANCE_SERVICES:\s*o\.maintenanceServices\s*\?\?\s*DEFAULT_MAINTENANCE_SERVICES/);

  const storeClient = read('app/site/StoreClient.tsx');
  assert.match(storeClient, /handleOpenMaintenanceModal/);
  assert.match(storeClient, /handleAddMaintenanceToCart/);
  assert.match(storeClient, /handleSubmitMaintenanceRequest/);
  assert.match(storeClient, /حجز خدمة تنفيذ أو صيانة هندسية/);

  const phiSite = read('app/site/PhiSite.tsx');
  assert.match(phiSite, /\/store\?tab=maintenance/);

  const adminPage = read('app/website-admin/page.tsx');
  assert.match(adminPage, /id:\s*'maintenance',\s*label:\s*'🛠️ التنفيذ والصيانة'/);
  assert.match(adminPage, /maintenance_request/);

  const storeApi = read('app/api/website-store/route.ts');
  assert.match(storeApi, /maintenance_request/);
});

test('interactive live-chat auto-responder covers expected scenarios, human escalation, and CMS controls', () => {
  const responder = read('app/site/chat-auto-responder.ts');
  assert.match(responder, /export function generateSmartAutoReply/);
  assert.match(responder, /export const DEFAULT_CHAT_BOT_CONFIG/);
  for (const intentName of [
    'human_handoff',
    'lead_qualified',
    'finishing_quote',
    'safety_sensors',
    'smart_home_low_current',
    'maintenance_execution',
    'real_estate',
    'fallback_escalate',
  ]) {
    assert.match(responder, new RegExp(`intent:\\s*'${intentName}'`), `Missing intent ${intentName}`);
  }
  assert.match(responder, /needsHuman:\s*true/);

  const siteContent = read('app/site/site-content.ts');
  assert.match(siteContent, /chatBotConfig\?:\s*Partial<ChatBotConfig>/);
  assert.match(siteContent, /CHAT_BOT:/);

  const chatApi = read('app/api/website-chat/route.ts');
  assert.match(chatApi, /generateEgyptianColloquialAiReply/);
  assert.match(chatApi, /escalatedToHuman/);
  assert.match(chatApi, /botPaused/);
  assert.match(chatApi, /تحويل عاجل من الرد الآلي/);

  assert.match(responder, /export async function generateEgyptianColloquialAiReply/);
  assert.match(responder, /منورنا يا أستاذ/);
  assert.match(responder, /ع الطوب/);
  assert.match(responder, /من غير تكسير/);

  const floatingChat = read('app/site/FloatingContactChat.tsx');
  assert.match(floatingChat, /requestHuman/);
  assert.match(floatingChat, /quickReplies/);
  assert.match(floatingChat, /actions/);
  assert.match(floatingChat, /تحويل لمهندس/);
  assert.match(floatingChat, /phi-chat-input/);
  assert.match(floatingChat, /-webkit-text-fill-color:\s*#0f172a/);

  assert.match(responder, /export function extractNameFromMessage/);
  assert.match(responder, /export function extractPhoneFromMessage/);
  assert.match(responder, /intent:\s*'ask_for_name'/);
  assert.match(responder, /nextStage:\s*'awaiting_name'/);
  assert.match(responder, /nextStage:\s*'awaiting_phone'/);

  const adminPage = read('app/website-admin/page.tsx');
  assert.match(adminPage, /chatBotConfig/);
  assert.match(adminPage, /escalatedToHuman/);
  assert.match(adminPage, /botPaused/);
});
