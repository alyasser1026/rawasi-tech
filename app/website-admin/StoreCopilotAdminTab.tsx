"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PRODUCT_CATEGORIES } from '../site/store-catalog';

interface SynonymRow {
  id: number;
  term: string;
  term_normalized: string;
  expand_terms: string[];
  target_categories: string[];
  synonym_type: 'slang' | 'brand' | 'product' | 'category';
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SearchMissRow {
  id: number;
  raw_query: string;
  normalized_query: string;
  category_filter: string | null;
  brand_filter: string | null;
  hit_count: number;
  last_page_url: string | null;
  resolved: boolean;
  resolved_synonym: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface TestSearchHit {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  price: number;
  install_price: number | null;
  currency: string;
  relevance_score: number;
}

interface AdminStats {
  totalSynonyms: number;
  activeSynonyms: number;
  byType: Record<string, number>;
  totalMisses: number;
  openMisses: number;
}

interface OverviewStats {
  total_products: number;
  in_stock_products: number;
  discounted_count: number;
  categories?: unknown[];
}

const TYPE_LABELS: Record<SynonymRow['synonym_type'], { label: string; color: string }> = {
  slang: { label: 'عامية مصرية', color: '#ea580c' },
  brand: { label: 'ماركة', color: '#0284c7' },
  product: { label: 'منتج / صنف', color: '#16a34a' },
  category: { label: 'قسم رئيسي', color: '#7c3aed' },
};

const CAT_NAME_MAP = new Map<string, string>(
  PRODUCT_CATEGORIES.map((c) => [c.id, `${c.icon} ${c.shortTitle || c.title}`])
);

export default function StoreCopilotAdminTab() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [synonyms, setSynonyms] = useState<SynonymRow[]>([]);
  const [misses, setMisses] = useState<SearchMissRow[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalSynonyms: 0,
    activeSynonyms: 0,
    byType: { slang: 0, brand: 0, product: 0, category: 0 },
    totalMisses: 0,
    openMisses: 0,
  });

  // نموذج إضافة / تعديل المرادف
  const [editingId, setEditingId] = useState<number | null>(null);
  const [trainingMiss, setTrainingMiss] = useState<SearchMissRow | null>(null);
  const [term, setTerm] = useState('');
  const [synType, setSynType] = useState<SynonymRow['synonym_type']>('slang');
  const [expandText, setExpandText] = useState('');
  const [targetCats, setTargetCats] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // فلاتر جدول المرادفات وسجل البحث
  const [typeFilter, setTypeFilter] = useState<'all' | SynonymRow['synonym_type']>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [missFilter, setMissFilter] = useState<'open' | 'all'>('open');

