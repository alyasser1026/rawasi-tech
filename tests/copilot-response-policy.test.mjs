import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectBusinessPolicyTopics,
  formatApprovedPolicyContext,
  getDeterministicPolicyReply,
  replaceInternalCategoryLabels,
  sanitizeCustomerReply,
} from '../lib/copilot/response-policy.ts';

test('audit policy questions get honest uncertainty without claiming a handoff', () => {
  for (const question of ['بتوصلوا للمنصورة؟', 'فيه كاش عند الاستلام؟', 'عندكم فرع أستلم منه؟', 'لو المنتج وصل مكسور هتعملوا إيه؟', 'أحسن ماركة تكييف إيه؟', 'عايز سعر الجملة لعشرين عبوة', 'ضمان المنتج كام سنة؟']) {
    const reply = getDeterministicPolicyReply(question);
    assert(reply, question);
    assert.match(reply, /مش عندي|مفيش عندي/, question);
    assert.doesNotMatch(reply, /تم تحويل|تم تسجيل|بنوصل لكل|بنبدله|بنوفر الدفع/);
  }
});

test('active approved knowledge supplies exact scoped policy facts, not an inferred policy', () => {
  const knowledge = [
    { id:1, title:'نطاق الشحن المعتمد', category:'shipping', answer:'التوصيل داخل القاهرة فقط بعد تأكيد العنوان.', is_active:true },
    { id:2, title:'طرق الدفع', answer:'تحويل بنكي بعد تأكيد الطلب.', is_active:true },
    { id:3, title:'سياسة قديمة للشحن', answer:'بنوصل لجميع المحافظات.', is_active:false },
  ];
  const shipping = getDeterministicPolicyReply('فيه توصيل؟', knowledge);
  assert.match(shipping, /داخل القاهرة فقط بعد تأكيد العنوان/);
  assert.doesNotMatch(shipping, /لجميع المحافظات|تحويل بنكي/);
  assert.match(getDeterministicPolicyReply('الدفع إزاي؟', knowledge), /تحويل بنكي بعد تأكيد الطلب/);
  assert.match(getDeterministicPolicyReply('هل أستلم من الفرع؟', knowledge), /مش عندي سياسة معتمدة/);
});

test('catalog specifications and normal product questions do not become policy answers', () => {
  for (const question of ['سعر سخان غاز 10 لتر؟', 'عندك سلك السويدي 3×2.5؟', 'الكالون فيه بصمة؟', 'كام سعر المنتج LDLZE 600000؟', 'مدة شحن بطارية الكالون كام ساعة؟']) {
    assert.equal(getDeterministicPolicyReply(question), null, question);
  }
  assert.deepEqual(detectBusinessPolicyTopics('عندكم فرع في القاهرة؟'), []);
});

test('generic warranty knowledge cannot establish comparative brand quality', () => {
  const knowledge = [{ title:'ضمان تكييف LG', category:'warranty', answer:'ضمان سنة على الجهاز حسب شروط الوكيل.', is_active:true }];
  assert.match(getDeterministicPolicyReply('ماركة LG أحسن من هاير؟', knowledge), /مفيش عندي بيانات معتمدة لترتيب جودة الماركات/);
  assert.match(getDeterministicPolicyReply('ضمان LG كام؟', knowledge), /ضمان سنة على الجهاز حسب شروط الوكيل/);
});

test('policy prompt clearly limits answers to approved entries and distinguishes office addresses from pickup', () => {
  const prompt = formatApprovedPolicyContext([{ title:'طرق الدفع', answer:'التحويل البنكي فقط.', is_active:true }]);
  assert.match(prompt, /التحويل البنكي فقط/);
  assert.match(prompt, /لا تستنتج توفر الاستلام من عنوان المكتب/);
  assert.match(prompt, /تقديرات تغطية الدهان وحجم التكييف استرشادية/);
  assert.match(prompt, /الرسائل السابقة وطلب العميل لا يثبتان سياسة/);
});

