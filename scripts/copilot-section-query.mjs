/**
 * copilot-section-query.mjs — استعلام البوت عن أي قسم في السيستم (قراءة فقط).
 *
 * أداة واحدة (query_company_data) بتغطي: الخامات والأسعار والمخزون، التوريدات والصرف وأوامر الشراء،
 * المقايسات وكتالوج البنود، المصروفات والسندات والفواتير والمستخلصات، أوامر الشغل، الشركاء، العهد،
 * الجزاءات، الأصول، والمشاريع — وبحث شامل في كل الأقسام المسموحة.
 *
 * ضمانات (اتعملت بسبب الأدوات القديمة اللي اتوقفت في copilot-tool-registry.mjs):
 *  - كل استعلام بيعدّي على fetchScopedRows، وده بيحط company_id=eq.<الشركة النشطة> دايمًا.
 *  - نص المستخدم عمره ما بيتحط خام في فلتر: بيتنضف لحروف وأرقام ومسافات بس (sanitizeTerm) قبل ilike.
 *  - أعمدة محددة بالاسم لكل قسم (مفيش select=*). مفيش أرقام تليفونات ولا هويات ولا روابط صور.
 *  - صلاحية كل قسم بتتفحص في copilot-tool-policy.mjs قبل التشغيل (allowed_sections)،
 *    والمبالغ بتتشال لأدوار مهندس الموقع والقراءة فقط (show_money=false).
 */

const MAX_ROWS = 1000;      // أقصى صفوف بتتجاب للحساب في القسم الواحد
const SHOW_ROWS = 12;       // أقصى صفوف بتتعرض في الرد
const ALL_ROWS = 3;         // صفوف لكل قسم في البحث الشامل
const ID_CHUNK = 100;       // أقصى IDs في فلتر in.(...)
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

export const QUERY_TOOL_NAME = 'query_company_data';

/* ───────────── تنضيف النص والمطابقة ───────────── */

/** حروف (أي لغة) وأرقام ومسافات وشرطة بس. أي رمز تاني (فواصل، أقواس، نجوم، نقط، علامات تنصيص) بيتشال. */
export function sanitizeTerm(value, max = 60) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

/** كلمات السؤال اللي مالهاش دعوة باسم الحاجة نفسها. */
const QUESTION_WORDS = new Set(['سعر', 'اسعار', 'أسعار', 'بكام', 'كام', 'كم', 'عندنا', 'عندكم', 'فيه', 'في', 'رصيد', 'كمية', 'كميه', 'عن', 'على', 'من', 'ايه', 'إيه', 'هل', 'لو', 'بتاع', 'بتاعت', 'الصنف', 'صنف', 'المخزن', 'مخزن']);

/** كلمات البحث: من غير كلمات السؤال، و«ال» في أول الكلمة بتتشال (الاسمنت = اسمنت). */
export function searchTokens(term) {
  const words = sanitizeTerm(term).split(' ').filter(Boolean);
  const kept = words.filter(w => !QUESTION_WORDS.has(w));
  return (kept.length ? kept : words).slice(0, 5).map(w => (w.length > 4 && /^[اأإآ]ل/.test(w) ? w.slice(2) : w));
}

/** نمط ilike آمن: الكلمات بـ * بينها، والحروف اللي ليها أشكال كتير (ا/أ/إ/آ، ة/ه، ي/ى) بتبقى _ (حرف واحد أي حاجة). */
export function ilikePattern(term) {
  const words = searchTokens(term).map(w => w.replace(/[اأإآ]/g, '_').replace(/[ةه]/g, '_').replace(/[يى]/g, '_'));
  if (!words.length) return null;
  return `*${words.join('*')}*`;
}

export const normalizeName = (s) => String(s ?? '')
  .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/* ───────────── تعريف الأقسام ───────────── */

const notDeleted = { is_deleted: 'not.is.true' };

/**
 * kind:
 *  header — جدول واحد (مع أسماء الشريك/المشروع بتتجاب بالـ ID)
 *  lines  — سطور أصناف ليها رأس (التاريخ والمورد والمشروع في الرأس)
 *  prices / stock — أقسام مجمّعة من أكتر من جدول
 * perms: أي واحدة منهم تكفي (نفس منطق RLS بتاع الجدول).
 * moneyOnly: القسم كله فلوس — مش متاح لو show_money=false.
 */
