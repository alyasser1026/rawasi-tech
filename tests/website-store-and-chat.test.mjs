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
