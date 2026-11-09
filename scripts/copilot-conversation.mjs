const MAX_CONVERSATIONS = 16;
const MAX_MESSAGE_IDS = 16;
const MAX_USER_TEXT = 1200;
const MAX_MODEL_TEXT = 1600;

const TOOL_MARKERS = new Map([
  ['get_labor_daily_logs', 'كان الطلب السابق استعلامًا عن سجلات يوميات العمالة. أعد التحقق من التاريخ والصلاحية واستعلم من جديد عند طلب أي رقم فعلي.'],
  ['get_engineering_checklist_and_specs', 'كان الطلب السابق عن إرشادات فحص هندسي. ارجع لدليل فاي تك عند الحاجة للتفاصيل.'],
  ['get_tareeha_deficits', 'كان الطلب السابق استعلامًا عن عجوزات الطريحة. أعد الاستعلام بالأداة عند طلب أي رقم أو تفاصيل فعلية.'],
  ['get_all_projects_and_villas', 'كان الطلب السابق استعلامًا عن المشاريع والفلل المسجلة أو التي تم العمل عليها. أعد الاستعلام بالأداة عند طلب بيانات محددة.'],
  ['get_daily_comprehensive_report', 'كان الطلب السابق استعلامًا عن التقرير اليومي المفصل الشامل (العمالة والفلل والمصروفات والخامات والمقاولين والركوستات). أعد الاستعلام بالأداة عند طلب تاريخ آخر.'],
  ['add_labor_daily_log_draft', 'كان الطلب السابق تسجيل مسودة يومية عامل جديدة في النظام.'],
  ['add_expense_draft', 'كان الطلب السابق تسجيل مسودة مصروف جديدة في النظام.'],
  ['add_payment_voucher_draft', 'كان الطلب السابق تسجيل مسودة سند صرف.'],
  ['add_journal_entry_draft', 'كان الطلب السابق تسجيل مسودة قيد يومية.'],
  ['add_job_order_draft', 'كان الطلب السابق تسجيل مسودة أمر شغل.'],
  ['add_partner', 'كان الطلب السابق إضافة شريك جديد.'],
  ['update_operation_draft', 'كان الطلب السابق تعديل عملية مسجلة.'],
  ['write_confirmation', 'عرض البوت ملخص عملية تسجيل وطلب التأكيد بالأزرار. لا تعتبر العملية متسجلة إلا بعد التأكيد.'],
  ['get_villa_and_budget_details', 'كان الطلب السابق استعلامًا عن بيانات وميزانية فيلا أو مشروع. أعد الاستعلام بالأداة عند طلب تحديث.'],
  ['get_model_villas_and_specs', 'كان الطلب السابق استعلامًا عن فلل ومواصفات نموذج معين.'],
  ['get_boq_and_materials', 'كان الطلب السابق استعلامًا عن مقايسة الأعمال واستهلاك الخامات.'],
  ['get_contractors_summary', 'كان الطلب السابق استعلامًا عن مقاولي الباطن وأوامر الشغل والمستحقات.'],
  ['get_pending_subclaims', 'كان الطلب السابق استعلامًا عن المستخلصات المعلقة لمقاولي الباطن.'],
  ['get_financial_transaction_details', 'كان الطلب السابق بحثًا في العمليات والسندات المالية والمصروفات.'],
  ['get_site_violations', 'كان الطلب السابق استعلامًا عن مخالفات الموقع والسلامة.'],
  ['get_custodies_and_closings', 'كان الطلب السابق استعلامًا عن العهد النثرية وإقفالات الصناديق.'],
  ['get_inventory_status', 'كان الطلب السابق استعلامًا عن أرصدة المخازن والخامات.'],
  ['get_vat_and_invoices_summary', 'كان الطلب السابق استعلامًا عن فواتير المبيعات وضريبة القيمة المضافة.'],
  ['get_company_notifications', 'كان الطلب السابق استعلامًا عن التنبيهات الإدارية والوثائق.'],
  ['get_fixed_assets_summary', 'كان الطلب السابق استعلامًا عن الأصول الثابتة والمعدات.'],
  ['generate_and_send_worker_statement_pdf', 'كان الطلب السابق إصدار كشف حساب عامل PDF.'],
  ['generate_and_send_engineering_checklist_pdf', 'كان الطلب السابق إصدار استمارة فحص واستلام هندسي PDF.'],
  ['record_site_inspection_visit', 'كان الطلب السابق تسجيل زيارة فحص واستلام هندسي بالموقع.'],
]);

const isMessageId = id => Number.isSafeInteger(id) && id > 0;

// 🧠 الأسماء اللي المستخدم ذكرها في طلبه (من معطيات الأداة) — عشان أسئلة المتابعة زي «وكام للمقاول ده؟».
// بنحتفظ بالأسماء والتواريخ بس؛ لا مبالغ ولا أرقام هوية ولا أي حاجة من نتيجة الأداة.
const ENTITY_FIELDS = Object.freeze([
  ['contractor_name', 'المقاول'], ['new_contractor', 'المقاول'], ['sub_contractor', 'مقاول الباطن'],
  ['worker_name', 'العامل'], ['helper_name', 'المساعد'], ['payee_name', 'المستفيد'], ['name', 'الاسم'],
  ['site_ref', 'الفيلا/المشروع'], ['new_site_ref', 'الفيلا/المشروع'], ['villa_filter', 'الفيلا/المشروع'],
  ['job_order', 'أمر الشغل'], ['work_item', 'البند'],
  ['date', 'التاريخ'], ['work_date', 'التاريخ'], ['exp_date', 'التاريخ'], ['entry_date', 'التاريخ'],
  ['start_date', 'من'], ['end_date', 'إلى'],
]);
const MAX_ENTITY_TEXT = 60;