export const SECTIONS = Object.freeze({
  prices: {
    label: 'أسعار الخامات والأصناف', icon: '💲', kind: 'prices', moneyOnly: true, needsSearch: true,
    perms: ['materials', 'materialitems', 'expenses', 'boqbudget', 'accounting'], screen: '/materials',
    hint: 'سعر صنف أو خامة: آخر سعر توريد ومتوسطه وأقل/أعلى سعر، سعر الدليل، أوامر الشراء، المصروفات، وسعر البند في المقايسة',
  },
  stock: {
    label: 'المخزون والأرصدة', icon: '🏬', kind: 'stock',
    perms: ['materials', 'material_issues', 'materialitems', 'inventory'], screen: '/inventory',
    hint: 'الكمية الموجودة من صنف: المورّد ناقص المنصرف، وحد إعادة الطلب',
  },
  items: {
    label: 'دليل الخامات والأصناف', icon: '📦', kind: 'header', table: 'material_items', screen: '/materialitems',
    perms: ['materialitems', 'materials', 'inventory'],
    select: 'item_code,item_name,main_category,default_unit,default_unit_price,moving_avg_cost,min_order_level',
    search: ['item_name', 'item_code', 'main_category'], order: 'item_name.asc',
    hint: 'الأصناف المسجلة بكودها وتصنيفها ووحدتها وسعرها الافتراضي',
    row: (r) => ({
      title: r.item_name, sub: [r.item_code && `كود ${r.item_code}`, r.main_category, r.default_unit && `الوحدة: ${r.default_unit}`],
      money: { 'السعر الافتراضي': r.default_unit_price, 'متوسط التكلفة': r.moving_avg_cost },
    }),
  },
  material_receipts: {
    label: 'توريدات الخامات (فواتير التوريد)', icon: '🚚', kind: 'lines', screen: '/materials',
    perms: ['materials'], table: 'material_receipt_lines', fk: 'receipt_id',
    select: 'receipt_id,item_name,quantity,unit,unit_price,total_price', search: ['item_name'],
    parent: { table: 'material_receipts', select: 'id,receipt_number,receipt_date,supplier_id,project_id,status', dateCol: 'receipt_date', partnerCol: 'supplier_id', projectCol: 'project_id', label: 'receipt_number' },
    hint: 'إيه اللي اتورّد من صنف أو مورد، بكام، ولمين، وإمتى',
  },
  material_issues: {
    label: 'صرف الخامات للمواقع', icon: '🏗️', kind: 'lines', screen: '/material_issues',
    perms: ['material_issues'], table: 'material_issue_lines', fk: 'issue_id',
    select: 'issue_id,item_name,quantity,unit,unit_price,total_price', search: ['item_name'],
    parent: { table: 'material_issues', select: 'id,issue_number,issue_date,subcontractor_id,contractor_text_name,project_id,issue_type', dateCol: 'issue_date', partnerCol: 'subcontractor_id', projectCol: 'project_id', label: 'issue_number' },
    hint: 'الخامات اللي اتصرفت لموقع أو مقاول',
  },
  purchase_orders: {
    label: 'أوامر الشراء', icon: '🧾', kind: 'lines', screen: '/purchase-orders',
    perms: ['materials', 'accounting'], table: 'purchase_order_lines', fk: 'po_id',
    select: 'po_id,item_name,description,quantity,received_quantity,unit,unit_price,total_price', search: ['item_name', 'description'],
    parent: { table: 'purchase_orders', select: 'id,po_number,order_date,supplier_id,project_id,status,total_amount', dateCol: 'order_date', partnerCol: 'supplier_id', projectCol: 'project_id', label: 'po_number' },
    hint: 'أوامر الشراء وأسعار الأصناف فيها والمستلم منها',
  },
  supplier_invoices: {
    label: 'فواتير الموردين', icon: '📑', kind: 'header', table: 'supplier_invoices', screen: '/purchase-orders', moneyOnly: true,
    perms: ['materials', 'accounting', 'invoices'],
    select: 'invoice_number,supplier_invoice_ref,invoice_date,due_date,supplier_id,project_id,total_amount,paid_amount,status',
    search: ['invoice_number', 'supplier_invoice_ref', 'notes'], dateCol: 'invoice_date', partnerCol: 'supplier_id', projectCol: 'project_id', amountCol: 'total_amount', order: 'invoice_date.desc.nullslast',
    hint: 'فواتير الموردين والمدفوع والمتبقي',
    row: (r, n) => ({
      title: `فاتورة ${r.invoice_number || r.supplier_invoice_ref || '—'}`, date: r.invoice_date,
      sub: [n.partner(r.supplier_id), n.project(r.project_id), r.status, r.due_date && `استحقاق ${r.due_date}`],
      amount: num(r.total_amount), money: { 'المدفوع': r.paid_amount, 'المتبقي': num(r.total_amount) - num(r.paid_amount) },
    }),
  },
  boq_catalog: {
    label: 'كتالوج البنود', icon: '📚', kind: 'header', table: 'boq_items', screen: '/boqcatalog',
    perms: ['boqcatalog'], select: 'item_code,main_category,sub_category,item_name,unit_of_measure,tareeha',
    search: ['item_name', 'item_code', 'main_category', 'sub_category'], order: 'item_code.asc',
    hint: 'بنود الأعمال المعتمدة بكودها ووحدتها وطريحتها',
    row: (r) => ({ title: r.item_name, sub: [r.item_code && `كود ${r.item_code}`, [r.main_category, r.sub_category].filter(Boolean).join(' / '), r.unit_of_measure && `الوحدة: ${r.unit_of_measure}`, has(r.tareeha) && `الطريحة: ${r.tareeha}`] }),
  },
  boq_budget: {
    label: 'مقايسات المشاريع', icon: '📐', kind: 'header', table: 'boq_budget', screen: '/boqbudget',
    perms: ['boqbudget'],
    select: 'work_item,Property,project_id,main_category,contract_quantity,actual_quantity,unit,unit_contract_price,total_contract_amount,completed_percentage,execution_status',
    search: ['work_item', 'main_category', 'sub_category', 'Property'], projectCol: 'project_id', amountCol: 'total_contract_amount', order: 'Property.asc,work_item.asc',
    hint: 'بنود المقايسة لكل مشروع: الكمية والسعر والإنجاز',
    row: (r, n) => ({
      title: r.work_item, sub: [r.Property || n.project(r.project_id), r.main_category, has(r.contract_quantity) && `الكمية ${num(r.contract_quantity)} ${r.unit || ''}`.trim(), has(r.completed_percentage) && `إنجاز ${num(r.completed_percentage)}%`, r.execution_status],
      amount: num(r.total_contract_amount), money: { 'سعر الوحدة': r.unit_contract_price },
    }),
  },
  expenses: {
    label: 'المصروفات', icon: '💸', kind: 'header', table: 'expenses', screen: '/expenses', moneyOnly: true,
    perms: ['expenses'], filters: notDeleted,
    select: 'exp_date,description,main_category,site_ref,project_id,payee_name,sub_contractor,quantity,unit_price,total_price,paid_amount,is_posted',
    search: ['description', 'main_category', 'payee_name', 'sub_contractor', 'notes'], dateCol: 'exp_date', siteCol: 'site_ref', projectCol: 'project_id', amountCol: 'total_price', order: 'exp_date.desc.nullslast',
    hint: 'المصروفات حسب البيان أو التصنيف أو الفيلا أو المورد',
    row: (r) => ({
      title: r.description || r.main_category || 'مصروف', date: r.exp_date,
      sub: [r.main_category, r.site_ref, r.payee_name || r.sub_contractor, r.is_posted ? 'معتمد' : 'معلق'],
      amount: num(r.total_price) || num(r.quantity || 1) * num(r.unit_price),
    }),
  },
  payment_vouchers: {
    label: 'سندات الصرف', icon: '📤', kind: 'header', table: 'payment_vouchers', screen: '/PaymentVouchers', moneyOnly: true,
    perms: ['payments'],
    select: 'voucher_number,date,partner_id,amount,payment_method,description,site_ref,status,is_posted',
    search: ['description', 'notes', 'voucher_number', 'site_ref'], dateCol: 'date', partnerCol: 'partner_id', siteCol: 'site_ref', amountCol: 'amount', order: 'date.desc.nullslast',
    hint: 'اللي اتصرف لعامل أو مقاول أو مورد',
    row: (r, n) => ({ title: `سند ${r.voucher_number || '—'} — ${n.partner(r.partner_id) || 'بدون مستفيد'}`, date: r.date, sub: [r.description, r.site_ref, r.payment_method, r.is_posted ? 'مرحّل' : (r.status || 'مسودة')], amount: num(r.amount) }),
  },
  receipts: {
    label: 'سندات القبض', icon: '📥', kind: 'header', table: 'receipt_vouchers', screen: '/ReceiptVouchers', moneyOnly: true,
    perms: ['receipts'],
    select: 'receipt_number,date,partner_id,amount,payment_method,notes,status,project_ids,reference_number',
    search: ['notes', 'receipt_number', 'reference_number'], dateCol: 'date', partnerCol: 'partner_id', projectArrayCol: 'project_ids', amountCol: 'amount', order: 'date.desc.nullslast',
    hint: 'التحصيلات من العملاء',
    row: (r, n) => ({ title: `سند ${r.receipt_number || '—'} — ${n.partner(r.partner_id) || 'بدون عميل'}`, date: r.date, sub: [n.projects(r.project_ids), r.payment_method, r.status], amount: num(r.amount) }),
  },
  invoices: {
    label: 'فواتير العملاء', icon: '🧮', kind: 'header', table: 'invoices', screen: '/invoices', moneyOnly: true,
    perms: ['invoices'],
    select: 'invoice_number,date,due_date,client_name,partner_id,total_amount,paid_amount,status,project_ids',
    search: ['invoice_number', 'client_name', 'description'], dateCol: 'date', partnerCol: 'partner_id', projectArrayCol: 'project_ids', amountCol: 'total_amount', order: 'date.desc.nullslast',
    hint: 'الفواتير والمحصّل والمتبقي',
    row: (r, n) => ({ title: `فاتورة ${r.invoice_number || '—'} — ${r.client_name || n.partner(r.partner_id) || ''}`.trim(), date: r.date, sub: [n.projects(r.project_ids), r.status, r.due_date && `استحقاق ${r.due_date}`], amount: num(r.total_amount), money: { 'المحصّل': r.paid_amount, 'المتبقي': num(r.total_amount) - num(r.paid_amount) } }),
  },
  sub_claims: {
    label: 'مستخلصات المقاولين', icon: '🧱', kind: 'header', table: 'sub_claims', screen: '/subclaims', moneyOnly: true,
    perms: ['subclaims', 'sub_claims'],
    select: 'claim_number,date,contractor_id,project_id,project_names_text,total_amount,net_amount,paid_amount,status,is_posted',
    search: ['claim_number', 'project_names_text'], dateCol: 'date', partnerCol: 'contractor_id', projectCol: 'project_id', amountCol: 'net_amount', order: 'date.desc.nullslast',
    hint: 'مستخلصات مقاولي الباطن والصافي والمدفوع',
    row: (r, n) => ({ title: `مستخلص ${r.claim_number || '—'} — ${n.partner(r.contractor_id) || 'مقاول'}`, date: r.date, sub: [r.project_names_text || n.project(r.project_id), r.status, r.is_posted ? 'مرحّل' : null], amount: num(r.net_amount), money: { 'إجمالي الأعمال': r.total_amount, 'المدفوع': r.paid_amount, 'المتبقي': num(r.net_amount) - num(r.paid_amount) } }),
  },
  job_orders: {
    label: 'أوامر الشغل', icon: '🛠️', kind: 'header', table: 'job_orders', screen: '/joborders',
    perms: ['projects'],
    select: 'order_number,project_id,boq_budget_id,contractor_id,executor_type,assigned_qty,unit_price,status,start_date,end_date',
    search: ['order_number', 'notes', 'executor_type'], dateCol: 'start_date', partnerCol: 'contractor_id', projectCol: 'project_id', order: 'created_at.desc',
    hint: 'أوامر الشغل: البند والمقاول والكمية والسعر والحالة',
    row: (r, n) => ({ title: `أمر ${r.order_number || '—'} — ${n.boq(r.boq_budget_id) || 'بند'}`, date: r.start_date, sub: [n.project(r.project_id), n.partner(r.contractor_id) || r.executor_type, has(r.assigned_qty) && `الكمية ${num(r.assigned_qty)}`, r.status, r.end_date && `حتى ${r.end_date}`], amount: num(r.assigned_qty) * num(r.unit_price), money: { 'سعر الوحدة': r.unit_price } }),
  },
  partners: {
    label: 'الشركاء (موردين ومقاولين وعملاء وعمال)', icon: '👥', kind: 'header', table: 'partners', screen: '/partners',
    perms: ['partners'], select: 'code,name,partner_type,job_role,is_active',
    search: ['name', 'code', 'job_role', 'partner_type'], order: 'name.asc',
    hint: 'اسم الشريك ونوعه ومهنته (من غير أرقام تليفونات أو هويات)',
    row: (r) => ({ title: r.name, sub: [r.code && `كود ${r.code}`, r.partner_type, r.job_role, r.is_active === false ? 'موقوف' : null] }),
  },
  custodies: {
    label: 'العهد', icon: '👜', kind: 'header', table: 'site_custodies', screen: '/custodies', moneyOnly: true,
    perms: ['expenses', 'payments', 'journal'],
    select: 'custody_number,partner_id,project_id,title,opened_date,disbursed_amount,spent_amount,remaining_amount,status',
    search: ['title', 'custody_number', 'notes'], dateCol: 'opened_date', partnerCol: 'partner_id', projectCol: 'project_id', amountCol: 'remaining_amount', order: 'opened_date.desc.nullslast',
    hint: 'عهد المواقع والموظفين: المصروف والمتبقي',
    row: (r, n) => ({ title: `عهدة ${r.custody_number || '—'} — ${n.partner(r.partner_id) || r.title || ''}`.trim(), date: r.opened_date, sub: [r.title, n.project(r.project_id), r.status], amount: num(r.remaining_amount), money: { 'المنصرف للعهدة': r.disbursed_amount, 'المصروف منها': r.spent_amount } }),
  },
  violations: {
    label: 'الجزاءات والمخالفات', icon: '⚠️', kind: 'header', table: 'violations', screen: '/violations', moneyOnly: true,
    perms: ['violations'], filters: notDeleted,
    select: 'date,emp_name,profession,project_id,site_name,reason,amount,violation_type,is_posted',
    search: ['emp_name', 'reason', 'violation_type', 'site_name'], dateCol: 'date', projectCol: 'project_id', amountCol: 'amount', order: 'date.desc.nullslast',
    hint: 'الجزاءات على العمال والموظفين',
    row: (r, n) => ({ title: `${r.violation_type || 'جزاء'} — ${r.emp_name || ''}`.trim(), date: r.date, sub: [r.reason, r.site_name || n.project(r.project_id), r.profession], amount: num(r.amount) }),
  },
  fixed_assets: {
    label: 'الأصول الثابتة والمعدات', icon: '🚜', kind: 'header', table: 'fixed_assets', screen: '/fixed-assets',
    perms: ['assets', 'accounting', 'journal'],
    select: 'asset_number,name,asset_type,purchase_date,purchase_cost,book_value,status,current_project_id',
    search: ['name', 'asset_number', 'asset_type', 'serial_number'], dateCol: 'purchase_date', projectCol: 'current_project_id', amountCol: 'book_value', order: 'name.asc',
    hint: 'المعدات والأصول ومكانها وقيمتها',
    row: (r, n) => ({ title: `${r.name}${r.asset_number ? ` (${r.asset_number})` : ''}`, date: r.purchase_date, sub: [r.asset_type, n.project(r.current_project_id) && `في ${n.project(r.current_project_id)}`, r.status], amount: num(r.book_value), money: { 'تكلفة الشراء': r.purchase_cost } }),
  },
  projects: {
    label: 'المشاريع والفلل', icon: '🏘️', kind: 'header', table: 'projects', screen: '/projects',
    perms: ['projects'],
    select: 'project_code,Property,project_name,client_name,contract_value,status,current_stage,unit_type,unit_area,start_date,end_date,engineer_in_charge',
    search: ['Property', 'project_name', 'client_name', 'project_code', 'unit_type'], amountCol: 'contract_value', order: 'Property.asc',
    hint: 'بيانات المشروع: العميل وقيمة العقد والمرحلة والمهندس',
    row: (r) => ({ title: r.Property || r.project_name, sub: [r.project_code && `كود ${r.project_code}`, r.client_name && `العميل: ${r.client_name}`, r.unit_type, has(r.unit_area) && `${num(r.unit_area)} م²`, r.current_stage || r.status, r.engineer_in_charge && `م/ ${r.engineer_in_charge}`], amount: num(r.contract_value) }),
  },
});

