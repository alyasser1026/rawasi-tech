import { supabase } from '@/lib/supabase';

export const tafqeet = (value: number | string | null | undefined): string => {
  if (!value || isNaN(Number(value)) || Number(value) === 0) return "صفر ريال سعودي";

  // تحويل الرقم لكسور عشرية ثابتة (خانتين للهللات)
  const val = Math.abs(Number(value)).toFixed(2);
  const parts = val.split(".");
  let intPart = parseInt(parts[0], 10);
  const decPart = parseInt(parts[1], 10);

  if (intPart === 0 && decPart === 0) return "صفر ريال سعودي";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  // دالة مساعدة لترجمة كل 3 أرقام
  const getSection = (n: number) => {
    if (n === 0) return "";
    let res = "";
    const h = Math.floor(n / 100);
    const rest = n % 100;

    if (h > 0) res += hundreds[h];
    if (rest > 0) {
      if (res !== "") res += " و ";
      if (rest < 10) res += ones[rest];
      else if (rest < 20) res += teens[rest - 10];
      else {
        const t = Math.floor(rest / 10);
        const o = rest % 10;
        if (o > 0) res += ones[o] + " و ";
        res += tens[t];
      }
    }
    return res;
  };

  let result = "";

  // 1. المليارات (Billions)
  if (intPart >= 1000000000) {
    const b = Math.floor(intPart / 1000000000);
    if (b === 1) result += "مليار";
    else if (b === 2) result += "ملياران";
    else if (b >= 3 && b <= 10) result += getSection(b) + " مليارات";
    else result += getSection(b) + " مليار";
    intPart %= 1000000000;
    if (intPart > 0) result += " و ";
  }

  // 2. الملايين (Millions)
  if (intPart >= 1000000) {
    const m = Math.floor(intPart / 1000000);
    if (m === 1) result += "مليون";
    else if (m === 2) result += "مليونان";
    else if (m >= 3 && m <= 10) result += getSection(m) + " ملايين";
    else result += getSection(m) + " مليون";
    intPart %= 1000000;
    if (intPart > 0) result += " و ";
  }

  // 3. الآلاف (Thousands)
  if (intPart >= 1000) {
    const t = Math.floor(intPart / 1000);
    if (t === 1) result += "ألف";
    else if (t === 2) result += "ألفان";
    else if (t >= 3 && t <= 10) result += getSection(t) + " آلاف";
    else result += getSection(t) + " ألف";
    intPart %= 1000;
    if (intPart > 0) result += " و ";
  }

  // 4. المئات والعشرات والآحاد
  if (intPart > 0) {
    result += getSection(intPart);
  }

  // تجميع النص الأساسي للريالات
  let finalStr = result.trim() === "" ? "" : "فقط " + result.trim() + " ريال سعودي";

  // 5. حساب الهللات (الكسور)
  if (decPart > 0) {
    let decStr = "";
    if (decPart === 1) decStr = "هللة واحدة";
    else if (decPart === 2) decStr = "هللتان";
    else if (decPart >= 3 && decPart <= 10) decStr = getSection(decPart) + " هللات";
    else decStr = getSection(decPart) + " هللة";

    if (finalStr === "") {
      finalStr = "فقط " + decStr;
    } else {
      finalStr += " و " + decStr;
    }
  }

  // الختم القانوني للجملة
  if (finalStr !== "") finalStr += " لا غير.";

  return finalStr;
};

// دالة الفلترة الذكية (نص + تاريخ)
export const filterData = (
  data: any[], 
  searchQuery: string, 
  dateFrom: string, 
  dateTo: string, 
  searchKeys: string[] = ['name', 'description'], // الحقول اللي هيبحث فيها بالنص
  dateKey: string = 'date' // اسم عمود التاريخ في الداتا بيز
) => {
  return data.filter(item => {
    // 1. فحص البحث النصي
    const matchesSearch = searchQuery === '' || searchKeys.some(key => {
      const val = item[key];
      return val ? String(val).toLowerCase().includes(searchQuery.toLowerCase()) : false;
    });

    // 2. فحص التاريخ (من)
    const itemDate = new Date(item[dateKey]);
    const isAfterFrom = dateFrom ? itemDate >= new Date(dateFrom) : true;
    
    // 3. فحص التاريخ (إلى)
    const isBeforeTo = dateTo ? itemDate <= new Date(dateTo) : true;

    // السطر هيظهر فقط لو حقق شرط النص وشرط التاريخ مع بعض
    return matchesSearch && isAfterFrom && isBeforeTo;
  });
};

