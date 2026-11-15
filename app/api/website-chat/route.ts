import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizePhoneForWhatsApp } from '@/lib/telegram-notifier';
import { mergeContent, sanitizeContent } from '@/app/site/site-content';
import {
  generateSmartAutoReply,
  type ChatBotActionLink,
} from '@/app/site/chat-auto-responder';

export const runtime = 'nodejs';

export interface ChatMessageItem {
  id: string;
  sender: 'visitor' | 'admin';
  senderName: string;
  text: string;
  createdAt: string;
  isAutoReply?: boolean;
  intent?: string;
  quickReplies?: string[];
  actions?: ChatBotActionLink[];
}

export interface ChatSessionPayload {
  sessionId: string;
  visitorName: string;
  visitorPhone: string;
  pageUrl?: string;
  updatedAt: string;
  unreadByAdmin?: number;
  escalatedToHuman?: boolean;
  escalationReason?: string;
  escalatedAt?: string;
  botPaused?: boolean;
  lastIntent?: string;
  messages: ChatMessageItem[];
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function verifyAdminAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await client.auth.getUser();
    if (!userRes?.user?.id) return false;
    const sb = getServiceSupabase();
    if (!sb) return false;
    const { data: prof } = await sb
      .from('profiles')
      .select('role, is_admin, is_active')
      .eq('id', userRes.user.id)
      .maybeSingle();
    if (!prof || prof.is_active === false) return false;
    return Boolean(prof.is_admin || prof.role === 'admin' || prof.role === 'super_admin');
  } catch {
    return false;
  }
}

async function loadMergedSiteContent(sb: ReturnType<typeof getServiceSupabase>) {
  if (!sb) return mergeContent({});
  try {
    const { data, error } = await sb.rpc('website_public_content');
    if (error || !data) return mergeContent({});
    return mergeContent(sanitizeContent(data));
  } catch {
    return mergeContent({});
  }
}

