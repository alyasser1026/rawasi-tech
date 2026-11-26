/**
 * app/api/store-copilot/trainer/route.ts
 * نقطة النهاية المقيدة للإيجنت الخارجي:
 * - محمية بمفتاح STORE_COPILOT_TRAINER_KEY (Fail-Closed).
 * - GET : قراءة غير حساسة للكلمات المفتوحة والمرادفات وإعدادات المعرفة وحدود الصلاحيات فقط.
 * - POST: تقديم مسودة تدريب واحدة في جدول المراجعة المعلقة (store_copilot_training_proposals) فقط،
 *         مع فحص أمني شامل وحظر وتسجيل فوري لأي أمر شيل أو كود مفخخ أو محاولة تصعيد صلاحية.
 */

import { NextResponse } from 'next/server';
import { PRODUCT_CATEGORIES } from '@/app/site/store-catalog';
import {
  auditTrainerProposal,
  describeRequestedScope,
  detectUnauthorizedRequestKeys,
  type ProposalSecurityFlag,
  TRAINER_AGENT_PERMISSION_MANIFEST,
  verifyTrainerKey,
} from '@/lib/copilot/proposal-security';
import {
  getCachedCopilotTraining,
  isMissingTrainingTableError,
  VALID_KNOWLEDGE_CATEGORY_SET,
} from '@/lib/copilot/training-store';
import { getCachedCatalogOverview, getServiceSupabase } from '@/lib/store-copilot-tools';
import { sendTrainerSecurityAlertTelegram } from '@/lib/store-order-telegram';

export const runtime = 'nodejs';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 25_600;
const MAX_PENDING_PROPOSALS = 30;
const VALID_SYNONYM_TYPES = new Set(['slang', 'brand', 'product', 'category']);
const VALID_CAT_SET = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));

const rateGlobal = globalThis as typeof globalThis & {
  __phiCopilotTrainerRateMap?: Map<string, number[]>;
};

function getRateMap(): Map<string, number[]> {
  if (!rateGlobal.__phiCopilotTrainerRateMap) {
    rateGlobal.__phiCopilotTrainerRateMap = new Map<string, number[]>();
  }
  return rateGlobal.__phiCopilotTrainerRateMap;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const map = getRateMap();
  const list = (map.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX_REQUESTS) {
    map.set(key, list);
    return false;
  }
  list.push(now);
  map.set(key, list);
  return true;
}

function extractClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 64);
  return (req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64);
}