export const deleteItem = async (table: string, id: number | string) => {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
};

// 🛡️ حماية السجلات المعتمدة من التعديل والحذف لغير المديرين
export const checkAdminApprovalPrivilege = async (
  records: any[], 
  action: 'تعديل' | 'حذف' = 'حذف'
) => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session?.user?.id).single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  
  if (!isAdmin) {
    const hasApproved = records.some(r => r.is_posted === true || r.header_status === 'معتمد' || r.status === 'معتمد');
    if (hasApproved) {
      throw new Error(`عفواً، لا تملك صلاحية ${action} السجلات المعتمدة والمرحلة.`);
    }
  }
};

/** Short currency for tight spaces, e.g. "١٫٣ مليون ر.س."; pair it with the full value (title/tooltip). */
export const formatCompactCurrency = (amount: number | string | null | undefined): string => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('ar-SA-u-nu-latn', {
    style: 'currency',
    currency: 'SAR',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(num);
};

export const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('ar-SA-u-nu-latn', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatDate = (dateString: string, showTime: boolean = false): string => {
  if (!dateString) return '---';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '---'; // الحماية من التواريخ غير الصالحة
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(showTime && { hour: '2-digit', minute: '2-digit', hour12: true })
  };
  
  return new Intl.DateTimeFormat('en-GB', options).format(date);
};

export const calculateVAT = (amount: number, isInclusive: boolean = false, vatRate: number = 0.15) => {
  const numAmount = Number(amount) || 0;
  
  if (isInclusive) {
    // لو السعر شامل الضريبة (مثال: 115) -> الصافي 100، والضريبة 15
    const net = numAmount / (1 + vatRate);
    const vat = numAmount - net;
    return { net: Number(net.toFixed(2)), vat: Number(vat.toFixed(2)), total: numAmount };
  } else {
    // لو السعر غير شامل (مثال: 100) -> الضريبة 15، والإجمالي 115
    const vat = numAmount * vatRate;
    const total = numAmount + vat;
    return { net: numAmount, vat: Number(vat.toFixed(2)), total: Number(total.toFixed(2)) };
  }
};

export const parseDbError = (error: any): string => {
  if (!error) return "حدث خطأ غير معروف.";
  
  const msg = error.message || error.details || "";
  
  if (msg.includes("duplicate key") || error.code === '23505') {
    return "هذا السجل (أو رقم المستند) موجود بالفعل ولا يمكن تكراره.";
  }
  if (msg.includes("violates foreign key") || error.code === '23503') {
    return "لا يمكن حذف هذا السجل لارتباطه ببيانات أخرى في النظام (مثل قيود أو فواتير).";
  }
  if (msg.includes("not null violation") || error.code === '23502') {
    return "يرجى التأكد من تعبئة جميع الحقول الإجبارية.";
  }
  
  return `فشل الإجراء: ${msg}`;
};

export const calculateProgress = (executed: number, total: number) => {
  if (!total || total === 0) return { percentage: 0, text: '0%', color: '#94a3b8' }; // رصاصي
  
  const percentage = Math.min((executed / total) * 100, 100); // بنمنع النسبة تتخطى 100%
  const formattedText = `${percentage.toFixed(1)}%`;

  let color = '#ef4444'; // أحمر (خطر / بداية)
  if (percentage >= 100) color = '#22c55e'; // أخضر (مكتمل)
  else if (percentage >= 75) color = '#3b82f6'; // أزرق (قرب يخلص)
  else if (percentage >= 40) color = '#fb923c'; // أصفر (شغال)

  return {
    percentage: Number(percentage.toFixed(2)),
    text: formattedText,
    color
  };
};

export const checkBudgetVariance = (budget: number, actualCost: number) => {
  const numBudget = Number(budget) || 0;
  const numActual = Number(actualCost) || 0;
  const variance = numBudget - numActual; // المتبقي
  const isOverBudget = variance < 0;

  return {
    isOverBudget,
    varianceAmount: Math.abs(variance), // قيمة الانحراف
    variancePercentage: numBudget > 0 ? ((Math.abs(variance) / numBudget) * 100).toFixed(1) : 0,
    statusText: isOverBudget ? 'تجاوز الميزانية' : 'ضمن الميزانية',
    color: isOverBudget ? '#dc2626' : '#059669' // أحمر لو تخطى، أخضر لو في السليم
  };
};

export const buildWbsTree = (items: any[], idKey = 'id', parentKey = 'parent_id') => {
  const itemMap: any = {};
  const tree: any[] = [];

  // 1. تحويل الـ Array لـ Object لسهولة البحث
  items.forEach(item => {
    itemMap[item[idKey]] = { ...item, children: [] };
  });

  // 2. ربط الأبناء بالآباء
  items.forEach(item => {
    if (item[parentKey] && itemMap[item[parentKey]]) {
      itemMap[item[parentKey]].children.push(itemMap[item[idKey]]);
    } else {
      // لو ملوش أب، يبقى ده مستوى رئيسي
      tree.push(itemMap[item[idKey]]);
    }
  });

  return tree;
};

export const getProjectTimelineStatus = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return { status: 'غير محدد', daysLeft: 0, color: '#94a3b8' };

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  // حساب الفرق بالأيام
  const diffTime = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (now < start) {
    return { status: 'لم يبدأ بعد', daysLeft, color: '#64748b' }; // رصاصي
  } else if (now > end) {
    return { status: 'متأخر (منتهي)', daysLeft: Math.abs(daysLeft), color: '#ef4444' }; // أحمر
  } else {
    // شغال حالياً، لو باقي أقل من 7 أيام نديله لون تحذيري
    if (daysLeft <= 7) return { status: 'قارب على الانتهاء', daysLeft, color: '#f97316' }; // برتقالي
    return { status: 'قيد التنفيذ', daysLeft, color: '#3b82f6' }; // أزرق
  }
};

