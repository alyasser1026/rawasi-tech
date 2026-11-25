/**
 * lib/copilot/training-store.ts — مخزن تدريب الكوبايلوت (الباك اند فقط).
 * يقرأ إعدادات السلوك واللهجة وقاعدة معرفة الشركة المخصصة من Supabase مع كاش 60 ثانية
 * وتراجع آمن (Graceful Fallback) إذا لم تُنفَّذ هجرة الجداول بعد.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeArabicSearch } from '@/lib/store-catalog-server';

export const VALID_KNOWLEDGE_CATEGORIES = [
  'general',
  'sales_policy',
  'shipping',
  'warranty',
  'installation',
  'maintenance',
  'smart_home',
  'finishing',
] as const;

export type CopilotKnowledgeCategory = (typeof VALID_KNOWLEDGE_CATEGORIES)[number];

export const VALID_KNOWLEDGE_CATEGORY_SET = new Set<string>(VALID_KNOWLEDGE_CATEGORIES);

export interface CopilotTrainingConfig {
  id: string;
  persona_name: string;
  tone_guidelines: string;
  extra_system_rules: string;
  forbidden_claims: string;
  sales_handoff_prompt: string;
  updated_at?: string;
}

export interface CopilotKnowledgeItem {
  id: number;
  title: string;
  category: CopilotKnowledgeCategory | string;
  keywords: string[];
  answer: string;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CopilotTrainingState {
  ready: boolean;
  config: CopilotTrainingConfig;
  knowledge: CopilotKnowledgeItem[];
}

export const DEFAULT_COPILOT_TRAINING_CONFIG: CopilotTrainingConfig = {
  id: 'default',
  persona_name: 'كوبايلوت متجر فاي تك الذكي',
  tone_guidelines:
    'تحدّث بالعامية المصرية الودودة والمهذبة والمباشرة (واضحة ومختصرة ومركزة على إفادة العميل).',
  extra_system_rules: '',
  forbidden_claims: '',
  sales_handoff_prompt: 'عايز تتكلم مع المبيعات مباشرة ولا نبدأ هنا بالمنتج اللي بتدور عليه؟',
};

const CACHE_TTL_MS = 60_000;

const cacheGlobal = globalThis as typeof globalThis & {
  __phiCopilotTrainingCache?: {
    expiresAt: number;
    state: CopilotTrainingState;
  };
};

export function invalidateCopilotTrainingCache(): void {
  cacheGlobal.__phiCopilotTrainingCache = undefined;
}

export function isMissingTrainingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown; details?: unknown };
  const code = String(record.code || '').toUpperCase();
  const msg = `${String(record.message || '')} ${String(record.details || '')}`.toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function mergeTrainingConfig(raw: Record<string, unknown> | null | undefined): CopilotTrainingConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_COPILOT_TRAINING_CONFIG };
  }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    id: str(raw.id) || DEFAULT_COPILOT_TRAINING_CONFIG.id,
    persona_name: str(raw.persona_name) || DEFAULT_COPILOT_TRAINING_CONFIG.persona_name,
    tone_guidelines: str(raw.tone_guidelines) || DEFAULT_COPILOT_TRAINING_CONFIG.tone_guidelines,
    extra_system_rules: str(raw.extra_system_rules),
    forbidden_claims: str(raw.forbidden_claims),
    sales_handoff_prompt:
      str(raw.sales_handoff_prompt) || DEFAULT_COPILOT_TRAINING_CONFIG.sales_handoff_prompt,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
}

export async function getCachedCopilotTraining(
  sb: SupabaseClient | null,
  opts?: { bypassCache?: boolean }
): Promise<CopilotTrainingState> {
  if (!sb) {
    return {
      ready: false,
      config: { ...DEFAULT_COPILOT_TRAINING_CONFIG },
      knowledge: [],
    };
  }

  const now = Date.now();
  if (
    !opts?.bypassCache &&
    cacheGlobal.__phiCopilotTrainingCache &&
    cacheGlobal.__phiCopilotTrainingCache.expiresAt > now
  ) {
    return cacheGlobal.__phiCopilotTrainingCache.state;
  }

  try {
    const [cfgRes, knowRes] = await Promise.all([
      sb
        .from('store_copilot_training_config')
        .select('*')
        .eq('id', 'default')
        .maybeSingle(),
      sb
        .from('store_copilot_knowledge')
        .select('*')
        .order('priority', { ascending: false })
        .order('id', { ascending: false })
        .limit(200),
    ]);

    if (isMissingTrainingTableError(cfgRes.error) || isMissingTrainingTableError(knowRes.error)) {
      const state: CopilotTrainingState = {
        ready: false,
        config: { ...DEFAULT_COPILOT_TRAINING_CONFIG },
        knowledge: [],
      };
      cacheGlobal.__phiCopilotTrainingCache = {
        expiresAt: now + CACHE_TTL_MS,
        state,
      };
      return state;
    }

    const knowledge: CopilotKnowledgeItem[] = Array.isArray(knowRes.data)
      ? knowRes.data.map((row: any) => ({
          id: Number(row.id),
          title: String(row.title || ''),
          category: String(row.category || 'general'),
          keywords: Array.isArray(row.keywords) ? row.keywords.map((k: unknown) => String(k)) : [],
          answer: String(row.answer || ''),
          priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 10,
          is_active: row.is_active !== false,
          created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
          updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
        }))
      : [];

    const state: CopilotTrainingState = {
      ready: !cfgRes.error && !knowRes.error,
      config: mergeTrainingConfig(cfgRes.data as Record<string, unknown> | null),
      knowledge,
    };

    cacheGlobal.__phiCopilotTrainingCache = {
      expiresAt: now + CACHE_TTL_MS,
      state,
    };
    return state;
  } catch {
    return {
      ready: false,
      config: { ...DEFAULT_COPILOT_TRAINING_CONFIG },
      knowledge: [],
    };
  }
}

export function matchCopilotKnowledge(
  query: string,
  items: CopilotKnowledgeItem[],
  maxItems = 3
): CopilotKnowledgeItem[] {
  const nq = normalizeArabicSearch(query);
  if (!nq || !Array.isArray(items) || items.length === 0) return [];

  const qTokens = nq.split(/\s+/).filter((t) => t.length >= 2);
  if (qTokens.length === 0) return [];

  const paddedQuery = ` ${nq} `;
  const ranked: Array<{ item: CopilotKnowledgeItem; relevance: number; sortScore: number }> = [];

  for (const item of items) {
    if (!item || item.is_active !== true) continue;

    let relevance = 0;
    const normTitle = normalizeArabicSearch(item.title || '');
    const normAnswer = normalizeArabicSearch(item.answer || '');
    const paddedTitle = ` ${normTitle} `;
    const paddedAnswer = ` ${normAnswer} `;

    const seenKwTokens = new Set<string>();
    for (const kwRaw of item.keywords || []) {
      const nkw = normalizeArabicSearch(kwRaw);
      if (!nkw) continue;

      if (paddedQuery.includes(` ${nkw} `)) {
        relevance += 12;
      }

      for (const kwTok of nkw.split(/\s+/).filter((t) => t.length >= 2)) {
        seenKwTokens.add(kwTok);
      }
    }

    for (const kwTok of seenKwTokens) {
      if (qTokens.includes(kwTok) || (kwTok.length > 3 && nq.includes(kwTok))) {
        relevance += 4;
      }
    }

    for (const tok of qTokens) {
      if (paddedTitle.includes(` ${tok} `) || (tok.length > 3 && normTitle.includes(tok))) {
        relevance += 3;
      }
      if (paddedAnswer.includes(` ${tok} `) || (tok.length > 3 && normAnswer.includes(tok))) {
        relevance += 1.5;
      }
    }

    if (relevance >= 4) {
      const priorityBoost = Math.min(Math.max(Number(item.priority || 0), 0), 50) * 0.1;
      ranked.push({
        item,
        relevance,
        sortScore: relevance + priorityBoost,
      });
    }
  }

  ranked.sort((a, b) => b.sortScore - a.sortScore || b.item.id - a.item.id);
  return ranked.slice(0, Math.max(1, maxItems)).map((r) => r.item);
}

export function formatTrainingConfigForPrompt(config: CopilotTrainingConfig): string {
  const extraRules = (config.extra_system_rules || '').trim().slice(0, 1500);
  const forbidden = (config.forbidden_claims || '').trim().slice(0, 800);
  if (!extraRules && !forbidden) return '';

  const lines: string[] = [
    '### توجيهات التدريب الإضافية المعتمدة من الإدارة:',
    `- الشخصية: ${(config.persona_name || DEFAULT_COPILOT_TRAINING_CONFIG.persona_name).trim()}`,
    `- الأسلوب: ${(config.tone_guidelines || DEFAULT_COPILOT_TRAINING_CONFIG.tone_guidelines).trim().slice(0, 400)}`,
    `- نص عرض المبيعات: ${(config.sales_handoff_prompt || DEFAULT_COPILOT_TRAINING_CONFIG.sales_handoff_prompt).trim().slice(0, 250)}`,
  ];
  if (extraRules) {
    lines.push(`- تعليمات إضافية:\n${extraRules}`);
  }
  if (forbidden) {
    lines.push(`- ممنوعات إضافية:\n${forbidden}`);
  }
  return lines.join('\n');
}

export function formatMatchedKnowledgeForPrompt(matches: CopilotKnowledgeItem[]): string {
  if (!Array.isArray(matches) || matches.length === 0) return '';

  const header = '### إجابات معتمدة من قاعدة معرفة الشركة (استخدمها عند الصلة دون اختراع تفاصيل غيرها):';
  const blocks: string[] = [];
  let remaining = 1800 - header.length;

  for (const item of matches.slice(0, 3)) {
    const entry = `- **${item.title.trim()}** (${item.category}): ${item.answer.trim()}`;
    if (entry.length + 1 > remaining) {
      const clipped = entry.slice(0, Math.max(0, remaining - 4)).trim();
      if (clipped.length > 20) blocks.push(`${clipped}...`);
      break;
    }
    blocks.push(entry);
    remaining -= entry.length + 1;
  }

  return blocks.length > 0 ? `${header}\n${blocks.join('\n')}` : '';
}