export function extractEntities(calls) {
  const list = Array.isArray(calls) ? calls : [calls];
  const seen = new Map();
  for (const call of list) {
    const args = call?.args && typeof call.args === 'object' ? call.args : {};
    for (const [key, label] of ENTITY_FIELDS) {
      const v = args[key];
      if (typeof v !== 'string') continue;
      const text = v.replace(/[\r\n\t]+/g, ' ').replace(/[`"<>]/g, '').trim();
      if (!text || text.length > MAX_ENTITY_TEXT) continue;
      const pair = `${label}: ${text}`;
      if (!seen.has(pair)) seen.set(pair, true);
      if (seen.size >= 8) break;
    }
  }
  return [...seen.keys()];
}

function entitiesNote(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return '';
  const clean = entities.filter(e => typeof e === 'string' && e.length <= MAX_ENTITY_TEXT + 20).slice(0, 8);
  return clean.length ? `\nالأسماء اللي اتذكرت في الطلب (استخدمها لو المستخدم قال «ده» أو «نفسه» أو سأل متابعة): ${clean.join('، ')}.` : '';
}

function identity(chatId, userId) {
  return isMessageId(chatId) && isMessageId(userId) ? chatId + ':' + userId : null;
}

function boundedText(value, limit) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > limit ? text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '') + '…' : text;
}

function emptyContext(referenceMissing = false) {
  return { contents: [], parentMessageId: null, referenceMissing };
}

/** Holds recent completed turns per Telegram sender and verified access scope in memory. */
export function createCopilotConversation({ maxTurns = 6, ttlMs = 30 * 60 * 1000, now = Date.now } = {}) {
  if (!Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 24 ||
      !Number.isFinite(ttlMs) || ttlMs <= 0 || typeof now !== 'function') {
    throw new TypeError('Invalid conversation limits');
  }
  const conversations = new Map();

  function activeTurns(key, scope, time) {
    for (const [actor, conversation] of conversations) {
      conversation.turns = conversation.turns.filter(turn => turn.createdAt <= time && time - turn.createdAt < ttlMs);
      if (!conversation.turns.length) conversations.delete(actor);
    }

    const conversation = conversations.get(key);
    if (conversation && conversation.scope !== scope) {
      conversations.delete(key);
      return [];
    }
    return conversation?.turns ?? [];
  }

  function getContext({ chatId, userId, scope, replyToMessageId } = {}) {
    const explicitReply = replyToMessageId !== null && replyToMessageId !== undefined;
    const key = identity(chatId, userId);
    if (!key) return emptyContext(explicitReply);
    const turns = activeTurns(key, scope, now());
    const referenced = explicitReply
      ? turns.find(turn => turn.userMessageId === replyToMessageId || turn.botMessageIds.includes(replyToMessageId))
      : turns.at(-1);
    if (!referenced) return emptyContext(explicitReply);

    const branch = [];
    let turn = referenced;
    while (turn) {
      branch.push(turn);
      const parent = turn.parentMessageId;
      turn = turns.find(candidate => candidate.userMessageId === parent);
    }

    return {
      contents: branch.reverse().flatMap(item => [
        { role: 'user', parts: [{ text: item.userText }] },
        { role: 'model', parts: [{ text: item.modelText }] },
      ]),
      parentMessageId: referenced.userMessageId,
      referenceMissing: false,
    };
  }

  function remember({ chatId, userId, scope, userMessageId, botMessageIds, parentMessageId, userText, modelText, toolName, entities } = {}) {
    const key = identity(chatId, userId);
    if (!key) return false;
    const time = now();
    const turns = activeTurns(key, scope, time);
    if (typeof scope !== 'string' || !scope.trim() || scope.length > 256 ||
        !Number.isFinite(time) || !isMessageId(userMessageId) ||
        turns.some(turn => turn.userMessageId === userMessageId)) return false;

    const user = boundedText(userText, MAX_USER_TEXT);
    // Never retain rendered data, IDs, counts, or other tool result text.
    const marker = toolName != null ? TOOL_MARKERS.get(toolName) : null;
    const model = toolName != null ? (marker ? marker + entitiesNote(entities) : undefined) : boundedText(modelText, MAX_MODEL_TEXT);
    if (!user || !model) return false;

    const ids = Array.isArray(botMessageIds)
      ? [...new Set(botMessageIds.slice(0, MAX_MESSAGE_IDS).filter(isMessageId))]
      : [];
    const parent = turns.some(turn => turn.userMessageId === parentMessageId) ? parentMessageId : null;

    conversations.delete(key);
    conversations.set(key, {
      scope,
      turns: [...turns, { userMessageId, botMessageIds: ids, parentMessageId: parent, userText: user, modelText: model, createdAt: time }]
        .slice(-maxTurns),
    });
    if (conversations.size > MAX_CONVERSATIONS) conversations.delete(conversations.keys().next().value);
    return true;
  }

  function clear({ chatId, userId } = {}) {
    const key = identity(chatId, userId);
    return key !== null && conversations.delete(key);
  }

  return { getContext, remember, clear };
}
