import { NextRequest, NextResponse } from 'next/server';
import {
  extractClientIp,
  sendVisitorNotification,
  sendLeadActionNotification,
  VisitorAlertInput,
} from '@/lib/telegram-notifier';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userAgent = req.headers.get('user-agent') || body.userAgent || '';
    const ip = extractClientIp(req);
    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      undefined;
    const city = req.headers.get('x-vercel-ip-city') || undefined;
    const deviceDetails =
      body.deviceDetails && typeof body.deviceDetails === 'object'
        ? body.deviceDetails
        : undefined;

    // Lead action notification (e.g. clicking WhatsApp, submitting phone or inquiry form)
    if (body.type === 'lead_action') {
      const ok = await sendLeadActionNotification({
        action: typeof body.action === 'string' ? body.action : 'whatsapp_click',
        label: typeof body.label === 'string' ? body.label : 'تواصل معنا عبر واتساب',
        phone: typeof body.phone === 'string' ? body.phone.trim() : undefined,
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        email: typeof body.email === 'string' ? body.email.trim() : undefined,
        projectKind:
          typeof body.projectKind === 'string' ? body.projectKind.trim() : undefined,
        projectLocation:
          typeof body.projectLocation === 'string'
            ? body.projectLocation.trim()
            : undefined,
        notes: typeof body.notes === 'string' ? body.notes.trim() : undefined,
        ip,
        country,
        city,
        userAgent,
        deviceDetails,
      });
      return NextResponse.json({ ok });
    }

    const payload: VisitorAlertInput = {
      path: typeof body.path === 'string' ? body.path : '/',
      referrer:
        typeof body.referrer === 'string'
          ? body.referrer
          : req.headers.get('referer') || '',
      screen: typeof body.screen === 'string' ? body.screen : undefined,
      userAgent,
      ip,
      country,
      city,
      language: typeof body.language === 'string' ? body.language : undefined,
      timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : undefined,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : undefined,
      utmCampaign:
        typeof body.utmCampaign === 'string' ? body.utmCampaign : undefined,
      connection: typeof body.connection === 'string' ? body.connection : undefined,
      deviceDetails,
    };

    const result = await sendVisitorNotification(payload);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[NotifyVisitRoute] Error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
