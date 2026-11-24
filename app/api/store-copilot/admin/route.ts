/**
 * app/api/store-copilot/admin/route.ts
 * واجهة إدارة ومراجعة مرادفات البحث وكلمات البحث المفتوحة (copilot_search_misses) للمديرين فقط.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRODUCT_CATEGORIES } from '@/app/site/store-catalog';
import { getCachedCatalogOverview, getServiceSupabase } from '@/lib/store-copilot-tools';

export const runtime = 'nodejs';

const VALID_SYNONYM_TYPES = new Set(['slang', 'brand', 'product', 'category']);
const VALID_CATEGORIES = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));

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

export async function GET(req: Request) {
  if (!(await verifyAdminAuth(req))) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 403 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
  }

  try {
    const [synRes, missRes, overview] = await Promise.all([
      sb.from('store_search_synonyms').select('*').order('synonym_type').order('id'),
      sb
        .from('copilot_search_misses')
        .select('*')
        .order('resolved', { ascending: true })
        .order('hit_count', { ascending: false })
        .order('last_seen_at', { ascending: false })
        .limit(150),
      getCachedCatalogOverview(sb),
    ]);

    if (synRes.error) {
      return NextResponse.json({ ok: false, error: synRes.error.message }, { status: 500 });
    }
    if (missRes.error) {
      return NextResponse.json({ ok: false, error: missRes.error.message }, { status: 500 });
    }

    const synonyms = synRes.data || [];
    const misses = missRes.data || [];
    const byType: Record<string, number> = { slang: 0, brand: 0, product: 0, category: 0 };
    let activeSynonyms = 0;

    for (const s of synonyms) {
      if (s.is_active) activeSynonyms++;
      const t = String(s.synonym_type || 'product');
      byType[t] = (byType[t] || 0) + 1;
    }

    const openMisses = misses.filter((m) => !m.resolved).length;

    return NextResponse.json({
      ok: true,
      synonyms,
      misses,
      overview,
      stats: {
        totalSynonyms: synonyms.length,
        activeSynonyms,
        byType,
        totalMisses: misses.length,
        openMisses,
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

    if ((kind !== 'synonym' && kind !== 'miss') || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'معاملات الحذف غير صالحة' }, { status: 400 });
    }

    const table = kind === 'miss' ? 'copilot_search_misses' : 'store_search_synonyms';
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء الحذف' },
      { status: 500 }
    );
  }
}
