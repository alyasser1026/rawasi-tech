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
      description: 'الاستعلام عن سجلات يوميات العمالة والعمال الذين نزلوا واشتغلوا اليوم أو في تاريخ أو فترة محددة في الشركة المربوطة.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'يوم محدد بصيغة YYYY-MM-DD أو today لو المستخدم قال النهارده أو اليوم' },
          start_date: { type: 'STRING', description: 'بداية الفترة YYYY-MM-DD' },
          end_date: { type: 'STRING', description: 'نهاية الفترة YYYY-MM-DD. الفترة لا تتجاوز 31 يومًا.' },
          worker_name: { type: 'STRING', description: 'اسم عامل كامل عند طلب تصفية سجلاته' },
          site_ref: { type: 'STRING', description: 'اسم أو رقم الفيلا / الموقع اختياري' },
        },
      },
    },
    source: { kind: 'table', name: 'labor_daily_logs', columns: ['work_date', 'worker_name', 'site_ref', 'work_item', 'attendance_value', 'daily_wage*', 'tareeha', 'productivity', 'unit', 'is_posted'] },
    permission: { module: 'labor_logs', action: 'view' }, // = RLS policy module_view on labor_daily_logs
    extraPermissions: [{ module: 'laborcost', action: 'view', for: 'الأجور اليومية وإجمالي الأجور (daily_wage / total_wages)' }],
    requiresCompany: true,
    flag: null, // gated by COPILOT_ENABLE_LIVE_READS + verified access
    limits: 'يوم واحد أو فترة ≤ 31 يوم (توقيت الرياض)، صفحة 100 سجل مع عدّ دقيق',
    output: 'عدد السجلات وتفاصيل العمال واليوميات المسجلة (الأجور مشروطة بصلاحية laborcost). يفرّق بين صفر موثوق ونتيجة جزئية ومصدر متعطل.',
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
    flag: { env: 'COPILOT_TOOL_TAREEHA_ENABLED', default: false },
    definition: 'copilot-tareeha.mjs: العجز = الإنتاجية < الطريحة × الحضور (نص يوم = نص المستهدف). الغياب والسجلات من غير إنتاجية مش عجز وبتتعد لوحدها.',
    limits: 'آخر 30 يوم، فحص حتى 500 سجل فيها طريحة، عرض أول 20',
    output: 'عدد العجوزات + أول 5 (المستهدف/المنفذ/نسبة الإنجاز) + عدد السجلات من غير إنتاجية.',
  },
  {
    name: 'get_all_projects_and_villas',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'get_all_projects_and_villas',
      description: 'استعلام عن المشاريع والفلل الموجودة كلها في الشركة، أو المشاريع والفلل التي اشتغلناها اليوم أو في تاريخ معين («المشاريع اللي موجودة كلها»، «المشاريع اللي اشتغلناها النهارده كلها»، «امال ايه البروجكت فيها ايه»، «الفلل اللي شغالة»).',
      parameters: {
        type: 'OBJECT',
        properties: {
          filter_mode: {
            type: 'STRING',
            enum: ['all', 'worked_today', 'active_only'],
            description: 'all لكل المشاريع الموجودة، worked_today للمشاريع التي اشتغلناها في التاريخ المحدد، active_only للمشاريع الجارية قيد التنفيذ',
          },
          date: { type: 'STRING', description: 'تاريخ بصيغة YYYY-MM-DD أو today (الافتراضي today)' },
        },
      },
    },
    source: { kind: 'table', name: 'projects + labor_daily_logs + expenses + material_issues + job_orders' },
    permission: { module: 'projects', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'حتى 100 مشروع مع ملخص نشاط اليوم',
    output: 'قائمة المشاريع والفلل المسجلة كلها وحالتها ومرحلتها الحالية والمشاريع التي تم العمل عليها اليوم.',
  },
  {
    name: 'get_daily_comprehensive_report',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'get_daily_comprehensive_report',
      description: 'التقرير اليومي المفصل والشامل عن اليوم أو تاريخ محدد، ويشمل 7 أقسام: (1) العمالة اللي نزلت النهارده، (2) الفلل والمشاريع اللي اشتغلناها، (3) المصروفات، (4) اللي اتصرف للعمالة، (5) الخامات اللي اتصرفت، (6) المقاولين اللي اتسلمت وأوامر الشغل والمستخلصات، (7) الركوستات والاستلامات اللي خلصت.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'تاريخ التقرير بصيغة YYYY-MM-DD أو today لتقرير النهارده (الافتراضي today)' },
          villa_filter: { type: 'STRING', description: 'اختياري: اسم أو رقم فيلا معينة لتصفية التقرير عليها' },
        },
      },
    },
    source: { kind: 'table', name: 'labor_daily_logs + projects + expenses + payment_vouchers + material_issues + sub_claims + job_orders + user_requests' },
    permission: null,
    extraPermissions: [
      { module: 'labor_logs', action: 'view', for: 'قسم العمالة اليومية' },
      { module: 'laborcost', action: 'view', for: 'أجور العمالة والمنصرف للعمالة' },
      { module: 'projects', action: 'view', for: 'قسم الفلل والمشاريع' },
      { module: 'expenses', action: 'view', for: 'قسم المصروفات' },
      { module: 'payments', action: 'view', for: 'سندات الصرف' },
    ],
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'تقرير يوم محدد بتوقيت الرياض لجميع الأقسام السبعة (كل قسم يتحقق من صلاحيته ومصدره، والناقص يظهر غير متاح)',
    output: 'تقرير يومي مفصل من 7 أقسام للعمالة والفلل والمصروفات والمنصرف للعمالة والخامات والمقاولين والركوستات المنجزة.',
  },
  {
    name: 'add_labor_daily_log_draft',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'add_labor_daily_log_draft',
      description: 'إضافة وتسجيل مسودة يومية عامل أو فني جديدة في قاعدة البيانات (labor_daily_logs) مع ربط أوتوماتيكي بملفات الشركاء (partners) والفيلا (projects) والبند (boq_budget) وأمر الشغل (job_orders). تدعم تسجيل فني ومساعد معاً، وتسجيل الإنتاجية واليومية والطريحة والملاحظات.',
      parameters: {
        type: 'OBJECT',
        properties: {
          worker_name: { type: 'STRING', description: 'اسم العامل أو الفني (مثال: أحمد أو محمد سلطان)' },
          helper_name: { type: 'STRING', description: 'اسم العامل المساعد إن وجد مع الفني في نفس اليومية (مثال: إبراهيم)' },
          helper_wage: { type: 'NUMBER', description: 'أجر العامل المساعد بالريال إن ذكر (مثال: 150)' },
          skill_level: { type: 'STRING', description: 'مستوى المهارة (مثال: فني، مساعد، صنايعي، عامل)' },
          work_item: { type: 'STRING', description: 'اسم البند المنفذ من جدول الميزانية boq_budget (مثال: محارة، جبس، مباني)' },
          daily_wage: { type: 'NUMBER', description: 'الأجر اليومي بالريال (مثال: 250)' },
          tareeha: { type: 'NUMBER', description: 'الطريحة المستهدفة لليومية (مثال: 50)' },
          productivity: { type: 'NUMBER', description: 'الإنتاجية الفعلية المنفذة / عمل كام (مثال: 40)' },
          unit: { type: 'STRING', description: 'وحدة القياس مثل م2 أو م3 أو متر طولي (الافتراضي م2)' },
          attendance_value: { type: 'NUMBER', description: 'قيمة الحضور: 1 يوم كامل، 0.5 نصف يوم (الافتراضي 1)' },
          site_ref: { type: 'STRING', description: 'اسم أو رقم الفيلا / المشروع من جدول projects (مثال: فيلا 657)' },
          job_order: { type: 'STRING', description: 'رقم أو كود أمر الشغل من جدول job_orders إن حدده المستخدم (مثال: JO-2026-0001)' },
          work_date: { type: 'STRING', description: 'تاريخ اليومية YYYY-MM-DD أو today (الافتراضي today)' },
          sub_contractor: { type: 'STRING', description: 'اسم مقاول الباطن إن وجد' },
          notes: { type: 'STRING', description: 'ملاحظات إضافية' },
        },
        required: ['worker_name'],
      },
    },
    source: { kind: 'table', name: 'labor_daily_logs' },
    permission: { module: 'labor_logs', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'حفظ مسودة غير مرحّلة (is_posted = false) مرتبطة بالشركة',
    output: 'تأكيد حفظ مسودة اليومية مع حساب نسبة إنجاز الطريحة والعجز.',
  },
  {
    name: 'add_expense_draft',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'add_expense_draft',
      description: 'إضافة وتسجيل مسودة مصروف جديدة في جدول المصروفات (expenses) فوراً عند طلب إضافة أو تسجيل مصروف مع البيان والمبلغ (الفيلا وأمر الشغل اختياريين تماماً ولا يشترطان).',
      parameters: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING', description: 'بيان أو سبب المصروف' },
          total_price: { type: 'NUMBER', description: 'إجمالي المبلغ بالريال' },
          site_ref: { type: 'STRING', description: 'اسم أو رقم الفيلا / المشروع' },
          payee_name: { type: 'STRING', description: 'اسم المستفيد' },
          main_category: { type: 'STRING', description: 'التصنيف الرئيسي للمصروف' },
          payment_method: { type: 'STRING', description: 'طريقة القيد: آجل، عهدة، تسوية داخلية' },
          exp_date: { type: 'STRING', description: 'تاريخ المصروف YYYY-MM-DD أو today' },
        },
        required: ['description', 'total_price'],
      },
    },
    source: { kind: 'table', name: 'expenses' },
    permission: { module: 'expenses', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'حفظ مسودة مصروف غير مرحّلة (is_posted = false)',
    output: 'تأكيد حفظ مسودة المصروف في قاعدة بيانات الشركة.',
  },
  {
    name: 'add_journal_entry_draft',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'add_journal_entry_draft',
      description: 'إضافة وتسجيل قيد محاسبي / قيد يومية مسودة في النظام (journal_headers + journal_lines) عندما يطلب المستخدم «سجل قيد...» أو «اعمل قيد...» مع تحديد البيان والمبلغ والحساب المدين والحساب الدائن والمشروع/الفيلا.',
      parameters: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING', description: 'بيان أو شرح القيد المحاسبي' },
          amount: { type: 'NUMBER', description: 'مبلغ القيد بالريال' },
          debit_account: { type: 'STRING', description: 'اسم أو كود الحساب المدين (+)' },
          credit_account: { type: 'STRING', description: 'اسم أو كود الحساب الدائن (-)' },
          site_ref: { type: 'STRING', description: 'اسم أو رقم الفيلا / المشروع إن وجد' },
          entry_date: { type: 'STRING', description: 'تاريخ القيد YYYY-MM-DD أو today' },
        },
        required: ['description', 'amount'],
      },
    },
    source: { kind: 'table', name: 'journal_headers + journal_lines' },
    permission: { module: 'journal', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'حفظ مسودة قيد متزن (طرف مدين وطرف دائن متساويين) غير مرحّل',
    output: 'تأكيد حفظ قيد اليومية المسودة وتفاصيل الطرفين المدين والدائن مع كود القيد.',
  },
  {
    name: 'add_job_order_draft',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'add_job_order_draft',
      description: 'إضافة وتسجيل أمر شغل أو أمر تشغيل جديد لمقاول أو فني في جدول أوامر العمل (job_orders) عندما يطلب المستخدم «اعمل أمر شغل...» أو «سجل أمر شغل...» أو «تكليف مقاول» مع اسم المقاول والبند والكمية والفئة والمشروع.',
      parameters: {
        type: 'OBJECT',
        properties: {
          work_item: { type: 'STRING', description: 'بند أو طبيعة العمل (مثال: محارة، دهانات، سباكة)' },
          assigned_qty: { type: 'NUMBER', description: 'الكمية المطلوبة' },
          unit_price: { type: 'NUMBER', description: 'سعر الوحدة بالريال' },
          contractor_name: { type: 'STRING', description: 'اسم المقاول أو المنفذ' },
          site_ref: { type: 'STRING', description: 'اسم أو رقم الفيلا / المشروع' },
          executor_type: { type: 'STRING', description: 'نوع التنفيذ: مقاول باطن أو تنفيذ ذاتي' },
          start_date: { type: 'STRING', description: 'تاريخ بدء أمر الشغل YYYY-MM-DD أو today' },
          notes: { type: 'STRING', description: 'ملاحظات إضافية' },
        },
        required: ['work_item', 'assigned_qty'],
      },
    },
    source: { kind: 'table', name: 'job_orders' },
    permission: { module: 'projects', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'حفظ أمر شغل جديد بحالة جاري التنفيذ أو مسودة',
    output: 'تأكيد حفظ أمر الشغل مع رقم الأمر والتكلفة الإجمالية واسم المقاول والفيلا.',
  },
  {
    name: 'add_partner',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'add_partner',
      description: 'إضافة وتسجيل شريك جديد (عامل يومية، مقاول باطن، مورد، عميل، موظف، استشاري، تأجير معدات) في جدول الشركاء (partners) في فاي تك فوراً عند طلب المستخدم «ضيف بارتنر...»، «سجل مقاول...»، «ضيف مورد...»، «سجل شريك...» مع الاسم والنوع والمهنة ورقم التليفون والكود.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'اسم الشريك أو المؤسسة أو المقاول أو العامل (إلزامي)' },
          partner_type: {
            type: 'STRING',
            description: 'نوع الشريك (عامل يومية، مقاول، مورد، عميل، موظف، استشاري، تأجير معدات، جهة حكومية). الافتراضي: عامل يومية أو مقاول حسب السياق',
          },
          job_role: { type: 'STRING', description: 'المهنة أو الوظيفة أو التخصص (مثال: حداد مسلح، نجار، سباك، دهانات، توريد خرسانة)' },
          phone: { type: 'STRING', description: 'رقم الهاتف أو الجوال' },
          code: { type: 'STRING', description: 'كود الشريك في النظام (اختياري)' },
          identity_number: { type: 'STRING', description: 'رقم الهوية الوطنية أو الإقامة أو السجل التجاري' },
          vat_number: { type: 'STRING', description: 'الرقم الضريبي للمنشأة' },
          address: { type: 'STRING', description: 'العنوان أو الموقع' },
        },
        required: ['name'],
      },
    },
    source: { kind: 'table', name: 'partners' },
    permission: { module: 'partners', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'إضافة شريك جديد نشط مرتبط بالشركة مع التحقق من عدم التكرار',
    output: 'تأكيد تسجيل الشريك مع بياناته والكود المخصص.',
  },
  {
    name: 'update_operation_draft',
    status: TOOL_STATUS.PILOT,
    declaration: {
      name: 'update_operation_draft',
      description: 'تعديل وتحديث عملية مسجلة سابقاً (قيد محاسبي، أمر شغل، مصروف، أو يومية عامل) عند قيام المستخدم بالرد (Reply) على رسالة العملية وطلب تعديل أي حقل (مثل: «غير المبلغ لـ 7000»، «عدل المشروع لفيلا 12»، «غير اسم العامل لـ أحمد»).',
      parameters: {
        type: 'OBJECT',
        properties: {
          record_identifier: { type: 'STRING', description: 'معرف أو كود العملية المستخرج من الرسالة المقتبسة (مثل: JV-xxxx أو JO-xxxx أو EXP-xxxx أو LAB-xxxx أو UUID)' },
          operation_type: { type: 'STRING', enum: ['journal', 'job_order', 'expense', 'labor_log'], description: 'نوع العملية المراد تعديلها' },
          new_amount: { type: 'NUMBER', description: 'المبلغ الجديد بالريال (للقيد أو المصروف أو يومية العامل)' },
          new_quantity: { type: 'NUMBER', description: 'الكمية الجديدة (لأمر الشغل أو طريحة العامل)' },
          new_unit_price: { type: 'NUMBER', description: 'سعر الوحدة الجديد (لأمر الشغل)' },
          new_site_ref: { type: 'STRING', description: 'اسم أو رقم الفيلا / المشروع الجديد' },
          new_description: { type: 'STRING', description: 'البيان أو بند العمل الجديد' },
          new_account: { type: 'STRING', description: 'الحساب الجديد (للقيد)' },
          new_contractor: { type: 'STRING', description: 'اسم المقاول أو العامل الجديد' },
          new_notes: { type: 'STRING', description: 'ملاحظات أو تعديلات إضافية' },
        },
        required: ['record_identifier'],
      },
    },
    source: { kind: 'table', name: 'journal_headers / job_orders / expenses / labor_daily_logs' },
    permission: { module: 'journal', action: 'view' },
    requiresCompany: true,
    flag: { env: 'COPILOT_LIVE_FIELD_OPS_ENABLED', default: false },
    limits: 'تعديل السجلات المسودة أو النشطة في الشركة النشطة فقط',
    output: 'تأكيد تعديل الحقول المحددة في قاعدة البيانات وإظهار البطاقة المحدثة.',
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
  {
    name: 'switch_company',
    status: TOOL_STATUS.ACTIVE,
    declaration: {
      name: 'switch_company',
      description: 'التبديل بين الشركات المتاحة في النظام (شركة 1: فاي تك للمقاولات العامة والتشطيبات الفاخرة، شركة 2: PHI-TECH-EGY) عندما يطلب المستخدم فتح شركة معينة أو التبديل إليها.',
      parameters: {
        type: 'OBJECT',
        properties: {
          company_identifier: { type: 'STRING', description: 'رقم أو اسم الشركة المراد التبديل إليها: "1" أو "2" أو "فاي تك" أو "PHI-TECH-EGY"' },
        },
        required: ['company_identifier'],
      },
    },
    source: { kind: 'local', name: 'companies' },
    permission: null,
    requiresCompany: false,
    limits: 'التبديل الفوري للشركة النشطة للبوت',
    output: 'تأكيد التبديل وبيانات الشركة الجديدة',
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

export const COPILOT_TOOL_REGISTRY = TOOL_REGISTRY;
export const COPILOT_FUNCTION_DECLARATIONS = DECLARED_TOOLS;
export const COPILOT_TOOL_BY_NAME = byName;
