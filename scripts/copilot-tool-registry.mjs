/**
 * copilot-tool-registry.mjs — the single reference for every Copilot tool (roadmap phase 3).
 *
 * For each tool: approved source (table/columns or local file), required module permission,
 * enable flag, limits, output contract and status. copilot-tool-policy.mjs derives its gates
 * from here and copilot-prompt.mjs derives the Gemini declarations from here.
 *
 * status:
 *   active   — declared to the model, enabled by its gates
 *   pilot    — declared to the model, behind its own flag (off by default)
 *   internal — never declared to the model; used by a server-side flow (e.g. /pdf)
 *   retired  — implementation removed; createCopilotTools exposes a stub that makes no request
 */

export const TOOL_STATUS = Object.freeze({ ACTIVE: 'active', PILOT: 'pilot', INTERNAL: 'internal', RETIRED: 'retired' });

export const TOOL_REGISTRY = Object.freeze([
  {
    name: 'get_labor_daily_logs',
    status: TOOL_STATUS.ACTIVE,
    declaration: {
      name: 'get_labor_daily_logs',
      description: 'عدد سجلات يوميات العمالة المطابقة لتاريخ أو فترة محددة في الشركة المربوطة، من غير حساب الأجور أو عدد الأفراد الفريدين.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'يوم محدد بصيغة YYYY-MM-DD أو today لو المستخدم قال النهارده' },
          start_date: { type: 'STRING', description: 'بداية الفترة YYYY-MM-DD' },
          end_date: { type: 'STRING', description: 'نهاية الفترة YYYY-MM-DD. الفترة لا تتجاوز 31 يومًا.' },
          worker_name: { type: 'STRING', description: 'اسم عامل كامل عند طلب تصفية سجلاته' },
        },
      },
    },
    source: { kind: 'table', name: 'labor_daily_logs', columns: ['work_date', 'worker_name', 'site_ref', 'work_item', 'attendance_value'] },
    permission: { module: 'labor_logs', action: 'view' }, // = RLS policy module_view on labor_daily_logs
    requiresCompany: true,
    flag: null, // gated by COPILOT_ENABLE_LIVE_READS + verified access
    limits: 'يوم واحد أو فترة ≤ 31 يوم (توقيت الرياض)، صفحة 100 سجل مع عدّ دقيق',
    output: 'عدد السجلات + أول 5 سجلات (تاريخ/اسم/موقع/بند/حضور). من غير أجور. يفرّق بين صفر موثوق ونتيجة جزئية ومصدر متعطل.',
  },
  {
    name: 'get_engineering_checklist_and_specs',
    status: TOOL_STATUS.ACTIVE,
    declaration: {
      name: 'get_engineering_checklist_and_specs',
      description: 'استرجاع إرشادات قائمة فحص هندسية من دليل فاي تك، للمراجعة مقابل مواصفة المشروع المعتمدة.',
      parameters: {
        type: 'OBJECT',
        properties: {
          item_name: { type: 'STRING', description: 'اسم البند الهندسي' },
          topic: { type: 'STRING', description: 'الجانب المطلوب، مثل الفحص أو خطوات التنفيذ' },
        },
        required: ['item_name'],
      },
    },
    source: { kind: 'file', name: 'config/copilot_engineering_checklists.md' },
    permission: null,
    requiresCompany: false,
    flag: null,
    limits: 'قسم واحد من الدليل، أول 1450 حرف في الرد',
    output: 'إرشاد عام من دليل فاي تك مع تنبيه إن المواصفة المعتمدة للمشروع هي المرجع الملزم.',
  },
  {
    name: 'get_tareeha_deficits',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'get_tareeha_deficits',
      description: 'عرض عجوزات الطريحة المستحقة للشركة المربوطة خلال آخر 30 يوم — السجلات اللي إنتاجيتها أقل من الطريحة المحددة.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    source: { kind: 'table', name: 'labor_daily_logs', columns: ['work_date', 'worker_name', 'site_ref', 'work_item', 'tareeha', 'productivity', 'attendance_value', 'unit'] },
    permission: { module: 'labor_logs', action: 'view' },
    requiresCompany: true,
    // Pilot read tool behind its own flag (off by default) — the owner turns it on for the trial.
    flag: { env: 'COPILOT_TOOL_TAREEHA_ENABLED', default: false },
    definition: 'copilot-tareeha.mjs: العجز = الإنتاجية < الطريحة × الحضور (نص يوم = نص المستهدف). الغياب والسجلات من غير إنتاجية مش عجز وبتتعد لوحدها. (حدده صاحب المشروع: «كما تشوفه مناسب»)',
    limits: 'آخر 30 يوم، فحص حتى 500 سجل فيها طريحة، عرض أول 20',
    output: 'عدد العجوزات + أول 5 (المستهدف/المنفذ/نسبة الإنجاز) + عدد السجلات من غير إنتاجية. لو النتيجة جزئية بيقول كده.',
  },
  {
    name: 'get_worker_month_statement',
    status: TOOL_STATUS.INTERNAL,
    usedBy: '/pdf worker <الاسم> <YYYY-MM> (copilot-pdf-requests.mjs)',
    source: {
      kind: 'table+rpc',
      name: 'partners (الهوية) + labor_daily_logs (السجلات) + rpc pull_payroll_module_data / get_payroll_balances_with_cutoff (الفلوس)',
      columns: ['partners.id', 'partners.partner_type', 'work_date', 'site_ref', 'work_item', 'attendance_value', 'tareeha', 'productivity', 'unit', 'notes', 'production_desc', 'is_posted', 'daily_wage*'],
    },
    permission: { module: 'labor_logs', action: 'view' },
    requiredPermissions: [{ module: 'partners', action: 'view', for: 'هوية العامل الثابتة (partners.id)' }],
    // Money section only with ALL of these: the wage permission chosen by the owner (laborcost) + every
    // module the payroll RPCs read. Missing one would make RLS return zeros silently, so it shows «غير متاح».
    extraPermissions: [
      { module: 'laborcost', action: 'view', for: 'الأجور (اختيار صاحب المشروع)' },
      { module: 'violations', action: 'view', for: 'الجزاءات' },
      { module: 'payments', action: 'view', for: 'سندات الصرف' },
      { module: 'journal', action: 'view', for: 'الترحيل والرصيد السابق' },
    ],
    requiresCompany: true,
    flag: { env: 'COPILOT_PDF_WORKER_ENABLED', default: false },
    definition: 'عامل يومية: صافي الشهر = اليوميات المرحّلة − الجزاءات المرحّلة − سندات الصرف المرحّلة، + الرصيد السابق — نفس شاشة الرواتب (payroll_logic.ts). الموظف بمرتب كشفه من شاشة الرواتب.',
    limits: 'شهر واحد حتى تاريخ اليوم، اسم مطابق تمامًا لشريك واحد، حد 500 سجل (أكتر = رفض)',
    output: 'صفوف الشهر + ملخص مالي من دوال الرواتب. أكتر من شريك بنفس الاسم = رفض. «موظف» = تحويل لشاشة الرواتب.',
  },

  // ─── Retired (implementation removed; stubs make no request) ───────────────
  ...[
    ['get_villa_and_budget_details', 'الفلل والمقايسات والخامات والمخزون', 'بحث or/ilike نصي على projects من غير company_id صريح'],
    ['get_model_villas_and_specs', 'الفلل والمقايسات والخامات والمخزون', 'بحث ilike على unit_type من غير company_id صريح'],
    ['get_boq_and_materials', 'الفلل والمقايسات والخامات والمخزون', 'بحث نصي على boq_budget وmaterial_issue_lines بدل معرّف المشروع والبند'],
    ['get_inventory_status', 'الفلل والمقايسات والخامات والمخزون', 'من غير مطابقة مخازن ووحدات مع الشاشة'],
    ['get_contractors_summary', 'المقاولون والمستخلصات والمخالفات', 'بيعرض أرقام تليفونات وأرصدة من غير مراجعة'],
    ['get_pending_subclaims', 'المقاولون والمستخلصات والمخالفات', 'حالات المستندات غير مراجعة'],
    ['get_site_violations', 'المقاولون والمستخلصات والمخالفات', 'أسماء موظفين ومبالغ وروابط صور من غير مراجعة'],
    ['get_financial_transaction_details', 'المصروفات والقبض والصرف', 'فلتر or= مبني من نص المستخدم الخام، ومفيش صلاحية لكل وحدة'],
    ['get_custodies_and_closings', 'العهد والإقفال والأصول والوثائق', 'أعمدة مختلفة عن الميجريشنات (actual_cash/notes)'],
    ['get_company_notifications', 'العهد والإقفال والأصول والوثائق', 'حقوق عرض المرفقات غير مراجعة'],
    ['get_fixed_assets_summary', 'العهد والإقفال والأصول والوثائق', 'أعمدة مختلفة (name/asset_type/useful_life_months/book_value)'],
    ['get_vat_and_invoices_summary', 'الفواتير والضريبة', 'لازم يعتمد تقرير الضريبة المعتمد للفترة'],
    ['generate_and_send_worker_statement_pdf', 'كشف العامل وتقرير الفحص', 'كان بيبعت PDF من غير تأكيد — اتستبدل بمسار /pdf worker'],
    ['generate_and_send_engineering_checklist_pdf', 'كشف العامل وتقرير الفحص', 'كان بيبعت PDF من غير تأكيد وبيحط «مطابق» افتراضيًا — اتستبدل بمسار /pdf checklist'],
    ['record_site_inspection_visit', 'كتابة', 'الكتابة من البوت مقفولة لحد تصميم معاينة وتأكيد'],
  ].map(([name, group, reason]) => ({ name, status: TOOL_STATUS.RETIRED, group, reason })),
]);

const byName = new Map(TOOL_REGISTRY.map(entry => [entry.name, entry]));

/** Own-property lookup only (no prototype names like "constructor"). */
export function registryEntry(name) {
  return typeof name === 'string' && byName.has(name) ? byName.get(name) : null;
}

/** A tool's own flag: unset → its default; set → only the exact string "true" enables it. */
export function isToolFlagEnabled(entry, env = process.env) {
  if (!entry?.flag) return true;
  const value = env[entry.flag.env];
  return value === undefined ? entry.flag.default === true : value === 'true';
}

export const RETIRED_TOOL_NAMES = Object.freeze(TOOL_REGISTRY.filter(e => e.status === TOOL_STATUS.RETIRED).map(e => e.name));

/** Declarations sent to Gemini: active + pilot tools only (the policy still filters per access/flag). */
export const DECLARED_TOOLS = Object.freeze(
  TOOL_REGISTRY.filter(e => e.declaration && (e.status === TOOL_STATUS.ACTIVE || e.status === TOOL_STATUS.PILOT)).map(e => e.declaration),
);
