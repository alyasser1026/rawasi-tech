import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeTgHtml,
  parseDeviceAndBrowser,
  parseReferralSource,
  isBotOrCrawler,
  sendLoginNotification,
  sendVisitorNotification,
  sendLeadActionNotification,
} from '../lib/telegram-notifier.ts';

test('Telegram HTML escaper safely handles special characters', () => {
  assert.equal(escapeTgHtml('<script>alert("test") & \'1\'</script>'), '&lt;script&gt;alert(&quot;test&quot;) &amp; &#39;1&#39;&lt;/script&gt;');
  assert.equal(escapeTgHtml(null), '');
  assert.equal(escapeTgHtml(undefined), '');
});

test('parseDeviceAndBrowser detects devices and in-app browsers accurately', () => {
  const tiktokIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_28.0.0 ByteLocale/en';
  const res1 = parseDeviceAndBrowser(tiktokIos);
  assert.match(res1.device, /iPhone/);
  assert.match(res1.os, /iOS 17/);
  assert.match(res1.browser, /TikTok/);

  const androidChrome = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const res2 = parseDeviceAndBrowser(androidChrome);
  assert.match(res2.device, /Android|SM-S918B/);
  assert.match(res2.os, /Android 14/);
  assert.match(res2.browser, /Google Chrome/);

  const winEdge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
  const res3 = parseDeviceAndBrowser(winEdge);
  assert.match(res3.device, /PC/);
  assert.match(res3.os, /Windows/);
  assert.match(res3.browser, /Edge/);
});

test('parseReferralSource identifies TikTok, Instagram, Google and direct visits', () => {
  assert.match(parseReferralSource('https://www.tiktok.com/@phitech', ''), /تيك توك/);
  assert.match(parseReferralSource('', 'musical_ly_28.0.0'), /تيك توك/);
  assert.match(parseReferralSource('https://www.instagram.com/', ''), /إنستغرام/);
  assert.match(parseReferralSource('https://www.google.com/search?q=phitech', ''), /جوجل/);
  assert.match(parseReferralSource('', ''), /زيارة مباشرة/);
  assert.match(parseReferralSource('direct', ''), /زيارة مباشرة/);
});

test('isBotOrCrawler rejects search engine bots and crawlers while allowing human user agents', () => {
  assert.equal(isBotOrCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(isBotOrCrawler('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'), true);
  assert.equal(isBotOrCrawler('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'), true);

  // Real human UA
  assert.equal(isBotOrCrawler('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false);
  assert.equal(isBotOrCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'), false);
});

test('sendLoginNotification dispatches expected HTML payload and inline button to Telegram API', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    if (String(url).includes('api.telegram.org')) {
      interceptedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1234 } }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  try {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
    process.env.TELEGRAM_CHAT_ID = 'mock_chat_id';

    const ok = await sendLoginNotification({
      type: 'login',
      userId: 'usr-1',
      email: 'engineer@phi-tech.org',
      fullName: 'م. أحمد مهدي',
      role: 'staff',
      destination: '/Dashboard',
      ip: '197.55.20.10',
      country: 'EG',
      city: 'Cairo',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    });

    assert.equal(ok, true);
    assert.equal(interceptedBody.chat_id, 'mock_chat_id');
    assert.equal(interceptedBody.parse_mode, 'HTML');
    assert.match(interceptedBody.text, /تسجيل دخول جديد إلى النظام/);
    assert.match(interceptedBody.text, /م\. أحمد مهدي/);
    assert.match(interceptedBody.text, /engineer@phi-tech\.org/);
    assert.match(interceptedBody.text, /مهندس \/ كادر فني/);
    assert.match(interceptedBody.text, /مصر 🇪🇬/);
    assert.match(interceptedBody.text, /197\.55\.20\.10/);
    assert.equal(interceptedBody.reply_markup.inline_keyboard[0][0].url.includes('197.55.20.10'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendVisitorNotification dispatches expected HTML payload, UTM parameters, and inline button', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    if (String(url).includes('api.telegram.org')) {
      interceptedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5678 } }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  try {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
    process.env.TELEGRAM_CHAT_ID = 'mock_chat_id';

    // 1. Bot check -> should return ok: false, reason: bot_ignored
    const botRes = await sendVisitorNotification({
      path: '/',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    assert.equal(botRes.reason, 'bot_ignored');
    assert.equal(interceptedBody, null);

    // 2. Real visitor from TikTok with UTM campaign
    const visRes = await sendVisitorNotification({
      path: '/',
      referrer: 'https://www.tiktok.com/@phitech',
      screen: '390×844',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 musical_ly_28.0.0',
      ip: '156.200.10.5',
      country: 'SA',
      city: 'Riyadh',
      utmSource: 'tiktok',
      utmCampaign: 'finishing_promo',
      connection: '4g',
      language: 'ar-SA',
    });

    assert.equal(visRes.ok, true);
    assert.notEqual(interceptedBody, null);
    assert.match(interceptedBody.text, /زائر جديد يتصفح الموقع الآن/);
    assert.match(interceptedBody.text, /تيك توك/);
    assert.match(interceptedBody.text, /الحملة الإعلانية/);
    assert.match(interceptedBody.text, /finishing_promo/);
    assert.match(interceptedBody.text, /آيفون/);
    assert.match(interceptedBody.text, /المملكة العربية السعودية 🇸🇦/);
    assert.match(interceptedBody.text, /156\.200\.10\.5/);
    assert.match(interceptedBody.text, /390×844/);
    assert.match(interceptedBody.text, /4G/);
    assert.equal(interceptedBody.reply_markup.inline_keyboard[0][0].url.includes('156.200.10.5'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendLeadActionNotification notifies Telegram when visitor clicks WhatsApp contact', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    if (String(url).includes('api.telegram.org')) {
      interceptedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 9999 } }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  try {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
    process.env.TELEGRAM_CHAT_ID = 'mock_chat_id';

    const ok = await sendLeadActionNotification({
      action: 'whatsapp_click',
      label: 'تواصل معنا عبر واتساب',
      ip: '197.35.40.12',
      country: 'EG',
      city: 'Cairo',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });

    assert.equal(ok, true);
    assert.match(interceptedBody.text, /تنبيه عميل محتمل/);
    assert.match(interceptedBody.text, /تواصل معنا عبر واتساب/);
    assert.match(interceptedBody.text, /مصر 🇪🇬/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
