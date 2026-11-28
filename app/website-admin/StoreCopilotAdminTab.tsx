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

interface KnowledgeItemRow {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  answer: string;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ProposalSecurityFlag {
  code: string;
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  field: string;
  excerpt: string;
}

interface TrainerProposalRow {
  id: number;
  agent_name: string;
  proposal_type: 'synonym' | 'knowledge' | 'training_config' | 'blocked_attempt';
  title: string;
  reason: string;
  requested_scope: string;
  payload: Record<string, unknown>;
  risk_level: 'safe' | 'warning' | 'critical';
  security_flags: ProposalSecurityFlag[];
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  review_note: string;
  reviewed_at?: string | null;
  created_at: string;
}

interface TrainerPermissionsManifest {
  allowed: string[];
  denied: string[];
}

interface AgentDialogueMessageItem {
  id: string;
  sender: 'external_agent' | 'antigravity' | 'admin';
  sender_name: string;
  message: string;
  reply_to_id?: string | null;
  status: 'unread' | 'read' | 'replied';
  created_at: string;
}

interface CopilotConversionMetrics {
  enabled: boolean;
  startedAt: string;
  totalSearches: number;
  synonymMatchedSearches: number;
  foundSearches: number;
  zeroMatchSearches: number;
  cartActionsCount: number;
  cartItemsAddedTotal: number;
  synonymAssistedCartActions: number;
  submittedOrdersCount: number;
  synonymAssistedSubmissions: number;
  escalationsCount: number;
  synonymAssistedEscalations: number;
  topSynonymTerms: Array<{
    key: string;
    searches: number;
    carts: number;
    orders: number;
    escalations: number;
  }>;
}

interface AdminStats {
  totalSynonyms: number;
  activeSynonyms: number;
  byType: Record<string, number>;
  totalMisses: number;
  openMisses: number;
  totalKnowledge?: number;
  activeKnowledge?: number;
  pendingProposals?: number;
  criticalSecurityAlerts?: number;
  conversionMetrics?: CopilotConversionMetrics;
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

const KNOWLEDGE_CATEGORY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'general', label: 'عام' },
  { id: 'sales_policy', label: 'سياسة المبيعات والأسعار' },
  { id: 'shipping', label: 'الشحن والتوصيل' },
  { id: 'warranty', label: 'الضمان وخدمة ما بعد البيع' },
  { id: 'installation', label: 'التركيبات والمعاينة' },
  { id: 'maintenance', label: 'الصيانة والتنفيذ' },
  { id: 'smart_home', label: 'السمارت هوم والحساسات' },
  { id: 'finishing', label: 'التشطيبات والمقاولات' },
];

const KNOWLEDGE_CAT_MAP = new Map<string, string>(
  KNOWLEDGE_CATEGORY_OPTIONS.map((c) => [c.id, c.label])
);

const CAT_NAME_MAP = new Map<string, string>(
  PRODUCT_CATEGORIES.map((c) => [c.id, `${c.icon} ${c.shortTitle || c.title}`])
);

