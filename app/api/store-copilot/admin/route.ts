/**
 * app/api/store-copilot/admin/route.ts
 * واجهة إدارة ومراجعة مرادفات البحث وكلمات البحث المفتوحة (copilot_search_misses) للمديرين فقط.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRODUCT_CATEGORIES } from '@/app/site/store-catalog';
import { getCachedCatalogOverview, getServiceSupabase } from '@/lib/store-copilot-tools';
import {
  DEFAULT_COPILOT_TRAINING_CONFIG,
  getCachedCopilotTraining,
  invalidateCopilotTrainingCache,
  isMissingTrainingTableError,
  VALID_KNOWLEDGE_CATEGORY_SET,
} from '@/lib/copilot/training-store';
import {
  auditTrainerProposal,
  TRAINER_AGENT_PERMISSION_MANIFEST,
} from '@/lib/copilot/proposal-security';
import {
  appendAgentDialogueMessage,
  loadAgentDialogue,
} from '@/lib/copilot/agent-dialogue-store';

export const runtime = 'nodejs';

const VALID_SYNONYM_TYPES = new Set(['slang', 'brand', 'product', 'category']);
const VALID_CATEGORIES = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));
const TRAINING_MIGRATION_MISSING_MSG =
  'جداول تدريب الكوبايلوت غير منشأة في قاعدة البيانات بعد — نفّذ ملف الهجرة 20261124100000_store_copilot_training.sql في Supabase أولاً.';
const PROPOSALS_MIGRATION_MISSING_MSG =
  'جدول مسودات التدريب غير منشأ في قاعدة البيانات بعد — نفّذ ملف الهجرة 20261126020000_store_copilot_trainer_proposals.sql في Supabase أولاً.';

function normalizeSqlSynonymKey(input: string): string {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(input || '')
    .replace(/[٠-٩]/g, (d) => String(digits.indexOf(d)))
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/بورسلين/g, 'بورسلان')
    .replace(/\s+/g, ' ')
    .trim();
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

function sanitizeTextArray(val: unknown): string[] {
  const list = Array.isArray(val)
    ? val
    : typeof val === 'string'
      ? val.split(/[،,\n]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const clean = String(raw ?? '').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

async function approveSingleProposalRow(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  prop: any,
  confirmCriticalOverride: boolean,
  reviewNote: string
): Promise<
  | { ok: true; proposal: any }
  | { ok: false; status: number; error: string; flags?: unknown }
> {
  if (prop.status !== 'pending' || prop.proposal_type === 'blocked_attempt') {
    return {
      ok: false,
      status: 400,
      error: 'لا يمكن اعتماد هذا العنصر — تم حظره أو مراجعته مسبقاً.',
    };
  }

  const payloadObj =
    prop.payload && typeof prop.payload === 'object' && !Array.isArray(prop.payload)
      ? (prop.payload as Record<string, unknown>)
      : {};

  const freshAudit = auditTrainerProposal({
    proposalType: String(prop.proposal_type || ''),
    title: String(prop.title || ''),
    reason: String(prop.reason || ''),
    payload: payloadObj,
  });

  if (freshAudit.hasCritical && !confirmCriticalOverride) {
    return {
      ok: false,
      status: 400,
      error:
        'هذا المقترح يحتوي على تحذيرات أمنية حرجة — فعّل خيار تأكيد المراجعة اليدوية قبل الاعتماد.',
      flags: freshAudit.flags,
    };
  }

  if (prop.proposal_type === 'synonym') {
    const synTerm = String(payloadObj.term || '').trim().slice(0, 100);
    const synType = VALID_SYNONYM_TYPES.has(String(payloadObj.synonym_type || ''))
      ? String(payloadObj.synonym_type)
      : 'slang';
    const linkedProduct = String(
      payloadObj.linked_product ?? payloadObj.product_name ?? payloadObj.product ?? ''
    )
      .trim()
      .slice(0, 140);
    const orderScenario = String(payloadObj.order_scenario ?? payloadObj.scenario ?? '')
      .trim()
      .slice(0, 200);
    const expandTerms = sanitizeTextArray(payloadObj.expand_terms);
    if (linkedProduct && linkedProduct !== synTerm && !expandTerms.includes(linkedProduct)) {
      expandTerms.push(linkedProduct);
    }
    const targetCats = sanitizeTextArray(payloadObj.target_categories).filter((c) =>
      VALID_CATEGORIES.has(c)
    );
    const rawNotes = String(
      payloadObj.notes || prop.reason || `مقترح معتمد من الإيجنت: ${prop.agent_name || 'trainer'}`
    ).trim();
    const notesWithScenario =
      orderScenario && !rawNotes.includes(orderScenario)
        ? `${rawNotes} | سيناريو الطلب: ${orderScenario}`
        : rawNotes;
    const notesText = notesWithScenario.slice(0, 240);

    if (!synTerm) {
      return { ok: false, status: 400, error: 'بيانات المرادف غير مكتملة' };
    }

    const normKey = normalizeSqlSynonymKey(synTerm);
    const { error: synUpErr } = await sb
      .from('store_search_synonyms')
      .upsert(
        {
          term: synTerm,
          term_normalized: normKey,
          synonym_type: synType,
          expand_terms: expandTerms.length > 0 ? expandTerms : [synTerm],
          target_categories: targetCats,
          notes: notesText,
          is_active: true,
        },
        { onConflict: 'term_normalized' }
      );

    if (synUpErr) {
      return { ok: false, status: 500, error: synUpErr.message };
    }

    const missId = Number(payloadObj.missId ?? payloadObj.resolve_miss_id);
    if (Number.isInteger(missId) && missId > 0) {
      await sb
        .from('copilot_search_misses')
        .update({ resolved: true, resolved_synonym: synTerm })
        .eq('id', missId);
    }
  } else if (prop.proposal_type === 'knowledge') {
    const kTitle = String(payloadObj.title || prop.title || '').trim().slice(0, 160);
    const kAnswer = String(payloadObj.answer || '').trim().slice(0, 2000);
    const rawCat = String(payloadObj.category || 'general').trim();
    const kCategory = VALID_KNOWLEDGE_CATEGORY_SET.has(rawCat) ? rawCat : 'general';
    const kKeywords = sanitizeTextArray(payloadObj.keywords);
    const rawPrio = Number(payloadObj.priority);
    const kPriority = Number.isFinite(rawPrio)
      ? Math.min(100, Math.max(0, Math.round(rawPrio)))
      : 10;

    if (!kTitle || !kAnswer) {
      return { ok: false, status: 400, error: 'بيانات مقال المعرفة غير مكتملة' };
    }

    const { error: kErr } = await sb.from('store_copilot_knowledge').insert({
      title: kTitle,
      category: kCategory,
      keywords: kKeywords,
      answer: kAnswer,
      priority: kPriority,
      is_active: true,
    });

    if (kErr) {
      return {
        ok: false,
        status: isMissingTrainingTableError(kErr) ? 503 : 500,
        error: isMissingTrainingTableError(kErr) ? TRAINING_MIGRATION_MISSING_MSG : kErr.message,
      };
    }
    invalidateCopilotTrainingCache();
  } else if (prop.proposal_type === 'training_config') {
    const current = await getCachedCopilotTraining(sb, { bypassCache: true });
    if (!current.ready) {
      return { ok: false, status: 503, error: TRAINING_MIGRATION_MISSING_MSG };
    }

    const strVal = (v: unknown, max: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '';

    const merged = {
      id: 'default',
      persona_name: strVal(payloadObj.persona_name, 120) || current.config.persona_name,
      tone_guidelines:
        strVal(payloadObj.tone_guidelines, 600) || current.config.tone_guidelines,
      sales_handoff_prompt:
        strVal(payloadObj.sales_handoff_prompt, 300) || current.config.sales_handoff_prompt,
      extra_system_rules:
        typeof payloadObj.extra_system_rules === 'string' && payloadObj.extra_system_rules.trim()
          ? payloadObj.extra_system_rules.trim().slice(0, 3000)
          : current.config.extra_system_rules,
      forbidden_claims:
        typeof payloadObj.forbidden_claims === 'string' && payloadObj.forbidden_claims.trim()
          ? payloadObj.forbidden_claims.trim().slice(0, 1500)
          : current.config.forbidden_claims,
      updated_at: new Date().toISOString(),
    };

    const { error: cfgErr } = await sb
      .from('store_copilot_training_config')
      .upsert(merged, { onConflict: 'id' });

    if (cfgErr) {
      return {
        ok: false,
        status: isMissingTrainingTableError(cfgErr) ? 503 : 500,
        error: isMissingTrainingTableError(cfgErr) ? TRAINING_MIGRATION_MISSING_MSG : cfgErr.message,
      };
    }
    invalidateCopilotTrainingCache();
  } else {
    return { ok: false, status: 400, error: 'نوع مقترح غير مدعوم للاعتماد' };
  }

  const { data: updated, error: updErr } = await sb
    .from('store_copilot_training_proposals')
    .update({
      status: 'approved',
      review_note: reviewNote,
      reviewed_at: new Date().toISOString(),
      risk_level: freshAudit.riskLevel,
      security_flags: freshAudit.flags,
    })
    .eq('id', prop.id)
    .select('*')
    .single();

  if (updErr) {
    return { ok: false, status: 500, error: updErr.message };
  }

  return { ok: true, proposal: updated };
}

export async function GET(req: Request) {
  if (!(await verifyAdminAuth(req))) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 403 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  try {
    const [synRes, missRes, overview, training, propRes, agentDialogue] = await Promise.all([
      sb.from('store_search_synonyms').select('*').order('synonym_type').order('id'),
      sb
        .from('copilot_search_misses')
        .select('*')
        .order('resolved', { ascending: true })
        .order('hit_count', { ascending: false })
        .order('last_seen_at', { ascending: false })
        .limit(150),
      getCachedCatalogOverview(sb),
      getCachedCopilotTraining(sb, { bypassCache: true }),
      sb
        .from('store_copilot_training_proposals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      loadAgentDialogue(sb),
    ]);

    if (synRes.error) {
      return NextResponse.json({ ok: false, error: synRes.error.message }, { status: 500 });
    }
    if (missRes.error) {
      return NextResponse.json({ ok: false, error: missRes.error.message }, { status: 500 });
    }

    const synonyms = synRes.data || [];
    const misses = missRes.data || [];
    const proposalsReady = !isMissingTrainingTableError(propRes.error);
    const proposals = proposalsReady && Array.isArray(propRes.data) ? propRes.data : [];
    const byType: Record<string, number> = { slang: 0, brand: 0, product: 0, category: 0 };
    let activeSynonyms = 0;

    for (const s of synonyms) {
      if (s.is_active) activeSynonyms++;
      const t = String(s.synonym_type || 'product');
      byType[t] = (byType[t] || 0) + 1;
    }

    const openMisses = misses.filter((m) => !m.resolved).length;
    const activeKnowledge = training.knowledge.filter((k) => k.is_active).length;
    const pendingProposals = proposals.filter((p: any) => p.status === 'pending').length;
    const criticalSecurityAlerts = proposals.filter(
      (p: any) =>
        p.status === 'blocked' ||
        p.risk_level === 'critical' ||
        (p.status === 'pending' && p.risk_level === 'warning')
    ).length;
    const trainerKeyConfigured = (process.env.STORE_COPILOT_TRAINER_KEY || '').trim().length >= 24;

    return NextResponse.json({
      ok: true,
      synonyms,
      misses,
      overview,
      trainingReady: training.ready,
      trainingConfig: training.config,
      knowledgeItems: training.knowledge,
      proposalsReady,
      proposals,
      agentDialogue,
      trainerKeyConfigured,
      trainerPermissions: TRAINER_AGENT_PERMISSION_MANIFEST,
      stats: {
        totalSynonyms: synonyms.length,
        activeSynonyms,
        byType,
        totalMisses: misses.length,
        openMisses,
        totalKnowledge: training.knowledge.length,
        activeKnowledge,
        pendingProposals,
        criticalSecurityAlerts,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'تعذر تحميل بيانات الكوبايلوت' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await verifyAdminAuth(req))) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 403 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  try {
    const body = await req.json();

    if (body?.action === 'test_search') {
      const query = String(body.query || '').trim();
      const t0 = performance.now();
      const { data, error } = await sb.rpc('copilot_search_products', {
        p_query: query,
        p_category: null,
        p_brand: null,
        p_limit: 5,
      });
      const ms = Math.round(performance.now() - t0);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, results: Array.isArray(data) ? data : [], ms });
    }

    if (body?.action === 'save_training_config') {
      const personaName =
        String(body?.persona_name || '').trim().slice(0, 120) ||
        DEFAULT_COPILOT_TRAINING_CONFIG.persona_name;
      const toneGuidelines =
        String(body?.tone_guidelines || '').trim().slice(0, 600) ||
        DEFAULT_COPILOT_TRAINING_CONFIG.tone_guidelines;
      const salesHandoffPrompt =
        String(body?.sales_handoff_prompt || '').trim().slice(0, 300) ||
        DEFAULT_COPILOT_TRAINING_CONFIG.sales_handoff_prompt;
      const extraSystemRules = String(body?.extra_system_rules || '').trim().slice(0, 3000);
      const forbiddenClaims = String(body?.forbidden_claims || '').trim().slice(0, 1500);

      const { data, error } = await sb
        .from('store_copilot_training_config')
        .upsert(
          {
            id: 'default',
            persona_name: personaName,
            tone_guidelines: toneGuidelines,
            sales_handoff_prompt: salesHandoffPrompt,
            extra_system_rules: extraSystemRules,
            forbidden_claims: forbiddenClaims,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(error) ? TRAINING_MIGRATION_MISSING_MSG : error.message,
          },
          { status: isMissingTrainingTableError(error) ? 503 : 500 }
        );
      }

      invalidateCopilotTrainingCache();
      return NextResponse.json({ ok: true, trainingConfig: data });
    }

    if (body?.action === 'create_knowledge') {
      const title = String(body?.title || '').trim().slice(0, 160);
      const answer = String(body?.answer || '').trim().slice(0, 2000);
      const rawCat = String(body?.category || 'general').trim();
      const category = VALID_KNOWLEDGE_CATEGORY_SET.has(rawCat) ? rawCat : 'general';
      const keywords = sanitizeTextArray(body?.keywords);
      const rawPrio = Number(body?.priority);
      const priority = Number.isFinite(rawPrio) ? Math.min(100, Math.max(0, Math.round(rawPrio))) : 10;
      const isActiveKnow = body?.is_active !== false;

      if (!title || !answer) {
        return NextResponse.json(
          { ok: false, error: 'العنوان ونص الإجابة المعتمدة مطلوبان' },
          { status: 400 }
        );
      }

      const { data, error } = await sb
        .from('store_copilot_knowledge')
        .insert({
          title,
          category,
          keywords,
          answer,
          priority,
          is_active: isActiveKnow,
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(error) ? TRAINING_MIGRATION_MISSING_MSG : error.message,
          },
          { status: isMissingTrainingTableError(error) ? 503 : 500 }
        );
      }

      invalidateCopilotTrainingCache();
      return NextResponse.json({ ok: true, knowledgeItem: data });
    }

    if (body?.action === 'approve_proposal') {
      const proposalId = Number(body?.id);
      if (!Number.isInteger(proposalId) || proposalId <= 0) {
        return NextResponse.json({ ok: false, error: 'معرّف المقترح غير صالح' }, { status: 400 });
      }

      const { data: prop, error: propErr } = await sb
        .from('store_copilot_training_proposals')
        .select('*')
        .eq('id', proposalId)
        .maybeSingle();

      if (propErr) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(propErr)
              ? PROPOSALS_MIGRATION_MISSING_MSG
              : propErr.message,
          },
          { status: isMissingTrainingTableError(propErr) ? 503 : 500 }
        );
      }

      if (!prop) {
        return NextResponse.json({ ok: false, error: 'المقترح غير موجود' }, { status: 404 });
      }

      const reviewNote = String(body?.review_note || '').trim().slice(0, 400);
      const res = await approveSingleProposalRow(
        sb,
        prop,
        body?.confirmCriticalOverride === true,
        reviewNote
      );

      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error, ...(res.flags ? { flags: res.flags } : {}) },
          { status: res.status }
        );
      }

      return NextResponse.json({ ok: true, proposal: res.proposal });
    }

    if (body?.action === 'bulk_approve_proposals') {
      const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
      const ids = Array.from(
        new Set(
          rawIds
            .map((v) => Number(v))
            .filter((n) => Number.isInteger(n) && n > 0)
        )
      ).slice(0, 50);

      if (ids.length === 0) {
        return NextResponse.json({ ok: false, error: 'اختر مقترحاً واحداً على الأقل' }, { status: 400 });
      }

      const { data: props, error: fetchErr } = await sb
        .from('store_copilot_training_proposals')
        .select('*')
        .in('id', ids);

      if (fetchErr) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(fetchErr)
              ? PROPOSALS_MIGRATION_MISSING_MSG
              : fetchErr.message,
          },
          { status: isMissingTrainingTableError(fetchErr) ? 503 : 500 }
        );
      }

      const confirmCriticalOverride = body?.confirmCriticalOverride === true;
      const reviewNote = String(body?.review_note || '').trim().slice(0, 400);
      const approvedIds: number[] = [];
      const skipped: Array<{ id: number; error: string }> = [];

      for (const prop of props || []) {
        const res = await approveSingleProposalRow(sb, prop, confirmCriticalOverride, reviewNote);
        if (res.ok) {
          approvedIds.push(prop.id);
        } else {
          skipped.push({ id: prop.id, error: res.error });
        }
      }

      invalidateCopilotTrainingCache();
      if (approvedIds.length === 0 && skipped.length > 0) {
        return NextResponse.json(
          { ok: false, error: skipped[0].error, approvedCount: 0, approvedIds, skipped },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        approvedCount: approvedIds.length,
        approvedIds,
        skipped,
      });
    }

    if (body?.action === 'reject_proposal') {
      const proposalId = Number(body?.id);
      if (!Number.isInteger(proposalId) || proposalId <= 0) {
        return NextResponse.json({ ok: false, error: 'معرّف المقترح غير صالح' }, { status: 400 });
      }

      const reviewNote = String(body?.review_note || '').trim().slice(0, 400);
      const { data: updated, error: updErr } = await sb
        .from('store_copilot_training_proposals')
        .update({
          status: 'rejected',
          review_note: reviewNote,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', proposalId)
        .select('*')
        .single();

      if (updErr) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(updErr)
              ? PROPOSALS_MIGRATION_MISSING_MSG
              : updErr.message,
          },
          { status: isMissingTrainingTableError(updErr) ? 503 : 500 }
        );
      }

      return NextResponse.json({ ok: true, proposal: updated });
    }

    if (body?.action === 'bulk_reject_proposals') {
      const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
      const ids = Array.from(
        new Set(
          rawIds
            .map((v) => Number(v))
            .filter((n) => Number.isInteger(n) && n > 0)
        )
      ).slice(0, 50);

      if (ids.length === 0) {
        return NextResponse.json({ ok: false, error: 'اختر مقترحاً واحداً على الأقل' }, { status: 400 });
      }

      const reviewNote = String(body?.review_note || '').trim().slice(0, 400);
      const { data: rejectedRows, error: rejErr } = await sb
        .from('store_copilot_training_proposals')
        .update({
          status: 'rejected',
          review_note: reviewNote,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids)
        .eq('status', 'pending')
        .select('id');

      if (rejErr) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(rejErr)
              ? PROPOSALS_MIGRATION_MISSING_MSG
              : rejErr.message,
          },
          { status: isMissingTrainingTableError(rejErr) ? 503 : 500 }
        );
      }

      const rejectedIds = Array.isArray(rejectedRows) ? rejectedRows.map((r: any) => r.id) : [];
      return NextResponse.json({
        ok: true,
        rejectedCount: rejectedIds.length,
        rejectedIds,
      });
    }

    if (body?.action === 'send_agent_dialogue_message') {
      const msgText = String(body?.message || '').trim().slice(0, 3000);
      if (!msgText) {
        return NextResponse.json({ ok: false, error: 'نص الرسالة مطلوب' }, { status: 400 });
      }
      const sender: 'admin' | 'antigravity' =
        body?.sender === 'admin' ? 'admin' : 'antigravity';
      const senderName = sender === 'admin' ? 'مدير الموقع' : 'Antigravity AI';
      const res = await appendAgentDialogueMessage(sb, {
        sender,
        sender_name: senderName,
        message: msgText,
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error || 'تعذر حفظ الرسالة' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        entry: res.entry,
        agentDialogue: res.state,
      });
    }

    const term = String(body?.term || '').trim();
    const synonymType = String(body?.synonym_type || 'slang').trim();
    if (!term) {
      return NextResponse.json({ ok: false, error: 'الكلمة الأساسية مطلوبة' }, { status: 400 });
    }
    if (!VALID_SYNONYM_TYPES.has(synonymType)) {
      return NextResponse.json({ ok: false, error: 'نوع المرادف غير صالح' }, { status: 400 });
    }

    const expandTerms = sanitizeTextArray(body?.expand_terms);
    const targetCategories = sanitizeTextArray(body?.target_categories).filter((c) =>
      VALID_CATEGORIES.has(c)
    );
    const notes = String(body?.notes || '').trim();
    const isActive = body?.is_active !== false;

    const { data, error } = await sb
      .from('store_search_synonyms')
      .insert({
        term,
        synonym_type: synonymType,
        expand_terms: expandTerms.length > 0 ? expandTerms : [term],
        target_categories: targetCategories,
        notes,
        is_active: isActive,
      })
      .select('*')
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      const errMessage =
        error.code === '23505'
          ? 'هذا المصطلح موجود بالفعل في جدول المرادفات — يمكنك تعديله مباشرة من الجدول.'
          : error.message;
      return NextResponse.json({ ok: false, error: errMessage }, { status });
    }

    const missId = Number(body?.missId);
    if (Number.isInteger(missId) && missId > 0) {
      await sb
        .from('copilot_search_misses')
        .update({ resolved: true, resolved_synonym: term })
        .eq('id', missId);
    }

    return NextResponse.json({ ok: true, synonym: data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء حفظ المرادف' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  if (!(await verifyAdminAuth(req))) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 403 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'معرّف العنصر مطلوب' }, { status: 400 });
    }

    if (body?.action === 'resolve_miss') {
      const resolved = body?.resolved !== false;
      const resolvedSynonym = body?.resolved_synonym ? String(body.resolved_synonym).trim() : null;
      const { data, error } = await sb
        .from('copilot_search_misses')
        .update({ resolved, resolved_synonym: resolvedSynonym })
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, miss: data });
    }

    if (body?.action === 'update_knowledge') {
      const knowUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body?.title === 'string') {
        const cleanTitle = body.title.trim().slice(0, 160);
        if (!cleanTitle) {
          return NextResponse.json({ ok: false, error: 'عنوان المقال لا يمكن أن يكون فارغاً' }, { status: 400 });
        }
        knowUpdate.title = cleanTitle;
      }
      if (typeof body?.category === 'string') {
        if (!VALID_KNOWLEDGE_CATEGORY_SET.has(body.category)) {
          return NextResponse.json({ ok: false, error: 'تصنيف المعرفة غير صالح' }, { status: 400 });
        }
        knowUpdate.category = body.category;
      }
      if (body?.keywords !== undefined) {
        knowUpdate.keywords = sanitizeTextArray(body.keywords);
      }
      if (typeof body?.answer === 'string') {
        const cleanAnswer = body.answer.trim().slice(0, 2000);
        if (!cleanAnswer) {
          return NextResponse.json({ ok: false, error: 'نص الإجابة لا يمكن أن يكون فارغاً' }, { status: 400 });
        }
        knowUpdate.answer = cleanAnswer;
      }
      if (body?.priority !== undefined) {
        const p = Number(body.priority);
        knowUpdate.priority = Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : 10;
      }
      if (typeof body?.is_active === 'boolean') {
        knowUpdate.is_active = body.is_active;
      }

      const { data, error } = await sb
        .from('store_copilot_knowledge')
        .update(knowUpdate)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: isMissingTrainingTableError(error) ? TRAINING_MIGRATION_MISSING_MSG : error.message,
          },
          { status: isMissingTrainingTableError(error) ? 503 : 500 }
        );
      }

      invalidateCopilotTrainingCache();
      return NextResponse.json({ ok: true, knowledgeItem: data });
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof body?.term === 'string') {
      const cleanTerm = body.term.trim();
      if (!cleanTerm) {
        return NextResponse.json({ ok: false, error: 'الكلمة الأساسية لا يمكن أن تكون فارغة' }, { status: 400 });
      }
      updatePayload.term = cleanTerm;
    }
    if (typeof body?.synonym_type === 'string') {
      if (!VALID_SYNONYM_TYPES.has(body.synonym_type)) {
        return NextResponse.json({ ok: false, error: 'نوع المرادف غير صالح' }, { status: 400 });
      }
      updatePayload.synonym_type = body.synonym_type;
    }
    if (body?.expand_terms !== undefined) {
      updatePayload.expand_terms = sanitizeTextArray(body.expand_terms);
    }
    if (body?.target_categories !== undefined) {
      updatePayload.target_categories = sanitizeTextArray(body.target_categories).filter((c) =>
        VALID_CATEGORIES.has(c)
      );
    }
    if (typeof body?.notes === 'string') {
      updatePayload.notes = body.notes.trim();
    }
    if (typeof body?.is_active === 'boolean') {
      updatePayload.is_active = body.is_active;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: 'لا توجد حقول لتحديثها' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('store_search_synonyms')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      return NextResponse.json(
        {
          ok: false,
          error: error.code === '23505' ? 'الكلمة المطبّعة مكررة مع مرادف آخر' : error.message,
        },
        { status }
      );
    }

    return NextResponse.json({ ok: true, synonym: data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء التحديث' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!(await verifyAdminAuth(req))) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 403 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const id = Number(url.searchParams.get('id'));

    if (
      (kind !== 'synonym' && kind !== 'miss' && kind !== 'knowledge' && kind !== 'proposal') ||
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json({ ok: false, error: 'معاملات الحذف غير صالحة' }, { status: 400 });
    }

    const table =
      kind === 'miss'
        ? 'copilot_search_misses'
        : kind === 'knowledge'
          ? 'store_copilot_knowledge'
          : kind === 'proposal'
            ? 'store_copilot_training_proposals'
            : 'store_search_synonyms';
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) {
      const missingTableMsg =
        kind === 'knowledge'
          ? TRAINING_MIGRATION_MISSING_MSG
          : kind === 'proposal'
            ? PROPOSALS_MIGRATION_MISSING_MSG
            : error.message;
      const isMissing =
        (kind === 'knowledge' || kind === 'proposal') && isMissingTrainingTableError(error);
      return NextResponse.json(
        {
          ok: false,
          error: isMissing ? missingTableMsg : error.message,
        },
        { status: isMissing ? 503 : 500 }
      );
    }

    if (kind === 'knowledge') {
      invalidateCopilotTrainingCache();
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء الحذف' },
      { status: 500 }
    );
  }
}
