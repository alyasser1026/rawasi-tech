import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decodeHtmlEntities, inferNewsTopicAndHref, parseRssXml } from '../lib/rssNewsParser.ts';

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
  assert.doesNotMatch(floatingChat, /wa\.me/);
  assert.match(floatingChat, /\/api\/website-chat/);
  assert.match(floatingChat, /شات حي فوري/);

  const phiSite = read('app/site/PhiSite.tsx');
  assert.match(phiSite, /wa\.me/);
  assert.match(phiSite, /PublicHeader/);

  const publicHeader = read('app/site/PublicHeader.tsx');
  assert.match(publicHeader, /pw-header-glass/);
  assert.match(publicHeader, /pw-mobile-dock/);
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

  const publicHeader = read('app/site/PublicHeader.tsx');
  assert.match(publicHeader, /\/sections\/maintenance/);
  const phiSite = read('app/site/PhiSite.tsx');
  assert.match(phiSite, /PUBLIC_NAV_ITEMS/);

  const sectionClient = read('app/site/SectionDetailClient.tsx');
  assert.match(sectionClient, /\/store\?tab=maintenance/);

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
  assert.match(responder, /تشرفنا يا أستاذ/);
  assert.match(responder, /skipGreeting:\s*true/);
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

test('all public website pages share unified Homepage standard header, hero band, and footer', () => {
  const publicHeader = read('app/site/PublicHeader.tsx');
  assert.match(publicHeader, /export const PUBLIC_NAV_ITEMS/);
  assert.match(publicHeader, /pw-header-glass/);
  assert.match(publicHeader, /pw-mobile-dock/);

  const siteStyles = read('app/site/site-styles.ts');
  assert.match(siteStyles, /\.pw-unified-hero\{/);
  assert.match(siteStyles, /\.pw-unified-crumb\{/);
  assert.match(siteStyles, /\.pw-header\.pw-header-glass \.pw-nav a\.is-nav-active/);

  for (const rel of [
    'app/site/PhiSite.tsx',
    'app/site/SectionDetailClient.tsx',
    'app/site/StoreClient.tsx',
    'app/site/RealEstateClient.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /<PublicHeader/, `${rel} must mount shared PublicHeader`);
    assert.match(src, /PUBLIC_NAV_ITEMS/, `${rel} footer must use PUBLIC_NAV_ITEMS`);
    assert.match(src, /className="pw-footer"/, `${rel} must use unified .pw-footer`);
    assert.doesNotMatch(src, /pw-header-solid/, `${rel} must not use legacy dark header`);
  }

  for (const rel of [
    'app/site/SectionDetailClient.tsx',
    'app/site/StoreClient.tsx',
    'app/site/RealEstateClient.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /pw-unified-hero/, `${rel} must use light unified hero`);
    assert.match(src, /pw-unified-crumb/, `${rel} must use clean unified breadcrumb`);
  }

  const realEstateClient = read('app/site/RealEstateClient.tsx');
  assert.doesNotMatch(realEstateClient, /\.re-hero/);
  assert.match(realEstateClient, /filteredProps\.length === 0/);

  const storeClient = read('app/site/StoreClient.tsx');
  assert.doesNotMatch(storeClient, /\.st-hero/);
});

test('home screen renders seamless infinite looping news ticker with CMS controls', () => {
  const tickerComp = read('app/site/NewsTicker.tsx');
  assert.match(tickerComp, /phi-ticker-bar/);
  assert.match(tickerComp, /phi-ticker-track/);
  assert.match(tickerComp, /requestAnimationFrame/);
  assert.match(tickerComp, /\/api\/news-feed/);
  assert.match(tickerComp, /renderGroup\('g1', false\)/);
  assert.match(tickerComp, /renderGroup\('g2', true\)/);

  const siteStyles = read('app/site/site-styles.ts');
  assert.match(siteStyles, /\.phi-ticker-viewport\{[^}]*direction:ltr/);
  assert.match(siteStyles, /\.phi-ticker-track\{display:flex;flex-direction:row/);
  assert.doesNotMatch(siteStyles, /\.phi-ticker-track\{animation:none\}/);

  const siteContent = read('app/site/site-content.ts');
  assert.match(siteContent, /export const DEFAULT_NEWS_TICKER/);
  assert.match(siteContent, /NEWS_TICKER:/);
  assert.match(siteContent, /if \(raw\.newsTicker/);

  const homePortal = read('app/site/HomePortalSections.tsx');
  assert.match(homePortal, /<NewsTicker/);

  const phiSite = read('app/site/PhiSite.tsx');
  assert.match(phiSite, /NEWS_TICKER/);
  assert.match(phiSite, /newsTicker=\{NEWS_TICKER\}/);

  const adminPage = read('app/website-admin/page.tsx');
  assert.match(adminPage, /newsTicker/);
  assert.match(adminPage, /شريط آخر الأخبار المتحرك/);
  assert.match(adminPage, /\/api\/news-feed/);
  assert.match(adminPage, /fetchDailyNews/);
});

test('rssNewsParser parses Arabic RSS feeds cleanly and maps topics to PhiTech sections', () => {
  assert.equal(decodeHtmlEntities('<![CDATA[ارتفاع &quot;أسعار الأسمنت&quot; &amp; الحديد]]>'), 'ارتفاع "أسعار الأسمنت" & الحديد');
  assert.deepEqual(inferNewsTopicAndHref('استقرار أسعار الأسمنت والحديد اليوم'), {
    tag: 'مواد البناء',
    suggestedHref: '/sections/materials',
  });
  assert.deepEqual(inferNewsTopicAndHref('انتعاش السوق العقاري وبيع شقق جديدة'), {
    tag: 'عقارات',
    suggestedHref: '/sections/real-estate',
  });

  const sampleXml = `<rss><channel>
    <item>
      <title><![CDATA[ارتفاع الرقم القياسي لأسعار العقارات في السعودية بنسبة 1.2% - العربية]]></title>
      <link>https://example.com/news/1</link>
      <pubDate>Mon, 16 Nov 2026 07:00:00 GMT</pubDate>
    </item>
    <item>
      <title>تجاهل رابط غير آمن</title>
      <link>javascript:alert(1)</link>
    </item>
  </channel></rss>`;

  const parsed = parseRssXml(sampleXml, 'مصدر افتراضي', 'اقتصاد', 10);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'ارتفاع الرقم القياسي لأسعار العقارات في السعودية بنسبة 1.2%');
  assert.equal(parsed[0].source, 'العربية');
  assert.equal(parsed[0].tag, 'عقارات');
  assert.equal(parsed[0].suggestedHref, '/sections/real-estate');
  assert.equal(parsed[1].link, '');

  const apiRoute = read('app/api/news-feed/route.ts');
  assert.match(apiRoute, /snabusiness\.com\/rss\/iqtisad\/rss\.xml/);
  assert.match(apiRoute, /cnnbusinessarabic\.com\/rssFeed\/0/);
  assert.match(apiRoute, /news\.google\.com\/rss\/search/);
});

test('every portal section has a valid local showcase image wired into home cards and detail hero', () => {
  const sectionDefs = read('app/site/section-defs.ts');
  const slugs = ['maintenance', 'contracting', 'real-estate', 'materials', 'smart-home', 'info'];

  for (const slug of slugs) {
    assert.match(sectionDefs, new RegExp(`image:\\s*'/sections/${slug}\\.jpg'`));
    const absImg = path.join(root, 'public', 'sections', `${slug}.jpg`);
    assert.equal(fs.existsSync(absImg), true, `Missing public/sections/${slug}.jpg`);
    assert.ok(fs.statSync(absImg).size > 20_000, `Expected non-trivial image for ${slug}.jpg`);
  }

  const homePortal = read('app/site/HomePortalSections.tsx');
  assert.match(homePortal, /pw-portal-media/);
  assert.match(homePortal, /src=\{sec\.image\}/);
  assert.match(homePortal, /alt=\{sec\.imageAlt\}/);

  const detailClient = read('app/site/SectionDetailClient.tsx');
  assert.match(detailClient, /pw-sec-hero-visual/);
  assert.match(detailClient, /src=\{sectionMeta\.image\}/);
  assert.match(detailClient, /alt=\{sectionMeta\.imageAlt\}/);
});