export default function StoreCopilotAdminTab() {
  const [subTab, setSubTab] = useState<'synonyms' | 'behavior' | 'knowledge' | 'proposals'>(
    'synonyms'
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [synonyms, setSynonyms] = useState<SynonymRow[]>([]);
  const [misses, setMisses] = useState<SearchMissRow[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [trainingReady, setTrainingReady] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemRow[]>([]);
  const [proposalsReady, setProposalsReady] = useState(false);
  const [proposals, setProposals] = useState<TrainerProposalRow[]>([]);
  const [trainerKeyConfigured, setTrainerKeyConfigured] = useState(false);
  const [trainerPermissions, setTrainerPermissions] = useState<TrainerPermissionsManifest | null>(
    null
  );
  const [propFilter, setPropFilter] = useState<'pending' | 'alerts' | 'all'>('pending');
  const [criticalOverrideConfirm, setCriticalOverrideConfirm] = useState<Record<number, boolean>>(
    {}
  );
  const [selectedProposalIds, setSelectedProposalIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [agentDialogueMessages, setAgentDialogueMessages] = useState<AgentDialogueMessageItem[]>(
    []
  );
  const [dialogueDraft, setDialogueDraft] = useState('');
  const [dialogueSenderMode, setDialogueSenderMode] = useState<'antigravity' | 'admin'>(
    'antigravity'
  );
  const [dialogueBusy, setDialogueBusy] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalSynonyms: 0,
    activeSynonyms: 0,
    byType: { slang: 0, brand: 0, product: 0, category: 0 },
    totalMisses: 0,
    openMisses: 0,
    totalKnowledge: 0,
    activeKnowledge: 0,
    pendingProposals: 0,
    criticalSecurityAlerts: 0,
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

  // إعدادات السلوك والبرومبت المخصصة
  const [personaName, setPersonaName] = useState('كوبايلوت متجر فاي تك الذكي');
  const [toneGuidelines, setToneGuidelines] = useState('');
  const [salesHandoffPrompt, setSalesHandoffPrompt] = useState('');
  const [extraSystemRules, setExtraSystemRules] = useState('');
  const [forbiddenClaims, setForbiddenClaims] = useState('');

  // نموذج قاعدة معرفة الشركة المدربة
  const [editingKnowId, setEditingKnowId] = useState<number | null>(null);
  const [knowTitle, setKnowTitle] = useState('');
  const [knowCategory, setKnowCategory] = useState('general');
  const [knowKeywords, setKnowKeywords] = useState('');
  const [knowAnswer, setKnowAnswer] = useState('');
  const [knowPriority, setKnowPriority] = useState(10);
  const [knowActive, setKnowActive] = useState(true);

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
  const knowFormRef = useRef<HTMLDivElement | null>(null);

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
      setTrainingReady(Boolean(data.trainingReady));
      setKnowledgeItems(Array.isArray(data.knowledgeItems) ? data.knowledgeItems : []);
      setProposalsReady(Boolean(data.proposalsReady));
      const nextProposals: TrainerProposalRow[] = Array.isArray(data.proposals)
        ? data.proposals
        : [];
      setProposals(nextProposals);
      const pendingIdSet = new Set(
        nextProposals
          .filter((p) => p.status === 'pending' && p.proposal_type !== 'blocked_attempt')
          .map((p) => p.id)
      );
      setSelectedProposalIds((prev) => prev.filter((id) => pendingIdSet.has(id)));
      setTrainerKeyConfigured(Boolean(data.trainerKeyConfigured));
      setAgentDialogueMessages(
        Array.isArray(data.agentDialogue?.messages) ? data.agentDialogue.messages : []
      );
      setTrainerPermissions(
        data.trainerPermissions && typeof data.trainerPermissions === 'object'
          ? (data.trainerPermissions as TrainerPermissionsManifest)
          : null
      );
      if (data.trainingConfig && typeof data.trainingConfig === 'object') {
        setPersonaName(String(data.trainingConfig.persona_name || 'كوبايلوت متجر فاي تك الذكي'));
        setToneGuidelines(String(data.trainingConfig.tone_guidelines || ''));
        setSalesHandoffPrompt(String(data.trainingConfig.sales_handoff_prompt || ''));
        setExtraSystemRules(String(data.trainingConfig.extra_system_rules || ''));
        setForbiddenClaims(String(data.trainingConfig.forbidden_claims || ''));
      }
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

  const resetKnowledgeForm = () => {
    setEditingKnowId(null);
    setKnowTitle('');
    setKnowCategory('general');
    setKnowKeywords('');
    setKnowAnswer('');
    setKnowPriority(10);
    setKnowActive(true);
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

  const handleSaveTrainingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_training_config',
          persona_name: personaName.trim(),
          tone_guidelines: toneGuidelines.trim(),
          sales_handoff_prompt: salesHandoffPrompt.trim(),
          extra_system_rules: extraSystemRules.trim(),
          forbidden_claims: forbiddenClaims.trim(),
        }),
      });
      setMsg('تم حفظ إعدادات السلوك واللهجة في الباك اند وتفعيلها فوراً ✅');
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر حفظ إعدادات التدريب');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowTitle.trim() || !knowAnswer.trim() || busy) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const keywords = knowKeywords
        .split(/[،,\n]+/)
        .map((k) => k.trim())
        .filter(Boolean);

      if (editingKnowId !== null) {
        await authedRequest('/api/store-copilot/admin', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'update_knowledge',
            id: editingKnowId,
            title: knowTitle.trim(),
            category: knowCategory,
            keywords,
            answer: knowAnswer.trim(),
            priority: knowPriority,
            is_active: knowActive,
          }),
        });
        setMsg(`تم تحديث مقال المعرفة "${knowTitle.trim()}" بنجاح ✅`);
      } else {
        await authedRequest('/api/store-copilot/admin', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_knowledge',
            title: knowTitle.trim(),
            category: knowCategory,
            keywords,
            answer: knowAnswer.trim(),
            priority: knowPriority,
            is_active: knowActive,
          }),
        });
        setMsg(`تمت إضافة "${knowTitle.trim()}" إلى قاعدة معرفة الكوبايلوت ✅`);
      }
      resetKnowledgeForm();
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر حفظ مقال المعرفة');
    } finally {
      setBusy(false);
    }
  };

  const handleEditKnowledge = (item: KnowledgeItemRow) => {
    setEditingKnowId(item.id);
    setKnowTitle(item.title);
    setKnowCategory(item.category || 'general');
    setKnowKeywords((item.keywords || []).join('، '));
    setKnowAnswer(item.answer);
    setKnowPriority(Number(item.priority || 10));
    setKnowActive(Boolean(item.is_active));
    setSubTab('knowledge');
    setErr('');
    setMsg('');
    knowFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleToggleKnowledgeActive = async (item: KnowledgeItemRow) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await authedRequest('/api/store-copilot/admin', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'update_knowledge',
          id: item.id,
          is_active: !item.is_active,
        }),
      });
      setKnowledgeItems((prev) =>
        prev.map((k) => (k.id === item.id ? { ...k, is_active: !item.is_active } : k))
      );
      setMsg(`تم ${!item.is_active ? 'تفعيل' : 'تعطيل'} "${item.title}".`);
    } catch (e: any) {
      setErr(e?.message || 'تعذر تغيير حالة المقال');
    } finally {
      setBusy(false);
    }
  };

  const toggleProposalSelection = (id: number) => {
    setSelectedProposalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllProposals = (candidateIds: number[]) => {
    if (candidateIds.length === 0) return;
    const allSelected = candidateIds.every((id) => selectedProposalIds.includes(id));
    if (allSelected) {
      const candidateSet = new Set(candidateIds);
      setSelectedProposalIds((prev) => prev.filter((id) => !candidateSet.has(id)));
    } else {
      setSelectedProposalIds((prev) => Array.from(new Set([...prev, ...candidateIds])));
    }
  };

  const handleBulkApproveProposals = async (idsToApprove?: number[]) => {
    if (busy || bulkBusy) return;
    const rawIds =
      idsToApprove && idsToApprove.length > 0 ? idsToApprove : selectedProposalIds;
    const ids = Array.from(new Set(rawIds)).filter((id) => {
      const p = proposals.find((row) => row.id === id);
      return Boolean(p && p.status === 'pending' && p.proposal_type !== 'blocked_attempt');
    });
    if (ids.length === 0) {
      setErr('اختر مقترحاً واحداً على الأقل من علامة التحديد قبل الإضافة.');
      return;
    }
    const unconfirmedCritical = ids.filter((id) => {
      const p = proposals.find((row) => row.id === id);
      return p?.risk_level === 'critical' && !criticalOverrideConfirm[id];
    });
    if (unconfirmedCritical.length > 0) {
      setErr(
        `المقترحات المحددة تحتوي عناصر عالية الخطورة (${unconfirmedCritical.map((id) => `#${id}`).join('، ')}) — فعّل تأكيد المراجعة اليدوية لها أولاً أو أزل تحديدها.`
      );
      return;
    }

    setBulkBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulk_approve_proposals',
          ids,
          confirmCriticalOverride: true,
        }),
      });
      const approvedIds: number[] = Array.isArray(res.approvedIds) ? res.approvedIds : ids;
      const approvedSet = new Set(approvedIds);
      setSelectedProposalIds((prev) => prev.filter((id) => !approvedSet.has(id)));
      setMsg(`تمت إضافة وتفعيل ${res.approvedCount ?? approvedIds.length} مقترح بنجاح ✅`);
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر تنفيذ الإضافة الجماعية');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkRejectProposals = async (idsToReject?: number[]) => {
    if (busy || bulkBusy) return;
    const rawIds =
      idsToReject && idsToReject.length > 0 ? idsToReject : selectedProposalIds;
    const ids = Array.from(new Set(rawIds)).filter((id) => {
      const p = proposals.find((row) => row.id === id);
      return Boolean(p && p.status === 'pending' && p.proposal_type !== 'blocked_attempt');
    });
    if (ids.length === 0) {
      setErr('اختر مقترحاً واحداً على الأقل لرفضه.');
      return;
    }

    setBulkBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulk_reject_proposals',
          ids,
        }),
      });
      const rejectedSet = new Set(ids);
      setSelectedProposalIds((prev) => prev.filter((id) => !rejectedSet.has(id)));
      setMsg(`تم رفض ${res.rejectedCount ?? ids.length} مقترح.`);
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر تنفيذ الرفض الجماعي');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleEditProposalInForm = (prop: TrainerProposalRow) => {
    const payloadObj =
      prop.payload && typeof prop.payload === 'object' && !Array.isArray(prop.payload)
        ? (prop.payload as Record<string, unknown>)
        : {};
    const synTerm = String(payloadObj.term || prop.title || '').trim();
    const rawSynType = String(payloadObj.synonym_type || 'slang').trim();
    const validSynType: SynonymRow['synonym_type'] =
      rawSynType === 'slang' ||
      rawSynType === 'brand' ||
      rawSynType === 'product' ||
      rawSynType === 'category'
        ? rawSynType
        : 'slang';
    const linkedProduct = String(
      payloadObj.linked_product ?? payloadObj.product_name ?? payloadObj.product ?? ''
    ).trim();
    const orderScenario = String(payloadObj.order_scenario ?? payloadObj.scenario ?? '').trim();
    const expandList = Array.isArray(payloadObj.expand_terms)
      ? payloadObj.expand_terms.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    if (linkedProduct && linkedProduct !== synTerm && !expandList.includes(linkedProduct)) {
      expandList.unshift(linkedProduct);
    }
    const cats = Array.isArray(payloadObj.target_categories)
      ? payloadObj.target_categories
          .map((c) => String(c || '').trim())
          .filter((c) => CAT_NAME_MAP.has(c))
      : [];
    const baseNote = String(payloadObj.notes || prop.reason || '').trim();
    const mergedNote =
      orderScenario && !baseNote.includes(orderScenario)
        ? [baseNote, `سيناريو الطلب: ${orderScenario}`].filter(Boolean).join(' | ')
        : baseNote;

    const missIdNum = Number(payloadObj.missId ?? payloadObj.resolve_miss_id);
    const linkedMiss =
      Number.isInteger(missIdNum) && missIdNum > 0
        ? misses.find((m) => m.id === missIdNum) || null
        : null;

    setEditingId(null);
    setTrainingMiss(linkedMiss);
    setTerm(synTerm);
    setSynType(validSynType);
    setExpandText(expandList.join('، '));
    setTargetCats(cats);
    setNotes(mergedNote.slice(0, 240));
    setIsActive(true);
    setSubTab('synonyms');
    setErr('');
    setMsg(`تم تحميل مقترح الإيجنت "#${prop.id} — ${prop.title}" في النموذج — راجعه ثم اضغط «إضافة وحفظ المرادف».`);
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleApproveProposal = async (prop: TrainerProposalRow) => {
    if (busy || bulkBusy) return;
    if (prop.risk_level === 'critical' && !criticalOverrideConfirm[prop.id]) {
      setErr('فعّل خيار «تأكيد المراجعة الأمنية اليدوية» أولاً قبل اعتماد مقترح عالي الخطورة.');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve_proposal',
          id: prop.id,
          confirmCriticalOverride: Boolean(criticalOverrideConfirm[prop.id]),
        }),
      });
      setSelectedProposalIds((prev) => prev.filter((id) => id !== prop.id));
      setMsg(`تمت إضافة وتفعيل المقترح "${prop.title}" على طول ✅`);
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر اعتماد المقترح');
    } finally {
      setBusy(false);
    }
  };

  const handleRejectProposal = async (prop: TrainerProposalRow) => {
    if (busy || bulkBusy) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reject_proposal',
          id: prop.id,
        }),
      });
      setSelectedProposalIds((prev) => prev.filter((id) => id !== prop.id));
      setMsg(`تم رفض المقترح "${prop.title}".`);
      await loadData();
    } catch (e: any) {
      setErr(e?.message || 'تعذر رفض المقترح');
    } finally {
      setBusy(false);
    }
  };

  const handleSendDialogueMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = dialogueDraft.trim();
    if (!clean || dialogueBusy) return;
    setDialogueBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await authedRequest('/api/store-copilot/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send_agent_dialogue_message',
          message: clean,
          sender: dialogueSenderMode,
        }),
      });
      if (Array.isArray(res.agentDialogue?.messages)) {
        setAgentDialogueMessages(res.agentDialogue.messages);
      }
      setDialogueDraft('');
      setMsg('تم إرسال الرسالة إلى غرفة التواصل مع الإيجنت الخارجي ✅');
    } catch (e: any) {
      setErr(e?.message || 'تعذر إرسال الرسالة');
    } finally {
      setDialogueBusy(false);
    }
  };

  const handleDeleteRow = async (
    kind: 'synonym' | 'miss' | 'knowledge' | 'proposal',
    id: number,
    label: string
  ) => {
    if (busy || bulkBusy || !window.confirm(`هل تريد حذف "${label}"؟`)) return;
    setBusy(true);
    setErr('');
    try {
      await authedRequest(`/api/store-copilot/admin?kind=${kind}&id=${id}`, {
        method: 'DELETE',
      });
      if (editingId === id && kind === 'synonym') resetForm();
      if (editingKnowId === id && kind === 'knowledge') resetKnowledgeForm();
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

  const pendingSynonymProposals = useMemo(() => {
    return proposals.filter((p) => p.status === 'pending' && p.proposal_type === 'synonym');
  }, [proposals]);

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (propFilter === 'pending') return p.status === 'pending';
      if (propFilter === 'alerts') {
        return p.status === 'blocked' || p.risk_level === 'critical' || p.risk_level === 'warning';
      }
      return true;
    });
  }, [proposals, propFilter]);

  const renderProposalBulkBar = (list: TrainerProposalRow[]) => {
    const selectableIds = list
      .filter((p) => p.status === 'pending' && p.proposal_type !== 'blocked_attempt')
      .map((p) => p.id);
    if (selectableIds.length === 0) return null;

    const selectedInList = selectableIds.filter((id) => selectedProposalIds.includes(id));
    const allChecked =
      selectableIds.length > 0 && selectedInList.length === selectableIds.length;

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1px solid rgba(249,115,22,0.35)',
          background: 'rgba(249,115,22,0.06)',
          marginBottom: '10px',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => toggleSelectAllProposals(selectableIds)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--acc)', cursor: 'pointer' }}
          />
          <span>
            ☑️ تحديد الكل ({selectedInList.length} / {selectableIds.length})
          </span>
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            className="wa-btn"
            disabled={busy || bulkBusy || selectedInList.length === 0}
            onClick={() => void handleBulkApproveProposals(selectedInList)}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 800,
              background: selectedInList.length > 0 ? '#16a34a' : 'var(--card)',
              borderColor: selectedInList.length > 0 ? '#15803d' : 'var(--line)',
              color: selectedInList.length > 0 ? '#ffffff' : 'var(--mut)',
              opacity: selectedInList.length > 0 ? 1 : 0.7,
            }}
          >
            {bulkBusy
              ? 'جارٍ الإضافة...'
              : `➕ إضافة المحدد على طول (${selectedInList.length})`}
          </button>
          <button
            type="button"
            className="wa-btn"
            disabled={busy || bulkBusy || selectedInList.length === 0}
            onClick={() => void handleBulkRejectProposals(selectedInList)}
            style={{
              padding: '7px 12px',
              fontSize: '12.5px',
              opacity: selectedInList.length > 0 ? 1 : 0.7,
            }}
          >
            ❌ رفض المحدد ({selectedInList.length})
          </button>
        </div>
      </div>
    );
  };

  const renderProposalCard = (prop: TrainerProposalRow, compact = false) => {
    const isBlocked = prop.status === 'blocked' || prop.proposal_type === 'blocked_attempt';
    const isCritical = prop.risk_level === 'critical';
    const isWarning = prop.risk_level === 'warning';
    const flags = Array.isArray(prop.security_flags) ? prop.security_flags : [];
    const canSelect = prop.status === 'pending' && !isBlocked;
    const isSelected = selectedProposalIds.includes(prop.id);

    const payloadObj =
      prop.payload && typeof prop.payload === 'object' && !Array.isArray(prop.payload)
        ? (prop.payload as Record<string, unknown>)
        : {};

    const synTerm = String(payloadObj.term || prop.title || '').trim();
    const synTypeRaw = String(payloadObj.synonym_type || 'slang').trim() as SynonymRow['synonym_type'];
    const synTypeMeta = TYPE_LABELS[synTypeRaw] || TYPE_LABELS.slang;
    const linkedProduct = String(
      payloadObj.linked_product ?? payloadObj.product_name ?? payloadObj.product ?? ''
    ).trim();
    const expandTerms = Array.isArray(payloadObj.expand_terms)
      ? payloadObj.expand_terms.map((t) => String(t || '').trim()).filter(Boolean)
      : [];
    const targetCategories = Array.isArray(payloadObj.target_categories)
      ? payloadObj.target_categories.map((c) => String(c || '').trim()).filter(Boolean)
      : [];
    const orderScenario = String(payloadObj.order_scenario ?? payloadObj.scenario ?? '').trim();
    const reasonText = String(prop.reason || '').trim();
    const notesText = String(payloadObj.notes || '').trim();

    const borderColor =
      isBlocked || isCritical
        ? '#dc2626'
        : isSelected
          ? 'var(--acc)'
          : prop.status === 'approved'
            ? '#16a34a'
            : isWarning
              ? '#d97706'
              : 'var(--line)';

    const statusLabel =
      prop.status === 'blocked'
        ? '⛔ محظور تلقائياً'
        : prop.status === 'approved'
          ? '✅ مضاف ومفعّل'
          : prop.status === 'rejected'
            ? '❌ مرفوض'
            : '⏳ جاهز للإضافة';

    const riskBadgeStyle = isCritical
      ? { color: '#b91c1c', borderColor: '#dc2626', background: 'rgba(220,38,38,0.1)' }
      : isWarning
        ? { color: '#b45309', borderColor: '#d97706', background: 'rgba(217,119,6,0.1)' }
        : { color: '#15803d', borderColor: '#16a34a', background: 'rgba(22,163,74,0.08)' };

    return (
      <div
        key={prop.id}
        style={{
          padding: '12px 14px',
          borderRadius: '12px',
          border: `1.5px solid ${borderColor}`,
          background:
            isBlocked || isCritical
              ? 'rgba(220,38,38,0.03)'
              : isSelected
                ? 'rgba(249,115,22,0.05)'
                : prop.status === 'approved'
                  ? 'rgba(22,163,74,0.04)'
                  : 'var(--bg)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              {canSelect ? (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    aria-label={`تحديد المقترح #${prop.id}`}
                    onChange={() => toggleProposalSelection(prop.id)}
                    style={{
                      width: '20px',
                      height: '20px',
                      accentColor: 'var(--acc)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>
                    #{prop.id} — {prop.title}
                  </strong>
                </label>
              ) : (
                <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>
                  {prop.status === 'approved' ? '✅ ' : ''}#{prop.id} — {prop.title}
                </strong>
              )}

              <span className="wa-pill" style={riskBadgeStyle}>
                {isCritical
                  ? '🚨 خطورة عالية'
                  : isWarning
                    ? '⚠️ تحذير أمان'
                    : '✅ آمن'}
              </span>
              <span
                className={`wa-pill ${prop.status === 'approved' ? 'p-ok' : ''}`}
              >
                {statusLabel}
              </span>
              <span className="wa-pill">النوع: {prop.proposal_type}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '4px' }}>
              الإيجنت: <code>{prop.agent_name}</code> • التوقيت:{' '}
              {new Date(prop.created_at).toLocaleString('ar-EG')}
            </div>
          </div>

          {prop.requested_scope && (
            <span
              className="wa-pill"
              style={{
                maxWidth: '100%',
                whiteSpace: 'normal',
                textAlign: 'start',
                borderColor: isBlocked ? '#dc2626' : '#0284c7',
                color: isBlocked ? '#b91c1c' : '#0369a1',
              }}
            >
              🔒 الصلاحية المطلوبة: {prop.requested_scope}
            </span>
          )}
        </div>

        {/* العرض المنظم للاسم والمنتج والقسم وسيناريو الطلب */}
        {prop.proposal_type === 'synonym' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))',
              gap: '8px',
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--mut)', marginBottom: '4px' }}>
                🏷️ الاسم / المصطلح المقترح
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '14.5px', color: 'var(--ink)' }}>{synTerm || '—'}</strong>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: `${synTypeMeta.color}18`,
                    color: synTypeMeta.color,
                  }}
                >
                  {synTypeMeta.label}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--mut)', marginBottom: '4px' }}>
                📦 المنتج والمرادفات المربوطة
              </div>
              {linkedProduct && (
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#0369a1',
                    background: 'rgba(2,132,199,0.08)',
                    border: '1px solid rgba(2,132,199,0.28)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                    marginBottom: '5px',
                    display: 'inline-block',
                  }}
                >
                  🎯 {linkedProduct}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {expandTerms.length > 0 ? (
                  expandTerms.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink)',
                      }}
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--mut)' }}>
                    {linkedProduct ? 'مربوط بالمنتج المحدد' : synTerm}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--mut)', marginBottom: '4px' }}>
                🗂️ القسم المرتبط
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {targetCategories.length > 0 ? (
                  targetCategories.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(249,115,22,0.12)',
                        color: 'var(--acc)',
                      }}
                    >
                      {CAT_NAME_MAP.get(cat) || cat}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--mut)', fontWeight: 700 }}>
                    🌐 كل الأقسام
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--mut)', marginBottom: '4px' }}>
                🛒 سيناريو الطلب / السبب
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.5 }}>
                {orderScenario && (
                  <div style={{ fontWeight: 800, color: '#15803d', marginBottom: reasonText ? '3px' : 0 }}>
                    {orderScenario}
                  </div>
                )}
                {reasonText && <div>{reasonText}</div>}
                {notesText && notesText !== reasonText && notesText !== orderScenario && (
                  <div style={{ fontSize: '11.5px', color: 'var(--mut)', marginTop: '3px' }}>
                    {notesText}
                  </div>
                )}
                {!orderScenario && !reasonText && !notesText && (
                  <span style={{ color: 'var(--mut)' }}>اقتراح عامي من الإيجنت</span>
                )}
              </div>
            </div>
          </div>
        )}

        {prop.proposal_type === 'knowledge' && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--card)',
              display: 'grid',
              gap: '6px',
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <strong>📚 {String(payloadObj.title || prop.title)}</strong>
              <span className="wa-pill">
                🗂️ {KNOWLEDGE_CAT_MAP.get(String(payloadObj.category || 'general')) || 'عام'}
              </span>
            </div>
            {Array.isArray(payloadObj.keywords) && payloadObj.keywords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {payloadObj.keywords.map((kw, kIdx) => (
                  <span
                    key={`${String(kw)}-${kIdx}`}
                    style={{
                      fontSize: '11.5px',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    {String(kw)}
                  </span>
                ))}
              </div>
            )}
            <div style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {String(payloadObj.answer || '')}
            </div>
            {reasonText && (
              <div style={{ color: 'var(--mut)' }}>
                <strong>السبب:</strong> {reasonText}
              </div>
            )}
          </div>
        )}

        {prop.proposal_type !== 'synonym' && prop.proposal_type !== 'knowledge' && reasonText && (
          <div style={{ fontSize: '13px', color: 'var(--ink)' }}>
            <strong>السبب:</strong> {reasonText}
          </div>
        )}

        {flags.length > 0 && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #dc2626',
              background: 'rgba(220,38,38,0.08)',
              display: 'grid',
              gap: '6px',
            }}
          >
            <strong style={{ color: '#b91c1c', fontSize: '13px' }}>
              🚨 الفحص الأمني رصد {flags.length} علامة خطر/صلاحية غير معتادة:
            </strong>
            {flags.map((flag, fIdx) => (
              <div
                key={`${flag.code}-${fIdx}`}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'var(--card)',
                  border: '1px solid rgba(220,38,38,0.28)',
                }}
              >
                <div style={{ fontWeight: 800, color: flag.severity === 'critical' ? '#b91c1c' : '#b45309' }}>
                  • [{flag.code}] {flag.title} — الحقل: <code>{flag.field}</code>
                </div>
                <div style={{ color: 'var(--mut)', marginTop: '2px' }}>{flag.detail}</div>
                {flag.excerpt && (
                  <pre
                    style={{
                      margin: '4px 0 0 0',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      fontSize: '11.5px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      direction: 'ltr',
                    }}
                  >
                    {flag.excerpt}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {!compact && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '12.5px', fontWeight: 800, color: 'var(--acc)' }}>
              👁️ معاينة البيانات الخام (JSON Payload)
            </summary>
            <pre
              style={{
                marginTop: '6px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                direction: 'ltr',
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(prop.payload, null, 2)}
            </pre>
          </details>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            {canSelect && isCritical && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  color: '#b91c1c',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(criticalOverrideConfirm[prop.id])}
                  onChange={(e) =>
                    setCriticalOverrideConfirm((prev) => ({
                      ...prev,
                      [prop.id]: e.target.checked,
                    }))
                  }
                />
                <span>أؤكد أنني راجعت التحذيرات الحرجة يدوياً وأوافق على تطبيقه</span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {canSelect && (
              <>
                <button
                  type="button"
                  className="wa-btn"
                  disabled={busy || bulkBusy || (isCritical && !criticalOverrideConfirm[prop.id])}
                  style={{
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 800,
                    background: '#16a34a',
                    borderColor: '#15803d',
                    color: '#ffffff',
                  }}
                  onClick={() => void handleApproveProposal(prop)}
                >
                  ➕ إضافة على طول
                </button>
                {prop.proposal_type === 'synonym' && (
                  <button
                    type="button"
                    className="wa-btn"
                    disabled={busy || bulkBusy}
                    style={{ padding: '7px 12px', fontSize: '12.5px' }}
                    onClick={() => handleEditProposalInForm(prop)}
                  >
                    ✏️ تعديل في النموذج
                  </button>
                )}
                <button
                  type="button"
                  className="wa-btn"
                  disabled={busy || bulkBusy}
                  style={{ padding: '7px 12px', fontSize: '12.5px' }}
                  onClick={() => void handleRejectProposal(prop)}
                >
                  ❌ رفض
                </button>
              </>
            )}
            <button
              type="button"
              className="wa-btn wa-danger"
              disabled={busy || bulkBusy}
              style={{ padding: '7px 12px', fontSize: '12.5px' }}
              onClick={() => void handleDeleteRow('proposal', prop.id, prop.title)}
            >
              🗑️ حذف
            </button>
          </div>
        </div>
      </div>
    );
  };

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

        <div className="wa-card">
          <div style={{ fontSize: '12.5px', color: 'var(--mut)', fontWeight: 700 }}>
            📚 مقالات المعرفة المدربة
          </div>
          <strong style={{ display: 'block', fontSize: '24px', marginTop: '4px', color: 'var(--ink)' }}>
            {stats.activeKnowledge ?? 0} / {stats.totalKnowledge ?? 0}
          </strong>
          <small style={{ color: trainingReady ? 'var(--ok)' : '#d97706', fontWeight: 700 }}>
            {trainingReady
              ? 'مربوطة بقاعدة البيانات وتعمل بالباك اند'
              : 'تحتاج تشغيل هجرة الجداول أولاً'}
          </small>
        </div>

        <div className="wa-card">
          <div style={{ fontSize: '12.5px', color: 'var(--mut)', fontWeight: 700 }}>
            🛡️ مقترحات وتنبيهات الإيجنت
          </div>
          <strong
            style={{
              display: 'block',
              fontSize: '24px',
              marginTop: '4px',
              color:
                (stats.criticalSecurityAlerts ?? 0) > 0
                  ? 'var(--bad)'
                  : (stats.pendingProposals ?? 0) > 0
                    ? 'var(--acc)'
                    : 'var(--ok)',
            }}
          >
            {stats.pendingProposals ?? 0} معلّق
          </strong>
          <small
            style={{
              color: (stats.criticalSecurityAlerts ?? 0) > 0 ? 'var(--bad)' : 'var(--mut)',
              fontWeight: 700,
            }}
          >
            {(stats.criticalSecurityAlerts ?? 0) > 0
              ? `🚨 ${stats.criticalSecurityAlerts} إنذار أمني/حظر`
              : trainerKeyConfigured
                ? 'المفتاح مضبوط ولا توجد إنذارات'
                : 'المفتاح الخارجي غير مضبوط بعد'}
          </small>
        </div>

        <div className="wa-card">
          <div style={{ fontSize: '12.5px', color: 'var(--mut)', fontWeight: 700 }}>
            🛒 قمع المرادفات والسلة والتحويل
          </div>
          <strong
            style={{
              display: 'block',
              fontSize: '22px',
              marginTop: '4px',
              color: 'var(--ok)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {stats.conversionMetrics?.cartActionsCount ?? 0} سلة •{' '}
            {(stats.conversionMetrics?.submittedOrdersCount ?? 0) +
              (stats.conversionMetrics?.escalationsCount ?? 0)}{' '}
            تحويل
          </strong>
          <small style={{ color: 'var(--mut)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            بحث: {stats.conversionMetrics?.totalSearches ?? 0} (مرادف:{' '}
            {stats.conversionMetrics?.synonymMatchedSearches ?? 0}) • سلة بمرادف:{' '}
            {stats.conversionMetrics?.synonymAssistedCartActions ?? 0}
          </small>
        </div>
      </div>

      {/* تبويبات التدريب الفرعية */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {(
          [
            ['synonyms', '🧠 المرادفات والبحث'],
            ['behavior', '🎯 سلوك المساعد والبرومبت'],
            ['knowledge', '📚 قاعدة معرفة الشركة'],
            [
              'proposals',
              `🛡️ مقترحات الإيجنت والأمان${
                (stats.pendingProposals ?? 0) + (stats.criticalSecurityAlerts ?? 0) > 0
                  ? ` (${stats.pendingProposals ?? 0}${
                      (stats.criticalSecurityAlerts ?? 0) > 0
                        ? ` | 🚨 ${stats.criticalSecurityAlerts}`
                        : ''
                    })`
                  : ''
              }`,
            ],
          ] as const
        ).map(([tabKey, tabLabel]) => {
          const active = subTab === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              className="wa-btn"
              onClick={() => {
                setSubTab(tabKey);
                setErr('');
                setMsg('');
              }}
              style={{
                borderColor: active ? 'var(--acc)' : 'var(--line)',
                color: active ? 'var(--acc)' : 'var(--ink)',
                background: active ? 'rgba(249,115,22,0.12)' : 'var(--card)',
                fontWeight: 800,
              }}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {subTab === 'synonyms' && (
        <>
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

      {pendingSynonymProposals.length > 0 && (
        <div
          className="wa-card"
          style={{
            borderColor: 'rgba(22,163,74,0.4)',
            background: 'linear-gradient(180deg, rgba(22,163,74,0.04) 0%, var(--card) 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                🤖 اقتراحات الإيجنت الجاهزة للإضافة الفورية ({pendingSynonymProposals.length})
              </h3>
              <small className="wa-muted">
                كل مقترح يعرض الاسم والمنتج والقسم وسيناريو الطلب مع علامة تحديد وزر «إضافة على طول».
              </small>
            </div>
            <button
              type="button"
              className="wa-btn"
              onClick={() => setSubTab('proposals')}
              style={{ padding: '6px 11px', fontSize: '12.5px' }}
            >
              🛡️ فتح سجل المقترحات والأمان الكامل
            </button>
          </div>

          {renderProposalBulkBar(pendingSynonymProposals)}

          <div style={{ display: 'grid', gap: '10px' }}>
            {pendingSynonymProposals.map((prop) => renderProposalCard(prop, true))}
          </div>
        </div>
      )}

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
        </>
      )}

      {subTab === 'behavior' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {!trainingReady && (
            <div
              className="wa-alert"
              style={{
                margin: 0,
                borderColor: '#d97706',
                background: 'rgba(217, 119, 6, 0.08)',
                color: 'var(--ink)',
              }}
            >
              ⚠️ جداول تدريب الباك اند غير منشأة في قاعدة البيانات بعد. نفّذ ملف الهجرة{' '}
              <code>supabase/migrations/20261124100000_store_copilot_training.sql</code> في Supabase SQL
              Editor ثم اضغط «🔄 تحديث البيانات» لتفعيل الحفظ المباشر.
            </div>
          )}

          <div className="wa-card">
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>🎯 إعدادات السلوك واللهجة والتعليمات الإضافية</h3>
              <small className="wa-muted">
                تُقرأ هذه الإعدادات في الباك اند فقط (`app/api/store-copilot`) ولا تدخل حزمة المتصفح، مع الإبقاء على
                قواعد الصدق وحماية الأسعار ثابتة دائماً.
              </small>
            </div>

            <form onSubmit={handleSaveTrainingConfig} className="wa-form">
              <label className="wa-f">
                اسم الشخصية (persona_name)
                <input
                  type="text"
                  maxLength={120}
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="مثال: كوبايلوت متجر فاي تك الذكي"
                />
              </label>

              <label className="wa-f">
                عبارة سؤال التحويل للمبيعات (sales_handoff_prompt)
                <input
                  type="text"
                  maxLength={300}
                  value={salesHandoffPrompt}
                  onChange={(e) => setSalesHandoffPrompt(e.target.value)}
                  placeholder="مثال: عايز تتكلم مع المبيعات مباشرة ولا نبدأ هنا بالمنتج اللي بتدور عليه؟"
                />
              </label>

              <label className="wa-f wa-wide">
                إرشادات اللهجة والأسلوب (tone_guidelines)
                <textarea
                  rows={2}
                  maxLength={600}
                  value={toneGuidelines}
                  onChange={(e) => setToneGuidelines(e.target.value)}
                  placeholder="مثال: تحدّث بالعامية المصرية الودودة والمهذبة والمباشرة..."
                />
              </label>

              <label className="wa-f wa-wide">
                تعليمات وقواعد تدريب إضافية (extra_system_rules)
                <textarea
                  rows={5}
                  maxLength={3000}
                  value={extraSystemRules}
                  onChange={(e) => setExtraSystemRules(e.target.value)}
                  placeholder="أضف هنا أي قواعد مبيعات أو أمثلة ردود تريد أن يلتزم بها الكوبايلوت..."
                />
              </label>

              <label className="wa-f wa-wide">
                ممنوعات وعبارات محظور ادعاؤها (forbidden_claims)
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={forbiddenClaims}
                  onChange={(e) => setForbiddenClaims(e.target.value)}
                  placeholder="مثال: ممنوع الوعد بتركيب مجاني أو خصم إضافي غير مسجل أو توافق كاميرات طرف ثالث بدون معاينة."
                />
              </label>

              <div className="wa-wide" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="wa-btn"
                  disabled={busy}
                  onClick={() => void loadData()}
                >
                  🔄 إعادة تحميل من السيرفر
                </button>
                <button
                  type="submit"
                  className="wa-btn wa-primary"
                  disabled={busy || !trainingReady}
                >
                  {busy ? 'جارٍ الحفظ...' : '💾 حفظ وتفعيل إعدادات السلوك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {subTab === 'knowledge' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {!trainingReady && (
            <div
              className="wa-alert"
              style={{
                margin: 0,
                borderColor: '#d97706',
                background: 'rgba(217, 119, 6, 0.08)',
                color: 'var(--ink)',
              }}
            >
              ⚠️ جداول قاعدة المعرفة غير منشأة في قاعدة البيانات بعد. نفّذ ملف الهجرة{' '}
              <code>supabase/migrations/20261124100000_store_copilot_training.sql</code> في Supabase SQL
              Editor لتتمكن من إضافة وتعديل مقالات المعرفة هنا.
            </div>
          )}

          <div className="wa-card" ref={knowFormRef}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingKnowId !== null
                  ? `✏️ تعديل مقال المعرفة (#${editingKnowId})`
                  : '➕ إضافة مقال معرفة أو سياسة شركة'}
              </h3>
              {editingKnowId !== null && (
                <button type="button" className="wa-btn" onClick={resetKnowledgeForm}>
                  ✕ إلغاء التعديل
                </button>
              )}
            </div>

            <form onSubmit={handleSaveKnowledge} className="wa-form">
              <label className="wa-f">
                العنوان *
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={knowTitle}
                  onChange={(e) => setKnowTitle(e.target.value)}
                  placeholder="مثال: سياسة الشحن والتوصيل للمحافظات"
                />
              </label>

              <label className="wa-f">
                التصنيف
                <select
                  value={knowCategory}
                  onChange={(e) => setKnowCategory(e.target.value)}
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
                  {KNOWLEDGE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="wa-f wa-wide">
                كلمات البحث المفتاحية (افصل بفاصلة , أو ،)
                <input
                  type="text"
                  value={knowKeywords}
                  onChange={(e) => setKnowKeywords(e.target.value)}
                  placeholder="مثال: شحن، توصيل، محافظات، مصاريف الشحن، الدلتا"
                />
              </label>

              <label className="wa-f wa-wide">
                نص الإجابة المعتمدة التي يسترشد بها المساعد *
                <textarea
                  rows={4}
                  required
                  maxLength={2000}
                  value={knowAnswer}
                  onChange={(e) => setKnowAnswer(e.target.value)}
                  placeholder="اكتب الإجابة الواضحة والدقيقة التي يجب أن يعتمدها الكوبايلوت..."
                />
              </label>

              <label className="wa-f">
                الأولوية (0 - 100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={knowPriority}
                  onChange={(e) => setKnowPriority(Number(e.target.value) || 0)}
                />
              </label>

              <label
                className="wa-f"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  alignSelf: 'end',
                  paddingBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={knowActive}
                  onChange={(e) => setKnowActive(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ color: 'var(--ink)', fontWeight: 800 }}>مفعّل في الباك اند</span>
              </label>

              <div className="wa-wide" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="wa-btn wa-primary"
                  disabled={busy || !trainingReady || !knowTitle.trim() || !knowAnswer.trim()}
                >
                  {busy
                    ? 'جارٍ الحفظ...'
                    : editingKnowId !== null
                      ? '💾 حفظ تعديلات المقال'
                      : '➕ إضافة وحفظ في المعرفة'}
                </button>
              </div>
            </form>
          </div>

          <div className="wa-card">
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>📚 مقالات قاعدة المعرفة ({knowledgeItems.length})</h3>
              <small className="wa-muted">
                يتم مطابقة أعلى 3 مقالات صلةً بسؤال العميل في الباك اند وإرسالها للنموذج أو في أداة خدمات الشركة.
              </small>
            </div>

            {knowledgeItems.length === 0 ? (
              <p className="wa-muted" style={{ margin: 0 }}>
                {trainingReady
                  ? 'لا توجد مقالات معرفة مسجلة بعد — أضف أول مقال من النموذج أعلاه.'
                  : 'بانتظار تنفيذ هجرة جداول التدريب لعرض المقالات المخزنة.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {knowledgeItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      opacity: item.is_active ? 1 : 0.6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                        <strong style={{ fontSize: '14.5px', color: 'var(--ink)' }}>{item.title}</strong>
                        <span className="wa-pill">
                          {KNOWLEDGE_CAT_MAP.get(item.category) || item.category}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--mut)' }}>
                          أولوية: {item.priority}
                        </span>
                        {!item.is_active && (
                          <span className="wa-pill" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>
                            معطّل
                          </span>
                        )}
                      </div>

                      <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55 }}>
                        {item.answer}
                      </p>

                      {Array.isArray(item.keywords) && item.keywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {item.keywords.map((kw) => (
                            <span
                              key={kw}
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: 'var(--card)',
                                border: '1px solid var(--line)',
                                color: 'var(--mut)',
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <button
                        type="button"
                        className="wa-btn"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => handleEditKnowledge(item)}
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
                          color: item.is_active ? 'var(--mut)' : 'var(--ok)',
                        }}
                        onClick={() => void handleToggleKnowledgeActive(item)}
                      >
                        {item.is_active ? '⏸ تعطيل' : '▶ تفعيل'}
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-danger"
                        disabled={busy}
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => void handleDeleteRow('knowledge', item.id, item.title)}
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
      )}

      {subTab === 'proposals' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* غرفة التواصل المباشر بين الإيجنت الخارجي و Antigravity */}
          <div
            className="wa-card"
            style={{
              borderColor: 'rgba(2,132,199,0.4)',
              background: 'linear-gradient(180deg, rgba(2,132,199,0.05) 0%, var(--card) 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  💬 غرفة التواصل المباشر بين الإيجنت الخارجي و Antigravity ({agentDialogueMessages.length})
                </h3>
                <small className="wa-muted">
                  الإيجنت يتواصل معي عبر <code>POST /api/store-copilot/trainer</code> (حقل{' '}
                  <code>action: &quot;agent_message&quot;</code>)، ويقرأ ردود Antigravity تلقائياً في{' '}
                  <code>GET /api/store-copilot/trainer</code> ضمن <code>antigravityDialogue</code>.
                </small>
              </div>
              <button
                type="button"
                className="wa-btn"
                disabled={loading || dialogueBusy}
                onClick={() => void loadData()}
                style={{ padding: '6px 11px', fontSize: '12.5px' }}
              >
                🔄 تحديث المحادثة
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '8px',
                maxHeight: '280px',
                overflowY: 'auto',
                padding: '8px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                marginBottom: '10px',
              }}
            >
              {agentDialogueMessages.length === 0 ? (
                <p className="wa-muted" style={{ margin: 0, fontSize: '13px' }}>
                  لا توجد رسائل متبادلة بعد — أرسل أول رسالة للإيجنت أدناه أو اطلب من Antigravity مراسلته.
                </p>
              ) : (
                agentDialogueMessages.map((dm) => {
                  const isExt = dm.sender === 'external_agent';
                  const isAgy = dm.sender === 'antigravity';
                  return (
                    <div
                      key={dm.id}
                      style={{
                        padding: '8px 11px',
                        borderRadius: '10px',
                        border: `1px solid ${
                          isExt ? 'rgba(249,115,22,0.4)' : isAgy ? 'rgba(2,132,199,0.4)' : 'rgba(22,163,74,0.4)'
                        }`,
                        background: isExt
                          ? 'rgba(249,115,22,0.06)'
                          : isAgy
                            ? 'rgba(2,132,199,0.06)'
                            : 'rgba(22,163,74,0.06)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                          fontSize: '12px',
                          marginBottom: '4px',
                        }}
                      >
                        <strong style={{ color: 'var(--ink)' }}>
                          {isExt ? '🤖' : isAgy ? '⚡' : '👤'} {dm.sender_name}
                        </strong>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span className="wa-pill">
                            {dm.status === 'replied'
                              ? 'تم الرد'
                              : dm.status === 'read'
                                ? 'مقروءة'
                                : 'جديدة'}
                          </span>
                          <span style={{ color: 'var(--mut)' }}>
                            {new Date(dm.created_at).toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {dm.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSendDialogueMessage}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
            >
              <select
                value={dialogueSenderMode}
                onChange={(e) =>
                  setDialogueSenderMode(e.target.value === 'admin' ? 'admin' : 'antigravity')
                }
                style={{
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '9px 10px',
                  font: 'inherit',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                <option value="antigravity">⚡ باسم Antigravity AI</option>
                <option value="admin">👤 باسم مدير الموقع</option>
              </select>
              <input
                type="text"
                className="wa-4d-search-input"
                value={dialogueDraft}
                onChange={(e) => setDialogueDraft(e.target.value)}
                placeholder="اكتب رسالة أو توجيه ليقرأه الإيجنت الخارجي على الموقع..."
              />
              <button
                type="submit"
                className="wa-btn wa-primary"
                disabled={dialogueBusy || !dialogueDraft.trim()}
              >
                {dialogueBusy ? 'جارٍ الإرسال...' : '📨 إرسال للإيجنت'}
              </button>
            </form>
          </div>

          {/* بطاقة حدود الصلاحيات والأمان للإيجنت الخارجي */}
          <div className="wa-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>🛡️ حدود وصلاحيات الإيجنت الخارجي (/api/store-copilot/trainer)</h3>
                <small className="wa-muted">
                  الإيجنت يعمل عبر هذه النقطة المقيدة فقط — لا يرى ملفات الكود ولا `.env` ولا GitHub ولا يقدر
                  ينفذ أوامر شيل أو يعدّل قاعدة الإنتاج بدون موافقتك هنا.
                </small>
              </div>
              <span
                className={`wa-pill ${trainerKeyConfigured ? 'p-ok' : ''}`}
                style={
                  trainerKeyConfigured
                    ? undefined
                    : { color: '#d97706', borderColor: '#d97706' }
                }
              >
                {trainerKeyConfigured
                  ? '🔐 STORE_COPILOT_TRAINER_KEY مفعّل'
                  : '⚠️ STORE_COPILOT_TRAINER_KEY غير مضبوط في السيرفر'}
              </span>
            </div>

            {trainerPermissions && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                  marginTop: '10px',
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(22,163,74,0.35)',
                    background: 'rgba(22,163,74,0.06)',
                  }}
                >
                  <strong style={{ color: '#15803d', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                    ✅ مسموح للإيجنت فقط:
                  </strong>
                  <ul style={{ margin: 0, paddingInlineStart: '18px', fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.65 }}>
                    {trainerPermissions.allowed.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(220,38,38,0.35)',
                    background: 'rgba(220,38,38,0.06)',
                  }}
                >
                  <strong style={{ color: '#b91c1c', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                    ⛔ محظور نهائياً على الإيجنت:
                  </strong>
                  <ul style={{ margin: 0, paddingInlineStart: '18px', fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.65 }}>
                    {trainerPermissions.denied.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {!proposalsReady && (
            <div
              className="wa-alert"
              style={{
                margin: 0,
                borderColor: '#d97706',
                background: 'rgba(217, 119, 6, 0.08)',
                color: 'var(--ink)',
              }}
            >
              ⚠️ جدول مسودات التدريب وسجل الإنذارات غير منشأ في قاعدة البيانات بعد. نفّذ ملف الهجرة{' '}
              <code>supabase/migrations/20261126020000_store_copilot_trainer_proposals.sql</code> في Supabase
              SQL Editor ثم اضغط «🔄 تحديث البيانات».
            </div>
          )}

          {/* قائمة المقترحات ومحاولات الخطر المحظورة */}
          <div className="wa-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  📬 طابور المراجعة والتنبيهات الأمنية ({filteredProposals.length} من {proposals.length})
                </h3>
                <small className="wa-muted">
                  أي كود مفخخ أو أمر شيل أو محاولة تصعيد صلاحية تُحظر تلقائياً (403) وتُعرض هنا باللون الأحمر
                  مع إرسال تنبيه تيليجرام فوري.
                </small>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(
                  [
                    ['pending', `المعلقة (${stats.pendingProposals ?? 0})`],
                    ['alerts', `🚨 التنبيهات والخطر (${stats.criticalSecurityAlerts ?? 0})`],
                    ['all', `الكل (${proposals.length})`],
                  ] as const
                ).map(([fKey, fLabel]) => (
                  <button
                    key={fKey}
                    type="button"
                    className="wa-btn"
                    onClick={() => setPropFilter(fKey)}
                    style={{
                      padding: '6px 11px',
                      fontSize: '12.5px',
                      borderColor: propFilter === fKey ? 'var(--acc)' : 'var(--line)',
                      color: propFilter === fKey ? 'var(--acc)' : 'var(--ink)',
                      background: propFilter === fKey ? 'rgba(249,115,22,0.1)' : 'var(--card)',
                    }}
                  >
                    {fLabel}
                  </button>
                ))}
              </div>
            </div>

            {filteredProposals.length === 0 ? (
              <p className="wa-muted" style={{ margin: 0 }}>
                {proposalsReady
                  ? 'لا توجد عناصر مطابقة للفلتر الحالي.'
                  : 'بانتظار تنفيذ هجرة جدول مسودات الإيجنت لعرض المقترحات والتنبيهات هنا.'}
              </p>
            ) : (
              <>
                {renderProposalBulkBar(filteredProposals)}
                <div style={{ display: 'grid', gap: '12px' }}>
                  {filteredProposals.map((prop) => renderProposalCard(prop, false))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