export const calculateCumulativeInvoice = (
  totalWorkToDate: number,       // إجمالي الأعمال المنفذة حتى اليوم
  previousBilledAmount: number,  // ما تم صرفه في المستخلصات السابقة
  retentionPercent: number = 0,  // نسبة ضمان الأعمال (مثلاً 10%)
  advanceDeductionPercent: number = 0 // نسبة استقطاع الدفعة المقدمة
) => {
  // 1. قيمة الأعمال الحالية (المستخلص الحالي)
  const currentWorkAmount = totalWorkToDate - previousBilledAmount;
  
  if (currentWorkAmount <= 0) return { currentWorkAmount: 0, netAmount: 0, retention: 0, advanceDeduction: 0 };

  // 2. حساب الاستقطاعات على المستخلص الحالي
  const retention = currentWorkAmount * (retentionPercent / 100);
  const advanceDeduction = currentWorkAmount * (advanceDeductionPercent / 100);
  
  // 3. الصافي المستحق قبل الضريبة
  const netAmount = currentWorkAmount - retention - advanceDeduction;

  return {
    currentWorkAmount: Number(currentWorkAmount.toFixed(2)),
    retention: Number(retention.toFixed(2)),
    advanceDeduction: Number(advanceDeduction.toFixed(2)),
    totalDeductions: Number((retention + advanceDeduction).toFixed(2)),
    netAmount: Number(netAmount.toFixed(2))
  };
};

