import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractClientIp } from '@/lib/telegram-notifier';

export const runtime = 'nodejs';

const ONLINE_WINDOW_MS = 75_000;
const MAX_PAGES_PER_SESSION = 40;
const MAX_ACTIONS_PER_SESSION = 20;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const BOT_UA_RE =
  /bot|crawler|spider|headless|lighthouse|vercel-screenshot|uptime|monitoring|pingdom|curl|wget|python-requests|slurp|bingpreview|facebookexternalhit|whatsapp/i;

export interface VisitorPageEvent {
  path: string;
  title?: string;
  enteredAt: string;
  durationSec?: number;
}

export interface VisitorActionEvent {
  action: string;
  label: string;
  at: string;
  path?: string;
}

export interface VisitorSessionPayload {
  sessionId: string;
  ip: string;
  country?: string;
  city?: string;
  deviceType: string;
  os: string;
  browser: string;
  deviceModel?: string;
  screen?: string;
  referrer?: string;
  utmSource?: string;
  utmCampaign?: string;
  visitorName?: string;
  visitorPhone?: string;
  currentPath: string;
  pages: VisitorPageEvent[];
  pageViewsCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  leftAt?: string;
  status: 'online' | 'left';
  actions?: VisitorActionEvent[];
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

function parseUserAgent(ua: string): { deviceType: string; os: string; browser: string } {
  const s = ua || '';
  let deviceType = 'كمبيوتر';
  if (/ipad|tablet|playbook|silk/i.test(s) || (/android/i.test(s) && !/mobile/i.test(s))) {
    deviceType = 'تابلت';
  } else if (/iphone|ipod|android.*mobile|windows phone|blackberry|mobile/i.test(s)) {
    deviceType = 'موبايل';
  }

  let os = 'غير محدد';
  if (/iphone|ipad|ipod/i.test(s)) os = 'iOS';
  else if (/android/i.test(s)) os = 'Android';
  else if (/windows/i.test(s)) os = 'Windows';
  else if (/mac os x|macintosh/i.test(s)) os = 'macOS';
  else if (/linux/i.test(s)) os = 'Linux';

  let browser = 'متصفح';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/samsungbrowser/i.test(s)) browser = 'Samsung';
  else if (/opr\/|opera/i.test(s)) browser = 'Opera';
  else if (/chrome|crios/i.test(s)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox';
  else if (/safari/i.test(s)) browser = 'Safari';

  return { deviceType, os, browser };
}

function safeDecode(val: string | null | undefined): string | undefined {
  if (!val) return undefined;
  try {
    return decodeURIComponent(val).trim().slice(0, 80) || undefined;
  } catch {
    return val.trim().slice(0, 80) || undefined;
  }
}

function sanitizePath(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '/';
  const cleaned = s.startsWith('/') ? s : `/${s}`;
  return cleaned.slice(0, 240);
}

function getPageLabel(path: string): string {
  const base = (path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (base === '/') return 'الرئيسية';
  if (base === '/store') return 'المتجر';
  if (base === '/sections/contracting') return 'التركيبات والصيانة والتنفيذ';
  if (base === '/sections/materials') return 'المبيعات ومواد البناء';
  if (base === '/sections/smart-home') return 'السمارت هوم';
  if (base === '/sections/maintenance') return 'التنفيذ والصيانة';
  if (base === '/sections/info') return 'معلومات وأدوات هندسية';
  if (base === '/sections/real-estate' || base === '/real-estate') return 'العقارات';
  if (base === '/verify' || base === '/website/verify') return 'التحقق من المستندات';
  if (base === '/login') return 'تسجيل الدخول';
  if (base === '/website') return 'الموقع التعريفي';
  return base;
}

function getCairoDateKey(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userAgent = req.headers.get('user-agent') || '';
    if (BOT_UA_RE.test(userAgent)) {
      return NextResponse.json({ ok: true, ignored: 'bot' });
    }

    const rawText = await req.text().catch(() => '');
    let body: Record<string, any> = {};
    try {
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!SESSION_ID_RE.test(sessionId)) {
      return NextResponse.json({ ok: false, error: 'Invalid sessionId' }, { status: 400 });
    }

    const event: 'pageview' | 'heartbeat' | 'blur' | 'leave' | 'action' =
      body.event === 'heartbeat' ||
      body.event === 'blur' ||
      body.event === 'leave' ||
      body.event === 'action'
        ? body.event
        : 'pageview';

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const nowMs = nowDate.getTime();
    const ip = extractClientIp(req);
    const country = safeDecode(
      req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry')
    );
    const city = safeDecode(req.headers.get('x-vercel-ip-city'));
    const uaInfo = parseUserAgent(userAgent);
    const deviceDetails =
      body.deviceDetails && typeof body.deviceDetails === 'object' ? body.deviceDetails : {};
    const path = sanitizePath(body.path);
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : undefined;

    const { data: existing } = await sb
      .from('user_requests')
      .select('id, details, status')
      .eq('type', 'site_visitor')
      .eq('category', sessionId)
      .maybeSingle();

    let payload: VisitorSessionPayload;
    if (existing?.details) {
      try {
        payload = JSON.parse(existing.details) as VisitorSessionPayload;
      } catch {
        payload = {
          sessionId,
          ip,
          country,
          city,
          deviceType: uaInfo.deviceType,
          os: uaInfo.os,
          browser: uaInfo.browser,
          currentPath: path,
          pages: [],
          pageViewsCount: 0,
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          status: 'online',
        };
      }
    } else {
      payload = {
        sessionId,
        ip,
        country,
        city,
        deviceType: uaInfo.deviceType,
        os: uaInfo.os,
        browser: uaInfo.browser,
        deviceModel:
          typeof deviceDetails.deviceModel === 'string'
            ? deviceDetails.deviceModel.trim().slice(0, 80)
            : undefined,
        screen:
          typeof body.screen === 'string'
            ? body.screen.trim().slice(0, 40)
            : typeof deviceDetails.screen === 'string'
              ? deviceDetails.screen.trim().slice(0, 40)
              : undefined,
        referrer:
          typeof body.referrer === 'string' && body.referrer.trim()
            ? body.referrer.trim().slice(0, 240)
            : undefined,
        utmSource:
          typeof body.utmSource === 'string' && body.utmSource.trim()
            ? body.utmSource.trim().slice(0, 80)
            : undefined,
        utmCampaign:
          typeof body.utmCampaign === 'string' && body.utmCampaign.trim()
            ? body.utmCampaign.trim().slice(0, 80)
            : undefined,
        visitorName:
          typeof body.visitorName === 'string' && body.visitorName.trim()
            ? body.visitorName.trim().slice(0, 80)
            : typeof deviceDetails.knownName === 'string' && deviceDetails.knownName.trim()
              ? deviceDetails.knownName.trim().slice(0, 80)
              : undefined,
        visitorPhone:
          typeof body.visitorPhone === 'string' && body.visitorPhone.trim()
            ? body.visitorPhone.trim().slice(0, 40)
            : typeof deviceDetails.knownPhone === 'string' && deviceDetails.knownPhone.trim()
              ? deviceDetails.knownPhone.trim().slice(0, 40)
              : undefined,
        currentPath: path,
        pages: [],
        pageViewsCount: 0,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        status: 'online',
        actions: [],
      };
    }

    // Refresh known metadata if newly provided
    if (!payload.country && country) payload.country = country;
    if (!payload.city && city) payload.city = city;
    if (ip && ip !== 'unknown' && (!payload.ip || payload.ip === 'unknown')) payload.ip = ip;
    if (!payload.deviceModel && typeof deviceDetails.deviceModel === 'string' && deviceDetails.deviceModel.trim()) {
      payload.deviceModel = deviceDetails.deviceModel.trim().slice(0, 80);
    }
    if (!payload.screen && typeof body.screen === 'string' && body.screen.trim()) {
      payload.screen = body.screen.trim().slice(0, 40);
    }
    const incomingName =
      (typeof body.visitorName === 'string' && body.visitorName.trim()) ||
      (typeof deviceDetails.knownName === 'string' && deviceDetails.knownName.trim()) ||
      '';
    const incomingPhone =
      (typeof body.visitorPhone === 'string' && body.visitorPhone.trim()) ||
      (typeof body.phone === 'string' && body.phone.trim()) ||
      (typeof deviceDetails.knownPhone === 'string' && deviceDetails.knownPhone.trim()) ||
      '';
    if (incomingName) payload.visitorName = incomingName.slice(0, 80);
    if (incomingPhone) payload.visitorPhone = incomingPhone.slice(0, 40);

    if (!Array.isArray(payload.pages)) payload.pages = [];
    if (!Array.isArray(payload.actions)) payload.actions = [];

    const lastPage = payload.pages[payload.pages.length - 1];

    if (event === 'pageview') {
      const samePathRecently =
        lastPage &&
        lastPage.path === path &&
        nowMs - new Date(lastPage.enteredAt).getTime() < 5000;

      if (!samePathRecently) {
        if (lastPage && typeof lastPage.durationSec !== 'number') {
          lastPage.durationSec = Math.max(
            1,
            Math.min(7200, Math.round((nowMs - new Date(lastPage.enteredAt).getTime()) / 1000))
          );
        }
        payload.pages.push({
          path,
          ...(title ? { title } : {}),
          enteredAt: nowIso,
        });
        if (payload.pages.length > MAX_PAGES_PER_SESSION) {
          payload.pages = payload.pages.slice(-MAX_PAGES_PER_SESSION);
        }
        payload.pageViewsCount = (payload.pageViewsCount || 0) + 1;
      } else if (title && lastPage && !lastPage.title) {
        lastPage.title = title;
      }
      payload.currentPath = path;
      payload.lastSeenAt = nowIso;
      payload.status = 'online';
      delete payload.leftAt;
    } else if (event === 'heartbeat') {
      if (body.path) payload.currentPath = path;
      if (title && lastPage && lastPage.path === payload.currentPath && !lastPage.title) {
        lastPage.title = title;
      }
      payload.lastSeenAt = nowIso;
      payload.status = 'online';
      delete payload.leftAt;
    } else if (event === 'blur') {
      payload.lastSeenAt = nowIso;
    } else if (event === 'leave') {
      if (lastPage && typeof lastPage.durationSec !== 'number') {
        lastPage.durationSec = Math.max(
          1,
          Math.min(7200, Math.round((nowMs - new Date(lastPage.enteredAt).getTime()) / 1000))
        );
      }
      payload.lastSeenAt = nowIso;
      payload.leftAt = nowIso;
      payload.status = 'left';
    } else if (event === 'action') {
      const action = typeof body.action === 'string' ? body.action.trim().slice(0, 40) : 'action';
      const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : action;
      payload.actions.push({
        action,
        label,
        at: nowIso,
        path: payload.currentPath || path,
      });
      if (payload.actions.length > MAX_ACTIONS_PER_SESSION) {
        payload.actions = payload.actions.slice(-MAX_ACTIONS_PER_SESSION);
      }
      payload.lastSeenAt = nowIso;
      payload.status = 'online';
    }

    const locationLabel = [payload.city, payload.country].filter(Boolean).join(', ') || payload.ip || 'زائر';
    const subject = `${payload.visitorName || locationLabel} — ${getPageLabel(payload.currentPath)}`.slice(0, 140);

    if (existing?.id) {
      await sb
        .from('user_requests')
        .update({
          subject,
          details: JSON.stringify(payload),
          status: payload.status,
        })
        .eq('id', existing.id);
    } else {
      await sb.from('user_requests').insert({
        user_id: null,
        type: 'site_visitor',
        category: sessionId,
        subject,
        details: JSON.stringify(payload),
        status: payload.status,
      });
    }

    return NextResponse.json({ ok: true, status: payload.status });
  } catch (err: any) {
    console.error('[WebsiteVisitorsRoute POST] Error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({
        visitors: [],
        stats: { onlineNow: 0, leftCount: 0, todayTotal: 0, totalSessions: 0, totalPageViews: 0 },
        topPages: [],
      });
    }

