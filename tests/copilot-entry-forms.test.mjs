import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopilotEntryForms } from '../scripts/copilot-entry-forms.mjs';
import { authorizeTelegramMessages } from '../scripts/copilot-telegram-auth.mjs';

const actor = { chatId: 12345, userId: 12345 };

function formDriver() {
  let clock = Date.parse('2026-11-05T22:30:00Z');
  const forms = createCopilotEntryForms({ now: () => clock });
  return {
    enter: text => forms.handle(actor, text),
    clear: () => forms.clear(actor),
    advance: minutes => { clock += minutes * 60_000; },
  };
}

test('opens the menu and prepares an expense with a project and job order', () => {
  const { enter } = formDriver();
  assert.deepEqual(enter('إضافة عملية').replyMarkup.keyboard[0], ['مصروف', 'سند قبض', 'سند صرف']);
  assert.match(enter('مصروف').text, /التاريخ/);
  assert.match(enter('2026-02-30').text, /قيمة صحيحة/);
  assert.match(enter('اليوم').text, /المشروع/);
  assert.match(enter('مشروع ألف').text, /أمر الشغل/);
  assert.match(enter('/skip').text, /مطلوبة/);
  assert.match(enter('WO-12').text, /المستفيد/);
  assert.match(enter('/skip').text, /البيان/);
  assert.match(enter('نقل خامات').text, /إجمالي المصروف/);
  for (const invalid of ['0', '-1', '1,200', '12.123']) {
    assert.match(enter(invalid).text, /قيمة صحيحة/);
  }
  assert.deepEqual(enter('٣٥٠٫٥٠').replyMarkup.keyboard[0], ['آجل', 'تسوية داخلية', 'عهدة']);
  const review = enter('عهدة');
  assert.match(review.text, /معاينة مصروف/);
  assert.match(review.text, /2026-11-06/);
  assert.match(review.text, /WO-12/);
  assert.match(review.text, /350\.50/);
  assert.match(review.text, /العهدة المفتوحة/);
  assert.match(review.text, /https:\/\/rawasi-tech\.vercel\.app\/expenses\n/);
  assert.match(review.text, /الحفظ من شاشة فاي تك/);
  assert.deepEqual(enter('/done').replyMarkup, { remove_keyboard: true });
  assert.equal(enter('سؤال آخر'), null);
});

test('changing the project requires a new job order and skipping removes it', () => {
  const { enter } = formDriver();
  enter('/add receipt');
  enter('۲۰۲۶-۱۱-۰۶');
  enter('عميل ألف');
  enter('120');
  enter('كاش');
  enter('INV-010');
  enter('مشروع ألف');
  enter('WO-1');
  enter('/back');
  enter('/back');
  assert.match(enter('مشروع باء').text, /أمر الشغل/);
  assert.doesNotMatch(enter('/resume').text, /WO-1/);
  enter('WO-2');
  enter('/back');
  enter('/back');
  assert.match(enter('/skip').text, /البيان/);
  const review = enter('/skip');
  assert.match(review.text, /INV-010/);
  assert.match(review.text, /طريقة الدفع: نقدي/);
  assert.doesNotMatch(review.text, /WO-|أمر الشغل/);
  assert.match(review.text, /\/ReceiptVouchers\n/);
});

test('offers an explicit back, keep and resume without consuming unrelated commands', () => {
  const { enter, clear } = formDriver();
  assert.match(enter('عاوز اضيف سند صرف').text, /سند صرف.*خطوة 1/);
  assert.match(enter('اليوم').text, /المستفيد/);
  assert.match(enter('مورد تجريبي').text, /المبلغ/);
  assert.match(enter('/back').text, /القيمة الحالية: مورد تجريبي/);
  assert.equal(enter('/help'), null);
  assert.equal(enter('/ask سؤال عن الأخطاء'), null);
  assert.equal(enter('/new'), null);
  assert.match(enter('/add receipt').text, /معاينة مفتوحة/);
  assert.match(enter('/resume').text, /المستفيد/);
  assert.match(enter('').text, /اكتب الإجابة كنص/);
  assert.match(enter('✓ كما هو').text, /المبلغ/);
  enter('125');
  enter('تحويل بنكي');
  enter('REF-7');
  enter('/skip');
  assert.match(enter('سداد جزء من المستحق').text, /\/PaymentVouchers\n/);
  assert.equal(clear(), true);
  assert.deepEqual(enter('/cancel').replyMarkup, { remove_keyboard: true });
});

test('expires a draft after inactivity without carrying values into the next form', () => {
  const { enter, advance } = formDriver();
  enter('إضافة سند قبض');
  enter('اليوم');
  enter('طرف سابق');
  advance(20);
  assert.match(enter('60').text, /انتهت مدة المعاينة/);
  assert.match(enter('/add receipt').text, /التاريخ/);
  assert.doesNotMatch(enter('اليوم').text, /طرف سابق/);
});

test('the authorized message gate stops an outside sender from changing a draft', async () => {
  const forms = createCopilotEntryForms();
  const dispatch = authorizeTelegramMessages(actor.chatId, msg => forms.handle({ chatId: msg.chat.id, userId: msg.from.id }, msg.text));
  const send = (text, userId = actor.userId, type = 'private') => dispatch({ message: {
    text, chat: { id: actor.chatId, type }, from: { id: userId, is_bot: false },
  } });
  await send('/add payment');
  await send('اليوم');
  assert.equal(await send('طرف غير مصرح', 54321), undefined);
  assert.equal(await send('/cancel', actor.userId, 'group'), undefined);
  assert.match((await send('/resume')).text, /المستفيد/);
  assert.match((await send('مورد صالح')).text, /المبلغ/);
});
