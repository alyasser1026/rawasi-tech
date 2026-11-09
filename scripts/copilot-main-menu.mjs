// القائمة الرئيسية لبوت تلغرام: كل زر يمرّر جملة جاهزة لنفس مسار الرسائل العادي
// (نفس الأدوات والصلاحيات). الجمل لازم تطابق أدوات موجودة في copilot-tool-registry.mjs.
export const MAIN_MENU_ACTIONS = Object.freeze({
  report_today: { label: '📊 تقرير اليوم', phrase: 'ابعت تقرير النهارده المفصل', tool: 'get_daily_comprehensive_report' },
  report_yesterday: { label: '🗓️ تقرير امبارح', phrase: 'ابعت تقرير امبارح المفصل', tool: 'get_daily_comprehensive_report' },
  labor_today: { label: '👷 عمالة اليوم', phrase: 'العمالة اللي نزلت النهارده', tool: 'get_labor_daily_logs' },
  projects: { label: '🏗️ المشاريع والفلل', phrase: 'المشاريع والفلل اللي عندنا كلها', tool: 'get_all_projects_and_villas' },
  tareeha: { label: '⚠️ عجوزات الطريحة', phrase: 'عجوزات الطريحة', tool: 'get_tareeha_deficits' },
});

export const MAIN_MENU_LAYOUT = Object.freeze([
  ['report_today', 'report_yesterday'],
  ['labor_today', 'projects'],
  ['tareeha'],
]);

export function buildMainMenuMarkup() {
  return {
    inline_keyboard: MAIN_MENU_LAYOUT.map((row) =>
      row.map((key) => ({ text: MAIN_MENU_ACTIONS[key].label, callback_data: `menu:${key}` }))),
  };
}

export function resolveMenuAction(callbackData) {
  const data = String(callbackData || '');
  if (!data.startsWith('menu:')) return null;
  return MAIN_MENU_ACTIONS[data.slice(5)] || null;
}

export const BOT_COMMANDS = Object.freeze([
  { command: 'menu', description: 'القائمة الرئيسية' },
  { command: 'start', description: 'بدء وتعريف بالبوت' },
  { command: 'help', description: 'مساعدة وأمثلة' },
]);