export const SECTION_KEYS = Object.freeze(Object.keys(SECTIONS));
/** أقسام البحث الشامل (section=all) بالترتيب. */
const ALL_ORDER = ['items', 'projects', 'partners', 'boq_catalog', 'boq_budget', 'job_orders', 'material_receipts', 'material_issues', 'purchase_orders', 'expenses', 'payment_vouchers', 'receipts', 'invoices', 'sub_claims', 'supplier_invoices', 'custodies', 'fixed_assets', 'violations'];

/** الأقسام اللي الدور يقدر يشوفها: أي صلاحية من perms تكفي، والأقسام اللي كلها فلوس محتاجة show_money. */
export function allowedSectionsFor(hasPermission, showMoney) {
  return SECTION_KEYS.filter(key => {
    const s = SECTIONS[key];
    if (s.moneyOnly && !showMoney) return false;
    return s.perms.some(m => hasPermission(m));
  });
}

/* ───────────── التحقق من المعطيات ───────────── */

function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/** بيرجّع المعطيات النضيفة أو null. resolveDate بيحوّل «النهارده/امبارح» لتاريخ. */
export function validateQueryArgs(supplied, resolveDate = validDate) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return null;
  const allowedKeys = ['section', 'search', 'project', 'partner', 'start_date', 'end_date'];
  if (Object.keys(supplied).some(k => !allowedKeys.includes(k))) return null;
  const section = typeof supplied.section === 'string' ? supplied.section.trim() : '';
  if (section !== 'all' && !Object.hasOwn(SECTIONS, section)) return null;
  const out = { section };
  for (const k of ['search', 'project', 'partner']) {
    if (supplied[k] === undefined || supplied[k] === null || supplied[k] === '') continue;
    const t = sanitizeTerm(supplied[k]);
    if (!t) return null;
    if (['الكل', 'كل', 'all'].includes(t.toLowerCase())) continue; // «الكل» = من غير فلتر
    out[k] = t;
  }
  if (supplied.start_date !== undefined || supplied.end_date !== undefined) {
    const s = supplied.start_date !== undefined ? resolveDate(supplied.start_date) : null;
    const e = supplied.end_date !== undefined ? resolveDate(supplied.end_date) : s;
    const start = s ?? e;
    if (!start || !e || e < start) return null;
    if ((Date.parse(e) - Date.parse(start)) / DAY_MS > MAX_RANGE_DAYS) return null;
    out.start_date = start;
    out.end_date = e;
  }
  if ((section === 'all' || SECTIONS[section]?.needsSearch) && !out.search) return null;
  return out;
}