    const { data, error } = await sb
      .from('user_requests')
      .select('id, category, details, status, created_at')
      .eq('type', 'site_visitor')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nowMs = Date.now();
    const todayCairo = getCairoDateKey(new Date(nowMs));
    const pageCounter = new Map<string, number>();

    let onlineNow = 0;
    let leftCount = 0;
    let todayTotal = 0;
    let totalPageViews = 0;

    const visitors = (data || [])
      .map((row) => {
        let parsed: VisitorSessionPayload | null = null;
        try {
          parsed = row.details ? (JSON.parse(row.details) as VisitorSessionPayload) : null;
        } catch {
          parsed = null;
        }
        if (!parsed) return null;

        const lastSeenMs = new Date(parsed.lastSeenAt || row.created_at).getTime();
        const firstSeenMs = new Date(parsed.firstSeenAt || row.created_at).getTime();
        const isOnline =
          parsed.status !== 'left' &&
          Number.isFinite(lastSeenMs) &&
          nowMs - lastSeenMs <= ONLINE_WINDOW_MS;

        const effectiveStatus: 'online' | 'left' = isOnline ? 'online' : 'left';
        const effectiveLeftAt = isOnline ? undefined : parsed.leftAt || parsed.lastSeenAt;
        const endMs = isOnline ? nowMs : new Date(effectiveLeftAt || parsed.lastSeenAt).getTime();
        const totalDurationSec = Math.max(
          0,
          Math.round(((Number.isFinite(endMs) ? endMs : nowMs) - (Number.isFinite(firstSeenMs) ? firstSeenMs : nowMs)) / 1000)
        );

        if (isOnline) onlineNow++;
        else leftCount++;

        if (getCairoDateKey(new Date(parsed.firstSeenAt || row.created_at)) === todayCairo) {
          todayTotal++;
        }

        const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
        const pvCount = Math.max(parsed.pageViewsCount || 0, pages.length);
        totalPageViews += pvCount;

        for (const p of pages) {
          const basePath = (p.path || '/').split('?')[0] || '/';
          pageCounter.set(basePath, (pageCounter.get(basePath) || 0) + 1);
        }

        return {
          id: row.id,
          ...parsed,
          pages,
          pageViewsCount: pvCount,
          isOnline,
          effectiveStatus,
          effectiveLeftAt,
          totalDurationSec,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
      });

    const topPages = Array.from(pageCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, views]) => ({
        path,
        label: getPageLabel(path),
        views,
      }));

    return NextResponse.json({
      visitors,
      stats: {
        onlineNow,
        leftCount,
        todayTotal,
        totalSessions: visitors.length,
        totalPageViews,
      },
      topPages,
      serverTime: new Date(nowMs).toISOString(),
    });
  } catch (err: any) {
    console.error('[WebsiteVisitorsRoute GET] Error:', err);
    return NextResponse.json({ error: err?.message || 'خطأ في جلب الزوار' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({ error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const scope = searchParams.get('scope');

    if (id) {
      const { error } = await sb
        .from('user_requests')
        .delete()
        .eq('type', 'site_visitor')
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (scope === 'old') {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await sb
        .from('user_requests')
        .delete()
        .eq('type', 'site_visitor')
        .lt('created_at', cutoff);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (scope === 'all') {
      const { error } = await sb
        .from('user_requests')
        .delete()
        .eq('type', 'site_visitor');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'حدد id أو scope' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذر الحذف' }, { status: 500 });
  }
}
