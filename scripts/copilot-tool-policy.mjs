import { TOOL_STATUS, isToolFlagEnabled, registryEntry } from './copilot-tool-registry.mjs';

const CHECKLIST = 'get_engineering_checklist_and_specs';
const LABOR = 'get_labor_daily_logs';
const TAREEHA = 'get_tareeha_deficits';
const PROJECTS = 'get_all_projects_and_villas';
const DAILY_REPORT = 'get_daily_comprehensive_report';
const ADD_LABOR = 'add_labor_daily_log_draft';
const ADD_EXPENSE = 'add_expense_draft';
const ADD_JOURNAL = 'add_journal_entry_draft';
const ADD_JOB_ORDER = 'add_job_order_draft';
const UPDATE_OPERATION = 'update_operation_draft';
const DAY_MS = 86_400_000;
const TOOLS_ENABLED = process.env.COPILOT_TOOLS_ENABLED !== 'false';

export function getCopilotDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  return [part('year'), part('month'), part('day')].join('-');
}

export function getCopilotYesterdayDate(now = new Date()) {
  return getCopilotDate(new Date(now.getTime() - DAY_MS));
}

/** Mirrors rawasi_private.can_access: permissions[module] is an action array or an {action: true} map. */
export function hasModulePermission(access, moduleName, action = 'view') {
  if (access?.fullCompanyAccess === true) return true;
  const actions = access?.permissions?.[moduleName];
  return Array.isArray(actions) ? actions.includes(action) : actions?.[action] === true;
}

/** Registry-driven gate: status, own flag, company scope and module permission (= the table's RLS module). */
function passesGates(entry, access) {
  if (!entry || !isToolFlagEnabled(entry)) return false;
  if (!entry.requiresCompany && !entry.permission) return true;
  if (!access?.companyId || !access.userId) return false;
  const required = [...(entry.permission ? [entry.permission] : []), ...(entry.requiredPermissions ?? [])];
  return required.every(({ module, action }) => hasModulePermission(access, module, action));
}

function isEnabled(name, access) {
  if (!TOOLS_ENABLED) return false;
  const entry = registryEntry(name);
  const declared = entry?.declaration && (entry.status === TOOL_STATUS.ACTIVE || entry.status === TOOL_STATUS.PILOT);
  return Boolean(declared) && passesGates(entry, access);
}

/** Same gate the model's tool calls go through — for flows outside the model. */
export function canUseCopilotTool(name, access) {
  return isEnabled(name, access);
}

/** Gate for internal (never declared) tools used by server-side flows such as /pdf. */
export function canUseInternalTool(name, access) {
  if (!TOOLS_ENABLED) return false;
  const entry = registryEntry(name);
  return entry?.status === TOOL_STATUS.INTERNAL && passesGates(entry, access);
}

export function getEnabledCopilotDeclarations(declarations, access) {
  if (!TOOLS_ENABLED) return [];
  return declarations.filter(({ name }) => isEnabled(name, access));
}

function safeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function resolveDateToken(value, now = new Date()) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (['today', 'اليوم', 'النهاردة', 'النهارده'].includes(trimmed) || ['today'].includes(trimmed.toLowerCase())) {
    return getCopilotDate(now);
  }
  if (['yesterday', 'امبارح', 'إمبارح', 'أمس', 'امس'].includes(trimmed) || ['yesterday'].includes(trimmed.toLowerCase())) {
    return getCopilotYesterdayDate(now);
  }
  return validDate(trimmed) ? trimmed : null;
}

