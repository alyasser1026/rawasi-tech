import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'config', 'copilot_bot_settings.json');
const MEMORY_FILE = path.join(process.cwd(), 'config', 'copilot_learned_memory.json');
const OPERATIONS_FILE = path.join(process.cwd(), 'work', 'copilot_operations_index.json');

const DEFAULT_SETTINGS = {
  botName: 'م. سليم',
  botTitle: 'المساعد الهندسي والمحاسبي الذكي — فاي تك',
  introEnabled: true,
  introTemplate: '👋 أهلاً بك! معك {botName} ({botTitle}).',
  inactivityCloseEnabled: true,
  inactivityTimeoutMinutes: 3,
  inactivityCloseMessage:
    '⏳ نظراً لعدم وجود رد أو استفسار جديد، تم إنهاء الجلسة الحالية وحفظ السياق.\nأنا ({botName}) موجود دائماً في خدمتك وقتما تبعث رسالة جديدة! 👋',
  voiceReplyMode: 'always',
  operationSeqStart: 101,
};

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath: string, data: unknown) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...readJsonSafe<Record<string, unknown>>(SETTINGS_FILE, {}),
  };
  const memoryStore = readJsonSafe<{ rules?: Array<Record<string, unknown>> }>(MEMORY_FILE, { rules: [] });
  const opsStore = readJsonSafe<{ nextSeq?: number; operations?: Array<Record<string, unknown>> }>(OPERATIONS_FILE, {
    nextSeq: 101,
    operations: [],
  });

  return NextResponse.json({
    ok: true,
    settings,
    learnedRules: Array.isArray(memoryStore.rules) ? memoryStore.rules : [],
    nextOperationSeq: opsStore.nextSeq || 101,
    recentOperations: Array.isArray(opsStore.operations) ? opsStore.operations.slice(0, 30) : [],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action || 'save_settings';

    if (action === 'save_settings') {
      const current = {
        ...DEFAULT_SETTINGS,
        ...readJsonSafe<Record<string, unknown>>(SETTINGS_FILE, {}),
      };
      const payload = body?.settings || body || {};
      const updated = {
        ...current,
        ...(typeof payload.botName === 'string' && payload.botName.trim() ? { botName: payload.botName.trim().slice(0, 60) } : {}),
        ...(typeof payload.botTitle === 'string' && payload.botTitle.trim() ? { botTitle: payload.botTitle.trim().slice(0, 120) } : {}),
        ...(typeof payload.introEnabled === 'boolean' ? { introEnabled: payload.introEnabled } : {}),
        ...(typeof payload.introTemplate === 'string' && payload.introTemplate.trim()
          ? { introTemplate: payload.introTemplate.trim().slice(0, 400) }
          : {}),
        ...(typeof payload.inactivityCloseEnabled === 'boolean'
          ? { inactivityCloseEnabled: payload.inactivityCloseEnabled }
          : {}),
        ...(Number.isFinite(Number(payload.inactivityTimeoutMinutes)) && Number(payload.inactivityTimeoutMinutes) >= 1
          ? { inactivityTimeoutMinutes: Math.min(120, Math.max(1, Math.round(Number(payload.inactivityTimeoutMinutes)))) }
          : {}),
        ...(typeof payload.inactivityCloseMessage === 'string' && payload.inactivityCloseMessage.trim()
          ? { inactivityCloseMessage: payload.inactivityCloseMessage.trim().slice(0, 500) }
          : {}),
        ...(typeof payload.voiceReplyMode === 'string' && ['always', 'on_voice_or_request', 'off'].includes(payload.voiceReplyMode)
          ? { voiceReplyMode: payload.voiceReplyMode }
          : {}),
        updatedAt: new Date().toISOString(),
      };

      writeJsonSafe(SETTINGS_FILE, updated);
      return NextResponse.json({ ok: true, settings: updated });
    }

    if (action === 'add_rule') {
      const ruleText = typeof body?.ruleText === 'string' ? body.ruleText.trim() : '';
      if (!ruleText || ruleText.length < 3) {
        return NextResponse.json({ ok: false, error: 'نص القاعدة قصير جداً' }, { status: 400 });
      }
      const memoryStore = readJsonSafe<{ rules?: Array<Record<string, unknown>>; lastUpdated?: string }>(MEMORY_FILE, { rules: [] });
      const rules = Array.isArray(memoryStore.rules) ? memoryStore.rules : [];
      const newEntry = {
        id: 'RULE-' + Date.now().toString(36).toUpperCase(),
        rule: ruleText.slice(0, 500),
        author: 'شاشة الإعدادات',
        learnedAt: new Date().toISOString(),
      };
      rules.push(newEntry);
      writeJsonSafe(MEMORY_FILE, { rules, lastUpdated: new Date().toISOString() });
      return NextResponse.json({ ok: true, learnedRules: rules });
    }

    if (action === 'delete_rule') {
      const ruleId = String(body?.ruleId || '');
      const memoryStore = readJsonSafe<{ rules?: Array<Record<string, unknown>> }>(MEMORY_FILE, { rules: [] });
      const rules = (Array.isArray(memoryStore.rules) ? memoryStore.rules : []).filter(r => r.id !== ruleId);
      writeJsonSafe(MEMORY_FILE, { rules, lastUpdated: new Date().toISOString() });
      return NextResponse.json({ ok: true, learnedRules: rules });
    }

    return NextResponse.json({ ok: false, error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في حفظ إعدادات البوت';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
