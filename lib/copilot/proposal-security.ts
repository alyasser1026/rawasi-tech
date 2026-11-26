/**
 * lib/copilot/proposal-security.ts — طبقة الأمان وفحص الأكواد المفخخة والصلاحيات للإيجنت الخارجي.
 * - باك اند فقط (ممنوع استيرادها من أي ملف عميل 'use client').
 * - تفشل بالإغلاق (Fail-Closed) إذا لم يكن STORE_COPILOT_TRAINER_KEY مضبوطاً بطول 24 حرفاً فأكثر.
 * - تفحص كل مسودة أو طلب وارد بحثاً عن أوامر تنفيذ، حقن كود/SQL، طلب صلاحيات زائدة، تلاعب بالبرومبت، أو تسريب مفاتيح.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface ProposalSecurityFlag {
  code:
    | 'CODE_INJECTION'
    | 'SHELL_COMMAND_EXEC'
    | 'PRIVILEGE_OR_PERMISSION_REQUEST'
    | 'PROMPT_INJECTION_OR_GUARD_BYPASS'
    | 'SECRET_MATERIAL'
    | 'EXTERNAL_URL'
    | 'UNAUTHORIZED_COMMAND_OR_PERMISSION';
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  field: string;
  excerpt: string;
}

export interface ProposalAuditResult {
  riskLevel: 'safe' | 'warning' | 'critical';
  flags: ProposalSecurityFlag[];
  hasCritical: boolean;
}

export const TRAINER_AGENT_PERMISSION_MANIFEST = {
  allowed: [
    'قراءة قائمة كلمات البحث التي لم تجد نتائج (copilot_search_misses) بدون أي بيانات عملاء',
    'قراءة خريطة الأقسام والملخص العام والمرادفات النشطة وعناوين المعرفة الحالية',
    'تقديم مسودات مقترحة فقط في جدول الانتظار (store_copilot_training_proposals): مرادف، مقال معرفة، أو تعديل لهجة/قواعد',
  ],
  denied: [
    'أي قراءة أو تعديل لملفات الكود المصدرية أو نظام الملفات أو متغيرات البيئة (.env)',
    'أي وصول إلى GitHub أو أوامر git أو النشر المباشر أو تشغيل أوامر الشيل (Shell/CLI)',
    'أي نشر تلقائي مباشر على قاعدة الإنتاج أو تجاوز موافقة المدير في /website-admin',
    'أي قراءة لبيانات العملاء الشخصية أو الجلسات أو الهواتف أو الطلبات أو الأسعار المباشرة',
    'أي طلب أو تعديل لصلاحيات مدير أو RLS أو مفاتيح الخدمة (service_role / tokens)',
  ],
};

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'agent_name',
  'proposal_type',
  'title',
  'reason',
  'payload',
]);

const FORBIDDEN_KEY_NAMES = new Set([
  'command',
  'cmd',
  'shell',
  'exec',
  'spawn',
  'script',
  'code',
  'sql',
  'query_sql',
  'querysql',
  'filepath',
  'file_path',
  'files',
  'patch',
  'diff',
  'writefile',
  'write_file',
  'deletefile',
  'delete_file',
  'permission',
  'permissions',
  'grant',
  'role',
  'is_admin',
  'isadmin',
  'service_role',
  'servicerole',
  'env',
  'secrets',
  'token',
  'github',
  'git',
  'deploy',
  'publish',
  'autoapprove',
  'auto_approve',
  'bypass',
  'runcommand',
  'run_command',
]);

export function verifyTrainerKey(
  req: Request
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const expected = (process.env.STORE_COPILOT_TRAINER_KEY || '').trim();
  if (expected.length < 24) {
    return {
      ok: false,
      status: 503,
      error:
        'مفتاح الإيجنت المدرّب (STORE_COPILOT_TRAINER_KEY) غير مضبوط أو أقل من 24 حرفاً على السيرفر.',
    };
  }

  const headerKey = (req.headers.get('x-trainer-key') || '').trim();
  const authHeader = (req.headers.get('authorization') || '').trim();
  const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const provided = headerKey || bearerKey;

  if (!provided) {
    return { ok: false, status: 401, error: 'مفتاح الإيجنت المدرّب مفقود أو غير صالح.' };
  }

  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  if (!timingSafeEqual(expectedDigest, providedDigest)) {
    return { ok: false, status: 401, error: 'مفتاح الإيجنت المدرّب غير صحيح.' };
  }

  return { ok: true };
}

function normalizeKeyName(key: string): string {
  return String(key || '').trim().toLowerCase();
}

function collectForbiddenPayloadKeys(
  val: unknown,
  prefix: string,
  out: string[],
  depth = 0
): void {
  if (depth > 5 || !val || typeof val !== 'object') return;
  if (Array.isArray(val)) {
    val.slice(0, 40).forEach((item, idx) =>
      collectForbiddenPayloadKeys(item, `${prefix}[${idx}]`, out, depth + 1)
    );
    return;
  }
  for (const [rawKey, subVal] of Object.entries(val as Record<string, unknown>)) {
    const norm = normalizeKeyName(rawKey);
    const compact = norm.replace(/[^a-z0-9_]/g, '');
    if (FORBIDDEN_KEY_NAMES.has(norm) || FORBIDDEN_KEY_NAMES.has(compact)) {
      out.push(`${prefix}.${rawKey}`);
    }
    collectForbiddenPayloadKeys(subVal, `${prefix}.${rawKey}`, out, depth + 1);
  }
}

export function detectUnauthorizedRequestKeys(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['invalid_body_object'];
  }
  const obj = body as Record<string, unknown>;
  const found: string[] = [];

  for (const rawKey of Object.keys(obj)) {
    const norm = normalizeKeyName(rawKey);
    const compact = norm.replace(/[^a-z0-9_]/g, '');
    if (FORBIDDEN_KEY_NAMES.has(norm) || FORBIDDEN_KEY_NAMES.has(compact)) {
      found.push(rawKey);
    } else if (!ALLOWED_TOP_LEVEL_KEYS.has(rawKey)) {
      found.push(`unexpected_key:${rawKey}`);
    }
  }

  if (obj.payload && typeof obj.payload === 'object') {
    collectForbiddenPayloadKeys(obj.payload, 'payload', found, 0);
  }

  return Array.from(new Set(found));
}

export function describeRequestedScope(proposalType: string): string {
  switch (proposalType) {
    case 'synonym':
      return 'عند الموافقة: إضافة/تحديث مرادف واحد في جدول المرادفات (store_search_synonyms) وإغلاق كلمة البحث المرتبطة إن وُجدت.';
    case 'knowledge':
      return 'عند الموافقة: إضافة مقال معرفة واحد في جدول قاعدة المعرفة (store_copilot_knowledge) وتحديث الكاش.';
    case 'training_config':
      return 'عند الموافقة: تحديث حقول اللهجة أو القواعد الإضافية في إعدادات التدريب (store_copilot_training_config).';
    default:
      return 'محظور تلقائياً: نوع غير مسموح به من الإيجنت الخارجي.';
  }
}

interface SecurityRule {
  code: ProposalSecurityFlag['code'];
  severity: ProposalSecurityFlag['severity'];
  title: string;
  detail: string;
  pattern: RegExp;
}

const SECURITY_RULES: SecurityRule[] = [
  {
    code: 'CODE_INJECTION',
    severity: 'critical',
    title: 'محاولة حقن كود برمجي أو SQL خطير',
    detail: 'تم رصد وسوم سكربت أو استدعاءات تنفيذ/شبكة أو أوامر SQL مريبة داخل النص.',
    pattern:
      /(?:<\s*script\b|<\/\s*script\s*>|javascript\s*:|\bon(?:error|load)\s*=|\beval\s*\(|\bnew\s+Function\b|\brequire\s*\(|\bimport\s*\(|\bglobalThis\b|__proto__|\bfetch\s*\(|\bXMLHttpRequest\b|\bdocument\.cookie\b|\bwindow\.location\b|\bDROP\s+TABLE\b|\bALTER\s+TABLE\b|\bTRUNCATE\s+(?:TABLE\s+)?\b|\bDELETE\s+FROM\b|\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b|\bUNION\s+(?:ALL\s+)?SELECT\b|;\s*--)/i,
  },
  {
    code: 'SHELL_COMMAND_EXEC',
    severity: 'critical',
    title: 'أمر شيل أو استدعاء نظام تشغيل',
    detail: 'تم رصد إشارة لأدوات تنفيذ أوامر أو طرفية أو git أو حزم تشغيل داخل النص.',
    pattern:
      /(?:\bchild_process\b|\bexecSync\b|\bexecFile\b|\bspawn\s*\(|\bpowershell\b|\bcmd\.exe\b|\/bin\/(?:sh|bash)\b|\brm\s+-rf\b|\bRemove-Item\b|\bInvoke-WebRequest\b|\bInvoke-Expression\b|\b(?:curl|wget|chmod|sudo)\s+|\bgit\s+(?:push|commit)\b|\bnpm\s+run\b|\bnpx\s+|\bnode\s+-e\b|\bssh\s+)/i,
  },
  {
    code: 'PRIVILEGE_OR_PERMISSION_REQUEST',
    severity: 'critical',
    title: 'طلب صلاحية مرفوضة أو الإشارة لمفاتيح النظام',
    detail: 'تم رصد محاولة لطلب صلاحية مدير/قاعدة/ملفات أو قراءة متغيرات البيئة والأسرار.',
    pattern:
      /(?:\bservice_role\b|\bis_admin\b|\bsuper_admin\b|\bGRANT\s+ALL\b|\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b|\bALTER\s+POLICY\b|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|GROQ_API_KEY|TELEGRAM_BOT_TOKEN|STORE_COPILOT_TRAINER_KEY|GITHUB_TOKEN|\.env\.local|\bprocess\.env\b|Authorization\s*:\s*Bearer|(?:اعطني|افتح|امنح(?:ني)?|ارفع|تجاوز)\s+صلاحية|صلاحية\s+(?:مدير|ادمن|أدمن|تنفيذ|امر|أمر|شيل|ملفات|كود|نشر مباشر|قاعدة|سيرفر))/i,
  },
  {
    code: 'PROMPT_INJECTION_OR_GUARD_BYPASS',
    severity: 'critical',
    title: 'محاولة تلاعب بالبرومبت أو تعطيل ضوابط الأمان',
    detail: 'تم رصد صياغة تحاول إلغاء التعليمات الثابتة أو كشف برومبت النظام أو تزييف التحويل/فرض الاسم.',
    pattern:
      /(?:\bignore\s+(?:all\s+)?previous(?:\s+instructions)?\b|\boverride\s+system\s+prompt\b|\breveal\s+system\s+prompt\b|\bdisable\s+handoff\b|\bbypass\s+policy\b|\bdisable\s+security\b|(?:تجاهل|ألغ|الغِ|تجاوز|عطّل|عطل)\s+(?:كل\s+)?(?:القواعد|التعليمات|الضوابط|الأمان|الامان|التحقق)|(?:اكشف|اعرض)\s+(?:برومبت النظام|الأسرار|الاسرار|المفاتيح)|قول\s+تم التحويل\s+(?:دائماً|دائما|فوراً|فورا)\s+(?:بدون|حتى لو)|الاسم\s+(?:إجباري|اجباري))/i,
  },
  {
    code: 'SECRET_MATERIAL',
    severity: 'critical',
    title: 'نمط مفتاح API أو توكن سري',
    detail: 'تم رصد نص يشبه مفتاح API أو JWT أو توكن بوت؛ يُمنع إدخال أي أسرار داخل بيانات التدريب.',
    pattern:
      /(?:AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z_-]{20,}|\bsk-[0-9A-Za-z_-]{20,}|eyJhbGci[0-9A-Za-z_.-]{20,}|\b\d{8,11}:[A-Za-z0-9_-]{30,})/,
  },
  {
    code: 'EXTERNAL_URL',
    severity: 'warning',
    title: 'رابط خارجي غير معتمد داخل المقترح',
    detail: 'وُجد رابط خارجي لا يتبع واتساب أو فاي تك — يجب مراجعته قبل الاعتماد.',
    pattern: /https?:\/\/(?!(?:wa\.me|api\.whatsapp\.com|(?:[\w-]+\.)?phitech[\w.-]*)(?:\/|$|\?))[^\s"'<>]+/i,
  },
];

function collectStrings(
  val: unknown,
  field: string,
  out: Array<{ field: string; text: string }>,
  depth = 0
): void {
  if (depth > 6 || val === null || val === undefined) return;
  if (typeof val === 'string') {
    if (val.trim()) out.push({ field, text: val });
    return;
  }
  if (Array.isArray(val)) {
    val.slice(0, 60).forEach((item, idx) =>
      collectStrings(item, `${field}[${idx}]`, out, depth + 1)
    );
    return;
  }
  if (typeof val === 'object') {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      collectStrings(v, field ? `${field}.${k}` : k, out, depth + 1);
    }
  }
}

export function auditTrainerProposal(input: {
  proposalType: string;
  title: string;
  reason: string;
  payload: Record<string, unknown>;
}): ProposalAuditResult {
  const strings: Array<{ field: string; text: string }> = [
    { field: 'proposalType', text: String(input.proposalType || '') },
    { field: 'title', text: String(input.title || '') },
    { field: 'reason', text: String(input.reason || '') },
  ];
  collectStrings(input.payload, 'payload', strings, 0);

  const flags: ProposalSecurityFlag[] = [];
  const seen = new Set<string>();

  for (const { field, text } of strings) {
    for (const rule of SECURITY_RULES) {
      const m = rule.pattern.exec(text);
      if (!m) continue;
      const dedupKey = `${rule.code}::${field}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const start = Math.max(0, m.index - 20);
      const excerpt = text.slice(start, start + Math.max(m[0].length + 40, 80)).slice(0, 140).trim();
      flags.push({
        code: rule.code,
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail,
        field,
        excerpt,
      });
    }
  }

  const hasCritical = flags.some((f) => f.severity === 'critical');
  const riskLevel: ProposalAuditResult['riskLevel'] = hasCritical
    ? 'critical'
    : flags.length > 0
      ? 'warning'
      : 'safe';

  return { riskLevel, flags, hasCritical };
}