/* ───────────── التنفيذ ───────────── */

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/**
 * fetchRows(table, params) → { ok, data, totalCount } — لازم يكون fetchScopedRows (بيحط company_id).
 * sitePricing(term) → { guide: [...], products: [...] } من الموقع العام (اختياري).
 */
export function createSectionQuery({ fetchRows, sitePricing = null }) {
  const nameCache = new Map();

  async function resolveNames(table, ids, selectCols, labelOf) {
    const key = table;
    if (!nameCache.has(key)) nameCache.set(key, new Map());
    const cache = nameCache.get(key);
    const missing = uniq(ids).filter(id => !cache.has(id));
    for (const part of chunk(missing, ID_CHUNK)) {
      const res = await fetchRows(table, { select: selectCols, id: `in.(${part.join(',')})`, limit: String(part.length) });
      for (const id of part) cache.set(id, null);
      if (res.ok) for (const r of res.data) cache.set(r.id, labelOf(r));
    }
    return (id) => (id ? cache.get(id) ?? null : null);
  }

  async function namesFor(rows, spec) {
    const partnerIds = [], projectIds = [], boqIds = [];
    for (const r of rows) {
      const src = r.__parent || r;
      const p = spec.parent || spec;
      if (p.partnerCol && src[p.partnerCol]) partnerIds.push(src[p.partnerCol]);
      if (p.projectCol && src[p.projectCol]) projectIds.push(src[p.projectCol]);
      if (p.projectArrayCol && Array.isArray(src[p.projectArrayCol])) projectIds.push(...src[p.projectArrayCol]);
      if (r.boq_budget_id) boqIds.push(r.boq_budget_id);
    }
    const [partner, project, boq] = await Promise.all([
      partnerIds.length ? resolveNames('partners', partnerIds, 'id,name', r => r.name) : () => null,
      projectIds.length ? resolveNames('projects', projectIds, 'id,Property,project_name', r => r.Property || r.project_name) : () => null,
      boqIds.length ? resolveNames('boq_budget', boqIds, 'id,work_item', r => r.work_item) : () => null,
    ]);
    return {
      partner, project, boq,
      projects: (ids) => (Array.isArray(ids) ? uniq(ids.map(project)).join(' + ') || null : null),
    };
  }

  async function matchIds(table, cols, term, selectCols = 'id', limit = 50) {
    const pat = ilikePattern(term);
    if (!pat) return [];
    const params = { select: selectCols, limit: String(limit) };
    if (cols.length === 1) params[cols[0]] = `ilike.${pat}`;
    else params.or = `(${cols.map(c => `${c}.ilike.${pat}`).join(',')})`;
    const res = await fetchRows(table, params);
    return res.ok ? res.data : null;
  }

  /** فلاتر الرأس: التاريخ والمشروع والشريك. بترجع null لو الفلتر ما لقاش حاجة (يعني النتيجة فاضية). */
  async function headerFilters(target, args, notes) {
    const params = {};
    if (target.dateCol && args.start_date) params[target.dateCol] = [`gte.${args.start_date}`, `lte.${args.end_date}`];
    if (args.project) {
      if (target.siteCol && !target.projectCol) params[target.siteCol] = `ilike.${ilikePattern(args.project)}`;
      else if (target.projectCol || target.projectArrayCol) {
        const proj = await matchIds('projects', ['Property', 'project_name', 'project_code'], args.project, 'id,Property', 20);
        if (proj === null) notes.push('ماقدرتش أقرأ قائمة المشاريع لفلترة المشروع.');
        const ids = (proj || []).map(p => p.id);
        if (!ids.length) {
          if (target.siteCol) params[target.siteCol] = `ilike.${ilikePattern(args.project)}`;
          else return null;
        } else if (target.projectArrayCol) params[target.projectArrayCol] = `ov.{${ids.join(',')}}`;
        else if (target.siteCol) params.or = `(${target.projectCol}.in.(${ids.join(',')}),${target.siteCol}.ilike.${ilikePattern(args.project)})`;
        else params[target.projectCol] = `in.(${ids.join(',')})`;
      }
    }
    if (args.partner && target.partnerCol) {
      const ps = await matchIds('partners', ['name', 'code'], args.partner, 'id', 50);
      if (ps === null) notes.push('ماقدرتش أقرأ قائمة الشركاء لفلترة الاسم.');
      const ids = (ps || []).map(p => p.id);
      if (!ids.length) return null;
      params[target.partnerCol] = `in.(${ids.join(',')})`;
    }
    return params;
  }

  /** لو الفلتر والبحث الاتنين فيهم or، نجمعهم and=(or(...),or(...)) بدل ما واحد يمسح التاني. */
  function mergeOr(a, b) {
    if (!a.or || !b.or) return { ...a, ...b };
    const { or: x, ...ra } = a; const { or: y, ...rb } = b;
    return { ...ra, ...rb, and: `(or${x},or${y})` };
  }

  function searchParams(cols, term) {
    if (!term) return {};
    const pat = ilikePattern(term);
    if (!pat) return {};
    return cols.length === 1 ? { [cols[0]]: `ilike.${pat}` } : { or: `(${cols.map(c => `${c}.ilike.${pat}`).join(',')})` };
  }

  async function runHeader(key, args, limit = MAX_ROWS) {
    const spec = SECTIONS[key];
    const notes = [];
    const filters = await headerFilters(spec, args, notes);
    if (filters === null) return { key, ok: true, rows: [], total: 0, notes, empty_reason: 'filter' };
    const params = { select: spec.select, ...spec.filters, ...mergeOr(filters, searchParams(spec.search, args.search)), order: spec.order || 'created_at.desc', limit: String(limit) };
    const res = await fetchRows(spec.table, params);
    if (!res.ok) return { key, ok: false, rows: [], total: null, notes };
    const names = await namesFor(res.data, spec);
    const rows = res.data.map(r => spec.row(r, names));
    const total = Number.isSafeInteger(res.totalCount) ? res.totalCount : res.data.length;
    return { key, ok: true, rows, total, fetched: res.data.length, sum: spec.amountCol ? rows.reduce((s, r) => s + num(r.amount), 0) : null, notes };
  }

  /** سطور الأصناف + رؤوسها. الفلترة بالتاريخ/المشروع/الشريك على الرأس، والبحث على اسم الصنف. */
  async function fetchLines(key, args, limit = MAX_ROWS) {
    const spec = SECTIONS[key];
    const notes = [];
    const p = spec.parent;
    const hdr = await headerFilters(p, args, notes);
    if (hdr === null) return { ok: true, lines: [], notes, empty_reason: 'filter' };
    let parentIds = null;
    let parentRows = [];
    if (Object.keys(hdr).length) {
      const pr = await fetchRows(p.table, { select: p.select, ...hdr, order: `${p.dateCol}.desc.nullslast`, limit: String(MAX_ROWS) });
      if (!pr.ok) return { ok: false, lines: [], notes };
      parentRows = pr.data;
      parentIds = pr.data.map(r => r.id);
      if (!parentIds.length) return { ok: true, lines: [], notes, empty_reason: 'filter' };
    }
    const lines = [];
    let truncated = false;
    const base = { select: spec.select, ...searchParams(spec.search, args.search) };
    if (parentIds) {
      for (const part of chunk(parentIds, ID_CHUNK)) {
        const res = await fetchRows(spec.table, { ...base, [spec.fk]: `in.(${part.join(',')})`, limit: String(limit) });
        if (!res.ok) return { ok: false, lines: [], notes };
        lines.push(...res.data);
        if (lines.length >= limit) { truncated = true; break; }
      }
    } else {
      const res = await fetchRows(spec.table, { ...base, limit: String(limit) });
      if (!res.ok) return { ok: false, lines: [], notes };
      lines.push(...res.data);
      truncated = Number.isSafeInteger(res.totalCount) && res.totalCount > res.data.length;
      const ids = uniq(res.data.map(l => l[spec.fk]));
      for (const part of chunk(ids, ID_CHUNK)) {
        const pr = await fetchRows(p.table, { select: p.select, id: `in.(${part.join(',')})`, limit: String(part.length) });
        if (pr.ok) parentRows.push(...pr.data);
      }
    }
    const byId = new Map(parentRows.map(r => [r.id, r]));
    for (const l of lines) l.__parent = byId.get(l[spec.fk]) || null;
    lines.sort((a, b) => String(b.__parent?.[p.dateCol] || '').localeCompare(String(a.__parent?.[p.dateCol] || '')));
    return { ok: true, lines, truncated, notes };
  }

  /** تجميع أسعار وكميات كل صنف من السطور. */
  function itemStats(lines, spec, names) {
    const p = spec.parent;
    const map = new Map();
    for (const l of lines) {
      const k = normalizeName(l.item_name || l.description);
      if (!k) continue;
      const g = map.get(k) || { name: l.item_name || l.description, unit: l.unit, count: 0, qty: 0, total: 0, min: null, max: null, last: null };
      const price = num(l.unit_price) || (num(l.quantity) ? num(l.total_price) / num(l.quantity) : 0);
      g.count += 1;
      g.qty += num(l.quantity);
      g.total += num(l.total_price) || num(l.quantity) * price;
      if (price > 0) {
        g.min = g.min === null ? price : Math.min(g.min, price);
        g.max = g.max === null ? price : Math.max(g.max, price);
        if (!g.last) g.last = { price, date: l.__parent?.[p.dateCol] || null, partner: names.partner(l.__parent?.[p.partnerCol]) || l.__parent?.contractor_text_name || null };
      }
      map.set(k, g);
    }
    return [...map.values()].map(g => ({ ...g, avg: g.qty > 0 ? g.total / g.qty : null })).sort((a, b) => b.total - a.total);
  }

  async function runLines(key, args, limit = MAX_ROWS) {
    const spec = SECTIONS[key];
    const res = await fetchLines(key, args, limit);
    if (!res.ok) return { key, ok: false, rows: [], total: null, notes: res.notes };
    const names = await namesFor(res.lines, spec);
    const p = spec.parent;
    const rows = res.lines.map(l => {
      const h = l.__parent || {};
      return {
        title: l.item_name || l.description || 'صنف',
        date: h[p.dateCol] || null,
        sub: [h[p.label] && `رقم ${h[p.label]}`, has(l.quantity) && `${num(l.quantity)} ${l.unit || ''}`.trim(), names.partner(h[p.partnerCol]) || h.contractor_text_name, names.project(h[p.projectCol]), has(l.received_quantity) && `المستلم ${num(l.received_quantity)}`, h.status],
        amount: num(l.total_price),
        money: { 'سعر الوحدة': l.unit_price },
      };
    });
    return {
      key, ok: true, rows, total: rows.length, truncated: res.truncated, fetched: rows.length,
      sum: rows.reduce((s, r) => s + num(r.amount), 0), notes: res.notes, empty_reason: res.empty_reason,
      stats: args.search ? itemStats(res.lines, spec, names).slice(0, 8) : null,
    };
  }

  async function runPrices(args, allowed) {
    const parts = {};
    const can = (k) => allowed.includes(k);
    const jobs = [];
    if (can('items')) jobs.push(runHeader('items', args, 20).then(r => { parts.items = r; }));
    if (can('material_receipts')) jobs.push(runLines('material_receipts', { search: args.search, project: args.project, partner: args.partner, start_date: args.start_date, end_date: args.end_date }).then(r => { parts.receipts = r; }));
    if (can('purchase_orders')) jobs.push(runLines('purchase_orders', { search: args.search, project: args.project, partner: args.partner, start_date: args.start_date, end_date: args.end_date }).then(r => { parts.purchase_orders = r; }));
    if (can('expenses')) jobs.push(runHeader('expenses', args, 200).then(r => { parts.expenses = r; }));
    if (can('boq_budget')) jobs.push(runHeader('boq_budget', { search: args.search, project: args.project }, 20).then(r => { parts.boq_budget = r; }));
    await Promise.all(jobs);
    let site = { guide: [], products: [] };
    if (typeof sitePricing === 'function') { try { site = (await sitePricing(args.search)) || site; } catch { /* الموقع مش متاح */ } }
    return { key: 'prices', ok: true, parts, guide: (site.guide || []).slice(0, 3), store: (site.products || []).filter(p => num(p.price) > 0).slice(0, 3) };
  }

  async function runStock(args, allowed) {
    const out = { key: 'stock', ok: true, items: [], notes: [] };
    const map = new Map();
    const touch = (name, unit) => {
      const k = normalizeName(name);
      if (!k) return null;
      if (!map.has(k)) map.set(k, { name, unit, received: 0, issued: 0, stock: null, min: null, lastPrice: null });
      return map.get(k);
    };
    const jobs = [];
    let anySource = false;
    if (allowed.includes('material_receipts')) {
      anySource = true;
      jobs.push(fetchLines('material_receipts', { search: args.search, project: args.project }).then(r => {
        if (!r.ok) { out.notes.push('التوريدات غير متاحة.'); return; }
        for (const l of r.lines) { const g = touch(l.item_name, l.unit); if (g) { g.received += num(l.quantity); if (g.lastPrice === null && num(l.unit_price)) g.lastPrice = num(l.unit_price); } }
        if (r.truncated) out.partial = true;
      }));
    }
    if (allowed.includes('material_issues')) {
      anySource = true;
      jobs.push(fetchLines('material_issues', { search: args.search, project: args.project }).then(r => {
        if (!r.ok) { out.notes.push('الصرف غير متاح.'); return; }
        for (const l of r.lines) { const g = touch(l.item_name, l.unit); if (g) g.issued += num(l.quantity); }
        if (r.truncated) out.partial = true;
      }));
    }
    if (allowed.includes('items')) {
      anySource = true;
      jobs.push((async () => {
        const inv = await fetchRows('inventory', { select: 'item_name,unit,current_stock,avg_price', ...searchParams(['item_name'], args.search), limit: String(MAX_ROWS) });
        if (inv.ok) for (const r of inv.data) { const g = touch(r.item_name, r.unit); if (g) { g.stock = num(r.current_stock); if (g.lastPrice === null && num(r.avg_price)) g.lastPrice = num(r.avg_price); } }
        const items = await fetchRows('material_items', { select: 'item_name,default_unit,min_order_level', ...searchParams(['item_name', 'item_code'], args.search), limit: String(MAX_ROWS) });
        if (items.ok) for (const r of items.data) { const g = touch(r.item_name, r.default_unit); if (g && has(r.min_order_level)) g.min = num(r.min_order_level); }
      })());
    }
    await Promise.all(jobs);
    if (!anySource) return { key: 'stock', ok: false, items: [], notes: ['مفيش مصدر مخزون ضمن صلاحياتك.'] };
    out.items = [...map.values()].map(g => {
      const balance = g.stock !== null && !g.received && !g.issued ? g.stock : g.received - g.issued;
      return { ...g, balance, low: g.min !== null && balance <= g.min };
    }).filter(g => g.received || g.issued || g.stock !== null || args.search)
      .sort((a, b) => (a.low === b.low ? b.balance - a.balance : a.low ? -1 : 1));
    out.project = args.project || null;
    return out;
  }

  async function runAll(args, allowed) {
    const keys = ALL_ORDER.filter(k => allowed.includes(k));
    const results = await Promise.all(keys.map(k => {
      const kind = SECTIONS[k].kind;
      const p = kind === 'lines' ? runLines(k, { search: args.search }, 50) : runHeader(k, { search: args.search, project: args.project, start_date: args.start_date, end_date: args.end_date }, 20);
      return p.catch(() => ({ key: k, ok: false, rows: [] }));
    }));
    return { key: 'all', ok: true, sections: results.filter(r => r.ok && r.rows.length).map(r => ({ ...r, rows: r.rows.slice(0, ALL_ROWS) })), failed: results.filter(r => !r.ok).map(r => r.key) };
  }

  /** نقطة الدخول: args متحققة (validateQueryArgs) + allowed_sections من السياسة. */
  return async function query({ section, allowed_sections = [], show_money = false, ...args }) {
    const allowed = Array.isArray(allowed_sections) ? allowed_sections : [];
    let result;
    if (section === 'all') result = await runAll(args, allowed);
    else if (!allowed.includes(section)) return { success: false, error: 'section_forbidden' };
    else if (section === 'prices') result = await runPrices(args, allowed);
    else if (section === 'stock') result = await runStock(args, allowed);
    else if (SECTIONS[section].kind === 'lines') result = await runLines(section, args);
    else result = await runHeader(section, args);
    if (!result.ok && section !== 'all') return { success: false, error: 'source_unavailable' };
    return { success: true, section, filters: args, show_money: Boolean(show_money), result };
  };
}