  // اختبار البحث الحي
  const [testQuery, setTestQuery] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testHits, setTestHits] = useState<TestSearchHit[] | null>(null);
  const [testMs, setTestMs] = useState<number | null>(null);

  const formCardRef = useRef<HTMLDivElement | null>(null);
  const testerCardRef = useRef<HTMLDivElement | null>(null);

  const authedRequest = useCallback(async (url: string, init?: RequestInit) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('يجب تسجيل الدخول بحساب مدير للوصول لهذه البيانات.');
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'فشل تنفيذ العملية');
    }
    return data;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await authedRequest('/api/store-copilot/admin');
      setSynonyms(Array.isArray(data.synonyms) ? data.synonyms : []);
      setMisses(Array.isArray(data.misses) ? data.misses : []);
      setOverview(data.overview || null);
      if (data.stats) setStats(data.stats);
    } catch (e: any) {
      setErr(e?.message || 'تعذر تحميل بيانات الكوبايلوت');
    } finally {
      setLoading(false);
    }
  }, [authedRequest]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setTrainingMiss(null);
    setTerm('');
    setSynType('slang');
    setExpandText('');
    setTargetCats([]);
    setNotes('');
    setIsActive(true);
  };

  const toggleTargetCat = (catId: string) => {
    setTargetCats((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const handleSaveSynonym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || busy) return;
    setBusy(true);
    setErr('');
    setMsg('');

    try {
      const expandTerms = expandText
        .split(/[،,\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (editingId !== null) {
        await authedRequest('/api/store-copilot/admin', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editingId,
            term: term.trim(),
            synonym_type: synType,
            expand_terms: expandTerms,
            target_categories: targetCats,
            notes: notes.trim(),
            is_active: isActive,
          }),
        });
        setMsg(`تم تحديث المرادف "${term.trim()}" بنجاح ✅`);
      } else {
        await authedRequest('/api/store-copilot/admin', {
          method: 'POST',
          body: JSON.stringify({
            term: term.trim(),
            synonym_type: synType,
            expand_terms: expandTerms,
            target_categories: targetCats,
            notes: notes.trim(),
            is_active: isActive,
            ...(trainingMiss ? { missId: trainingMiss.id } : {}),
          }),
        });
        setMsg(
          trainingMiss
            ? `تمت إضافة المرادف "${term.trim()}" وحل استعلام البحث المسجل بنجاح ✅`
            : `تمت إضافة المرادف "${term.trim()}" وتفعيله فوراً في البحث ✅`
        );
      }

      resetForm();
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'حدث خطأ أثناء حفظ المرادف');
    } finally {
      setBusy(false);
    }
  };

  const handleEditSynonym = (row: SynonymRow) => {
    setTrainingMiss(null);
    setEditingId(row.id);
    setTerm(row.term);
    setSynType(row.synonym_type);
    setExpandText((row.expand_terms || []).join('، '));
    setTargetCats(Array.isArray(row.target_categories) ? row.target_categories : []);
    setNotes(row.notes || '');
    setIsActive(Boolean(row.is_active));
    setErr('');
    setMsg('');
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleToggleActive = async (row: SynonymRow) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await authedRequest('/api/store-copilot/admin', {
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, is_active: !row.is_active }),
      });
      setSynonyms((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, is_active: !row.is_active } : s))
      );
      setMsg(`تم ${!row.is_active ? 'تفعيل' : 'تعطيل'} المرادف "${row.term}".`);
    } catch (e: any) {
      setErr(e?.message || 'تعذر تغيير حالة المرادف');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRow = async (kind: 'synonym' | 'miss', id: number, label: string) => {
    if (busy || !window.confirm(`هل تريد حذف "${label}"؟`)) return;
    setBusy(true);
    setErr('');
    try {
      await authedRequest(`/api/store-copilot/admin?kind=${kind}&id=${id}`, {
        method: 'DELETE',
      });
      if (editingId === id && kind === 'synonym') resetForm();
      setMsg(`تم حذف "${label}" بنجاح.`);
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر الحذف');
    } finally {
      setBusy(false);
    }
  };

  const handleTrainMiss = (miss: SearchMissRow) => {
    setEditingId(null);
    setTrainingMiss(miss);
    setTerm(miss.raw_query);
    setSynType('slang');
    setExpandText(miss.raw_query);
    setTargetCats(
      miss.category_filter && CAT_NAME_MAP.has(miss.category_filter)
        ? [miss.category_filter]
        : []
    );
    setNotes('تدريب من سجل كلمات البحث المفتوحة');
    setIsActive(true);
    setErr('');
    setMsg('');
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleResolveMiss = async (miss: SearchMissRow, resolved: boolean) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await authedRequest('/api/store-copilot/admin', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'resolve_miss',
          id: miss.id,
          resolved,
          resolved_synonym: resolved ? miss.resolved_synonym || 'تمت المراجعة يدوياً' : null,
        }),
      });
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر تحديث حالة الاستعلام');
    } finally {
      setBusy(false);
    }
  };

  const runLiveTest = async (queryText: string) => {
    const clean = queryText.trim();
    if (!clean || testLoading) return;
    setTestQuery(clean);
    setTestLoading(true);
    setErr('');
    try {
      const data = await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'test_search', query: clean }),
      });
      setTestHits(Array.isArray(data.results) ? data.results : []);
      setTestMs(typeof data.ms === 'number' ? data.ms : null);
    } catch (e: any) {
      setErr(e?.message || 'فشل اختبار البحث');
    } finally {
      setTestLoading(false);
    }
  };

  const filteredSynonyms = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return synonyms.filter((s) => {
      if (typeFilter !== 'all' && s.synonym_type !== typeFilter) return false;
      if (!q) return true;
      const blob = [s.term, s.term_normalized, ...(s.expand_terms || []), s.notes || '']
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [synonyms, typeFilter, searchFilter]);

  const filteredMisses = useMemo(() => {
    return misses.filter((m) => (missFilter === 'open' ? !m.resolved : true));
  }, [misses, missFilter]);

  if (loading) {
    return (
      <div className="wa-card">
        <p className="wa-muted">جاري تحميل بيانات الكوبايلوت والمرادفات…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {err && <div className="wa-alert wa-err">⚠️ {err}</div>}
      {msg && <div className="wa-alert wa-ok">{msg}</div>}

      {/* شريط المؤشرات السريعة */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
        }}
      >
        <div className="wa-card">
          <div style={{ fontSize: '12.5px', color: 'var(--mut)', fontWeight: 700 }}>
            📦 المنتجات المفهرسة في SQL
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '4px', color: 'var(--ink)' }}>
            {(overview?.total_products ?? 0).toLocaleString('en-US')}
          </strong>
          <small style={{ color: 'var(--ok)', fontWeight: 700 }}>
            متوفر بالمخزون: {(overview?.in_stock_products ?? 0).toLocaleString('en-US')}
          </small>
        </div>

        <div className="wa-card">
          <div style={{ fontSize: '12.5px', color: 'var(--mut)', fontWeight: 700 }}>
            🧠 المرادفات النشطة
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '4px', color: 'var(--acc)' }}>
            {stats.activeSynonyms} / {stats.totalSynonyms}
          </strong>
          <small style={{ color: 'var(--mut)', fontWeight: 700 }}>
            عامية: {stats.byType.slang || 0} • ماركات: {stats.byType.brand || 0} • منتجات:{' '}
            {stats.byType.product || 0} • أقسام: {stats.byType.category || 0}
          </small>
        </div>

        <div className="wa-card">
          <div style={{ fontSize: '12.5px', color: 'var(--mut)', fontWeight: 700 }}>
            🔎 كلمات بحث تحتاج تدريب
          </div>
          <strong
            style={{
              display: 'block',
              fontSize: '24px',
              marginTop: '4px',
              color: stats.openMisses > 0 ? 'var(--bad)' : 'var(--ok)',
            }}
          >
            {stats.openMisses}
          </strong>
          <small style={{ color: 'var(--mut)', fontWeight: 700 }}>
            إجمالي المسجل: {stats.totalMisses} (تُضاف تلقائياً عند 0 نتائج)
          </small>
        </div>
      </div>

      {/* أداة اختبار البحث الحي بالعامية */}
      <div className="wa-card" ref={testerCardRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0 }}>🔎 اختبار البحث الحي (copilot_search_products)</h3>
            <small className="wa-muted">
              جرّب أي جملة بالعامية المصرية أو كود أو ماركة للتأكد من مطابقة المرادفات والأقسام فوراً.
            </small>
          </div>
          {testMs !== null && (
            <span className="wa-pill p-ok">زمن الاستجابة: {testMs}ms</span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runLiveTest(testQuery);
          }}
          style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            className="wa-4d-search-input"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="مثال: فيشة شنايدر، حنفية جروهي، بلاعة، جيبسون بورد..."
          />
          <button type="submit" className="wa-btn wa-primary" disabled={testLoading || !testQuery.trim()}>
            {testLoading ? 'جارٍ البحث...' : '🔎 اختبر البحث'}
          </button>
          <button
            type="button"
            className="wa-btn"
            onClick={() => void loadData()}
            disabled={busy}
          >
            🔄 تحديث البيانات
          </button>
        </form>

        {testHits && (
          <div style={{ marginTop: '12px', display: 'grid', gap: '6px' }}>
            {testHits.length === 0 ? (
              <div className="wa-alert" style={{ margin: 0, borderColor: 'var(--bad)', color: 'var(--bad)' }}>
                لم تظهر نتائج لهذا الاستعلام — يمكنك إضافته كمرادف في النموذج أدناه!
              </div>
            ) : (
              testHits.map((hit) => (
                <div
                  key={hit.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--ink)' }}>{hit.name}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--mut)' }}>
                      <code>{hit.code}</code> • {hit.brand} • {CAT_NAME_MAP.get(hit.category) || hit.category} • درجة المطابقة:{' '}
                      {Number(hit.relevance_score || 0).toFixed(1)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <strong style={{ color: 'var(--acc)' }}>
                      {Number(hit.price || 0).toLocaleString('en-US')} {hit.currency}
                    </strong>
                    {hit.install_price && hit.install_price > 0 ? (
                      <div style={{ fontSize: '11.5px', color: '#0369a1' }}>
                        + تركيب {Number(hit.install_price).toLocaleString('en-US')}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* نموذج إضافة أو تعديل مرادف */}
      <div className="wa-card" ref={formCardRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>
            {editingId !== null
              ? `✏️ تعديل المرادف (#${editingId})`
              : '➕ إضافة مرادف جديد أو قاعدة عامية'}
          </h3>
          {(editingId !== null || trainingMiss) && (
            <button type="button" className="wa-btn" onClick={resetForm}>
              ✕ إلغاء {editingId !== null ? 'التعديل' : 'التدريب'}
            </button>
          )}
        </div>

        {trainingMiss && (
          <div className="wa-alert" style={{ borderColor: '#0284c7', background: 'rgba(2,132,199,0.08)', color: 'var(--ink)' }}>
            🎓 تدريب كلمة بحث مفتوحة: <strong>«{trainingMiss.raw_query}»</strong> (تكررت{' '}
            {trainingMiss.hit_count} مرة) — أضف لها المرادفات المقابلة في الكتالوج وسيتم إغلاقها تلقائياً عند الحفظ.
          </div>
        )}

        <form onSubmit={handleSaveSynonym} className="wa-form">
          <label className="wa-f">
            الكلمة الأساسية (term) *
            <input
              type="text"
              required
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="مثال: فيشة أو بريزة أو جروهي"
            />
          </label>

          <label className="wa-f">
            النوع (synonym_type)
            <select
              value={synType}
              onChange={(e) => setSynType(e.target.value as SynonymRow['synonym_type'])}
              style={{
                background: 'var(--bg)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '10px 12px',
                font: 'inherit',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <option value="slang">عامية مصرية (slang)</option>
              <option value="brand">ماركة (brand)</option>
              <option value="product">منتج / صنف (product)</option>
              <option value="category">قسم رئيسي (category)</option>
            </select>
          </label>

          <label className="wa-f wa-wide">
            الكلمات والمرادفات المقابلة بالكتالوج (افصل بينها بفاصلة , أو ،)
            <textarea
              rows={2}
              value={expandText}
              onChange={(e) => setExpandText(e.target.value)}
              placeholder="مثال: بريزة، مقبس، سوكيت، فيشة، outlet"
            />
          </label>

          <div className="wa-f wa-wide">
            <span>الأقسام المرتبطة (ترفع ترتيب النتائج من هذه الأقسام +14 نقطة):</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {PRODUCT_CATEGORIES.map((cat) => {
                const selected = targetCats.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleTargetCat(cat.id)}
                    style={{
                      border: selected ? '1.5px solid var(--acc)' : '1px solid var(--line)',
                      background: selected ? 'rgba(249, 115, 22, 0.14)' : 'var(--bg)',
                      color: selected ? 'var(--acc)' : 'var(--ink)',
                      borderRadius: '999px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {cat.icon} {cat.shortTitle}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="wa-f">
            ملاحظات
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة اختيارية لسبب المرادف..."
            />
          </label>

          <label className="wa-f" style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'end', paddingBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ color: 'var(--ink)', fontWeight: 800 }}>مفعّل في البحث فوراً</span>
          </label>

          <div className="wa-wide" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="submit" className="wa-btn wa-primary" disabled={busy || !term.trim()}>
              {busy
                ? 'جارٍ الحفظ...'
                : editingId !== null
                  ? '💾 حفظ التعديلات'
                  : '➕ إضافة وحفظ المرادف'}
            </button>
          </div>
        </form>
      </div>

      {/* جدول مراجعة المرادفات كلها (65+ مرادف) */}
      <div className="wa-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>
            📚 جدول المرادفات ({filteredSynonyms.length} من {synonyms.length})
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {(
              [
                ['all', 'الكل'],
                ['slang', 'عامية'],
                ['brand', 'ماركات'],
                ['product', 'منتجات'],
                ['category', 'أقسام'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="wa-btn"
                onClick={() => setTypeFilter(key)}
                style={{
                  padding: '6px 11px',
                  fontSize: '12.5px',
                  borderColor: typeFilter === key ? 'var(--acc)' : 'var(--line)',
                  color: typeFilter === key ? 'var(--acc)' : 'var(--ink)',
                  background: typeFilter === key ? 'rgba(249,115,22,0.1)' : 'var(--card)',
                }}
              >
                {label}
              </button>
            ))}

            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="فلتر سريع للمرادفات..."
              style={{
                background: 'var(--bg)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: 700,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '8px', maxHeight: '520px', overflowY: 'auto', paddingInlineEnd: '4px' }}>
          {filteredSynonyms.length === 0 ? (
            <p className="wa-muted">لا توجد مرادفات مطابقة للفلتر الحالي.</p>
          ) : (
            filteredSynonyms.map((row) => {
              const typeMeta = TYPE_LABELS[row.synonym_type] || TYPE_LABELS.product;
              return (
                <div
                  key={row.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    opacity: row.is_active ? 1 : 0.6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <strong style={{ fontSize: '14.5px', color: 'var(--ink)' }}>{row.term}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: `${typeMeta.color}18`,
                          color: typeMeta.color,
                        }}
                      >
                        {typeMeta.label}
                      </span>
                      {!row.is_active && (
                        <span className="wa-pill" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>
                          معطّل
                        </span>
                      )}
                      {row.notes && (
                        <span style={{ fontSize: '11.5px', color: 'var(--mut)' }}>• {row.notes}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                      {(row.expand_terms || []).map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'var(--card)',
                            border: '1px solid var(--line)',
                            color: 'var(--ink)',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {Array.isArray(row.target_categories) && row.target_categories.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {row.target_categories.map((cat) => (
                          <span
                            key={cat}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--acc)',
                            }}
                          >
                            [{CAT_NAME_MAP.get(cat) || cat}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="wa-btn"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => {
                        void runLiveTest(row.term);
                        testerCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      🔎 اختبر
                    </button>
                    <button
                      type="button"
                      className="wa-btn"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => handleEditSynonym(row)}
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      type="button"
                      className="wa-btn"
                      disabled={busy}
                      style={{
                        padding: '5px 10px',
                        fontSize: '12px',
                        color: row.is_active ? 'var(--mut)' : 'var(--ok)',
                      }}
                      onClick={() => void handleToggleActive(row)}
                    >
                      {row.is_active ? '⏸ تعطيل' : '▶ تفعيل'}
                    </button>
                    <button
                      type="button"
                      className="wa-btn wa-danger"
                      disabled={busy}
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => void handleDeleteRow('synonym', row.id, row.term)}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* قائمة الكلمات التي بحث عنها العملاء ولم تجد نتائج */}
      <div className="wa-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>🕵️ سجل كلمات البحث بدون نتائج (copilot_search_misses)</h3>
            <small className="wa-muted">
              أي استعلام يكتبه عميل ولا يعيد نتائج يُسجّل هنا تلقائياً لتتمكن من تحويله لمرادف بضغطة واحدة.
            </small>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="wa-btn"
              onClick={() => setMissFilter('open')}
              style={{
                padding: '6px 11px',
                fontSize: '12.5px',
                borderColor: missFilter === 'open' ? 'var(--acc)' : 'var(--line)',
                color: missFilter === 'open' ? 'var(--acc)' : 'var(--ink)',
              }}
            >
              المفتوحة فقط ({stats.openMisses})
            </button>
            <button
              type="button"
              className="wa-btn"
              onClick={() => setMissFilter('all')}
              style={{
                padding: '6px 11px',
                fontSize: '12.5px',
                borderColor: missFilter === 'all' ? 'var(--acc)' : 'var(--line)',
                color: missFilter === 'all' ? 'var(--acc)' : 'var(--ink)',
              }}
            >
              الكل ({stats.totalMisses})
            </button>
          </div>
        </div>

        {filteredMisses.length === 0 ? (
          <p className="wa-muted" style={{ margin: 0 }}>
            {missFilter === 'open'
              ? 'ممتاز! لا توجد كلمات بحث مفتوحة بدون نتائج حالياً. 🎉'
              : 'سجل الكلمات غير الموجودة فارغ حالياً.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {filteredMisses.map((miss) => (
              <div
                key={miss.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{miss.raw_query}</strong>
                    <span className="wa-pill" style={{ color: 'var(--acc)', borderColor: 'var(--acc)' }}>
                      {miss.hit_count}× بحث
                    </span>
                    {miss.resolved ? (
                      <span className="wa-pill p-ok">✓ تم الحل: {miss.resolved_synonym || 'نعم'}</span>
                    ) : (
                      <span className="wa-pill p-عالية">تحتاج تدريب</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '3px' }}>
                    {miss.category_filter ? `القسم: ${miss.category_filter} • ` : ''}
                    {miss.brand_filter ? `الماركة: ${miss.brand_filter} • ` : ''}
                    آخر بحث: {new Date(miss.last_seen_at).toLocaleString('ar-EG')}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {!miss.resolved && (
                    <button
                      type="button"
                      className="wa-btn wa-primary"
                      style={{ padding: '6px 11px', fontSize: '12px' }}
                      onClick={() => handleTrainMiss(miss)}
                    >
                      🎓 حوّل لمرادف
                    </button>
                  )}
                  <button
                    type="button"
                    className="wa-btn"
                    disabled={busy}
                    style={{ padding: '6px 11px', fontSize: '12px' }}
                    onClick={() => void handleResolveMiss(miss, !miss.resolved)}
                  >
                    {miss.resolved ? '↺ إعادة فتح' : '✓ تحديد كمحلول'}
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-danger"
                    disabled={busy}
                    style={{ padding: '6px 11px', fontSize: '12px' }}
                    onClick={() => void handleDeleteRow('miss', miss.id, miss.raw_query)}
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