export const getStockAlertStatus = (
  currentStock: number,   // الرصيد الفعلي في الموقع
  reorderPoint: number,   // حد الطلب (مثلاً لو نزل عن 100 طن اطلب)
  minimumBuffer: number   // رصيد الأمان الحرج (لو نزل عنه الموقع هيقف)
) => {
  if (currentStock <= minimumBuffer) {
    return { status: 'حرج! الموقع مهدد بالتوقف', action: 'طلب طارئ', color: '#991b1b', bg: '#fee2e2' }; // أحمر غامق
  } else if (currentStock <= reorderPoint) {
    return { status: 'وصل لحد الطلب', action: 'إصدار أمر شراء', color: '#b45309', bg: '#fef3c7' }; // برتقالي
  } else {
    return { status: 'الرصيد آمن', action: 'لا إجراء مطلوب', color: '#047857', bg: '#d1fae5' }; // أخضر
  }
};

export const calculatePettyCash = (
  totalAdvanced: number,  // إجمالي العهدة المستلمة
  totalExpensed: number   // إجمالي الفواتير اللي قدمها المشرف
) => {
  const balance = totalAdvanced - totalExpensed;
  
  if (balance === 0) {
    return { text: 'العهدة مسواة بالكامل', amount: 0, color: '#059669' };
  } else if (balance > 0) {
    return { text: 'متبقي على الموظف', amount: balance, color: '#c2410c' }; // لازم يرجع فلوس
  } else {
    return { text: 'مستحق للموظف (صرف من جيبه)', amount: Math.abs(balance), color: '#dc2626' }; // الشركه مدينة للموظف
  }
};

export const getInvoiceAging = (invoiceDate: string, isPaid: boolean) => {
  if (isPaid) return { text: 'مُسدد', daysOverdue: 0, color: '#059669', badge: '✅' };

  const today = new Date();
  const invDate = new Date(invoiceDate);
  
  // حساب الفرق بالأيام
  const diffTime = today.getTime() - invDate.getTime();
  const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 30) {
    return { text: 'متأخرات (أقل من شهر)', daysOverdue, color: '#3b82f6', badge: '⏳' };
  } else if (daysOverdue <= 90) {
    return { text: 'متأخرات (1 - 3 شهور)', daysOverdue, color: '#c2410c', badge: '⚠️' };
  } else {
    return { text: 'ديون معدومة أو حرجة (+3 شهور)', daysOverdue, color: '#dc2626', badge: '🚨' };
  }
};

// استبدل الدالة القديمة في آخر الملف بهذا الكود الاحترافي
export const getInvoiceSummaryAndAging = (invoices: any[]) => {
  const summary = {
    totalInvoicesAmount: 0, // إجمالي الفواتير
    totalPaidAmount: 0,     // إجمالي المبالغ المحصلة
    totalRemaining: 0,      // إجمالي المديونية المتبقية
    totalOverdue: 0,        // إجمالي المتأخرات (أحمر وأصفر)
    // التقسيمات اللونية (Buckets)
    aging: {
      current: 0,      // أخضر
      days_1_30: 0,    // أصفر
      days_31_60: 0,   // برتقالي
      days_61_90: 0,   // أحمر
      over_90: 0       // أحمر داكن
    }
  };

  if (!invoices || invoices.length === 0) return summary;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  invoices.forEach(inv => {
    // 🚀 قراءة الصافي الفعلي بعد الإشعارات الدائنة/المدينة والمدفوعات المرحلة
    const amount = inv.effective_total != null
      ? Number(inv.effective_total)
      : Number(inv.net_amount ?? inv.total_amount ?? 0);
    const paid = inv.adjusted_paid_amount != null
      ? Number(inv.adjusted_paid_amount)
      : Number(inv.paid_amount ?? 0);
    const balance = inv.remaining_amount != null
      ? Number(inv.remaining_amount)
      : (amount - paid);

    // 1. حساب الإجماليات (للفواتير المعتمدة فقط أو حسب نظامك)
    if (inv.status !== 'مسودة') {
      summary.totalInvoicesAmount += amount;
      summary.totalPaidAmount += paid;
      summary.totalRemaining += balance;
    }

    // 2. حساب أعمار الديون (للفواتير اللي ليها متبقي ومش مسودة)
    if (balance > 0 && inv.status !== 'مسودة') {
      const dueDate = new Date(inv.due_date || inv.date || inv.created_at);
      dueDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        summary.aging.current += balance;
      } else {
        summary.totalOverdue += balance; // يضاف لإجمالي المتأخرات
        if (diffDays <= 30) summary.aging.days_1_30 += balance;
        else if (diffDays <= 60) summary.aging.days_31_60 += balance;
        else if (diffDays <= 90) summary.aging.days_61_90 += balance;
        else summary.aging.over_90 += balance;
      }
    }
  });

  return summary;
};

