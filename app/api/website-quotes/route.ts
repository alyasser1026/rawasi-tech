import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), 'data0');
const QUOTES_FILE = path.join(DATA_DIR, 'website_quotes.json');

async function ensureFileExists() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(QUOTES_FILE);
    } catch {
      await fs.writeFile(QUOTES_FILE, '[]', 'utf8');
    }
  } catch (err) {
    console.error('Error ensuring quotes file:', err);
  }
}

async function sendTelegramAlert(quote: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg = [
    `🏗️ <b>طلب مقايسة جديد — PHI CONSTRUCT</b>`,
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
    const body = await req.json();
    const { name, phone, package: pkg, location, notes, bua, totalBudget, currency } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'الاسم ورقم الهاتف مطلوبان' }, { status: 400 });
    }

    const refId = `PHI-Q-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newQuote = {
      id: refId,
      name: String(name).trim(),
      phone: String(phone).trim(),
      package: String(pkg || 'غير محدد').trim(),
      location: String(location || 'غير محدد').trim(),
      notes: String(notes || '').trim(),
      bua: bua || null,
      totalBudget: totalBudget || null,
      currency: currency || 'ج.م',
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    // 1. Save to local JSON storage
    await ensureFileExists();
    let quotes = [];
    try {
      const raw = await fs.readFile(QUOTES_FILE, 'utf8');
      quotes = JSON.parse(raw);
    } catch {
      quotes = [];
    }
    quotes.unshift(newQuote);
    await fs.writeFile(QUOTES_FILE, JSON.stringify(quotes, null, 2), 'utf8');

    // 2. Dispatch Telegram Alert in background
    sendTelegramAlert(newQuote).catch(() => {});

    // 3. Try to push notification to admins in Supabase if notifications table is active
    try {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,is_admin.eq.true')
        .limit(10);

      if (adminProfiles && adminProfiles.length > 0) {
        const notifs = adminProfiles.map(admin => ({
          user_id: admin.id,
          message: `طلب مقايسة جديد من موقع PHI CONSTRUCT: ${newQuote.name} (${newQuote.package}) - ${newQuote.location}`,
          type: 'alert',
          is_read: false,
          created_at: new Date().toISOString()
        }));
        await supabase.from('notifications').insert(notifs);
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

export async function GET() {
  try {
    await ensureFileExists();
    const raw = await fs.readFile(QUOTES_FILE, 'utf8');
    const quotes = JSON.parse(raw);
    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ quotes: [] });
  }
}
