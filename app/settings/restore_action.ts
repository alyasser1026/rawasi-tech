"use server";
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { fetchAllSupabaseData } from '@/lib/helpers';

// 🛠️ فلتر التنظيف المطور لمعالجة مشاكل المسافات والحروف العربية
const normalizeStr = (str: any) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // تحويل مسافات زائدة لمسافة واحدة
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
};

const formatExcelDate = (excelSerialNumber: number) => {
  const date = new Date(Math.round((excelSerialNumber - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
};

const mapHeaderToSchema = (sheetName: string, header: string) => {
  const h = normalizeStr(header);
  
  if (h.includes('تاريخ') || h.includes('date')) return sheetName === 'labor_daily_logs' ? 'work_date' : (sheetName === 'expenses' ? 'exp_date' : 'date');
  
  // 🚀 التعديل: نقلنا شروط المصروفات هنا فوق عشان تتنفذ الأول ومتتضربش بالشروط العامة
  if (sheetName === 'expenses') {
    if (h.includes('تاريخ')) return 'exp_date';
    if (h.includes('مقاول') || h.includes('مورد')) return 'sub_contractor';
    if (h.includes('مستفيد')) return 'payee_name';
    if (h.includes('حساب') && (h.includes('مصروف') || h.includes('مدين'))) return 'creditor_account';
    if (h.includes('حساب') && (h.includes('سداد') || h.includes('دائن'))) return 'payment_account';
    if (h.includes('بيان') || h.includes('وصف')) return 'description';
    if (h.includes('تصنيف') || h.includes('فئة') || h.includes('category')) return 'main_category';
    if (h.includes('خصم')) return h.includes('حساب') ? 'discount_account' : 'discount_amount';
    if (h.includes('ضريبه') || h.includes('vat')) return 'vat_amount';
  }

  // 🟢 التعديل الجديد الآمن: بلوك خاص بخامات المستودع عشان ميتعارضش مع الجداول التانية
  if (sheetName === 'material_receipt_lines') {
    if (h.includes('ماده') || h.includes('مادة') || h.includes('صنف') || h.includes('خام') || h.includes('item')) return 'item_name';
    if (h.includes('عقار') || h.includes('مشروع') || h.includes('property') || h.includes('project')) return 'project_id'; 
    if (h.includes('كميه') || h.includes('كمية') || h.includes('quantity') || h.includes('qty')) return 'quantity';
    if (h.includes('وحده') || h.includes('وحدة') || h.includes('unit')) return 'unit';
    if (h.includes('سعر') || h.includes('price')) return 'unit_price';
    if (h.includes('إجمالي') || h.includes('اجمالي') || h.includes('total')) return 'total_price';
    if (h.includes('سند') || h.includes('اذن') || h.includes('استلام') || h.includes('receipt')) return 'receipt_id';
  }

  // 🟢 التقاط الـ 3 معرفات مباشرة وبدقة متناهية
  if (h.includes('partner_id')) return 'partner_id';
  if (h.includes('debit_account_id') || (h.includes('مدين') && h.includes('id'))) return 'debit_account_id';
  if (h.includes('credit_account_id') || (h.includes('دائن') && h.includes('id'))) return 'credit_account_id';
  if (h.includes('account_id') && !h.includes('debit') && !h.includes('credit')) return 'account_id'; // لباقي الجداول القديمة

  // 🟢 التقاط اسم الشريك/المستفيد لو المستخدم كتب الاسم بدل الـ ID
  if (h.includes('موظف') || h.includes('عامل') || h.includes('اسم') || h.includes('emp') || h.includes('worker') || h.includes('مستفيد') || h.includes('payee') || h.includes('شريك')) {
      if (sheetName === 'labor_daily_logs') return 'worker_name';
      if (sheetName === 'payment_vouchers' || sheetName === 'receipt_vouchers') return 'payee_name';
      return 'emp_name';
  }

  // 🟢 التقاط اسم الحساب المالي
  if (h.includes('حساب') || h.includes('صندوق') || h.includes('بنك') || h.includes('account')) {
      if (h.includes('مدين')) return 'debit_account_name';
      if (h.includes('دائن')) return 'credit_account_name';
      return 'account_name'; 
  }

  if (h.includes('مبلغ') || h.includes('قيمه') || h.includes('amount')) return 'amount';
  if (h.includes('يوميه') || h.includes('اجر') || h.includes('wage')) return 'daily_wage';
  if (h.includes('حضور') || h.includes('ايام') || h.includes('attendance')) return 'attendance_value';
  if (h.includes('انجاز') || h.includes('نسبه') || h.includes('completion')) return 'completion_percentage';
  
  // ⚠️ السطور القديمة بتاعتك زي ما هي متلمستش ⚠️
  if (h.includes('عقار') || h.includes('مشروع') || h.includes('property') || h.includes('project')) return 'Property';
  if (h.includes('موقع') || h.includes('site')) return sheetName === 'violations' ? 'site_name' : 'site_ref';
  if (h.includes('بند') || h.includes('عمل') || h.includes('item')) return 'work_item';
  if (h.includes('مقاول') || h.includes('contractor')) return 'sub_contractor';
  if (h.includes('ملاحظات') || h.includes('notes')) return 'notes';
  
  // (هذه السطور سيتخطاها الخامات بسبب البلوك اللي فوق، وستعمل للجداول الأخرى بشكل طبيعي)
  if (h.includes('مادة') || h.includes('صنف') || h.includes('item')) return 'item_name';
  if (h.includes('عقار') || h.includes('مشروع') || h.includes('property')) return 'project_id'; 
  if (h.includes('إجمالي') || h.includes('اجمالي') || h.includes('total')) return 'total_price';
  if (h.includes('سند') || h.includes('اذن') || h.includes('استلام') || h.includes('receipt')) return 'receipt_id';

  if (h.includes('بيان') || h.includes('وصف') || h.includes('desc') || h.includes('سبب')) {
    if (sheetName === 'emp_adv') return 'Desc';
    if (sheetName === 'labor_daily_logs') return 'production_desc';
    if (sheetName === 'payment_vouchers') return 'description'; 
    if (sheetName === 'expenses') return 'description';
    return 'reason'; 
  }
  
  if (h.includes('طريقه') || h.includes('طريقة') || h.includes('دفع')) return 'payment_method';
  
  // 🚀 التعديل الجذري: "سعر" لازم يجي قبل "وحده" عشان كلمة "سعر الوحدة" تترجم صح
  if (h.includes('سعر') || h.includes('price')) return 'unit_price';
  if (h.includes('وحده') || h.includes('وحدة') || h.includes('unit')) return 'unit';
  if (h.includes('كميه') || h.includes('كمية') || h.includes('qty') || h.includes('quantity')) return 'quantity';
  if (h.includes('طريحه') || h.includes('tareeha')) return 'tareeha';
  if (h.includes('انتاجيه') || h.includes('productivity')) return 'productivity';

  // ... باقي التعريفات العامة الموجودة مسبقاً (متروكة كما هي بدون تغيير لحفظ التوافقية)
  if (h.includes('كميه') || h.includes('quantity')) return 'quantity';
  if (h.includes('سعر') || h.includes('price')) return 'unit_price';
  if (h.includes('مشروع') || h.includes('موقع')) return 'site_ref';
  
  return header; 
};

// 🚀 دالة التصنيف التلقائي الشاملة (مخصصة حسب مصطلحات عملك)
const autoCategorizeExpense = (description: string): string => {
    if (!description) return 'غير مصنف';
    const text = description.toLowerCase();

    // 1. الإعاشة والتغذية
    if (/فطار|غداء|عشا|بيبسي|بيسي|مياه|عيش|وجب|ماء|طعام|غدا|عدا|وجبات/i.test(text)) return 'إعاشة وتغذية';
    
    // 2. المحروقات والانتقالات
    if (/وقود|بنزين|ديزل|سولار|مواصلات|نقل|سيارة|سيار|مشوار|عربية|باص|توصيل/i.test(text)) return 'محروقات وانتقالات';
    
    // 3. عدد ومعدات
    if (/عدة|صاروخ|ساروخ|هيلتي|دريل|ماكينة|ماكينه|دسك|ليزر|مكسر|كشاف|مكنة|كوريك|زاوية|زاويه|متر|مفتاح|زرادية|زراديه|شنيور|بطاريه|بطاريات|عدد/i.test(text)) return 'عدد ومعدات';
    
    // 4. مستهلكات ومواد تشغيل
    if (/بونط|بنط|اسطوانة|اسطوانات|اسطوان|خيط|خيوط|سلك|صنفرة|سبراي|اسبري|تلوينة|فوم|غاز|شعلة|أمير|سيليكون|صلايب|ريش|كولة|قطر|كتر|مفك|تخشينه|قلم|خرطوم|شاحن|دواية|فراطيس/i.test(text)) return 'مستهلكات ومواد تشغيل';
    
    // 5. صيانة وإصلاحات
    if (/تصليح|صيانة|صيانه|غيار زيت|زيت|غسيل|لحام|كوتش|تيل|تربيط|زجاج|مكيف|عربه|عربانة/i.test(text)) return 'صيانة وإصلاحات';
    
    // 6. مصاريف إدارية (تم إضافة المصروفات الشخصية والتصفيات ونقاط البيع)
    if (/تصوير|أوراق|مكتب|ختم|تصديق|نت|باقة|إقامة|اقامة|مقيم|تأشير|رسوم|تحويل|تامينات|ايجار|طابعة|بادة|مصاريف|مصروفات|فاتورة|فاتوره|تجديد|خصم|نقاط|مؤسسة|نثريات|تصفية/i.test(text)) return 'مصاريف إدارية';
    
    // 7. عمولات وبقشيش ومقطوعيات
    if (/بقشيش|بقشييش|نسبة|عمولة|مقطوعية|شغل/i.test(text)) return 'عمولات وبقشيش';
    
    // 8. سكن وأثاث
    if (/إيجار|استراحة|سكن|سرير|مرتبة|مراتب|مخدة|طاولة|طاولات|كرسي|كراسي|شباك|شبابيك|باب|ابواب|كرفان/i.test(text)) return 'سكن وأثاث';
    
    // 9. أدوات نظافة
    if (/مقشة|مقشه|مكنسة|مكنسه|مساحة|مساحه|نظافة|فرشة/i.test(text)) return 'أدوات نظافة';
    
    // 10. مواد إنشائية
    if (/جالون|زيتي|دهان|تنر|رول|حديد|كوع|شطاف|مفصلة|قفل|لون|صنفره|عقد|سكاكين|قدة|براويطة|فيستات/i.test(text)) return 'مواد إنشائية';

    return 'غير مصنف'; // في حالة ظهور صنف جديد تماماً
};

// 🟢 تم الحفاظ على كل الحقول
const numericColumns = [
  'amount', 'daily_wage', 'attendance_value', 'completion_percentage', 'quantity', 
  'unit_price', 'total_price', 'vat_amount', 'discount_amount', 'materials_discount', 
  'taxable_amount', 'tax_amount', 'guarantee_percent', 'guarantee_amount', 'total_amount', 
  'paid_amount', 'debit', 'credit', 'tax_rate', 'assigned_qty', 'contract_quantity', 
  'unit_contract_price', 'estimated_labor_cost', 'estimated_operational_cost', 
  'estimated_expenses_cost', 'current_stock', 'avg_price', 'basic_salary', 
  'total_advances', 'total_deductions', 'net_salary', 'Salary', 'housing', 
  'deductions', 'earnings', 'net_earnings', 'progress_percentage', 'retention_amount', 
  'net_amount', 'due_in_days'
];

// 🟢 تم الحفاظ على كل المعرفات
const uuidColumns = [
  'id', 'project_id', 'partner_id', 'account_id', 'boq_item_id', 'contractor_id', 
  'payee_id', 'client_id', 'emp_id', 'parent_id', 'work_item_id', 'sub_contractor_id', 
  'worker_partner_id', 'credit_account_id', 'debit_account_id', 'partner_acc_id', 
  'safe_bank_acc_id', 'tax_acc_id', 'guarantee_acc_id', 'materials_acc_id', 
  'header_id', 'invoice_id', 'receipt_id', 'supplier_id', 'created_by', 
  'user_id', 'linked_partner_id', 'claim_id'
];

const parseNumeric = (val: any) => {
  if (val === null || val === undefined || val === '') return 0;
  const strVal = String(val).replace(/[^\d.-]/g, '');
  if (strVal === '' || strVal === '-' || strVal === '.') return 0;
  const num = Number(strVal);
  return isNaN(num) ? 0 : num;
};

const isUUID = (str: any) => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
};

export async function processExcelInBackend(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error("لم يتم استلام الملف في السيرفر.");

    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    const arrayBuffer = await file.arrayBuffer();
    const bufferData = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(bufferData, { type: 'array' });

    // 🚀🚀 التعديل الجذري الأول: فلتر "البلدوزر" (يمسح أي مسافات، رموز، أو فراغات مخفية)
    const cleanMatch = (str: any) => {
        if (!str) return '';
        let s = String(str).trim();
        s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
        s = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '');
        // الإبقاء على الحروف والأرقام فقط (أقوى فلتر تطابق)
        return s.replace(/[^\u0621-\u064A0-9a-zA-Z]/g, '').toLowerCase();
    };

    // 🚀🚀 التعديل الجذري الثاني: جلب العقارات بـ Loop لتخطي حد الـ 1000 مشروع الخاص بـ Supabase
    let allProjects: any[] = [];
    let from = 0, to = 999;
    let hasMore = true;
    while(hasMore) {
        // بنسحب الـ Property والـ project_name بس عشان الأداء يبقى طلقة
        const { data, error } = await supabase.from('projects').select('id, "Property", project_name').range(from, to);
        if (data && data.length > 0) {
            allProjects.push(...data);
            from += 1000;
            to += 1000;
        } else {
            hasMore = false;
        }
    }

    const [partners, accounts, boqItems] = await Promise.all([
      fetchAllSupabaseData(supabase, 'partners', '*', 'id', false),
      fetchAllSupabaseData(supabase, 'accounts', '*', 'id', false),
      fetchAllSupabaseData(supabase, 'boq_items', '*', 'id', false)
    ]);

    const projectMap = new Map();
    allProjects.forEach(p => {
      if (p.Property) projectMap.set(cleanMatch(p.Property), p.id);
      if (p.property) projectMap.set(cleanMatch(p.property), p.id); 
      if (p.project_name) projectMap.set(cleanMatch(p.project_name), p.id);
    });

    const partnerMap = new Map();
    partners?.forEach(p => partnerMap.set(cleanMatch(p.name), p.id));

    const accountMap = new Map();
    accounts?.forEach(a => accountMap.set(cleanMatch(a.name), a.id));

    const boqMap = new Map();
    boqItems?.forEach(b => boqMap.set(cleanMatch(b.item_name), b.id));

    let totalUploaded = 0;
    const CHUNK_SIZE = 100; 

    // 🚀🚀 الترتيب المنطقي لضمان عدم تعارض الـ Foreign Keys 🚀🚀
    const DEPENDENCY_ORDER = [
      'system_settings', 'profiles', 'accounts', 'partners', 'projects', 
      'project_stages', 'project_work_structure', 'boq_items', 'boq_budget', 
      'job_orders', 'contractor_assignments', 'inventory', 'all_emp', 
      'payroll_slips', 'violations', 'expenses', 'invoices', 
      'material_receipts', 'material_receipt_lines', 'material_issues', 
      'material_issue_lines', 'sub_claims', 'payment_vouchers', 
      'receipt_vouchers', 'labor_daily_logs', 'journal_headers', 
      'journal_lines', 'journal_errors', 'sys_financial_reports', 
      'user_requests', 'user_tasks', 'notifications'
    ];

    // ترتيب الشيتات الموجودة في الملف بناءً على ترتيب الاعتمادية
    const sortedSheetNames = workbook.SheetNames.sort((a, b) => {
      const indexA = DEPENDENCY_ORDER.indexOf(a);
      const indexB = DEPENDENCY_ORDER.indexOf(b);
      // لو مش موجود في القائمة نخليه في الأخر
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    for (const sheetName of sortedSheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) continue;

      const cleanDataWithRows = jsonData.map((row: any, index: number) => {
        const excelRowNumber = index + 2; 
        const newRow: any = {};
        
        for (const excelHeader in row) {
          if (excelHeader.includes('__EMPTY')) continue;
          
          let val = row[excelHeader];
          const dbColumnName = mapHeaderToSchema(sheetName, excelHeader.trim());

          if (numericColumns.includes(dbColumnName)) val = parseNumeric(val);
          else {
              if (val === null || val === undefined || val === '') val = null;
              else if (typeof val === 'string') {
                  const strVal = val.trim();
                  if (/^[-—–−_]+$/.test(strVal) || strVal === '') val = null; 
                  else val = strVal;
              }
          }

          if ((dbColumnName.includes('date') || dbColumnName.includes('التاريخ')) && typeof val === 'number') {
            val = formatExcelDate(val);
          }

          if (dbColumnName === 'is_posted' && (val === null || val === '')) val = false; 
          if (dbColumnName === 'is_deleted' && (val === null || val === '')) val = false; 

          newRow[dbColumnName] = val;

          // 🧠 الربط الذكي للـ IDs بناءً على الأسماء
          if (val !== null && typeof val === 'string') {
            
            const searchVal = cleanMatch(val);

            if (dbColumnName === 'Property' || dbColumnName === 'site_ref' || dbColumnName === 'site_name' || dbColumnName === 'project_id') {
              const matchedId = projectMap.get(searchVal);
              if (matchedId) {
                  newRow['project_id'] = matchedId;
                  if (dbColumnName === 'project_id') newRow[dbColumnName] = matchedId;
              } else if (dbColumnName === 'project_id' && val && !val.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
                  throw new Error(`❌ خطأ في الصف رقم ${excelRowNumber}: العقار "${val}" غير موجود بقاعدة البيانات! يرجى التأكد من الاسم.`);
              }
            }
            
            if (dbColumnName === 'emp_name' || dbColumnName === 'worker_name' || dbColumnName === 'payee_name') {
              const matchedId = partnerMap.get(searchVal);
              if (matchedId) {
                if (sheetName === 'labor_daily_logs') newRow['worker_partner_id'] = matchedId;
                else if (sheetName === 'payroll_slips') newRow['emp_id'] = matchedId;
                else if (sheetName === 'expenses') newRow['payee_id'] = matchedId;
                else newRow['partner_id'] = matchedId; 
              }
            }
            
            if (dbColumnName === 'sub_contractor') {
              const matchedId = partnerMap.get(searchVal);
              if (matchedId) newRow['sub_contractor_id'] = matchedId;
            }
            
            if (dbColumnName === 'credit_account_name' || dbColumnName === 'debit_account_name' || dbColumnName === 'account_name') {
              const matchedId = accountMap.get(searchVal);
              if (matchedId) {
                  if (dbColumnName === 'debit_account_name') {
                      newRow['debit_account_id'] = matchedId;
                  } else {
                      newRow['credit_account_id'] = matchedId; 
                  }
              }
            }
            if (dbColumnName === 'work_item') {
              const matchedId = boqMap.get(searchVal);
              if (matchedId) newRow['work_item_id'] = matchedId; 
            }
          }
        }
        
       const finalRow: any = {};
        Object.keys(newRow).forEach(key => {
            if (key === 'total_price') return; 

            if (sheetName === 'expenses' && [
                'credit_account_name', 'debit_account_name', 'account_name', 
                'emp_name', 'sub_contractor_id', 'unit',
                'credit_account_id', 'debit_account_id', 'account_id'
            ].includes(key)) {
                return; 
            }

            let value = newRow[key];
            const fakeColumns = ['emp_name', 'worker_name', 'payee_name', 'debit_account_name', 'credit_account_name', 'account_name'];
            
            if (fakeColumns.includes(key) && !['expenses', 'labor_daily_logs', 'violations', 'emp_adv', 'emp_ded', 'housing_services', 'all_emp'].includes(sheetName)) {
                return; 
            }

            if (typeof value === 'string') {
                value = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                if (value === '') value = null;
            }
            if (uuidColumns.includes(key)) {
                if (value !== null) {
                    if (typeof value !== 'string' || !isUUID(value)) value = null; 
                }
            }
            if (key === 'id' && value === null) return; 
            
            finalRow[key] = value;
        });

        // ====================================================================
        // 🚀 تأمين استلام الخامات (material_receipt_lines)
        // ====================================================================
        if (sheetName.includes('material_receipt')) { 
            if (!finalRow.item_name || finalRow.item_name === '') {
                finalRow.item_name = row['اسم المادة / الصنف'] || row['Item Name'] || row['item_name'] || 'صنف غير محدد';
            }
            finalRow.quantity = Number(finalRow.quantity) || Number(row['الكمية']) || 1;
            finalRow.unit_price = Number(finalRow.unit_price) || Number(row['سعر الوحدة']) || 0;
            finalRow.unit = finalRow.unit || row['الوحدة'] || 'وحدة';
            
            if (!finalRow.total_price) {
                finalRow.total_price = finalRow.quantity * finalRow.unit_price;
            }
        }

        // ====================================================================
        // 🚀 تأمين بيانات المصروفات (expenses)
        // ====================================================================
        if (sheetName === 'expenses') {
            if (!finalRow.lines_data) finalRow.lines_data = [];
            if (!finalRow.sub_contractor) finalRow.sub_contractor = 'غير محدد'; 
            if (!finalRow.creditor_account) finalRow.creditor_account = 'مصروفات غير مصنفة'; 

            finalRow.quantity = Number(finalRow.quantity) || 1; 
            finalRow.unit_price = Number(finalRow.unit_price) || 0; 
            finalRow.vat_amount = Number(finalRow.vat_amount) || 0;
            finalRow.discount_amount = Number(finalRow.discount_amount) || 0;

            if (!finalRow.main_category && finalRow.description) {
                finalRow.main_category = autoCategorizeExpense(finalRow.description);
            } else if (!finalRow.main_category) {
                finalRow.main_category = 'غير مصنف';
            }
        }

        if (sheetName === 'payment_vouchers') {
           if (!finalRow.amount || finalRow.amount <= 0) return null; 
           if (!finalRow.voucher_number) {
              finalRow.voucher_number = `PV-${Date.now().toString().slice(-6)}-${excelRowNumber}`;
           }
        }

        if (sheetName === 'invoices' || sheetName === 'expenses') {
            if (!finalRow.lines_data) finalRow.lines_data = [];
        }

        if (currentUserId && ['emp_ded', 'emp_adv', 'payment_vouchers', 'expenses', 'material_receipts'].includes(sheetName)) {
            finalRow['created_by'] = currentUserId;
        }

        return { data: finalRow, excelRow: excelRowNumber, rawData: row };
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      for (let i = 0; i < cleanDataWithRows.length; i += CHUNK_SIZE) {
          const chunkWrapper = cleanDataWithRows.slice(i, i + CHUNK_SIZE);
          const chunkPayload = chunkWrapper.map(c => c.data); 
          
          const { error } = await supabase
            .from(sheetName)
            .upsert(chunkPayload, { onConflict: 'id', ignoreDuplicates: false }); 

          if (error) {
            let exactErrorMsg = `فشل في شيت [${sheetName}]: الدفعة من صف ${chunkWrapper[0].excelRow} إلى ${chunkWrapper[chunkWrapper.length - 1].excelRow}`;

            for (const item of chunkWrapper) {
                const { error: singleError } = await supabase
                  .from(sheetName)
                  .upsert(item.data, { onConflict: 'id', ignoreDuplicates: false });

                if (singleError) {
                    exactErrorMsg = `❌ خطأ في شيت: [${sheetName}]\n📍 الصف رقم: (${item.excelRow})\n🔍 التفاصيل: ${singleError.message || singleError.details}`;
                    break; 
                }
            }
            throw new Error(exactErrorMsg); 
          }
      }
      totalUploaded += cleanDataWithRows.length;
    }

    if (totalUploaded === 0) throw new Error("الملف فارغ أو لا يحتوي على داتا صالحة.");
    
    return { success: true, total: totalUploaded };

  } catch (error: any) {
    console.error("❌ Backend Processing Error:", error);
    return { success: false, error: error.message || "حدث خطأ غير متوقع في السيرفر" };
  }
}
