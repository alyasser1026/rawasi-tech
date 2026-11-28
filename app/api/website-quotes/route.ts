import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeAdminRequest } from '@/lib/admin-authorization';
import { checkIpRateLimit } from '@/lib/api-rate-limit';

export const runtime = 'nodejs';

const PRIVATE_CACHE_CONTROL = 'private, no-store';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase admin configuration');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sendTelegramAlert(quote: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg = [
    `🏗️ <b>طلب مقايسة جديد — فاي تك | PHI TECH</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>العميل:</b> ${quote.name}`,
    `📱 <b>الهاتف:</b> <code>${quote.phone}</code>`,
    `📍 <b>الموقع:</b> ${quote.location}`,
    `📦 <b>نطاق الأعمال:</b> ${quote.package}`,
    quote.bua ? `📐 <b>المسافة البنائية (BUA):</b> ${quote.bua} م²` : null,
    quote.totalBudget ? `💰 <b>الميزانية المحسوبة:</b> ${quote.totalBudget} ${quote.currency || 'ج.م'}` : null,
    quote.notes ? `📝 <b>تفاصيل:</b>\n<i>${quote.notes}</i>` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔖 <b>رقم المرجع:</b> <code>${quote.id}</code>`,
    `⏰ <b>التاريخ:</b> ${new Date(quote.createdAt).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`
  ].filter(Boolean).join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.warn('Failed to send Telegram alert for website quote:', err);
  }
}

export async function POST(req: Request) {
  try {
    const rate = checkIpRateLimit(req, 'website-quotes', 10, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'تم إرسال عدة طلبات في وقت قصير، يرجى المحاولة بعد دقيقة.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, phone, package: pkg, location, notes, bua, totalBudget, currency } = body;

    if (!name || !phone || String(phone).replace(/\D/g, '').length < 8) {
      return NextResponse.json({ error: 'الاسم ورقم الهاتف الصحيح مطلوبان' }, { status: 400 });
    }

    const refId = `PHI-Q-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newQuote = {
      id: refId,
      name: String(name).trim().slice(0, 120),
      phone: String(phone).trim().slice(0, 32),
      package: String(pkg || 'غير محدد').trim().slice(0, 120),
      location: String(location || 'غير محدد').trim().slice(0, 200),
      notes: String(notes || '').trim().slice(0, 1500),
      bua: bua || null,
      totalBudget: totalBudget || null,
      currency: currency || 'ج.م',
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    // 1. Save persistently in Supabase user_requests table
    const adminSb = getAdminClient();
    const { error: insertErr } = await adminSb.from('user_requests').insert({
      user_id: null,
      type: 'website_quote',
      category: refId,
      subject: `${newQuote.name} — ${newQuote.phone}`,
      details: JSON.stringify(newQuote),
      status: 'new',
    });
    if (insertErr) {
      throw new Error(insertErr.message);
    }

    // 2. Dispatch Telegram Alert in background
    sendTelegramAlert(newQuote).catch(() => {});

    // 3. Try to push notification to admins in Supabase
    try {
      const { data: adminProfiles } = await adminSb
        .from('profiles')
        .select('id')
        .or('role.eq.admin,is_admin.eq.true')
        .limit(10);

      if (adminProfiles && adminProfiles.length > 0) {
        const notifs = adminProfiles.map(admin => ({
          user_id: admin.id,
          message: `طلب مقايسة جديد من الموقع: ${newQuote.name} (${newQuote.package}) - ${newQuote.location}`,
          type: 'alert',
          is_read: false,
          created_at: new Date().toISOString()
        }));
        await adminSb.from('notifications').insert(notifs);
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      refId,
      message: 'تم استلام طلب المقايسة وتسجيله في النظام بنجاح.'
    });
  } catch (error: any) {
    console.error('Error handling website quote submission:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const headers = { 'Cache-Control': PRIVATE_CACHE_CONTROL };

  let adminClient: ReturnType<typeof getAdminClient>;
  try {
    const auth = await authorizeAdminRequest(req, getAdminClient);
    if (auth.error) {
      auth.error.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
      return auth.error;
    }
    adminClient = auth.client;
  } catch {
    return NextResponse.json(
      { error: 'تعذر التحقق من صلاحية عرض طلبات المقايسة.' },
      { status: 503, headers },
    );
  }

  try {
    const { data, error } = await adminClient
      .from('user_requests')
      .select('id, category, subject, details, status, created_at')
      .eq('type', 'website_quote')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const quotes = (data || []).map((row) => {
      let parsed: Record<string, any> = {};
      try {
        parsed = row.details ? JSON.parse(row.details) : {};
      } catch {
        parsed = {};
      }
      return {
        ...parsed,
        id: parsed.id || row.category || row.id,
        status: row.status || parsed.status || 'new',
        createdAt: parsed.createdAt || row.created_at,
      };
    });

    return NextResponse.json({ quotes }, { headers });
  } catch {
    return NextResponse.json({ quotes: [] }, { headers });
  }
}
