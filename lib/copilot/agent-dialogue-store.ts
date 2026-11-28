/**
 * lib/copilot/agent-dialogue-store.ts
 * مخزن الحوار المباشر بين الإيجنت الخارجي وAntigravity عبر الموقع (user_requests).
 * يعمل عبر Service Role فقط على الباك اند، مع قراءة وتحديث آمن بدون الحاجة إلى قيد UNIQUE إضافي.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { containsOrRedactsSecrets } from '@/lib/copilot/proposal-security';

export const AGENT_DIALOGUE_TYPE = 'agent_dialogue';
export const AGENT_DIALOGUE_ROOM = 'antigravity-trainer-room';
const MAX_MESSAGES_IN_ROOM = 80;

export interface AgentDialogueMessage {
  id: string;
  sender: 'external_agent' | 'antigravity' | 'admin';
  sender_name: string;
  message: string;
  reply_to_id?: string | null;
  status: 'unread' | 'read' | 'replied';
  created_at: string;
}

export interface AgentDialogueState {
  messages: AgentDialogueMessage[];
  updatedAt: string;
  unreadForAgent: AgentDialogueMessage[];
  unreadForAntigravity: AgentDialogueMessage[];
}

function sanitizeStoredMessages(raw: unknown): AgentDialogueMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentDialogueMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const text = String(m.message || '').trim();
    if (!text) continue;
    const rawSender = String(m.sender || 'external_agent');
    const sender: AgentDialogueMessage['sender'] =
      rawSender === 'antigravity' || rawSender === 'admin' ? rawSender : 'external_agent';
    const rawStatus = String(m.status || 'unread');
    const status: AgentDialogueMessage['status'] =
      rawStatus === 'read' || rawStatus === 'replied' ? rawStatus : 'unread';
    out.push({
      id: String(m.id || `msg-${out.length + 1}`),
      sender,
      sender_name: String(m.sender_name || sender).slice(0, 80),
      message: containsOrRedactsSecrets(text).sanitized.slice(0, 3000),
      reply_to_id: typeof m.reply_to_id === 'string' ? m.reply_to_id : null,
      status,
      created_at: String(m.created_at || new Date().toISOString()),
    });
  }
  return out.slice(-MAX_MESSAGES_IN_ROOM);
}

function buildState(messages: AgentDialogueMessage[], updatedAt: string): AgentDialogueState {
  return {
    messages,
    updatedAt,
    unreadForAgent: messages.filter(
      (m) => (m.sender === 'antigravity' || m.sender === 'admin') && m.status === 'unread'
    ),
    unreadForAntigravity: messages.filter(
      (m) => m.sender === 'external_agent' && m.status === 'unread'
    ),
  };
}

export async function loadAgentDialogue(sb: SupabaseClient | null): Promise<AgentDialogueState> {
  if (!sb) {
    return buildState([], new Date().toISOString());
  }

  try {
    const { data, error } = await sb
      .from('user_requests')
      .select('id, details, created_at')
      .eq('type', AGENT_DIALOGUE_TYPE)
      .eq('category', AGENT_DIALOGUE_ROOM)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.details) {
      return buildState([], new Date().toISOString());
    }

    const parsed = JSON.parse(data.details) as { messages?: unknown; updatedAt?: unknown };
    const messages = sanitizeStoredMessages(parsed?.messages);
    const updatedAt =
      typeof parsed?.updatedAt === 'string' && parsed.updatedAt
        ? parsed.updatedAt
        : String(data.created_at || new Date().toISOString());
    return buildState(messages, updatedAt);
  } catch {
    return buildState([], new Date().toISOString());
  }
}

export async function appendAgentDialogueMessage(
  sb: SupabaseClient,
  input: {
    sender: 'external_agent' | 'antigravity' | 'admin';
    sender_name: string;
    message: string;
    reply_to_id?: string | null;
  }
): Promise<{
  ok: boolean;
  error?: string;
  entry?: AgentDialogueMessage;
  state: AgentDialogueState;
}> {
  const cleanMessage = String(input.message || '').trim().slice(0, 3000);
  if (!cleanMessage) {
    const cur = await loadAgentDialogue(sb);
    return { ok: false, error: 'نص الرسالة مطلوب.', state: cur };
  }

  if (input.sender === 'antigravity' || input.sender === 'admin') {
    const secretCheck = containsOrRedactsSecrets(cleanMessage);
    if (secretCheck.hasSecret) {
      const cur = await loadAgentDialogue(sb);
      return {
        ok: false,
        error:
          'تم منع إرسال الرسالة لأنها تحتوي على نمط مفتاح سري أو كلمة سر — يُمنع مشاركة أي أسرار مع الإيجنت الخارجي.',
        state: cur,
      };
    }
  }

  const nowIso = new Date().toISOString();
  const { data: existing } = await sb
    .from('user_requests')
    .select('id, details')
    .eq('type', AGENT_DIALOGUE_TYPE)
    .eq('category', AGENT_DIALOGUE_ROOM)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let prevMessages: AgentDialogueMessage[] = [];
  if (existing?.details) {
    try {
      const parsed = JSON.parse(existing.details) as { messages?: unknown };
      prevMessages = sanitizeStoredMessages(parsed?.messages);
    } catch {
      prevMessages = [];
    }
  }

  const isFromExternal = input.sender === 'external_agent';
  const updatedPrev = prevMessages.map((m) => {
    if (isFromExternal && (m.sender === 'antigravity' || m.sender === 'admin') && m.status === 'unread') {
      return { ...m, status: 'replied' as const };
    }
    if (!isFromExternal && m.sender === 'external_agent' && m.status === 'unread') {
      return { ...m, status: 'replied' as const };
    }
    return m;
  });

  const entry: AgentDialogueMessage = {
    id: `dlg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    sender: input.sender,
    sender_name: String(input.sender_name || input.sender).trim().slice(0, 80),
    message: cleanMessage,
    reply_to_id: input.reply_to_id ? String(input.reply_to_id).trim().slice(0, 80) : null,
    status: 'unread',
    created_at: nowIso,
  };

  const nextMessages = [...updatedPrev, entry].slice(-MAX_MESSAGES_IN_ROOM);
  const nextDetails = JSON.stringify({
    updatedAt: nowIso,
    messages: nextMessages,
  });
  const notePreview = `[${entry.sender_name}] ${cleanMessage}`.slice(0, 160);

  if (existing?.id) {
    const { error: updErr } = await sb
      .from('user_requests')
      .update({
        subject: 'حوار الإيجنت الخارجي مع Antigravity',
        details: nextDetails,
        status: isFromExternal ? 'بانتظار رد Antigravity' : 'بانتظار الإيجنت الخارجي',
        admin_note: notePreview,
      })
      .eq('id', existing.id);

    if (updErr) {
      return {
        ok: false,
        error: updErr.message,
        state: buildState(prevMessages, nowIso),
      };
    }
  } else {
    const { error: insErr } = await sb.from('user_requests').insert({
      type: AGENT_DIALOGUE_TYPE,
      category: AGENT_DIALOGUE_ROOM,
      subject: 'حوار الإيجنت الخارجي مع Antigravity',
      details: nextDetails,
      status: isFromExternal ? 'بانتظار رد Antigravity' : 'بانتظار الإيجنت الخارجي',
      admin_note: notePreview,
    });

    if (insErr) {
      return {
        ok: false,
        error: insErr.message,
        state: buildState(prevMessages, nowIso),
      };
    }
  }

  return {
    ok: true,
    entry,
    state: buildState(nextMessages, nowIso),
  };
}