/* ───────────── تنسيق الرد ───────────── */

function fmtMoney(v, cur) {
  const n = num(v);
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}`;
}
const fmtQty = (v) => num(v).toLocaleString('en-US', { maximumFractionDigits: 2 });

function filtersLine(f) {
  const parts = [];
  if (f.search) parts.push(`🔎 «${f.search}»`);
  if (f.project) parts.push(`🏠 ${f.project}`);
  if (f.partner) parts.push(`👤 ${f.partner}`);
  if (f.start_date) parts.push(f.start_date === f.end_date ? `📅 ${f.start_date}` : `📅 ${f.start_date} → ${f.end_date}`);
  return parts.join(' • ');
}

function rowLine(r, i, showMoney, cur) {
  const sub = (r.sub || []).filter(Boolean).join(' • ');
  const money = [];
  if (showMoney) {
    if (r.amount) money.push(fmtMoney(r.amount, cur));
    for (const [label, v] of Object.entries(r.money || {})) if (has(v) && num(v) !== 0) money.push(`${label} ${fmtMoney(v, cur)}`);
  }
  return `${i + 1}) ${r.date ? `${r.date} — ` : ''}${r.title || '—'}${sub ? `\n   ${sub}` : ''}${money.length ? `\n   💰 ${money.join(' • ')}` : ''}`;
}

function statsBlock(stats, showMoney, cur) {
  if (!stats?.length) return '';
  const lines = stats.map(s => {
    const base = `• ${s.name}: ${s.count} مرة، كمية ${fmtQty(s.qty)} ${s.unit || ''}`.trim();
    if (!showMoney) return base;
    const price = s.last ? `آخر سعر ${fmtMoney(s.last.price, cur)}${s.last.date ? ` (${s.last.date}${s.last.partner ? ` — ${s.last.partner}` : ''})` : ''}` : '';
    const range = s.min !== null ? `أقل ${fmtMoney(s.min, cur)} / أعلى ${fmtMoney(s.max, cur)}${s.avg ? ` / متوسط ${fmtMoney(s.avg, cur)}` : ''}` : '';
    return [base, price, range, `الإجمالي ${fmtMoney(s.total, cur)}`].filter(Boolean).join('\n   ');
  });
  return `📊 حسب الصنف:\n${lines.join('\n')}`;
}

function sectionBlock(res, { showMoney, cur, maxRows }) {
  const spec = SECTIONS[res.key];
  if (!res.rows.length) {
    return res.empty_reason === 'filter' ? 'مالقيتش مشروع أو اسم مطابق للفلتر.' : 'مفيش نتايج مطابقة.';
  }
  const head = [];
  head.push(`العدد: ${res.total ?? res.rows.length}${res.truncated || (res.total && res.fetched && res.total > res.fetched) ? ' (أول جزء بس)' : ''}`);
  if (showMoney && spec.amountCol !== undefined && res.sum !== null && res.sum !== undefined) head.push(`الإجمالي: ${fmtMoney(res.sum, cur)}`);
  if (showMoney && spec.kind === 'lines') head.push(`الإجمالي: ${fmtMoney(res.sum, cur)}`);
  const shown = res.rows.slice(0, maxRows).map((r, i) => rowLine(r, i, showMoney, cur));
  const more = res.rows.length > maxRows ? `\n… وفيه ${(res.total ?? res.rows.length) - maxRows} كمان. ضيّق البحث أو افتح ${spec.screen}` : '';
  const stats = res.stats ? `\n\n${statsBlock(res.stats, showMoney, cur)}` : '';
  return `${head.join(' • ')}\n\n${shown.join('\n')}${more}${stats}`;
}

function pricesReply(out, f, cur, companyLabel) {
  const p = out.result.parts;
  const lines = [`💲 أسعار «${f.search}» — ${companyLabel}`];
  const fl = filtersLine({ ...f, search: null });
  if (fl) lines.push(fl);
  let found = false;
  const item = p.items?.rows?.[0];
  if (item) {
    found = true;
    const m = Object.entries(item.money || {}).filter(([, v]) => has(v) && num(v)).map(([k, v]) => `${k} ${fmtMoney(v, cur)}`);
    lines.push(`\n📦 دليل الخامات: ${item.title}${m.length ? ` — ${m.join(' • ')}` : ''}${p.items.rows.length > 1 ? ` (و${p.items.rows.length - 1} صنف مشابه)` : ''}`);
  }
  for (const [k, label] of [['receipts', '🚚 التوريدات'], ['purchase_orders', '🧾 أوامر الشراء']]) {
    const s = p[k]?.stats?.[0];
    if (!s) continue;
    found = true;
    lines.push(`\n${label}: ${s.name} — ${s.count} مرة، كمية ${fmtQty(s.qty)} ${s.unit || ''}`.trim());
    if (s.last) lines.push(`   آخر سعر ${fmtMoney(s.last.price, cur)}${s.last.date ? ` (${s.last.date}${s.last.partner ? ` — ${s.last.partner}` : ''})` : ''}`);
    if (s.min !== null) lines.push(`   أقل ${fmtMoney(s.min, cur)} / أعلى ${fmtMoney(s.max, cur)}${s.avg ? ` / متوسط ${fmtMoney(s.avg, cur)}` : ''}`);
  }
  const ex = p.expenses?.rows || [];
  if (ex.length) {
    found = true;
    const last = ex[0];
    lines.push(`\n💸 المصروفات: ${p.expenses.total ?? ex.length} مصروف بإجمالي ${fmtMoney(p.expenses.sum, cur)}\n   آخر واحد: ${last.date || ''} — ${last.title} — ${fmtMoney(last.amount, cur)}`);
  }
  const boq = p.boq_budget?.rows || [];
  if (boq.length) {
    found = true;
    lines.push(`\n📐 في المقايسات:`);
    for (const b of boq.slice(0, 4)) lines.push(`   • ${b.title} — ${(b.sub || []).filter(Boolean)[0] || ''}${has(b.money?.['سعر الوحدة']) ? ` — سعر الوحدة ${fmtMoney(b.money['سعر الوحدة'], cur)}` : ''}`);
  }
  if (out.result.guide?.length) {
    found = true;
    lines.push(`\n📘 أسعار استرشادية من دليل التنفيذ (الموقع العام):`);
    for (const g of out.result.guide) lines.push(`   • ${g.itemTitle}: ${g.totalRate || g.materialCostRange || '—'}${g.lastPriceUpdate ? ` (تحديث ${g.lastPriceUpdate})` : ''}`);
  }
  if (out.result.store?.length) {
    found = true;
    lines.push(`\n🛒 سعر البيع في متجر الموقع:`);
    for (const g of out.result.store) lines.push(`   • ${g.name}${g.code ? ` (${g.code})` : ''}: ${g.price ? fmtMoney(g.price, g.currency || cur) : 'عند الطلب'}${g.unit ? ` / ${g.unit}` : ''}${g.installPrice ? ` + تركيب ${fmtMoney(g.installPrice, g.currency || cur)}` : ''}${g.inStock ? '' : ' (غير متوفر)'}`);
  }
  if (!found) lines.push('\nمالقيتش سعر مسجل للصنف ده في الدليل أو التوريدات أو المصروفات أو المقايسات. جرّب اسم تاني أو افتح /materials.');
  return lines.join('\n');
}

function stockReply(out, f, cur, showMoney, companyLabel) {
  const r = out.result;
  const lines = [`🏬 المخزون${f.search ? ` — «${f.search}»` : ''} — ${companyLabel}`];
  if (f.project) lines.push(`🏠 ${f.project} (المورّد للمشروع ناقص المنصرف منه)`);
  if (!r.items.length) {
    lines.push('\nمفيش حركة توريد أو صرف مسجلة للصنف ده.');
  } else {
    for (const g of r.items.slice(0, SHOW_ROWS)) {
      const bits = [`الرصيد ${fmtQty(g.balance)} ${g.unit || ''}`.trim()];
      if (g.received || g.issued) bits.push(`ورد ${fmtQty(g.received)} • اتصرف ${fmtQty(g.issued)}`);
      if (g.min !== null) bits.push(`حد الطلب ${fmtQty(g.min)}`);
      if (showMoney && g.lastPrice) bits.push(`آخر سعر ${fmtMoney(g.lastPrice, cur)}`);
      lines.push(`${g.low ? '🔴' : '•'} ${g.name}: ${bits.join(' • ')}`);
    }
    if (r.items.length > SHOW_ROWS) lines.push(`… وفيه ${r.items.length - SHOW_ROWS} صنف كمان. افتح /inventory`);
  }
  if (r.partial) lines.push('\n⚠️ الحركات كتير، الرقم من أول 1000 سطر بس.');
  if (r.notes?.length) lines.push(`\n${r.notes.join(' ')}`);
  return lines.join('\n');
}

/** رد نصي جاهز للتليجرام. */
export function formatSectionReply(out, { companyLabel = 'الشركة', cur = 'ر.س' } = {}) {
  const f = out.filters || {};
  const showMoney = out.show_money === true;
  if (out.section === 'prices') return pricesReply(out, f, cur, companyLabel);
  if (out.section === 'stock') return stockReply(out, f, cur, showMoney, companyLabel);
  if (out.section === 'all') {
    const r = out.result;
    const lines = [`🔎 بحث شامل عن «${f.search}» — ${companyLabel}`];
    if (!r.sections.length) {
      lines.push('\nمالقيتش أي حاجة مطابقة في الأقسام المتاحة لك.');
    } else {
      for (const s of r.sections) {
        const spec = SECTIONS[s.key];
        lines.push(`\n${spec.icon} ${spec.label} (${s.total ?? s.rows.length}):`);
        s.rows.forEach((row, i) => lines.push(rowLine(row, i, showMoney, cur)));
      }
      lines.push('\nعاوز تفاصيل قسم معين؟ قولّي اسم القسم.');
    }
    if (r.failed?.length) lines.push(`\n⚠️ أقسام ماقدرتش أقراها: ${r.failed.map(k => SECTIONS[k].label).join('، ')}`);
    return lines.join('\n');
  }
  const spec = SECTIONS[out.section];
  const fl = filtersLine(f);
  const notes = out.result.notes?.length ? `\n\n${out.result.notes.join(' ')}` : '';
  return `${spec.icon} ${spec.label} — ${companyLabel}${fl ? `\n${fl}` : ''}\n${sectionBlock(out.result, { showMoney, cur, maxRows: SHOW_ROWS })}${notes}`;
}

/** وصف الأداة للنموذج (Gemini). */
export const QUERY_TOOL_DECLARATION = Object.freeze({
  name: QUERY_TOOL_NAME,
  description:
    'استعلام قراءة فقط عن أي قسم في سيستم فاي تك للشركة المفتوحة: الأسعار، المخزون، الخامات والأصناف، التوريدات، صرف الخامات، أوامر الشراء، فواتير الموردين، كتالوج البنود، المقايسات، المصروفات، سندات الصرف والقبض، فواتير العملاء، المستخلصات، أوامر الشغل، الشركاء، العهد، الجزاءات، الأصول، والمشاريع. ' +
    'استخدميها لأي سؤال عن بضاعة أو صنف أو سعر أو كمية أو مبلغ أو مستند أو شريك. لو مش عارفة القسم استخدمي section="all" مع كلمة البحث. ' +
    'الأقسام: ' + SECTION_KEYS.map(k => `${k} = ${SECTIONS[k].hint}`).join('؛ ') + '.',
  parameters: {
    type: 'OBJECT',
    properties: {
      section: { type: 'STRING', enum: ['all', ...SECTION_KEYS], description: 'القسم المطلوب. prices للأسعار (لازم search)، stock للأرصدة، all للبحث في كل الأقسام (لازم search).' },
      search: { type: 'STRING', description: 'كلمة البحث: اسم الصنف أو الخامة أو البند أو البيان أو رقم المستند (مثال: «اسمنت»، «حديد 16»، «محارة»). من غير كلمات الأوامر.' },
      project: { type: 'STRING', description: 'اسم أو رقم الفيلا / المشروع لو اتذكر.' },
      partner: { type: 'STRING', description: 'اسم المورد أو المقاول أو العميل أو العامل لو اتذكر.' },
      start_date: { type: 'STRING', description: 'بداية الفترة YYYY-MM-DD أو today/yesterday. اختياري.' },
      end_date: { type: 'STRING', description: 'نهاية الفترة YYYY-MM-DD. الفترة لحد سنة.' },
    },
    required: ['section'],
  },
});