function getToolArgs(name, supplied, now) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return null;
  if (name === CHECKLIST) {
    if (Object.keys(supplied).some(key => !['item_name', 'topic'].includes(key))) return null;
    const item = safeText(supplied.item_name, 120);
    const topic = supplied.topic === undefined ? null : safeText(supplied.topic, 120);
    return item && (topic || supplied.topic === undefined) ? { item_name: item, ...(topic && { topic }) } : null;
  }

  if (name === TAREEHA) {
    // لا تقبل أي args من المستخدم — company_id في الـ closure
    if (Object.keys(supplied).length !== 0) return null;
    return {};
  }

  if (name === PROJECTS) {
    if (Object.keys(supplied).some(key => !['filter_mode', 'date'].includes(key))) return null;
    const filterMode = ['all', 'worked_today', 'active_in_progress', 'models', 'partners'].includes(supplied.filter_mode)
      ? supplied.filter_mode
      : 'all';
    const date = supplied.date !== undefined ? resolveDateToken(supplied.date, now) : getCopilotDate(now);
    return date ? { filter_mode: filterMode, date } : null;
  }

  if (name === DAILY_REPORT) {
    if (Object.keys(supplied).some(key => !['date', 'villa_filter'].includes(key))) return null;
    const date = supplied.date !== undefined ? resolveDateToken(supplied.date, now) : getCopilotDate(now);
    if (!date) return null;
    const villaFilter = supplied.villa_filter !== undefined ? safeText(supplied.villa_filter, 80) : null;
    return { date, ...(villaFilter ? { villa_filter: villaFilter } : {}) };
  }

  if (name === ADD_LABOR) {
    const allowedKeys = ['worker_name', 'work_item', 'site_ref', 'tareeha', 'productivity', 'daily_wage', 'attendance_value', 'unit', 'work_date', 'notes'];
    if (Object.keys(supplied).some(key => !allowedKeys.includes(key))) return null;
    const workerName = safeText(supplied.worker_name, 80);
    if (!workerName) return null;
    const workDate = supplied.work_date !== undefined ? resolveDateToken(supplied.work_date, now) : getCopilotDate(now);
    if (!workDate) return null;
    return {
      worker_name: workerName,
      work_date: workDate,
      ...(safeText(supplied.work_item, 120) ? { work_item: safeText(supplied.work_item, 120) } : {}),
      ...(safeText(supplied.site_ref, 80) ? { site_ref: safeText(supplied.site_ref, 80) } : {}),
      ...(safeText(supplied.unit, 20) ? { unit: safeText(supplied.unit, 20) } : {}),
      ...(safeText(supplied.notes, 200) ? { notes: safeText(supplied.notes, 200) } : {}),
      ...(Number.isFinite(Number(supplied.tareeha)) ? { tareeha: Number(supplied.tareeha) } : {}),
      ...(Number.isFinite(Number(supplied.productivity)) ? { productivity: Number(supplied.productivity) } : {}),
      ...(Number.isFinite(Number(supplied.daily_wage)) ? { daily_wage: Number(supplied.daily_wage) } : {}),
      ...(Number.isFinite(Number(supplied.attendance_value)) ? { attendance_value: Number(supplied.attendance_value) } : {}),
    };
  }

  if (name === ADD_EXPENSE) {
    const allowedKeys = ['description', 'total_price', 'site_ref', 'main_category', 'payee_name', 'payment_method', 'exp_date', 'notes'];
    if (Object.keys(supplied).some(key => !allowedKeys.includes(key))) return null;
    const description = safeText(supplied.description, 160);
    const totalPrice = Number(supplied.total_price);
    if (!description || !Number.isFinite(totalPrice) || totalPrice <= 0) return null;
    const expDate = supplied.exp_date !== undefined ? resolveDateToken(supplied.exp_date, now) : getCopilotDate(now);
    if (!expDate) return null;
    return {
      description,
      total_price: totalPrice,
      exp_date: expDate,
      ...(safeText(supplied.site_ref, 80) ? { site_ref: safeText(supplied.site_ref, 80) } : {}),
      ...(safeText(supplied.main_category, 80) ? { main_category: safeText(supplied.main_category, 80) } : {}),
      ...(safeText(supplied.payee_name, 80) ? { payee_name: safeText(supplied.payee_name, 80) } : {}),
      ...(safeText(supplied.payment_method, 40) ? { payment_method: safeText(supplied.payment_method, 40) } : {}),
      ...(safeText(supplied.notes, 200) ? { notes: safeText(supplied.notes, 200) } : {}),
    };
  }

  if (name === ADD_JOURNAL) {
    const description = safeText(supplied.description, 200);
    const amount = Number(supplied.amount);
    if (!description || !Number.isFinite(amount) || amount <= 0) return null;
    const entryDate = supplied.entry_date !== undefined ? resolveDateToken(supplied.entry_date, now) : getCopilotDate(now);
    return {
      description,
      amount,
      entry_date: entryDate || getCopilotDate(now),
      ...(safeText(supplied.debit_account, 100) ? { debit_account: safeText(supplied.debit_account, 100) } : {}),
      ...(safeText(supplied.credit_account, 100) ? { credit_account: safeText(supplied.credit_account, 100) } : {}),
      ...(safeText(supplied.site_ref, 100) ? { site_ref: safeText(supplied.site_ref, 100) } : {}),
    };
  }

  if (name === ADD_JOB_ORDER) {
    const workItem = safeText(supplied.work_item, 200);
    const assignedQty = Number(supplied.assigned_qty);
    if (!workItem || !Number.isFinite(assignedQty) || assignedQty <= 0) return null;
    const startDate = supplied.start_date !== undefined ? resolveDateToken(supplied.start_date, now) : getCopilotDate(now);
    return {
      work_item: workItem,
      assigned_qty: assignedQty,
      start_date: startDate || getCopilotDate(now),
      ...(Number.isFinite(Number(supplied.unit_price)) ? { unit_price: Number(supplied.unit_price) } : {}),
      ...(safeText(supplied.contractor_name, 100) ? { contractor_name: safeText(supplied.contractor_name, 100) } : {}),
      ...(safeText(supplied.site_ref, 100) ? { site_ref: safeText(supplied.site_ref, 100) } : {}),
      ...(safeText(supplied.executor_type, 50) ? { executor_type: safeText(supplied.executor_type, 50) } : {}),
      ...(safeText(supplied.notes, 200) ? { notes: safeText(supplied.notes, 200) } : {}),
    };
  }

  if (name === UPDATE_OPERATION) {
    const recordIdentifier = safeText(supplied.record_identifier, 100);
    if (!recordIdentifier) return null;
    return {
      record_identifier: recordIdentifier,
      ...(safeText(supplied.operation_type, 50) ? { operation_type: safeText(supplied.operation_type, 50) } : {}),
      ...(Number.isFinite(Number(supplied.new_amount)) ? { new_amount: Number(supplied.new_amount) } : {}),
      ...(Number.isFinite(Number(supplied.new_quantity)) ? { new_quantity: Number(supplied.new_quantity) } : {}),
      ...(Number.isFinite(Number(supplied.new_unit_price)) ? { new_unit_price: Number(supplied.new_unit_price) } : {}),
      ...(safeText(supplied.new_site_ref, 100) ? { new_site_ref: safeText(supplied.new_site_ref, 100) } : {}),
      ...(safeText(supplied.new_description, 200) ? { new_description: safeText(supplied.new_description, 200) } : {}),
      ...(safeText(supplied.new_account, 100) ? { new_account: safeText(supplied.new_account, 100) } : {}),
      ...(safeText(supplied.new_contractor, 100) ? { new_contractor: safeText(supplied.new_contractor, 100) } : {}),
      ...(safeText(supplied.new_notes, 200) ? { new_notes: safeText(supplied.new_notes, 200) } : {}),
    };
  }

  if (name !== LABOR) return null;
  const isFieldOpsMode = process.env.COPILOT_LIVE_FIELD_OPS_ENABLED === 'true';
  const allowedLaborKeys = isFieldOpsMode
    ? ['date', 'start_date', 'end_date', 'worker_name', 'site_ref']
    : ['date', 'start_date', 'end_date', 'worker_name'];
  if (Object.keys(supplied).some(key => !allowedLaborKeys.includes(key))) return null;
  const { date, start_date: start, end_date: end, worker_name: worker, site_ref: site } = supplied;
  const workerName = worker === undefined ? null : safeText(worker, 80);
  if (worker !== undefined && (!workerName || !/^[\p{L}\p{M}\p{N} .'\u2019-]+$/u.test(workerName))) return null;
  const siteRef = isFieldOpsMode && site !== undefined ? safeText(site, 80) : null;
  const workerFilter = {
    ...(workerName ? { worker_name: workerName } : {}),
    ...(siteRef ? { site_ref: siteRef } : {}),
  };

  if (date !== undefined) {
    if (start !== undefined || end !== undefined) return null;
    if (['today', 'اليوم', 'النهاردة', 'النهارده'].includes(date)) {
      return { date: getCopilotDate(now), ...workerFilter };
    }
    if (isFieldOpsMode && ['yesterday', 'امبارح', 'إمبارح', 'أمس', 'امس'].includes(date)) {
      return { date: getCopilotYesterdayDate(now), ...workerFilter };
    }
    return validDate(date) ? { date, ...workerFilter } : null;
  }

  if (isFieldOpsMode && start === undefined && end === undefined) {
    return { date: getCopilotDate(now), ...workerFilter };
  }

  const resolvedStart = isFieldOpsMode ? resolveDateToken(start, now) : start;
  const resolvedEnd = isFieldOpsMode ? resolveDateToken(end, now) : end;
  const first = validDate(resolvedStart);
  const last = validDate(resolvedEnd);
  if (!first || !last || last < first || last - first >= 31 * DAY_MS) return null;
  return { start_date: resolvedStart, end_date: resolvedEnd, ...workerFilter };
}

function formatProjectsReply(result, companyLabel) {
  const mode = result.filter_mode || 'all';
  const dateChecked = result.date_checked || '';
  const allProjects = Array.isArray(result.all_projects) ? result.all_projects : [];
  const workedToday = Array.isArray(result.worked_today_projects) ? result.worked_today_projects : [];
  const partners = Array.isArray(result.partners_list) ? result.partners_list : [];

  if (mode === 'partners') {
    const byType = {};
    for (const pt of partners) {
      const t = pt.partner_type || 'غير محدد';
      if (!byType[t]) byType[t] = [];
      byType[t].push(pt);
    }
    const pLines = [
      `👥 قائمة الشركاء والمقاولين والعمالة المسجلين — ${companyLabel}`,
      `إجمالي السجلات المسجلة: ${result.partners_count ?? partners.length}`,
    ];
    for (const [typeLabel, list] of Object.entries(byType)) {
      pLines.push(`\n🔹 ${typeLabel} (${list.length}):`);
      for (const item of list.slice(0, 35)) {
        const roleTxt = item.job_role && item.job_role !== '—' ? ` — ${item.job_role}` : '';
        const phoneTxt = item.phone && item.phone !== '—' ? ` (📱 ${item.phone})` : '';
        pLines.push(`  • ${item.name}${roleTxt}${phoneTxt}`);
      }
      if (list.length > 35) pLines.push(`  ... وعدد ${list.length - 35} آخرين في نفس التصنيف.`);
    }
    return pLines.join('\n');
  }

  const lines = [
    `🏗️ بيان المشاريع والفلل ونماذج المساحات — ${companyLabel}`,
    `التاريخ المرجعي: ${dateChecked}`,
    `إجمالي المشاريع المسجلة: ${result.total_existing_projects ?? allProjects.length} مشروع (منها ${result.active_in_progress_count ?? 0} قيد التنفيذ)`,
    `المشاريع التي تم العمل عليها في هذا اليوم (${dateChecked}): ${workedToday.length} مشروع`,
  ];

  if (mode === 'worked_today') {
    if (workedToday.length === 0) {
      lines.push('\n⚠️ لم يتم تسجيل حركات عمل (يوميات عمالة أو مصروفات أو صرف خامات) على أي فيلا بتاريخ ' + dateChecked + '.');
    } else {
      lines.push('\n📌 الفلل والمشاريع التي اشتغلناها في هذا اليوم:');
      for (const p of workedToday) {
        const act = p.today_activity || {};
        const wagePart = act.wages_available ? ` بإجمالي ${act.labor_wages || 0} ر.س` : '';
        lines.push(
          `• ${p.name} (${p.status} — المرحلة: ${p.current_stage})` +
          `\n  - المهندس المسؤول: ${p.engineer_in_charge} | مدير المشروع: ${p.project_manager}` +
          `\n  - حركة اليوم: عمالة (${act.workers_count || 0})${wagePart} | مصروفات (${act.expenses_count || 0}) بإجمالي ${act.expenses_total || 0} ر.س | خامات منصرفة (${act.material_issues_count || 0}) بإجمالي ${act.material_issues_total || 0} ر.س`
        );
      }
    }
  }

  if (allProjects.length > 0) {
    lines.push('\n📋 قائمة المشاريع والفلل ونماذجها ومساحاتها:');
    for (const p of allProjects) {
      const act = p.today_activity || {};
      const todayBadge = p.worked_on_date
        ? `✅ اشتغلناها (${act.workers_count || 0} عامل / مصروفات ${act.expenses_total || 0} ر.س)`
        : '➖ لا توجد حركات مسجلة بهذا التاريخ';
      lines.push(
        `• ${p.name} [كود: ${p.project_code}] — الحالة: ${p.status}` +
        `\n  - النموذج: ${p.unit_type} | المساحة: ${p.unit_area}` +
        `\n  - المرحلة الحالية: ${p.current_stage}` +
        `\n  - المهندس المسؤول: ${p.engineer_in_charge} | مدير المشروع: ${p.project_manager}` +
        (p.contract_value > 0 ? `\n  - قيمة التعاقد: ${p.contract_value.toLocaleString('en-US')} ر.س` : '') +
        `\n  - موقف اليوم (${dateChecked}): ${todayBadge}`
      );
    }
  } else {
    lines.push('\nلا توجد مشاريع مسجلة حالياً.');
  }

  return lines.join('\n');
}

function formatComprehensiveReportReply(result, companyLabel) {
  const s1 = result.section_1_labor_today || {};
  const s2 = result.section_2_villas_and_projects || {};
  const s3 = result.section_3_expenses_today || {};
  const s4 = result.section_4_spent_on_labor || {};
  const s5 = result.section_5_materials_issued || {};
  const s6 = result.section_6_contractors_delivered || {};
  const s7 = result.section_7_completed_requests || {};

  const lines = [
    `📊 التقرير اليومي المفصل الشامل — ${companyLabel}`,
    `📅 التاريخ: ${result.report_date} | النطاق: ${result.villa_filter || 'جميع المشاريع والفلل'}`,
    '────────────────────────────',
  ];

  // 1) العمالة
  if (s1.available === false) {
    lines.push(`1️⃣ العمالة اللي نزلت: غير متاح (راجع صلاحية يوميات العمالة labor_logs أو المصدر).`);
  } else {
    lines.push(`1️⃣ العمالة اللي نزلت (${s1.records_count ?? 0} سجل / ${s1.unique_workers_count ?? 0} عامل):`);
    if (Array.isArray(s1.workers) && s1.workers.length > 0) {
      const wageSummary = s1.wages_available === false
        ? 'غير متاح (يتطلب صلاحية laborcost)'
        : `${s1.total_daily_wages ?? 0} ر.س`;
      lines.push(`• إجمالي أيام الحضور: ${s1.total_attendance_days ?? 0} يوم | إجمالي اليوميات المستحقة: ${wageSummary}`);
      for (const w of s1.workers.slice(0, 15)) {
        const tareehaTxt = w.tareeha != null ? ` | طريحة: ${w.tareeha} منفذ: ${w.productivity ?? 0} (${w.completion_percentage || '—'})` : '';
        const wageTxt = s1.wages_available === false ? '' : ` | يومية: ${w.daily_wage ?? 0} ر.س`;
        lines.push(`  - ${w.worker_name} | ${w.site_ref} | بند: ${w.work_item}${wageTxt} (${w.status})${tareehaTxt}`);
      }
    } else {
      lines.push('• لم يتم تسجيل يوميات عمالة في هذا التاريخ حتى الآن.');
    }
  }

  // 2) الفلل والمشاريع
  lines.push('────────────────────────────');
  if (s2.available === false) {
    lines.push(`2️⃣ الفلل والمشاريع: غير متاح (راجع صلاحية المشاريع projects أو المصدر).`);
  } else {
    lines.push(`2️⃣ الفلل والمشاريع (${s2.worked_today_count ?? 0} اشتغلناها اليوم من أصل ${s2.total_company_projects ?? 0} مشاريع بالشركة):`);
    if (Array.isArray(s2.worked_today_villas) && s2.worked_today_villas.length > 0) {
      lines.push(`• الفلل النشطة اليوم: ${s2.worked_today_villas.join(' ، ')}`);
    } else {
      lines.push('• لا توجد حركات مسجلة على فلل محددة في هذا التاريخ.');
    }
    if (Array.isArray(s2.all_company_projects) && s2.all_company_projects.length > 0) {
      lines.push('• موقف المشاريع المسجلة بالشركة:');
      for (const p of s2.all_company_projects.slice(0, 10)) {
        lines.push(`  - ${p.name} (${p.status}): المرحلة «${p.current_stage}» | نموذج ${p.unit_type} (${p.unit_area}) | م/ ${p.engineer_in_charge}`);
      }
    }
  }

  // 3) المصروفات
  lines.push('────────────────────────────');
  if (s3.available === false) {
    lines.push(`3️⃣ المصروفات المسجلة: غير متاح (راجع صلاحية المصروفات expenses أو المصدر).`);
  } else {
    lines.push(`3️⃣ المصروفات المسجلة (${s3.expenses_count ?? 0} حركة بإجمالي ${s3.total_expenses_amount ?? 0} ر.س):`);
    if (Array.isArray(s3.expenses_list) && s3.expenses_list.length > 0) {
      for (const e of s3.expenses_list.slice(0, 10)) {
        lines.push(`  - ${e.description}: ${e.total_price} ر.س | ${e.site_ref} | التصنيف: ${e.main_category} (${e.status})`);
      }
    } else {
      lines.push('• لا توجد مصروفات مسجلة في هذا التاريخ.');
    }
  }

  // 4) اللي اتصرف للعمالة
  lines.push('────────────────────────────');
  if (s4.available === false) {
    lines.push(`4️⃣ اللي اتصرف للعمالة: غير متاح (يتطلب صلاحيات تكلفة العمالة والمصروفات وسندات الصرف).`);
  } else {
    lines.push(
      `4️⃣ اللي اتصرف للعمالة (مستحقات ومنصرف العمالة):`,
      `• إجمالي أجور يوميات العمالة المسجلة: ${s4.wages_available === false ? 'غير متاح (صلاحية laborcost)' : `${s4.daily_logs_wages_total ?? 0} ر.س`}`,
      `• مصروفات بنود عمالة مباشرة: ${s4.expenses_available === false ? 'غير متاح (صلاحية expenses)' : `${s4.labor_expenses_total ?? 0} ر.س`}`,
      `• سندات صرف نقدية/تحويل للعمالة: ${s4.vouchers_available === false ? 'غير متاح (صلاحية payments)' : `${s4.labor_payment_vouchers_total ?? 0} ر.س`}`,
      `• الإجمالي الكلي للعمالة: ${s4.total_spent_or_accrued_for_labor === null || s4.total_spent_or_accrued_for_labor === undefined ? 'غير متاح بالكامل (بعض المصادر غير متاحة)' : `${s4.total_spent_or_accrued_for_labor} ر.س`}`
    );
  }

  // 5) الخامات اللي اتصرفت
  lines.push('────────────────────────────');
  if (s5.available === false) {
    lines.push(`5️⃣ الخامات اللي اتصرفت من المخازن: غير متاح (راجع صلاحية المخازن وصرف الخامات).`);
  } else {
    lines.push(`5️⃣ الخامات اللي اتصرفت من المخازن (${s5.issues_count_today ?? 0} إذن صرف بإجمالي ${s5.total_materials_cost_today ?? 0} ر.س):`);
    if (Array.isArray(s5.items_issued) && s5.items_issued.length > 0) {
      for (const item of s5.items_issued.slice(0, 10)) {
        lines.push(`  - ${item.item_name}: الكمية ${item.quantity} ${item.unit} (إجمالي ${item.total_price} ر.س)`);
      }
    } else {
      lines.push('• لم يتم تسجيل أذون صرف خامات في هذا التاريخ.');
    }
  }

  // 6) المقاولين اللي اتسلمت والمستخلصات
  lines.push('────────────────────────────');
  if (s6.available === false) {
    lines.push(`6️⃣ المقاولين اللي اتسلمت والمستخلصات وأوامر الشغل: غير متاح (راجع صلاحية أوامر الشغل والمستخلصات).`);
  } else {
    lines.push(
      `6️⃣ المقاولين اللي اتسلمت والمستخلصات وأوامر الشغل:`,
      `• أوامر شغل مكتملة/مستلمة: ${s6.orders_available === false ? 'غير متاح' : (s6.delivered_job_orders_count ?? 0)} | أوامر شغل جارية: ${s6.orders_available === false ? 'غير متاح' : (s6.active_job_orders_count ?? 0)}`,
      `• مستخلصات معتمدة: ${s6.claims_available === false ? 'غير متاح' : (s6.approved_subclaims_count ?? 0)} | مستخلصات معلقة للمراجعة: ${s6.claims_available === false ? 'غير متاح' : (s6.pending_subclaims_count ?? 0)}`
    );
    if (Array.isArray(s6.delivered_job_orders) && s6.delivered_job_orders.length > 0) {
      for (const o of s6.delivered_job_orders.slice(0, 5)) {
        lines.push(`  - أمر شغل مستلم #${o.order_number}: ${o.contractor_name} | ${o.villa} (${o.status})`);
      }
    }
    if (Array.isArray(s6.subclaims_summary) && s6.subclaims_summary.length > 0) {
      for (const c of s6.subclaims_summary.slice(0, 5)) {
        lines.push(`  - مستخلص ${c.claim_number}: ${c.contractor_name} | ${c.projects} | الصافي: ${c.net_amount} ر.س (${c.status})`);
      }
    }
  }

  // 7) الركوستات والمهام اللي خلصت
  lines.push('────────────────────────────');
  if (s7.available === false) {
    lines.push(`7️⃣ الركوستات والطلبات والمهام اللي خلصت: غير متاح حالياً.`);
  } else {
    lines.push(
      `7️⃣ الركوستات والطلبات والمهام اللي خلصت:`,
      `• الركوستات المكتملة/المعتمدة: ${s7.completed_user_requests_count ?? 0} من أصل ${s7.total_user_requests_count ?? 0}`,
      `• المهام المكتملة: ${s7.completed_tasks_count ?? 0} من أصل ${s7.total_tasks_count ?? 0}`
    );
    if (Array.isArray(s7.completed_requests) && s7.completed_requests.length > 0) {
      for (const r of s7.completed_requests.slice(0, 5)) {
        lines.push(`  - طلب مكتمل [${r.type || 'طلب'}]: ${r.subject || r.category} (${r.status})`);
      }
    } else if (Array.isArray(s7.all_recent_requests) && s7.all_recent_requests.length > 0) {
      lines.push('• أحدث الطلبات المسجلة:');
      for (const r of s7.all_recent_requests.slice(0, 5)) {
        lines.push(`  - [${r.type || 'طلب'}]: ${r.subject || 'بدون عنوان'} — الحالة: ${r.status}`);
      }
    }
  }

  return lines.join('\n');
}

function formatAddLaborReply(result, companyLabel) {
  const r = result.record || {};
  return [
    `✅ تم تسجيل مسودة يومية العامل بنجاح في فاي تك`,
    `الشركة: ${companyLabel}`,
    `• اسم العامل: ${r.worker_name}`,
    `• التاريخ: ${r.work_date}`,
    `• الفيلا / الموقع: ${r.site_ref}`,
    `• البند / العمل: ${r.work_item}`,
    `• اليومية (الأجر): ${r.daily_wage} ر.س (حضور: ${r.attendance_value} يوم)`,
    r.tareeha != null ? `• الطريحة: ${r.tareeha} ${r.unit} | الإنتاجية المنفذة: ${r.productivity ?? 0} ${r.unit} (${r.completion_percentage || '—'})` : null,
    r.tareeha != null ? `• موقف الطريحة: ${r.tareeha_deficit}` : null,
    `• الحالة: مسودة غير مرحّلة (بانتظار الاعتماد من شاشة يوميات العمالة).`,
  ].filter(Boolean).join('\n');
}

function formatAddExpenseReply(result, companyLabel) {
  const r = result.record || {};
  return [
    `✅ تم تسجيل مسودة المصروف بنجاح في فاي تك`,
    `الشركة: ${companyLabel}`,
    `• البيان: ${r.description}`,
    `• المبلغ الإجمالي: ${r.total_price} ر.س`,
    `• التاريخ: ${r.exp_date}`,
    `• الفيلا / الموقع: ${r.site_ref}`,
    `• التصنيف: ${r.main_category} | طريقة الدفع: ${r.payment_method}`,
    r.payee_name && r.payee_name !== '—' ? `• المستفيد: ${r.payee_name}` : null,
    `• الحالة: مسودة غير مرحّلة (بانتظار المراجعة والاعتماد من شاشة المصروفات).`,
  ].filter(Boolean).join('\n');
}

function formatAddJournalReply(result, companyLabel) {
  const r = result.record || {};
  return [
    `📋 <b>قيد محاسبي جديد مسجل [${r.entry_number || '#'}]</b>`,
    `الشركة: <b>${companyLabel}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 <b>التاريخ:</b> ${r.entry_date}`,
    `📝 <b>البيان:</b> ${r.description}`,
    `💰 <b>المبلغ:</b> ${r.amount} ر.س`,
    `🟢 <b>المدين (+):</b> ${r.debit_account}`,
    `🔴 <b>الدائن (-):</b> ${r.credit_account}`,
    `🏗️ <b>المشروع:</b> ${r.site_ref}`,
    `📌 <b>الحالة:</b> ${r.status}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 <i>للتعديل: اضغط "رد" (Reply) على هذه الرسالة واكتب تعديلك.</i>`,
  ].filter(Boolean).join('\n');
}

function formatAddJobOrderReply(result, companyLabel) {
  const r = result.record || {};
  return [
    `🔨 <b>أمر تشغيل جديد مسجل [${r.order_number || '#'}]</b>`,
    `الشركة: <b>${companyLabel}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 <b>التاريخ:</b> ${r.start_date}`,
    `🏗️ <b>المشروع:</b> ${r.site_ref}`,
    `👷 <b>المقاول / المنفذ:</b> ${r.contractor_name} (${r.executor_type})`,
    `📦 <b>البند:</b> ${r.work_item}`,
    `📐 <b>الكمية:</b> ${r.assigned_qty} | <b>الفئة:</b> ${r.unit_price} ر.س`,
    `💵 <b>الإجمالي:</b> ${r.total_amount} ر.س`,
    `📌 <b>الحالة:</b> ${r.status}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 <i>للتعديل: اضغط "رد" (Reply) على هذه الرسالة واكتب تعديلك.</i>`,
  ].filter(Boolean).join('\n');
}

function formatUpdateOperationReply(result, companyLabel) {
  const u = result.updated || {};
  const changesList = Array.isArray(u.changes) ? u.changes.map(c => `• ${c}`).join('\n') : '• تم حفظ التعديلات بنجاح';
  return [
    `✏️ <b>تم تعديل العملية بنجاح! [${u.reference || '#'}]</b>`,
    `الشركة: <b>${companyLabel}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📝 <b>نوع العملية:</b> ${u.type || 'عملية مسجلة'}`,
    `🔄 <b>التعديلات التي تم تطبيقها:</b>`,
    changesList,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ <i>تم حفظ التعديلات وتحديث السجلات في قاعدة البيانات بنجاح.</i>`,
    `💡 <i>للتعديل مرة أخرى: اضغط "رد" (Reply) على هذه الرسالة.</i>`,
  ].filter(Boolean).join('\n');
}

export async function runEnabledCopilotTool(call, tools, access, now = new Date()) {
  if (!TOOLS_ENABLED) return 'الأدوات المتقدمة معطّلة حالياً. افتح فاي تك مباشرةً.';
  const name = call?.name;
  if (!isEnabled(name, access) || !tools || !Object.hasOwn(tools, name) || typeof tools[name] !== 'function') {
    return 'العملية دي مش متاحة من البوت بالإعدادات والصلاحيات الحالية. افتح الشاشة المختصة في فاي تك.';
  }

  const args = getToolArgs(name, call.args, now);
  if (!args) {
    if (name === LABOR) return 'حدّد تاريخ اليومية، أو تاريخ بداية ونهاية لفترة لا تتجاوز 31 يومًا. ولو عايز عامل معيّن، اذكر اسمه.';
    if (name === TAREEHA) return 'جرّب تاني — الطلب ده ما بياخدش معطيات إضافية.';
    if (name === ADD_LABOR) return 'اذكر اسم العامل والبند واليومية لتسجيل مسودة اليومية.';
    if (name === ADD_EXPENSE) return 'اذكر بيان المصروف والمبلغ بالريال لتسجيل مسودة المصروف.';
    if (name === ADD_JOURNAL) return 'اذكر بيان القيد والمبلغ بالريال لتسجيل قيد اليومية.';
    if (name === ADD_JOB_ORDER) return 'اذكر بند العمل والكمية وسعر الوحدة والمقاول لتسجيل أمر الشغل.';
    if (name === UPDATE_OPERATION) return 'اذكر كود أو تفاصيل العملية والتعديل المطلوب.';
    if (name === PROJECTS || name === DAILY_REPORT) return 'حدّد التاريخ بصيغة YYYY-MM-DD أو اكتب «النهارده».';
    return 'اذكر اسم البند الهندسي ونوع الفحص المطلوب.';
  }

  const isFieldOpsMode = process.env.COPILOT_LIVE_FIELD_OPS_ENABLED === 'true';
  const canViewWages = hasModulePermission(access, 'laborcost', 'view');
  const execArgs = { ...args };
  if ((name === LABOR || name === PROJECTS) && isFieldOpsMode) {
    execArgs.include_wages = canViewWages;
  } else if (name === DAILY_REPORT) {
    execArgs.section_permissions = {
      labor_logs: hasModulePermission(access, 'labor_logs', 'view'),
      laborcost: canViewWages,
      projects: hasModulePermission(access, 'projects', 'view'),
      expenses: hasModulePermission(access, 'expenses', 'view'),
      payments: hasModulePermission(access, 'payments', 'view'),
      inventory: hasModulePermission(access, 'inventory', 'view') || hasModulePermission(access, 'projects', 'view'),
      contractors: hasModulePermission(access, 'sub_claims', 'view') || hasModulePermission(access, 'projects', 'view'),
      requests: Boolean(access?.fullCompanyAccess) || hasModulePermission(access, 'projects', 'view'),
    };
  }

  let result;
  try {
    result = await tools[name](execArgs);
  } catch {
    return 'مصدر الاستعلام غير متاح حاليًا. جرّب من شاشة فاي تك وتحقق من الصلاحية والاتصال.';
  }
  if (result?.success !== true) {
    return 'ما قدرتش أكمّل الاستعلام. راجع صلاحية المصدر وتوافره في فاي تك.';
  }
  if (name === CHECKLIST) {
    const guidance = result.engineering_guidance;
    if (!result.reference_found || typeof guidance !== 'string' || !guidance.trim() || guidance.trim() === '## undefined') {
      return 'مالقيتش مرجع فحص مطابق للبند. اكتب اسم البند بدقة أو راجع مواصفة المشروع المعتمدة.';
    }
    return 'إرشاد من دليل فاي تك. معايير الاستلام الملزمة تتحدد من مواصفة مشروعك المعتمدة.\n\n' +
      guidance.slice(0, 1450);
  }

  const companyLabel = safeText(access?.companyName, 100) || access?.companyId || 'الشركة';

  if (name === PROJECTS) {
    return formatProjectsReply(result, companyLabel);
  }
  if (name === DAILY_REPORT) {
    return formatComprehensiveReportReply(result, companyLabel);
  }
  if (name === ADD_LABOR) {
    return formatAddLaborReply(result, companyLabel);
  }
  if (name === ADD_EXPENSE) {
    return formatAddExpenseReply(result, companyLabel);
  }
  if (name === ADD_JOURNAL) {
    return formatAddJournalReply(result, companyLabel);
  }
  if (name === ADD_JOB_ORDER) {
    return formatAddJobOrderReply(result, companyLabel);
  }
  if (name === UPDATE_OPERATION) {
    return formatUpdateOperationReply(result, companyLabel);
  }

  if (name === TAREEHA) {
    const period = validDate(result.start_date) && validDate(result.end_date)
      ? result.start_date + ' إلى ' + result.end_date : 'آخر 30 يوم';
    const heading = 'عجوزات الطريحة المستحقة\nالشركة: ' + companyLabel + '\nالفترة: ' + period;
    const count = result.count;
    if (!Number.isSafeInteger(count) || count < 0) return heading + '\nالمصدر ما رجّعش بيانات صالحة.';
    const partialNote = result.partial === true ? '\nالنتيجة جزئية (سجلات كتير في الفترة) — العدد ده أقل حد، راجع شاشة اليوميات للعدد الكامل.' : '';
    if (count === 0) {
      const unrecordedOnly = Number.isSafeInteger(result.no_productivity) && result.no_productivity > 0
        ? '\nسجلات فيها طريحة من غير إنتاجية مسجلة (مش محسوبة): ' + result.no_productivity : '';
      return heading + '\nلا توجد عجوزات مستحقة حالياً.' + partialNote + unrecordedOnly;
    }
    const lines = Array.isArray(result.deficits) && result.deficits.length > 0
      ? '\n\nأبرز العجوزات:\n' + result.deficits.slice(0, 5).map(d => {
          const num = value => (Number.isFinite(Number(value)) ? Number(value) : '—');
          const unit = safeText(d.unit, 20) || '';
          return `• ${validDate(d.work_date) ? d.work_date : '—'} — ${safeText(d.worker_name, 60) || '—'} — ${safeText(d.site_ref, 60) || 'غير محدد'} — ${safeText(d.work_item, 60) || '—'} (المستهدف: ${num(d.expected)} / المنفذ: ${num(d.productivity)} ${unit} — إنجاز ${num(d.achievement)}%)`;
        }).join('\n')
      : '';
    const unrecorded = Number.isSafeInteger(result.no_productivity) && result.no_productivity > 0
      ? '\nسجلات فيها طريحة من غير إنتاجية مسجلة (مش محسوبة): ' + result.no_productivity : '';
    return heading + '\nإجمالي العجوزات: ' + count + partialNote + unrecorded +
      '\nالتعريف: الإنتاجية أقل من الطريحة × الحضور.' + lines;
  }

  const period = args.date || (args.start_date + ' إلى ' + args.end_date);
  const heading = 'يوميات العمالة المحفوظة على الخادم\nالشركة: ' + companyLabel + '\nالفترة: ' + period;
  if (result.partial === true) return heading + '\nالنتيجة جزئية، لذلك مش ممكن أعرض إجماليًا موثوقًا. جرّب فترة أقصر أو راجع شاشة اليوميات.';
  if (!Number.isSafeInteger(result.count_records) || result.count_records < 0) {
    return heading + '\nالمصدر ما رجّعش عدد سجلات صالح.';
  }
  if (result.count_records === 0) {
    let hintText = '';
    if (isFieldOpsMode && result.latest_recorded_hint?.last_work_date) {
      const samples = Array.isArray(result.latest_recorded_hint.recent_samples)
        ? result.latest_recorded_hint.recent_samples.map(s => {
            const wageTxt = canViewWages && s.daily_wage !== undefined ? ` — يومية: ${s.daily_wage ?? 0} ر.س` : '';
            return `  - ${s.work_date}: ${s.worker_name} (${s.site_ref || 'غير محدد'} — ${s.work_item || '—'}${wageTxt})`;
          }).join('\n')
        : '';
      hintText = `\n\n💡 تنبيه: آخر يوميات مسجلة في النظام كانت بتاريخ ${result.latest_recorded_hint.last_work_date}:\n${samples}`;
    }
    return heading + '\nلا توجد سجلات يوميات مطابقة للبحث.' + hintText;
  }

  const wageHeader = canViewWages && result.total_wages !== null && result.total_wages !== undefined
    ? `إجمالي الأجور اليومية: ${result.total_wages ?? 0} ر.س`
    : 'إجمالي الأجور اليومية: غير متاح (تتطلب صلاحية laborcost)';
  const summaryStats = isFieldOpsMode && result.count_unique_workers !== undefined
    ? `\nإجمالي العمال: ${result.count_unique_workers ?? result.count_records} عامل | إجمالي أيام الحضور: ${result.total_attendance_days ?? 0} | ${wageHeader} (مرحّل: ${result.posted_records ?? 0} / مسودة: ${result.draft_records ?? 0})`
    : '';

  const logLines = Array.isArray(result.logs) && result.logs.length > 0
    ? '\n\nآخر السجلات:\n' + result.logs.slice(0, isFieldOpsMode ? 15 : 5).map(l => {
        const wagePart = isFieldOpsMode && canViewWages && l.daily_wage !== undefined
          ? ` | اليومية: ${l.daily_wage ?? 0} ر.س`
          : '';
        const extra = isFieldOpsMode
          ? wagePart +
            (l.tareeha != null ? ` | طريحة: ${l.tareeha} منفذ: ${l.productivity ?? 0} ${l.unit || ''}` : '') +
            (l.is_posted !== undefined ? ` (${l.is_posted ? 'مرحّل' : 'مسودة'})` : '')
          : '';
        return `• ${l.work_date} — ${safeText(l.worker_name, 60) || '—'} — ${safeText(l.site_ref, 60) || 'غير محدد'} — ${safeText(l.work_item, 60) || 'غير محدد'} (حضور: ${l.attendance_value ?? '—'})${extra}`;
      }).join('\n')
    : '';

  return heading + '\nعدد سجلات اليوميات المطابقة: ' + result.count_records + summaryStats + logLines;
}