// دي الدالة القديمة لو محتاجها لعرض "ملصق" جنب كل صف في الجدول (اختياري)
export const getSingleInvoiceStatus = (invoiceDate: string, isPaid: boolean) => {
  if (isPaid) return { text: 'مُسدد', color: '#059669', badge: '✅' };
  const today = new Date();
  const invDate = new Date(invoiceDate);
  const diffTime = today.getTime() - invDate.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (days <= 0) return { text: 'جاري', color: '#10b981', badge: '🟢' };
  return { text: `متأخر ${days} يوم`, color: days > 90 ? '#dc2626' : '#c2410c', badge: '⚠️' };
};

// =========================================================================
// 🚀 دالة البلدوزر: لسحب الجداول الضخمة التي تتخطى حاجز الـ 1000 سجل من Supabase
// =========================================================================
// =========================================================================
// 🚀 دالة البلدوزر المطورة: سحب تكراري لضمان جلب كل البيانات (بدون سقف الـ 1000)
// =========================================================================
// دالة البلدوزر لسحب الجداول الضخمة تلقائياً (تتخطى 1000 سطر)
export const fetchAllSupabaseData = async (
  supabase: any,
  tableName: string,
  selectFields: string = '*',
  orderByColumn?: string,
  ascending: boolean = false
) => {
  let allData: any[] = [];
  const seenIds = new Set<string>(); // 🛡️ حماية من التكرار
  let currentOffset = 0;
  const limit = 1000;
  let keepFetching = true;

  console.log(`📡 جاري بدء سحب بيانات جدول: [${tableName}]...`);

  while (keepFetching) {
    let query = supabase.from(tableName).select(selectFields).range(currentOffset, currentOffset + limit - 1);
    
    if (orderByColumn) {
      query = query.order(orderByColumn, { ascending });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ خطأ في سحب [${tableName}]:`, error.message);
      break; 
    }

    if (data && data.length > 0) {
      for (const row of data) {
          const id = String(row.id || row.line_id || row.code || JSON.stringify(row));
          if (!seenIds.has(id)) {
              seenIds.add(id);
              allData.push(row);
          }
      }
      currentOffset += limit;
      console.log(`✅ تم سحب ${allData.length} صف من جدول [${tableName}] حتى الآن...`);
      
      if (data.length < limit) {
        keepFetching = false;
      }
    } else {
      keepFetching = false;
    }
  }

  console.log(`🏁 اكتمل السحب! إجمالي بيانات [${tableName}]: ${allData.length} صف.`);
  return allData;
};
// 🛡️ دالة فحص الصلاحيات الموحدة (Global Permission Checker)
export const canUser = (profile: any, module: string, action: string): boolean => {
  // 1. لو المستخدم "مدير نظام" (Admin) يفتح له كل الأبواب
  if (profile?.is_admin) return true;

  // 2. الوصول لصلاحيات الموديول من الـ JSONB
  const userPermissions = profile?.permissions || {};
  const moduleActions = userPermissions[module];

  // 3. التأكد إن الصلاحية مصفوفة (Array) وبتحتوي على الفعل المطلوب
  return Array.isArray(moduleActions) && moduleActions.includes(action);
};


