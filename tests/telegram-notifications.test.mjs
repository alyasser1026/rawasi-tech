import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeTgHtml,
  normalizePhoneForWhatsApp,
  parseDeviceAndBrowser,
  parseReferralSource,
  isBotOrCrawler,
  sendLoginNotification,
  sendVisitorNotification,
  sendLeadActionNotification,
} from '../lib/telegram-notifier.ts';

test('Telegram HTML escaper safely handles special characters', () => {
  assert.equal(
    escapeTgHtml('<script>alert("test") & \'1\'</script>'),
    '&lt;script&gt;alert(&quot;test&quot;) &amp; &#39;1&#39;&lt;/script&gt;'
  );
  assert.equal(escapeTgHtml(null), '');
  assert.equal(escapeTgHtml(undefined), '');
});

test('normalizePhoneForWhatsApp normalizes Egyptian, Saudi, and international numbers', () => {
  assert.equal(normalizePhoneForWhatsApp('01012345678'), '201012345678');
  assert.equal(normalizePhoneForWhatsApp('0501234567'), '966501234567');
  assert.equal(normalizePhoneForWhatsApp('+20 155-888-8744'), '201558888744');
  assert.equal(normalizePhoneForWhatsApp('00966551234567'), '966551234567');
  assert.equal(normalizePhoneForWhatsApp('12345'), null);
  assert.equal(normalizePhoneForWhatsApp(''), null);
});