function sanitizeTextArray(val: unknown, maxItems = 15, maxLen = 80): string[] {
  const list = Array.isArray(val)
    ? val
    : typeof val === 'string'
      ? val.split(/[،,\n]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const clean = String(raw ?? '').trim().slice(0, maxLen);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeDraftPayload(
  proposalType: 'synonym' | 'knowledge' | 'training_config',
  rawPayload: unknown,
  fallbackTitle: string
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { ok: false, error: 'حقل payload يجب أن يكون كائن JSON صالحاً.' };
  }
  const p = rawPayload as Record<string, unknown>;

  if (proposalType === 'synonym') {
    const term = String(p.term || '').trim().slice(0, 100);
    if (!term) return { ok: false, error: 'حقل term مطلوب لمقترح المرادف.' };
    const rawType = String(p.synonym_type || 'slang').trim();
    const synonymType = VALID_SYNONYM_TYPES.has(rawType) ? rawType : 'slang';
    const expandTerms = sanitizeTextArray(p.expand_terms, 15, 80);
    const targetCategories = sanitizeTextArray(p.target_categories, 14, 40).filter((c) =>
      VALID_CAT_SET.has(c)
    );
    const notes = String(p.notes || '').trim().slice(0, 240);
    const missIdNum = Number(p.missId);
    const clean: Record<string, unknown> = {
      term,
      synonym_type: synonymType,
      expand_terms: expandTerms.length > 0 ? expandTerms : [term],
      target_categories: targetCategories,
      notes,
    };
    if (Number.isInteger(missIdNum) && missIdNum > 0) {
      clean.missId = missIdNum;
    }
    return { ok: true, payload: clean };
  }

  if (proposalType === 'knowledge') {
    const title = (String(p.title || '').trim() || fallbackTitle).slice(0, 160);
    const answer = String(p.answer || '').trim().slice(0, 2000);
    if (!title || !answer) {
      return { ok: false, error: 'حقلا title و answer مطلوبان لمقترح المعرفة.' };
    }
    const rawCat = String(p.category || 'general').trim();
    const category = VALID_KNOWLEDGE_CATEGORY_SET.has(rawCat) ? rawCat : 'general';
    const keywords = sanitizeTextArray(p.keywords, 20, 60);
    const rawPrio = Number(p.priority);
    const priority = Number.isFinite(rawPrio) ? Math.min(100, Math.max(0, Math.round(rawPrio))) : 10;
    return {
      ok: true,
      payload: {
        title,
        category,
        keywords,
        answer,
        priority,
      },
    };
  }

  // training_config
  const cleanCfg: Record<string, unknown> = {};
  if (typeof p.persona_name === 'string' && p.persona_name.trim()) {
    cleanCfg.persona_name = p.persona_name.trim().slice(0, 120);
  }
  if (typeof p.tone_guidelines === 'string' && p.tone_guidelines.trim()) {
    cleanCfg.tone_guidelines = p.tone_guidelines.trim().slice(0, 600);
  }
  if (typeof p.sales_handoff_prompt === 'string' && p.sales_handoff_prompt.trim()) {
    cleanCfg.sales_handoff_prompt = p.sales_handoff_prompt.trim().slice(0, 300);
  }
  if (typeof p.extra_system_rules === 'string' && p.extra_system_rules.trim()) {
    cleanCfg.extra_system_rules = p.extra_system_rules.trim().slice(0, 3000);
  }
  if (typeof p.forbidden_claims === 'string' && p.forbidden_claims.trim()) {
    cleanCfg.forbidden_claims = p.forbidden_claims.trim().slice(0, 1500);
  }

  if (Object.keys(cleanCfg).length === 0) {
    return {
      ok: false,
      error: 'يجب تحديد حقل واحد على الأقل من إعدادات السلوك في مقترح training_config.',
    };
  }
  return { ok: true, payload: cleanCfg };
}

export async function GET(req: Request) {
  const auth = verifyTrainerKey(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!checkRateLimit(`trainer_get:${extractClientIp(req)}`)) {
    return NextResponse.json(
      { ok: false, error: 'تم تجاوز الحد الأقصى لطلبات القراءة في الدقيقة.' },
      { status: 429 }
    );
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  try {
    const [overview, missesRes, synonymsRes, training, proposalsRes] = await Promise.all([
      getCachedCatalogOverview(sb),
      sb
        .from('copilot_search_misses')
        .select('id, raw_query, normalized_query, category_filter, brand_filter, hit_count, last_seen_at')
        .eq('resolved', false)
        .order('hit_count', { ascending: false })
        .order('last_seen_at', { ascending: false })
        .limit(50),
      sb
        .from('store_search_synonyms')
        .select('term, expand_terms, target_categories, synonym_type, is_active')
        .order('id')
        .limit(250),
      getCachedCopilotTraining(sb, { bypassCache: true }),
      sb
        .from('store_copilot_training_proposals')
        .select('id, agent_name, proposal_type, title, risk_level, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const proposalsReady = !isMissingTrainingTableError(proposalsRes.error);

    return NextResponse.json({
      ok: true,
      permissions: TRAINER_AGENT_PERMISSION_MANIFEST,
      overview,
      openMisses: missesRes.error ? [] : missesRes.data || [],
      synonyms: synonymsRes.error ? [] : synonymsRes.data || [],
      trainingConfig: training.config,
      knowledgeSummary: training.knowledge.map((k) => ({
        id: k.id,
        title: k.title,
        category: k.category,
        keywords: k.keywords,
        priority: k.priority,
        is_active: k.is_active,
      })),
      proposalsReady,
      recentProposals: proposalsReady && Array.isArray(proposalsRes.data) ? proposalsRes.data : [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'تعذر قراءة بيانات التدريب' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = verifyTrainerKey(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!checkRateLimit(`trainer_post:${extractClientIp(req)}`)) {
    return NextResponse.json(
      { ok: false, error: 'تم تجاوز الحد الأقصى لمحاولات الإرسال في الدقيقة.' },
      { status: 429 }
    );
  }

  let rawText = '';
  try {
    rawText = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر قراءة جسم الطلب' }, { status: 400 });
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'حجم المقترح يتجاوز الحد الأقصى المسموح (25 KB).' },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ ok: false, error: 'جسم الطلب ليس JSON صالحاً.' }, { status: 400 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  const bodyObj = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<
    string,
    unknown
  >;
  const agentName =
    typeof bodyObj.agent_name === 'string' && bodyObj.agent_name.trim()
      ? bodyObj.agent_name.trim().slice(0, 80)
      : 'external-trainer';
  const proposalType =
    typeof bodyObj.proposal_type === 'string' ? bodyObj.proposal_type.trim() : '';
  const title = typeof bodyObj.title === 'string' ? bodyObj.title.trim().slice(0, 160) : '';
  const reason = typeof bodyObj.reason === 'string' ? bodyObj.reason.trim().slice(0, 500) : '';

  const unauthorizedKeys = detectUnauthorizedRequestKeys(body);
  const validType =
    proposalType === 'synonym' ||
    proposalType === 'knowledge' ||
    proposalType === 'training_config';

  if (unauthorizedKeys.length > 0 || !validType) {
    const flags: ProposalSecurityFlag[] = [];
    if (unauthorizedKeys.length > 0) {
      flags.push({
        code: 'UNAUTHORIZED_COMMAND_OR_PERMISSION',
        severity: 'critical',
        title: 'حقول أو أوامر أو طلبات صلاحية غير مصرح بها',
        detail: 'حاول الطلب تمرير مفاتيح محظورة أو خارجة عن نطاق المسودات المسموح بها.',
        field: unauthorizedKeys.join(', '),
        excerpt: unauthorizedKeys.slice(0, 8).join(', ').slice(0, 140),
      });
    }
    if (!validType) {
      flags.push({
        code: 'UNAUTHORIZED_COMMAND_OR_PERMISSION',
        severity: 'critical',
        title: 'نوع مقترح غير مسموح به',
        detail: 'الأنواع المسموحة للإيجنت الخارجي هي فقط: synonym, knowledge, training_config.',
        field: 'proposal_type',
        excerpt: (proposalType || 'empty').slice(0, 140),
      });
    }

    const contentAudit = auditTrainerProposal({
      proposalType: proposalType || 'blocked_attempt',
      title: title || 'محاولة غير مصرح بها',
      reason,
      payload: bodyObj,
    });
    const seenKeys = new Set(flags.map((f) => `${f.code}::${f.field}`));
    for (const f of contentAudit.flags) {
      if (!seenKeys.has(`${f.code}::${f.field}`)) {
        flags.push(f);
        seenKeys.add(`${f.code}::${f.field}`);
      }
    }

    const safeSnippetPayload = {
      unauthorizedKeys,
      attemptedType: proposalType || null,
      rawSnippet: rawText.slice(0, 600),
    };

    try {
      await sb.from('store_copilot_training_proposals').insert({
        agent_name: agentName,
        proposal_type: 'blocked_attempt',
        title: title || `محاولة محظورة (${proposalType || 'غير معروف'})`,
        reason: reason || 'رصد حقول أو صلاحيات أو أوامر خارج النطاق المسموح.',
        requested_scope: 'محظور تلقائياً: محاولة تمرير أمر أو صلاحية غير مصرح بها',
        payload: safeSnippetPayload,
        risk_level: 'critical',
        security_flags: flags,
        status: 'blocked',
      });
    } catch {
      // ignore if migration has not run yet; still return 403 and notify Telegram
    }

    try {
      await sendTrainerSecurityAlertTelegram({
        agentName,
        proposalType: proposalType || 'blocked_attempt',
        title: title || 'محاولة محظورة من الإيجنت الخارجي',
        blocked: true,
        riskLevel: 'critical',
        flags,
      });
    } catch {
      // non-blocking alert failure
    }

    return NextResponse.json(
      {
        ok: false,
        blocked: true,
        error:
          'تم حظر الطلب وتسجيل تنبيه أمني للإدارة بسبب وجود أوامر أو حقول أو صلاحيات غير مصرح بها.',
        flags,
      },
      { status: 403 }
    );
  }

  if (!title) {
    return NextResponse.json(
      { ok: false, error: 'حقل title مطلوب لوصف المقترح.' },
      { status: 400 }
    );
  }

  const sanitized = sanitizeDraftPayload(
    proposalType as 'synonym' | 'knowledge' | 'training_config',
    bodyObj.payload,
    title
  );
  if (!sanitized.ok) {
    return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
  }

  const { count, error: countErr } = await sb
    .from('store_copilot_training_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (countErr) {
    const missing = isMissingTrainingTableError(countErr);
    return NextResponse.json(
      {
        ok: false,
        error: missing
          ? 'جدول مسودات التدريب غير منشأ في قاعدة البيانات بعد — نفّذ ملف الهجرة 20261126020000_store_copilot_trainer_proposals.sql أولاً.'
          : countErr.message,
      },
      { status: missing ? 503 : 500 }
    );
  }

  if ((count ?? 0) >= MAX_PENDING_PROPOSALS) {
    return NextResponse.json(
      {
        ok: false,
        error: `تجاوزت قائمة المسودات قيد الانتظار الحد الأقصى (${MAX_PENDING_PROPOSALS}). انتظر مراجعة المدير أولاً.`,
      },
      { status: 429 }
    );
  }

  const audit = auditTrainerProposal({
    proposalType,
    title,
    reason,
    payload: sanitized.payload,
  });
  const requestedScope = describeRequestedScope(proposalType);

  const { data, error } = await sb
    .from('store_copilot_training_proposals')
    .insert({
      agent_name: agentName,
      proposal_type: proposalType,
      title,
      reason,
      requested_scope: requestedScope,
      payload: sanitized.payload,
      risk_level: audit.riskLevel,
      security_flags: audit.flags,
      status: 'pending',
    })
    .select('id, status, risk_level, security_flags, requested_scope')
    .single();

  if (error) {
    const missing = isMissingTrainingTableError(error);
    return NextResponse.json(
      {
        ok: false,
        error: missing
          ? 'جدول مسودات التدريب غير منشأ في قاعدة البيانات بعد — نفّذ ملف الهجرة 20261126020000_store_copilot_trainer_proposals.sql أولاً.'
          : error.message,
      },
      { status: missing ? 503 : 500 }
    );
  }

  if (audit.hasCritical) {
    try {
      await sendTrainerSecurityAlertTelegram({
        agentName,
        proposalType,
        title,
        blocked: false,
        riskLevel: audit.riskLevel,
        flags: audit.flags,
      });
    } catch {
      // non-blocking alert failure
    }
  }

  return NextResponse.json(
    {
      ok: true,
      proposalId: data.id,
      status: 'pending',
      riskLevel: audit.riskLevel,
      securityFlags: audit.flags,
      requestedScope,
      message: 'تم حفظ المسودة بانتظار مراجعة وموافقة المدير.',
    },
    { status: 201 }
  );
}