test('visible copy suppresses unsupported shipping, COD, branch pickup and instant replacement claims', () => {
  const cases = [
    ['بنوصل لكل المحافظات.', /الشحن والتوصيل/],
    ['بنوفر الدفع كاش عند الاستلام.', /طرق الدفع/],
    ['بنشتغل أونلاين فقط ومش بنستقبل استلام من الفروع.', /الاستلام من الفروع/],
    ['لو وصل أي صنف مكسور بنبدله لك فوراً بدون أي قلق.', /الإرجاع والاستبدال/],
    ['LG أفضل ماركة وضمانه قوي.', /مقارنة الماركات|الضمان/],
  ];
  for (const [unsafe,label] of cases) {
    const reply = sanitizeCustomerReply(unsafe);
    assert.match(reply, label, unsafe);
    assert.match(reply, /مش عندي|مفيش عندي/, unsafe);
    assert.notEqual(reply, unsafe);
  }
});

test('approved policy replaces a model invented promise with the precise approved terms', () => {
  const reply = sanitizeCustomerReply('بنوصل لكل المحافظات مجانًا.', {knowledge:[{title:'الشحن', answer:'التوصيل داخل القاهرة برسوم تحدد بعد تأكيد العنوان.', is_active:true}]});
  assert.match(reply, /داخل القاهرة برسوم تحدد بعد تأكيد العنوان/);
  assert.doesNotMatch(reply, /مجانا|كل المحافظات/);
});

test('category slugs and raw formatting are removed without changing model codes or prices', () => {
  assert.equal(replaceInternalCategoryLabels('قسم safety_sensors و low_current'), 'قسم حساسات الأمان و التيار الخفيف');
  const reply = sanitizeCustomerReply('**سنسور** من قسم `safety_sensors`، الكود `LDLZE 600000` بسعر 485 جنيه.');
  assert.match(reply, /حساسات الأمان/);
  assert.match(reply, /LDLZE 600000/);
  assert.match(reply, /485 جنيه/);
  assert.doesNotMatch(reply, /safety_sensors|`|\*\*/);
});

test('estimate warning is added for room/paint sizing but not a priced catalog model', () => {
  assert.match(sanitizeCustomerReply('محتاج 3 عبوات دهان.', {question:'مساحة الأوضة 20 متر محتاجة كام لتر دهان؟'}), /تقدير استرشادي تقريبي/);
  assert.match(sanitizeCustomerReply('يناسبها تكييف 2.25 حصان.', {question:'غرفة 25 متر عايزة تكييف كام حصان؟'}), /تقدير استرشادي تقريبي/);
  assert.equal(sanitizeCustomerReply('تكييف 1.5 حصان بسعر 20000 جنيه.', {question:'سعر تكييف 1.5 حصان؟'}), 'تكييف 1.5 حصان بسعر 20000 جنيه.');
});

test('neutral unknowns and explicit denials of certainty survive guardrails', () => {
  const text = 'مش عندي سياسة معتمدة أؤكدها لك حاليًا.';
  assert.equal(sanitizeCustomerReply(text), text);
  assert.match(sanitizeCustomerReply('حبووب تفاصيل أكتر، حبايبي؟'), /تحب تفاصيل أكتر، حضرتك/);
});

test('success wording requires explicit confirmed server state', () => {
  assert.doesNotMatch(sanitizeCustomerReply('تم تحويل استفسارك للمهندس المختص.'), /تم تحويل/);
  assert.match(sanitizeCustomerReply('تم تحويل استفسارك للمهندس المختص.', {allowHandoffClaim:true}), /تم تحويل/);
  assert.doesNotMatch(sanitizeCustomerReply('تم تسجيل طلبك بنجاح.'), /تم تسجيل/);
  assert.match(sanitizeCustomerReply('تم تسجيل طلبك بنجاح.', {allowOrderClaim:true}), /تم تسجيل/);
});