test('parseDeviceAndBrowser detects devices, marketing models, OS versions, and in-app browsers accurately', () => {
  const tiktokIos =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.1.0 ByteLocale/ar';
  const res1 = parseDeviceAndBrowser(tiktokIos);
  assert.match(res1.device, /iPhone/);
  assert.match(res1.os, /iOS 17\.5/);
  assert.match(res1.browser, /TikTok/);

  const androidChrome =
    'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const res2 = parseDeviceAndBrowser(androidChrome);
  assert.match(res2.device, /Samsung Galaxy S24 Ultra/);
  assert.match(res2.os, /Android 14/);
  assert.match(res2.browser, /Google Chrome 126/);

  const redactedAndroidWithHint =
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
  const resHint = parseDeviceAndBrowser(redactedAndroidWithHint, 'SM-A556E');
  assert.match(resHint.device, /Samsung Galaxy A55/);

  const winEdge =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
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

  assert.equal(isBotOrCrawler('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false);
  assert.equal(isBotOrCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'), false);
});

test('sendLoginNotification dispatches phone, hardware telemetry, and WhatsApp inline button', async () => {
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
      phone: '01026332733',
      role: 'staff',
      destination: '/Dashboard',
      ip: '197.55.20.10',
      country: 'EG',
      city: 'Cairo',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      deviceDetails: {
        visitorId: 'V-ABC123',
        cpuCores: 8,
        ramGb: 16,
        gpu: 'ANGLE (NVIDIA GeForce RTX 3060)',
        batteryLevel: 85,
        batteryCharging: true,
      },
    });

    assert.equal(ok, true);
    assert.equal(interceptedBody.chat_id, 'mock_chat_id');
    assert.equal(interceptedBody.parse_mode, 'HTML');
    assert.match(interceptedBody.text, /تسجيل دخول جديد إلى النظام/);
    assert.match(interceptedBody.text, /م\. أحمد مهدي/);
    assert.match(interceptedBody.text, /01026332733/);
    assert.match(interceptedBody.text, /engineer@phi-tech\.org/);
    assert.match(interceptedBody.text, /#V-ABC123/);
    assert.match(interceptedBody.text, /8 أنوية CPU/);
    assert.match(interceptedBody.text, /16 GB RAM/);
    assert.match(interceptedBody.text, /NVIDIA GeForce RTX 3060/);
    assert.match(interceptedBody.text, /بطارية 85%/);
    assert.match(interceptedBody.text, /مصر 🇪🇬/);
    assert.match(interceptedBody.text, /197\.55\.20\.10/);

    const buttons = interceptedBody.reply_markup.inline_keyboard.flat();
    assert.equal(buttons.some((b) => b.url === 'https://wa.me/201026332733'), true);
    assert.equal(buttons.some((b) => b.url.includes('197.55.20.10')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendVisitorNotification renders Visitor ID, hardware specs, ISP intel, maps button, and ignores bots', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    const u = String(url);
    if (u.includes('ip-api.com')) {
      return new Response(
        JSON.stringify({
          status: 'success',
          country: 'Saudi Arabia',
          countryCode: 'SA',
          regionName: 'Riyadh Region',
          city: 'Riyadh',
          lat: 24.7136,
          lon: 46.6753,
          timezone: 'Asia/Riyadh',
          isp: 'Saudi Telecom Company (STC)',
          mobile: true,
          proxy: false,
        }),
        { status: 200 }
      );
    }
    if (u.includes('api.telegram.org')) {
      interceptedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5678 } }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  try {
    // Allow ip-api mock lookup in test unless NODE_ENV==='test' forces bypass
    process.env.TELEGRAM_BOT_TOKEN = 'test_mock_token_with_geo';
    process.env.TELEGRAM_CHAT_ID = 'mock_chat_id';

    // 1. Bot check -> should return ok: false, reason: bot_ignored
    const botRes = await sendVisitorNotification({
      path: '/',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    assert.equal(botRes.reason, 'bot_ignored');
    assert.equal(interceptedBody, null);

    // 2. Real visitor from TikTok with hardware telemetry & known identity
    const visRes = await sendVisitorNotification({
      path: '/',
      referrer: 'https://www.tiktok.com/@phitech',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 musical_ly_35.0.0',
      ip: '212.102.44.88',
      country: 'SA',
      city: 'Riyadh',
      utmSource: 'tiktok',
      utmCampaign: 'finishing_promo',
      deviceDetails: {
        visitorId: 'V-9X8Y7Z',
        visitCount: 3,
        knownName: 'خالد العتيبي',
        knownPhone: '0501234567',
        screen: '390×844',
        pixelRatio: 3,
        colorScheme: 'dark',
        cpuCores: 6,
        ramGb: 8,
        gpu: 'Apple GPU',
        batteryLevel: 64,
        batteryCharging: false,
        connection: '4g',
        downlinkMbps: 24.5,
        language: 'ar-SA',
      },
    });

    assert.equal(visRes.ok, true);
    assert.notEqual(interceptedBody, null);
    assert.match(interceptedBody.text, /زائر جديد يتصفح الموقع الآن/);
    assert.match(interceptedBody.text, /خالد العتيبي/);
    assert.match(interceptedBody.text, /0501234567/);
    assert.match(interceptedBody.text, /#V-9X8Y7Z/);
    assert.match(interceptedBody.text, /الزيارة رقم 3 لهذا الجهاز/);
    assert.match(interceptedBody.text, /6 أنوية CPU/);
    assert.match(interceptedBody.text, /8 GB RAM/);
    assert.match(interceptedBody.text, /Apple GPU/);
    assert.match(interceptedBody.text, /بطارية 64%/);
    assert.match(interceptedBody.text, /3x Retina/);
    assert.match(interceptedBody.text, /4G/);
    assert.match(interceptedBody.text, /المملكة العربية السعودية 🇸🇦/);

    const buttons = interceptedBody.reply_markup.inline_keyboard.flat();
    assert.equal(buttons.some((b) => b.url === 'https://wa.me/966501234567'), true);
    if (process.env.NODE_ENV !== 'test') {
      assert.match(interceptedBody.text, /Saudi Telecom Company \(STC\)/);
      assert.match(interceptedBody.text, /بيانات جوال/);
      assert.equal(buttons.some((b) => b.url.includes('google.com/maps?q=24.7136,46.6753')), true);
    }
    assert.equal(buttons.some((b) => b.url.includes('212.102.44.88')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendLeadActionNotification includes captured phone, project inquiry details, and WhatsApp button', async () => {
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
      action: 'inquiry_form',
      label: 'إرسال طلب معاينة ومقايسة',
      name: 'م. طارق منصور',
      phone: '01099887766',
      projectKind: 'فيلا',
      projectLocation: 'التجمع الخامس',
      notes: 'تشطيب سوبر لوكس + تكييف مخفي',
      ip: '197.35.40.12',
      country: 'EG',
      city: 'Cairo',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      deviceDetails: {
        visitorId: 'V-LEAD01',
      },
    });

    assert.equal(ok, true);
    assert.match(interceptedBody.text, /تنبيه عميل محتمل/);
    assert.match(interceptedBody.text, /م\. طارق منصور/);
    assert.match(interceptedBody.text, /01099887766/);
    assert.match(interceptedBody.text, /فيلا/);
    assert.match(interceptedBody.text, /التجمع الخامس/);
    assert.match(interceptedBody.text, /تكييف مخفي/);
    assert.match(interceptedBody.text, /#V-LEAD01/);
    assert.match(interceptedBody.text, /مصر 🇪🇬/);

    const buttons = interceptedBody.reply_markup.inline_keyboard.flat();
    assert.equal(buttons.some((b) => b.url === 'https://wa.me/201099887766'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
