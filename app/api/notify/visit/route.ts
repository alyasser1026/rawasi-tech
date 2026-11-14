import { NextRequest, NextResponse } from 'next/server';
import {
  sendVisitorNotification,
  sendLeadActionNotification,
  VisitorAlertInput,
} from '@/lib/telegram-notifier';

export const runtime = 'nodejs';

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userAgent = req.headers.get('user-agent') || body.userAgent || '';
    const ip = extractClientIp(req);
    const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || undefined;
    const city = req.headers.get('x-vercel-ip-city') || undefined;

    // Lead action notification (e.g. clicking WhatsApp)
    if (body.type === 'lead_action') {
      const ok = await sendLeadActionNotification({
        action: body.action || 'whatsapp_click',
        label: body.label || 'تواصل معنا عبر واتساب',
        ip,
        country,
        city,
        userAgent,
      });
      return NextResponse.json({ ok });
    }

    const payload: VisitorAlertInput = {
      path: typeof body.path === 'string' ? body.path : '/',
      referrer: typeof body.referrer === 'string' ? body.referrer : req.headers.get('referer') || '',
      screen: typeof body.screen === 'string' ? body.screen : undefined,
      userAgent,
      ip,
      country,
      city,
      language: typeof body.language === 'string' ? body.language : undefined,
      timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : undefined,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : undefined,
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign : undefined,
      connection: typeof body.connection === 'string' ? body.connection : undefined,
    };

    const result = await sendVisitorNotification(payload);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[NotifyVisitRoute] Error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
