// One place for user feedback messages: replaces browser alert() and the old custom toast
// with react-hot-toast styled for the Phi Tech theme (see app/providers.tsx).
import { createElement } from 'react';
import { toast } from 'react-hot-toast';
import { Info, TriangleAlert } from 'lucide-react';

export type NotifyType = 'success' | 'error' | 'warning' | 'info';

const ERROR_HINTS = /(❌|⛔|🚫|خطأ|فشل|تعذر|تعذّر|غير مصرح|غير متاح|ليس لديك|لا يمكن|مرفوض|ممنوع)/;
const WARNING_HINTS = /(⚠|تنبيه|تحذير|يرجى|يجب|الرجاء|من فضلك|اختر|عفوا|عفواً|انتظر|لا يوجد|لا توجد|غير مرحل)/;
const SUCCESS_HINTS = /(✅|🎉|^تم|\sتم\s|بنجاح)/;
const EMOJI = /\p{Extended_Pictographic}[️︎]?(?:‍\p{Extended_Pictographic}️?)*/gu;

/** Guess the message tone from its wording, so plain alert() texts map to the right toast. */
export function inferNotifyType(message: string): NotifyType {
  if (ERROR_HINTS.test(message)) return 'error';
  if (WARNING_HINTS.test(message)) return 'warning';
  if (SUCCESS_HINTS.test(message)) return 'success';
  return 'info';
}

/** Show a themed toast. Returns nothing, so it can replace `return alert(...)` safely. */
export function notify(message: unknown, type?: NotifyType): void {
  const raw = message instanceof Error ? message.message : String(message ?? '');
  const text = raw.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim();
  if (!text) return;
  const kind = type ?? inferNotifyType(raw);
  if (kind === 'success') toast.success(text);
  else if (kind === 'error') toast.error(text, { duration: 6000 });
  else if (kind === 'warning') toast(text, { duration: 5000, icon: createElement(TriangleAlert, { size: 18, color: '#b45309', 'aria-hidden': true }) });
  else toast(text, { icon: createElement(Info, { size: 18, color: '#1d4ed8', 'aria-hidden': true }) });
}

notify.success = (message: unknown) => notify(message, 'success');
notify.error = (message: unknown) => notify(message, 'error');
notify.warning = (message: unknown) => notify(message, 'warning');
notify.info = (message: unknown) => notify(message, 'info');