async function sendLiveChatTelegramNotification(params: {
  sessionId: string;
  visitorName: string;
  visitorPhone: string;
  messageText: string;
  pageUrl?: string;
  isFirstMessage: boolean;
  needsHuman?: boolean;
  escalationReason?: string;
  autoReplyPreview?: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const waPhone = normalizePhoneForWhatsApp(params.visitorPhone);
  const nowStr = new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  const headerLine = params.needsHuman
    ? '🚨🔔 <b>تحويل عاجل من الرد الآلي — العميل يحتاج تدخلك!</b>'
    : params.isFirstMessage
      ? '💬 <b>محادثة شات حي جديدة على الموقع — فاي تك</b>'
      : '💬 <b>رسالة جديدة في الشات الحي — فاي تك</b>';

  const lines = [
    headerLine,
    '━━━━━━━━━━━━━━━━━━━━',
    `👤 <b>اسم العميل:</b> ${escapeHtml(params.visitorName)}`,
    `📱 <b>رقم الجوال:</b> <code>${escapeHtml(params.visitorPhone)}</code>`,
    `💌 <b>رسالة العميل:</b>\n<b>"${escapeHtml(params.messageText)}"</b>`,
    params.needsHuman && params.escalationReason
      ? `⚠️ <b>سبب التحويل:</b> ${escapeHtml(params.escalationReason)}`
      : null,
    params.autoReplyPreview
      ? `🤖 <b>رد المساعد الآلي:</b>\n<i>${escapeHtml(params.autoReplyPreview.slice(0, 280))}${params.autoReplyPreview.length > 280 ? '…' : ''}</i>`
      : null,
    params.pageUrl ? `📄 <b>الصفحة:</b> <code>${escapeHtml(params.pageUrl)}</code>` : null,
    `🆔 <b>كود الجلسة:</b> <code>${escapeHtml(params.sessionId)}</code>`,
    `⏰ <b>التوقيت:</b> ${escapeHtml(nowStr)}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '💡 <i>يمكنك الرد مباشرة على العميل من تبويب «الشات الحي» في صفحة إدارة الموقع (/website-admin) أو عبر واتساب أدناه:</i>',
  ].filter(Boolean);

  const buttons: Array<Array<{ text: string; url: string }>> = [];
  if (waPhone) {
    const waText = encodeURIComponent(
      `مرحباً أستاذ ${params.visitorName}، معك المهندس المختص من شركة فاي تك بخصوص استفسارك على الموقع: "${params.messageText.slice(0, 80)}"`
    );
    buttons.push([{ text: `💬 الرد عبر واتساب (${params.visitorPhone})`, url: `https://wa.me/${waPhone}?text=${waText}` }]);
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(buttons.length > 0 ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    });
  } catch (err) {
    console.warn('Telegram live chat notification error:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const visitorName = String(body.visitorName || '').trim().slice(0, 80);
    const visitorPhone = String(body.visitorPhone || '').trim().slice(0, 30);
    const messageText = String(body.message || '').trim().slice(0, 1000);
    const pageUrl = String(body.pageUrl || '/').trim().slice(0, 120);
    const requestHuman = Boolean(body.requestHuman);
    const rawSessionId = String(body.sessionId || '').trim();
    const sessionId =
      rawSessionId && /^CHAT-[A-Z0-9-]{4,32}$/i.test(rawSessionId)
        ? rawSessionId
        : `CHAT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    if (!visitorName || visitorPhone.replace(/\D/g, '').length < 8) {
      return NextResponse.json(
        { error: 'يرجى إدخال الاسم ورقم الجوال الصحيح لبدء المحادثة' },
        { status: 400 }
      );
    }
    if (!messageText) {
      return NextResponse.json({ error: 'يرجى كتابة رسالتك' }, { status: 400 });
    }

    const sb = getServiceSupabase();
    const siteContent = await loadMergedSiteContent(sb);
    const nowIso = new Date().toISOString();
    const newMsg: ChatMessageItem = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'visitor',
      senderName: visitorName,
      text: messageText,
      createdAt: nowIso,
    };

    let existingRowId: string | null = null;
    let existingParsed: ChatSessionPayload | null = null;
    let isFirstMessage = true;

    if (sb) {
      const { data: existing } = await sb
        .from('user_requests')
        .select('id, details')
        .eq('type', 'live_chat')
        .eq('category', sessionId)
        .maybeSingle();

      if (existing) {
        isFirstMessage = false;
        existingRowId = existing.id;
        try {
          existingParsed = existing.details ? JSON.parse(existing.details) : null;
        } catch {
          existingParsed = null;
        }
      }
    }

    const prevMessages = Array.isArray(existingParsed?.messages) ? existingParsed!.messages : [];
    const shouldRunBot = requestHuman || (siteContent.CHAT_BOT.enabled !== false && !existingParsed?.botPaused);

    const autoReply = shouldRunBot
      ? generateSmartAutoReply({
          messageText,
          visitorName,
          visitorPhone,
          pageUrl,
          requestHuman,
          previousMessages: prevMessages,
          siteContent,
        })
      : null;

    const botMsg: ChatMessageItem | null =
      autoReply && autoReply.shouldReply
        ? {
            id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: 'admin',
            senderName: autoReply.senderName,
            text: autoReply.replyText,
            createdAt: new Date(Date.now() + 5).toISOString(),
            isAutoReply: true,
            intent: autoReply.intent,
            quickReplies: autoReply.quickReplies,
            actions: autoReply.actions,
          }
        : null;

    const welcomeMsg: ChatMessageItem = {
      id: 'welcome-auto',
      sender: 'admin',
      senderName: 'خدمة عملاء فاي تك الهندسية',
      text: botMsg
        ? `أهلاً بك يا أستاذ ${visitorName} في شركة فاي تك 👷‍♂️✨ تم فتح تذكرة محادثة فورية (${sessionId}) لمتابعة طلبك.`
        : `أهلاً بك يا أستاذ ${visitorName} في شركة فاي تك 👷‍♂️✨ تم استلام رسالتك وإشعار المهندس المختص فوراً، وسنرد عليك هنا مباشرة أو عبر جوالك (${visitorPhone}).`,
      createdAt: nowIso,
      isAutoReply: true,
    };

    const nextMessages: ChatMessageItem[] = isFirstMessage
      ? [welcomeMsg, newMsg, ...(botMsg ? [botMsg] : [])]
      : [...prevMessages.slice(-60), newMsg, ...(botMsg ? [botMsg] : [])];

    const escalatedToHuman = Boolean(existingParsed?.escalatedToHuman || autoReply?.needsHuman);
    const escalationReason = autoReply?.needsHuman
      ? autoReply.escalationReason
      : existingParsed?.escalationReason;
    const escalatedAt = autoReply?.needsHuman ? nowIso : existingParsed?.escalatedAt;

    const sessionData: ChatSessionPayload = {
      sessionId,
      visitorName: visitorName || existingParsed?.visitorName || 'زائر',
      visitorPhone: visitorPhone || existingParsed?.visitorPhone || '',
      pageUrl: pageUrl || existingParsed?.pageUrl,
      updatedAt: nowIso,
      unreadByAdmin: Number(existingParsed?.unreadByAdmin || 0) + 1,
      escalatedToHuman,
      escalationReason,
      escalatedAt,
      botPaused: Boolean(existingParsed?.botPaused),
      lastIntent: autoReply?.intent || existingParsed?.lastIntent,
      messages: nextMessages,
    };

    const rowStatus = escalatedToHuman ? '🚨 يطلب تدخل المهندس' : 'نشط';

    if (sb) {
      if (existingRowId) {
        await sb
          .from('user_requests')
          .update({
            subject: `${sessionData.visitorName} — ${sessionData.visitorPhone}`,
            details: JSON.stringify(sessionData),
            status: rowStatus,
            admin_note: (escalatedToHuman && escalationReason ? `[تحويل] ${escalationReason}` : messageText).slice(0, 160),
          })
          .eq('id', existingRowId);
      } else {
        await sb.from('user_requests').insert({
          type: 'live_chat',
          category: sessionId,
          subject: `${visitorName} — ${visitorPhone}`,
          details: JSON.stringify(sessionData),
          status: rowStatus,
          admin_note: (escalatedToHuman && escalationReason ? `[تحويل] ${escalationReason}` : messageText).slice(0, 160),
        });
      }
    }

    await sendLiveChatTelegramNotification({
      sessionId,
      visitorName,
      visitorPhone,
      messageText,
      pageUrl,
      isFirstMessage,
      needsHuman: Boolean(autoReply?.needsHuman),
      escalationReason: autoReply?.escalationReason,
      autoReplyPreview: botMsg?.text,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      session: sessionData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'تعذر إرسال الرسالة حالياً' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId')?.trim();
    const mode = searchParams.get('mode');

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({ sessions: [], session: null });
    }

    if (mode === 'admin') {
      const isAdmin = await verifyAdminAuth(req);
      if (!isAdmin) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      const { data, error } = await sb
        .from('user_requests')
        .select('id, category, subject, details, status, admin_note, created_at')
        .eq('type', 'live_chat')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const sessions = (data || []).map((row) => {
        let parsed: Partial<ChatSessionPayload> = {};
        try {
          parsed = row.details ? JSON.parse(row.details) : {};
        } catch {
          parsed = {};
        }
        return {
          rowId: row.id,
          sessionId: row.category || parsed.sessionId || row.id,
          visitorName: parsed.visitorName || row.subject,
          visitorPhone: parsed.visitorPhone || '',
          pageUrl: parsed.pageUrl || '/',
          status: row.status || 'نشط',
          updatedAt: parsed.updatedAt || row.created_at,
          unreadByAdmin: Number(parsed.unreadByAdmin || 0),
          escalatedToHuman: Boolean(parsed.escalatedToHuman),
          escalationReason: parsed.escalationReason || '',
          escalatedAt: parsed.escalatedAt || '',
          botPaused: Boolean(parsed.botPaused),
          lastIntent: parsed.lastIntent || '',
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        };
      });

      sessions.sort((a, b) => {
        if (a.escalatedToHuman !== b.escalatedToHuman) {
          return a.escalatedToHuman ? -1 : 1;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return NextResponse.json({ sessions });
    }

    if (!sessionId) {
      return NextResponse.json({ session: null });
    }

    const { data: row } = await sb
      .from('user_requests')
      .select('id, details, status')
      .eq('type', 'live_chat')
      .eq('category', sessionId)
      .maybeSingle();

    if (!row || !row.details) {
      return NextResponse.json({ session: null });
    }

    let parsed: ChatSessionPayload | null = null;
    try {
      parsed = JSON.parse(row.details);
    } catch {
      parsed = null;
    }

    return NextResponse.json({ session: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطأ في جلب المحادثة' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const isAdmin = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId, replyText, status, senderName, botPaused, clearEscalation } = body;
    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 });
    }

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({ error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
    }

    const { data: existing, error: fetchErr } = await sb
      .from('user_requests')
      .select('id, details, status')
      .eq('type', 'live_chat')
      .eq('category', sessionId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'لم يتم العثور على جلسة المحادثة' }, { status: 404 });
    }

    let parsed: ChatSessionPayload = {
      sessionId,
      visitorName: 'زائر',
      visitorPhone: '',
      updatedAt: new Date().toISOString(),
      unreadByAdmin: 0,
      messages: [],
    };
    try {
      if (existing.details) parsed = JSON.parse(existing.details);
    } catch {
      // keep fallback
    }

    const nowIso = new Date().toISOString();
    const hasReply = Boolean(replyText && String(replyText).trim());
    if (hasReply) {
      const adminMsg: ChatMessageItem = {
        id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'admin',
        senderName: String(senderName || '👨‍💼 المهندس المختص — فاي تك').trim(),
        text: String(replyText).trim().slice(0, 1500),
        createdAt: nowIso,
        isAutoReply: false,
      };
      parsed.messages = [...(Array.isArray(parsed.messages) ? parsed.messages : []), adminMsg];
      parsed.updatedAt = nowIso;
      parsed.botPaused = true;
      parsed.escalatedToHuman = false;
      parsed.escalationReason = '';
    }

    if (typeof botPaused === 'boolean') {
      parsed.botPaused = botPaused;
    }
    if (clearEscalation === true) {
      parsed.escalatedToHuman = false;
      parsed.escalationReason = '';
    }
    parsed.unreadByAdmin = 0;

    const nextStatus =
      typeof status === 'string'
        ? status
        : hasReply
          ? 'تم الرد'
          : parsed.escalatedToHuman
            ? '🚨 يطلب تدخل المهندس'
            : existing.status || 'نشط';

    const { error: updErr } = await sb
      .from('user_requests')
      .update({
        details: JSON.stringify(parsed),
        status: nextStatus,
        ...(hasReply ? { admin_note: `رد المهندس: ${String(replyText).trim().slice(0, 120)}` } : {}),
      })
      .eq('id', existing.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطأ أثناء إرسال الرد' }, { status: 500 });
  }
}
