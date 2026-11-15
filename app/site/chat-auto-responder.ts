/**
 * chat-auto-responder.ts — محرك المحادثة الهندسية الذكي بالعامية المصرية (AI-Style Egyptian Colloquial Responder)
 *
 * تدفق المحادثة الاحترافي (طبيعي وذكي بدون فورم مسبق):
 * 1. العميل يكتب سؤاله بالعامية براحته أول ما يفتح الشات (بدون طلب بيانات مسبقة وبدون زحمة اختيارات).
 * 2. المساعد الهندسي بيرحب بيه بالعامية المصرية الودودة ويستأذنه يتعرف على اسمه الكريم الأول.
 * 3. أول ما العميل يكتب اسمه، المساعد بيرحب بيه باسمه ("منورنا يا أستاذ ...") وبيجاوب على سؤاله بالتفصيل الهندسي بلغة عامية مصرية ذكية زي الذكاء الاصطناعي، وفي آخر الشرح بيطلب رقم تليفونه أو الواتساب جوه المحادثة.
 * 4. لما العميل يكتب رقمه، السيستم بيحفظه ويبعت إشعار فوري للمهندس على تليجرام، وتكمل المحادثة أو تتحول للمهندس البشري لو السؤال محتاج تدخل مباشر.
 */

import {
  DEFAULT_MAINTENANCE_SERVICES,
  DEFAULT_PRODUCTS,
  DEFAULT_PROPERTIES,
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
  type WebsiteProperty,
} from './store-catalog';

export type ChatConversationStage =
  | 'ask_question'
  | 'awaiting_name'
  | 'awaiting_phone'
  | 'active';

export interface ChatBotActionLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface ChatBotCustomRule {
  id: string;
  title: string;
  keywords: string;
  reply: string;
  quickReplies?: string[];
}

export interface ChatBotConfig {
  enabled: boolean;
  botName: string;
  welcomeText: string;
  escalationText: string;
  customRules: ChatBotCustomRule[];
}

export interface AutoResponderSiteContent {
  SITE?: {
    name?: string;
    offices?: string[];
    contact?: {
      phone?: string;
      whatsapp?: string;
      email?: string;
      address?: string;
      hours?: string;
    };
  };
  FAQS?: Array<{ q: string; a: string }>;
  COMMITMENTS?: Array<{ title: string; text: string }>;
  PRODUCTS?: WebsiteProduct[];
  PROPERTIES?: WebsiteProperty[];
  MAINTENANCE_SERVICES?: WebsiteMaintenanceService[];
  CHAT_BOT?: Partial<ChatBotConfig>;
}

export interface AutoReplyResult {
  shouldReply: boolean;
  replyText: string;
  senderName: string;
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  needsHuman: boolean;
  escalationReason?: string;
  quickReplies: string[];
  actions?: ChatBotActionLink[];
  nextStage?: ChatConversationStage;
  extractedName?: string;
  extractedPhone?: string;
  pendingQuestion?: string;
}

export const DEFAULT_CHAT_BOT_CONFIG: ChatBotConfig = {
  enabled: true,
  botName: '🤖 المستشار الهندسي الذكي — فاي تك',
  welcomeText:
    'أهلاً بيك في شركة فاي تك للمقاولات والتشطيبات والسمارت هوم 👷‍♂️✨\nقولي بتفكر في إيه أو إيه اللي شاغل بالك في شقتك أو مشروعك، وأنا معاك خطوة بخطوة!',
  escalationText:
    'حولت محادثتك دلوقتي حالاً للمهندس المختص 👨‍💻🔔 وبعتله إشعار فوري بكل التفاصيل اللي كتبتها عشان يدخل يكلمك هنا أو على الواتساب في دقايق.',
  customRules: [
    {
      id: 'rule-contracts',
      title: 'نظام الدفعات والميزانية ("الأسعار حنينة ولا غالية؟")',
      keywords:
        'نظام الدفعات, دفعات, تعاقد, عقد, مستخلص, مستخلصات, نسبه الاشراف, طرق الدفع, غالي, غاليه, حنينه, علي قد الايد, ميزانيه, بتقسطوا التشطيب',
      reply:
        'بص يا فندم، إحنا في فاي تك شغالين بنظام مريح وشفاف جداً عشان متشيلش هم التكلفة ولا تدفع جنيه غير في مكانه الصح 💯:\n' +
        '• **مقايسة مفتوحة (Open Book) على قد ميزانيتك:** بنفصّل الخامات والبنود حسب الميزانية اللي مريحاك من غير أي مصاريف مخفية.\n' +
        '• **دفعات مرتبطة بالإنجاز الفعلي:** يعني كل مرحلة بتخلص (تأسيس كهرباء وسباكة، محارة، سيراميك، تشطيب) حضرتك بتستلمها الأول بالليزر وبالاختبار وبعدين نصرف مستخلص المرحلة اللي بعدها.\n' +
        '• **متابعة رقمية بالفاتورة:** كل مسمار أو سلك بيدخل الموقع بيبقى موثق قدامك.',
      quickReplies: ['💰 إزاي بنحسب تكلفة تشطيب الشقة؟', '👨‍💼 حولني لمهندس الآن'],
    },
    {
      id: 'rule-survey',
      title: 'المعاينة والرفع المساحي بالليزر ("تقدروا تيجوا تعاينوا امتى؟")',
      keywords: 'معاينه, رفع مساحي, شوب درونج, مخططات تنفيذيه, هندسي بالليزر, هتيجو امتى, تيجوا تعاينوا, مهندس يعاين',
      reply:
        'من عنيا يا فندم! إحنا بنبدأ أي شغلانة صح بـ **معاينة هندسية ورفع مساحي بالليزر (Laser Survey)** على الطبيعة 📐:\n' +
        '• المهندس بينزل يرفع مقاسات الشقة بالملي ويشيك على الرطوبة ومناسيب الصرف والكهرباء.\n' +
        '• قبل ما ندق مسمار واحد، بنعملك **مخططات تنفيذية (Shop Drawings)** توضح مكان كل فيشة، خلاط دفن، تكييف، وقطعة عفش عشان منكسرش حاجة مرتين.\n' +
        '• نقدر نرتبلك أقرب ميعاد معاينة يناسب وقتك خلال 24 لـ 48 ساعة.',
      quickReplies: ['عندي شقة 150 متر ع الطوب', 'عندي فيلا / دوبلكس للمعاينة', '👨‍💼 حولني لمهندس الآن'],
    },
    {
      id: 'rule-locations',
      title: 'المحافظات ونطاق الشغل والشحن',
      keywords: 'محافظات, شحن, توصيل خارج, اسكندريه, الدلتا, الجيزه, اكتوبر, التجمع, العاصمه, زايد, المنصوره, بتشتغلوا فين',
      reply:
        'إحنا معاك في كل مكان يا فندم 📍:\n' +
        '• **التنفيذ والتشطيبات والصيانة الهندسية:** مغطيين القاهرة الكبرى بالكامل (التجمع، مدينة نصر، مصر الجديدة، المعادي، الشيخ زايد، 6 أكتوبر، العاصمة الإدارية، الشروق، مدينتي) وكمان المنصورة ومحافظات الدلتا.\n' +
        '• **منتجات المتجر والسمارت هوم وحساسات الأمان:** بنشحنها لحد باب البيت في أي محافظة في مصر مع دعم فني كامل للتركيب والبرمجة.',
      quickReplies: ['أطلب معاينة ومقايسة', '🛒 أفتح المتجر وأشوف المنتجات', '👨‍💼 حولني لمهندس الآن'],
    },
  ],
};

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toEnglishDigits(text: string): string {
  return String(text || '').replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

export function normalizeArabic(text: string): string {
  return toEnglishDigits(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s²]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(normMsg: string, keywords: string[]): boolean {
  const padded = ` ${normMsg} `;
  for (const kw of keywords) {
    const nkw = normalizeArabic(kw);
    if (!nkw) continue;
    if (nkw.length <= 3) {
      const re = new RegExp(`(^|\\s)(و|ال|ب|ل|ف|ك)?${nkw}(ه|ين|ات)?(\\s|$)`);
      if (re.test(padded)) return true;
    } else if (normMsg.includes(nkw)) {
      return true;
    }
  }
  return false;
}

/** استخراج رقم الجوال من نص الرسالة إن وُجد (8 إلى 15 رقماً) */
export function extractPhoneFromMessage(text: string): string | null {
  const normalizedDigits = toEnglishDigits(text);
  const matches = normalizedDigits.match(/(?:\+?\d[\d\s()-]{7,16}\d)/g);
  if (!matches) return null;
  for (const raw of matches) {
    const hasPlus = raw.trim().startsWith('+');
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return hasPlus ? `+${digits}` : digits;
    }
  }
  return null;
}

const QUESTION_INDICATORS = [
  'بكام',
  'كام',
  'سعر',
  'اسعار',
  'عايز',
  'عاوز',
  'محتاج',
  'اريد',
  'استفسار',
  'تشطيب',
  'اشطب',
  'سباكه',
  'كهرباء',
  'كهربا',
  'سمارت',
  'حساس',
  'شقه',
  'فيلا',
  'عقار',
  'صيانه',
  'تكييف',
  'ممكن',
  'ازاي',
  'كيف',
  'هل',
  'فين',
  'عنوان',
  'ضمان',
  'معاينه',
  'مقايسه',
  'طوب',
  'محاره',
  'رطوبه',
  'تسريب',
  'قفله',
  'تقسيط',
  'بورسلان',
  'سيراميك',
  'رخام',
  'دهانات',
  'نقاشه',
  'جبس',
];

export function isSimpleGreeting(text: string): boolean {
  const norm = normalizeArabic(text);
  if (!norm) return true;
  const words = norm.split(' ');
  if (words.length > 5) return false;
  if (hasAny(norm, QUESTION_INDICATORS)) return false;
  return hasAny(norm, [
    'سلام',
    'السلام عليكم',
    'مرحبا',
    'اهلا',
    'صباح',
    'مساء',
    'ازيك',
    'عامل ايه',
    'اخبارك',
    'هاي',
    'الو',
    'هلا',
    'يا هندسه',
    'يا باشا',
    'لو سمحت',
  ]);
}

/**
 * استخراج اسم العميل من رسالته في مرحلة التعارف، مع فصل أي سؤال إضافي إن كتبه في نفس الرسالة
 */
export function extractNameFromMessage(text: string): {
  name: string | null;
  additionalQuestion?: string;
} {
  const cleaned = toEnglishDigits(text)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .trim();
  if (!cleaned) return { name: null };

  // Split if visitor wrote "أحمد، وكنت عايز أسأل..."
  const parts = cleaned.split(
    /[،,\n-]|(?:\s+وكنت\s+)|(?:\s+وعايز\s+)|(?:\s+وعاوز\s+)|(?:\s+ومحتاج\s+)|(?:\s+وبسأل\s+)/
  );
  let candidate = (parts[0] || '').trim();
  const rest = parts.slice(1).join(' ').trim();

  // Strip greetings and Egyptian colloquial name prefixes
  candidate = candidate
    .replace(
      /^(?:السلام عليكم|وعليكم السلام|اهلا بك|اهلا بيك|اهلا|مرحبا|صباح الخير|مساء الخير|تشرفنا|الشرف ليا|حبيبي|يا هندسه|يا باشا|مع حضرتك|انا اسمي|اسمي|انا|معاك|معك|اخوك|الاسم|المهندس|مهندس|استاذ|الاستاذ|دكتور|الدكتور|الحاج|باشمهندس)+[\s:،-]*/gi,
      ''
    )
    .replace(/^(?:انا اسمي|اسمي|انا|معاك|معك|الاسم|استاذ|مهندس|باشمهندس)+[\s:،-]*/gi, '')
    .trim();

  const normCand = normalizeArabic(candidate);
  if (!normCand) return { name: null };

  const words = candidate.split(/\s+/).filter(Boolean);
  if (/\d/.test(candidate) || words.length > 4) {
    return { name: null, additionalQuestion: cleaned };
  }
  if (hasAny(normCand, QUESTION_INDICATORS) || isSimpleGreeting(candidate)) {
    return { name: null, additionalQuestion: cleaned };
  }

  const finalName = words.slice(0, 3).join(' ');
  if (finalName.length < 2) return { name: null };

  return {
    name: finalName,
    additionalQuestion: rest.length > 3 ? rest : undefined,
  };
}

const DEFAULT_QUICK_MENU = [
  '💰 شقتي ع الطوب وعايز أعرف تكلفة التشطيب',
  '📱 عايز أقلب الشقة سمارت هوم من غير تكسير',
  '🛠️ محتاج صنايعي أو مهندس صيانة وتنفيذ',
  '🚨 خايف من تسريب الغاز والمية (حساسات الأمان)',
  '🏢 عندكم شقق متشطبة أو بالتقسيط؟',
  '👨‍💼 حولني لمهندس أكلمه دلوقتي',
];

function buildContactActions(siteContent?: AutoResponderSiteContent): ChatBotActionLink[] {
  const rawWa = siteContent?.SITE?.contact?.whatsapp || siteContent?.SITE?.contact?.phone || '201558888744';
  const cleanWa = String(rawWa).replace(/\D/g, '') || '201558888744';
  const phoneDisplay = siteContent?.SITE?.contact?.phone || '+201558888744';
  return [
    {
      label: `💬 واتساب مباشر (${phoneDisplay})`,
      href: `https://wa.me/${cleanWa}`,
      external: true,
    },
    {
      label: '🛒 تصفح المتجر والكتالوج',
      href: '/store',
    },
  ];
}

function findMatchingMaintenanceService(
  normMsg: string,
  services: WebsiteMaintenanceService[]
): WebsiteMaintenanceService | null {
  const tradeMatchers: Array<{ category: WebsiteMaintenanceService['category']; keywords: string[] }> = [
    {
      category: 'hvac',
      keywords: [
        'تكييف',
        'تكيف',
        'كونسيلد',
        'اسبليت',
        'فريون',
        'دكت',
        'كمبريسور',
        'مش بيسقع',
        'بينقط ميه',
        'صيانه تكييف',
        'hvac',
      ],
    },
    {
      category: 'electrical',
      keywords: [
        'كهرباء',
        'كهربا',
        'كهربائي',
        'قواطع',
        'لوحه توزيع',
        'افياش',
        'قفله',
        'ميجر',
        'بيفصل',
        'بتكهرب',
        'سبوتات',
        'ليد بروفايل',
      ],
    },
    {
      category: 'plumbing',
      keywords: [
        'سباكه',
        'سباك',
        'تسريب مياه',
        'تسرب مياه',
        'بتنقط',
        'سيفون',
        'خلاط',
        'طرد',
        'ضغط هيدروليكي',
        'مواسير',
        'صرف',
        'البلاعه',
        'نشع',
      ],
    },
    {
      category: 'paint',
      keywords: [
        'دهان',
        'دهانات',
        'نقاشه',
        'نقاش',
        'رطوبه',
        'عزل',
        'معجون',
        'تقشر',
        'بتقشر',
        'تملح',
        'الحيطه باشت',
      ],
    },
    {
      category: 'ceramics',
      keywords: [
        'سيراميك',
        'بورسلان',
        'بورسلين',
        'بلاط',
        'مبلط',
        'ليزر',
        'كلبسات',
        'بيطبل',
        'تطبيل',
      ],
    },
    {
      category: 'marble',
      keywords: ['رخام', 'جرانيت', 'جلي', 'تلميع', 'درج', 'احجار', 'كونتر مطبخ'],
    },
    {
      category: 'decor',
      keywords: [
        'جبس',
        'جبس بورد',
        'ديكور',
        'ديكورات',
        'بديل خشب',
        'بديل رخام',
        'تجليد',
        'بيت نور',
        'اسقف معلقه',
      ],
    },
    {
      category: 'smart_home',
      keywords: ['سمارت', 'تحكم عن بعد', 'زيجبي', 'قفل ذكي', 'مفتاح ذكي', 'ستائر', 'اقلب الشقه سمارت'],
    },
    {
      category: 'low_current',
      keywords: ['تيار خفيف', 'كاميرات', 'انتركم', 'شبكات', 'واي فاي', 'فايبر', 'صوتيات', 'الشبكه بتقطع'],
    },
    {
      category: 'safety_sensors',
      keywords: ['حساس', 'غاز', 'حريق', 'دخان', 'انذار', 'محبس تلقائي'],
    },
  ];

  for (const matcher of tradeMatchers) {
    if (hasAny(normMsg, matcher.keywords)) {
      const found = services.find((s) => s.category === matcher.category && s.available !== false);
      if (found) return found;
    }
  }
  return null;
}

function findMatchingProductCategory(normMsg: string): ProductCategoryId | null {
  const catKeywords: Array<{ id: ProductCategoryId; keywords: string[] }> = [
    { id: 'safety_sensors', keywords: ['حساس', 'دخان', 'حريق', 'غاز', 'تسرب مياه', 'تسريب', 'محبس'] },
    { id: 'smart_home', keywords: ['سمارت', 'تحكم عن بعد', 'زيجبي', 'zigbee', 'اليكسا', 'قفل ذكي', 'ستائر'] },
    { id: 'low_current', keywords: ['تيار خفيف', 'كاميرات', 'انتركم', 'اكسس', 'ساوند', 'سماعات', 'واي فاي', 'فايبر', 'راك'] },
    { id: 'electrical', keywords: ['كهرباء', 'كهربا', 'اسلاك', 'سويدي', 'افياش', 'مفاتيح', 'ليد', 'بروفايل', 'لوحه قواطع'] },
    { id: 'plumbing', keywords: ['سباكه', 'خلاط', 'مدفون', 'جروهي', 'مرحاض', 'صندوق طرد', 'مضخه', 'محبس'] },
    { id: 'paint', keywords: ['دهان', 'دهانات', 'جوتن', 'عزل', 'ايبوكسي', 'معجون'] },
    { id: 'ceramics', keywords: ['سيراميك', 'بورسلان', 'بورسلين', 'غراء', 'كلبسات'] },
    { id: 'marble', keywords: ['رخام', 'جرانيت', 'جلاكسى', 'كرارة', 'اربسكاتو', 'حجر'] },
    { id: 'decor', keywords: ['ديكور', 'جبس بورد', 'بديل خشب', 'بديل رخام', 'تجليد', 'WPC'] },
  ];

  for (const entry of catKeywords) {
    if (hasAny(normMsg, entry.keywords)) return entry.id;
  }
  return null;
}

/**
 * محرك الإجابة الهندسية بالعامية المصرية الذكية (يرد كمهندس استشاري مصري خبير وودود)
 */
function buildTopicExplanation(params: {
  questionText: string;
  visitorName: string;
  visitorPhone: string;
  requestHuman?: boolean;
  previousMessages?: Array<{ sender: 'visitor' | 'admin'; text: string; intent?: string }>;
  siteContent?: AutoResponderSiteContent;
  chatBot: ChatBotConfig;
}): AutoReplyResult {
  const {
    questionText,
    visitorName,
    visitorPhone,
    requestHuman = false,
    previousMessages = [],
    siteContent,
    chatBot,
  } = params;

  const displayVisitor = visitorName || 'يا فندم';
  const honorific = visitorName ? `يا أستاذ ${visitorName}` : 'يا فندم';
  const products = siteContent?.PRODUCTS ?? DEFAULT_PRODUCTS;
  const properties = siteContent?.PROPERTIES ?? DEFAULT_PROPERTIES;
  const maintenanceServices = siteContent?.MAINTENANCE_SERVICES ?? DEFAULT_MAINTENANCE_SERVICES;
  const faqs = siteContent?.FAQS ?? [];
  const commitments = siteContent?.COMMITMENTS ?? [];
  const contact = siteContent?.SITE?.contact || {
    phone: '+201558888744',
    whatsapp: '201558888744',
    email: 'phi.tech.eg@gmail.com',
    address: 'الرياض · القاهرة · المنصورة',
    hours: 'السبت – الخميس، 9 صباحاً – 9 مساءً',
  };
  const offices = siteContent?.SITE?.offices || ['الرياض', 'القاهرة', 'المنصورة'];
  const rawWa = contact.whatsapp || contact.phone || '201558888744';
  const cleanWa = String(rawWa).replace(/\D/g, '') || '201558888744';

  const senderName = chatBot.botName;
  const normMsg = normalizeArabic(questionText);

  // 1. Direct Human Handoff Request ("عايز أكلم مهندس / حولني لمهندس")
  const humanKeywords = [
    'تحويل لمهندس',
    'حولني لمهندس',
    'تحويل للمهندس',
    'اكلم مهندس',
    'اكلم حد',
    'مهندس بشري',
    'خدمه عملاء',
    'موظف',
    'مدير',
    'شكوي',
    'تفاوض',
    'خصم خاص',
    'سعر خاص',
    'حد يرد',
    'اتصلو بيا',
    'كلمني',
    'كلموني',
    'اريد التحدث',
    'مكالمه',
    'مهندس يكلمني',
  ];

  if (requestHuman || hasAny(normMsg, humanKeywords)) {
    return {
      shouldReply: true,
      senderName,
      intent: 'human_handoff',
      confidence: 'high',
      needsHuman: true,
      escalationReason: 'طلب العميل التحدث المباشر مع المهندس المسؤول',
      replyText:
        `من عنيا ${honorific}! 🙌\n` +
        `${chatBot.escalationText}\n\n` +
        (visitorName ? `👤 الاسم المسجل: أستاذ ${visitorName}\n` : '') +
        (visitorPhone
          ? `📱 رقم التليفون المسجل: ${visitorPhone}`
          : `📱 ياريت بس تكتبلي رقم تليفونك أو الواتساب هنا في الشات عشان المهندس يكلمك عليه فوراً.`),
      quickReplies: ['📍 عناوين الفروع ومواعيد الشغل', '🛒 أفتح المتجر والكتالوج'],
      actions: buildContactActions(siteContent),
    };
  }

  // 2. Finishing Quote & Price per Meter Scenario ("شقتي ع الطوب وعايز أشطبها / المتر بكام؟")
  const asksFinishing = hasAny(normMsg, [
    'تشطيب',
    'تشطيبات',
    'اشطب',
    'نشطب',
    'مقايسه',
    'سعر المتر',
    'المتر بكام',
    'المتر بيكلف',
    'تكلفه تشطيب',
    'باقات التشطيب',
    'مقاولات',
    'سوبر لوكس',
    'الترا لوكس',
    'تسليم مفتاح',
    'بناء',
    'خرسانه',
    'ع الطوب',
    'علي الطوب',
    'ع المحاره',
    'علي المحاره',
  ]);
  const hasArea = /\b\d{2,4}\s*(متر|م2|م²|m2|م)\b/.test(normMsg);
  const hasLocationOrCondition = hasAny(normMsg, [
    'طوب احمر',
    'علي الطوب',
    'ع الطوب',
    'نصف تشطيب',
    'نص تشطيب',
    'على المحاره',
    'ع المحاره',
    'محاره',
    'التجمع',
    'زايد',
    'اكتوبر',
    'العاصمه',
    'المعادي',
    'مدينتي',
    'الرحاب',
    'المنصوره',
    'الشروق',
    'مدينة نصر',
    'مصر الجديده',
    'بكره',
    'غدا',
    'النهارده',
  ]);

  if (asksFinishing) {
    const qualifiedWithDetails = hasArea || hasLocationOrCondition;
    const baseReply =
      `بص ${honorific}، خليني أجيبلك الخلاصة الهندسية في موضوع **التشطيب والمقاولات** عندنا في فاي تك عشان تبقى مطمن على كل جنيه بتحطه 🏗️✨:\n\n` +
      `إحنا مابنشتغلش عشوائي ولا بنرمي سعر جزافي للمتر وبعدين نفاجئك بمصاريف زيادة في النص؛ إحنا بنمشي معاك 4 خطوات على الفرازة:\n` +
      `1️⃣ **معاينة ورفع مساحي بالليزر (Laser Survey):** مهندسنا بينزل يرفع مقاسات الشقة بالملي ويفحص الحوائط ومناسيب الصرف.\n` +
      `2️⃣ **رسومات تنفيذية (Shop Drawings 2D/3D):** بنفرش الشقة على الورق الأول ونحدد مكان كل فيشة ومفتاح وتكييف وخلاط دفن عشان منكسرش طوبة واحدة مرتين.\n` +
      `3️⃣ **مقايسة مفتوحة البنود (Open Book) على قد ميزانيتك:** بنحسبلك الكميات الفعلية بالظبط سواء شقتك ع الطوب الأحمر أو نص تشطيب (ع المحارة)، وبنختار سوا الخامات المعتمدة اللي تناسبك (سويدي، جروهي، جوتن، كناوف).\n` +
      `4️⃣ **إشراف هندسي وضمان 10 سنين:** بنستلم السباكة بضغط 10 بار، والسيراميك والمحارة بالليزر، وبتستلم شقتك على المفتاح بضمان موثق.`;

    if (qualifiedWithDetails) {
      return {
        shouldReply: true,
        senderName,
        intent: 'lead_qualified',
        confidence: 'high',
        needsHuman: true,
        escalationReason: `عميل تشطيبات شارك تفاصيل وحدته: "${questionText.slice(0, 100)}"`,
        replyText:
          `${baseReply}\n\n` +
          `✅ سجلت عندي تفاصيل وحدتك («${questionText}») وبعتها للمهندس المختص عشان يجهزلك المقايسة التقديرية المظبوطة.`,
        quickReplies: [
          '🛡️ إيه الضمان اللي بتدوه على الشغل؟',
          '📱 عايز أدخل سمارت هوم في التشطيب',
          '👨‍💼 حولني لمهندس الآن',
        ],
        actions: [{ label: '🛠️ شوف بنود التنفيذ والتأسيس', href: '/store?tab=maintenance' }],
      };
    }

    return {
      shouldReply: true,
      senderName,
      intent: 'finishing_quote',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `${baseReply}\n\n` +
        `💡 قولي برضه شقتك مساحتها كام متر تقريباً؟ وفي أنهي منطقة؟ وهل هي ع الطوب الأحمر ولا ع المحارة عشان أظبطلك الحسبة الهندسية الصح!`,
      quickReplies: [
        'شقة 150 متر ع الطوب الأحمر',
        'شقة 180 متر نص تشطيب (ع المحارة)',
        '🛡️ إيه الضمان ومراحل الاستلام؟',
        '👨‍💼 حولني لمهندس الآن',
      ],
      actions: [{ label: '🛠️ شوف بنود التنفيذ والتأسيس', href: '/store?tab=maintenance' }],
    };
  }

  // 3. Lead Qualification (Visitor sent concrete area/location measurements)
  const hasUnitOrProjectContext =
    hasAny(normMsg, ['شقه', 'فيلا', 'دوبلكس', 'مكتب', 'عياده', 'محل', 'معاينه', 'تاسيس']) ||
    previousMessages.some((m) => m.intent === 'finishing_quote' || m.intent === 'maintenance_execution');

  if ((hasArea || (hasLocationOrCondition && hasUnitOrProjectContext)) && !hasAny(normMsg, ['فرع', 'فروع', 'عنوان', 'مكانكم'])) {
    return {
      shouldReply: true,
      senderName,
      intent: 'lead_qualified',
      confidence: 'high',
      needsHuman: true,
      escalationReason: `عميل مؤهل شارك تفاصيل المشروع: "${questionText.slice(0, 100)}"`,
      replyText:
        `الله ينور عليك ${honorific} 👍 كده الصورة بقت واضحة جداً! سجلت عندي مواصفات وحدتك:\n` +
        `📝 «${questionText}»\n\n` +
        `الخطوة الجاية عندنا في فاي تك إن المهندس ينزل يعمل رفع مساحي بالليزر ونرسم الـ (Shop Drawings) لتوزيع الفرش والكهرباء والسباكة والتكييفات قبل ما نبدأ، وبعدها نقدملك مقايسة تفصيلية واضحة لكل بند.\n` +
        `✅ بلغت المهندس المختص بتفاصيل وحدتك حالاً عشان يرتب معاك المعاينة والمقايسة.`,
      quickReplies: ['🛡️ إيه الضمان ومراحل الاستلام؟', '📍 عناوين الفروع ومواعيد الشغل'],
      actions: [
        { label: `💬 متابعة سريعة على واتساب`, href: `https://wa.me/${cleanWa}`, external: true },
        { label: '🛠️ خدمات التنفيذ والصيانة', href: '/store?tab=maintenance' },
      ],
    };
  }

  // 4. Custom Rules configured from /website-admin
  for (const rule of chatBot.customRules) {
    const kws = String(rule.keywords || '')
      .split(/[,،|]/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 2);
    if (kws.length > 0 && hasAny(normMsg, kws)) {
      return {
        shouldReply: true,
        senderName,
        intent: 'custom_rule',
        confidence: 'high',
        needsHuman: false,
        replyText: rule.reply,
        quickReplies:
          Array.isArray(rule.quickReplies) && rule.quickReplies.length > 0
            ? rule.quickReplies
            : ['👨‍💼 حولني لمهندس الآن', '💰 شقتي ع الطوب وعايز أعرف تكلفة التشطيب'],
        actions: [{ label: '🛒 تصفح المتجر', href: '/store' }],
      };
    }
  }

  // 5. Site FAQs matching
  for (const faq of faqs) {
    const qWords = normalizeArabic(faq.q)
      .split(' ')
      .filter((w) => w.length >= 3);
    const matchedWords = qWords.filter((w) => normMsg.includes(w));
    if (qWords.length >= 2 && matchedWords.length >= 2) {
      return {
        shouldReply: true,
        senderName,
        intent: 'site_faq',
        confidence: 'high',
        needsHuman: false,
        replyText: `سؤال مهم جداً ${honorific} 📌\n**${faq.q}**\n\n${faq.a}`,
        quickReplies: ['👨‍💼 حولني لمهندس الآن', '💰 شقتي ع الطوب وعايز أعرف تكلفة التشطيب'],
      };
    }
  }

  // 6. Safety Sensors (Gas, Fire, Water Leak + Auto Shutoff) ("خايف من تسريب الغاز والمية")
  if (
    hasAny(normMsg, [
      'حساس',
      'حساسات',
      'حريق',
      'دخان',
      'غاز',
      'تسرب',
      'تسريب',
      'انذار',
      'محبس تلقائي',
      'محبس غاز',
      'تغرق الشقه',
      'خايف من الغاز',
    ])
  ) {
    const sensorProducts = products.filter((p) => p.category === 'safety_sensors').slice(0, 3);
    const listText = sensorProducts
      .map((p) => `• ${p.name}${p.price > 0 ? ` — ${p.price.toLocaleString('en-US')} ${p.currency}` : ''}`)
      .join('\n');

    return {
      shouldReply: true,
      senderName,
      intent: 'safety_sensors',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `أهم قرار تاخده لبيتك ${honorific}! 🚨 **منظومة حساسات الأمان الذكية في فاي تك** بتحرس الشقة 24 ساعة حتى لو إنت مسافر:\n\n` +
        `• **حساس الغاز الذكي + محبس يقفل لوحده (Auto Shut-off):** أول ما يشم أي بداية تسريب غاز، بيصفر ويبعتلك إنذار على الموبايل، والأهم إنه **بيقفل محبس الغاز الرئيسي أوتوماتيك في ثواني** من غير ما حد يلمسه.\n` +
        `• **حساس تسريب المية الأرضي:** بيتحط تحت الحوض أو الغسالة، ولو نزلت نقطة مية على الأرض بيقفل محبس المية العمومي فوراً عشان الشقة والباركيه مايغرقوش.\n` +
        `• **حساس الدخان والحرارة الذكي:** بيلقط أي دخان في أوله وينبهك على تليفونك فوراً.\n\n` +
        `💡 *نصيحة هندسية من الموقع:* لو عندك غاز طبيعي (أخف من الهوا) بنركب الحساس فوق قريب من السقف بـ 30 سم، إنما لو أنبوبة بوتاجاز (أتقل من الهوا) بيركب تحت قريب من الأرض بـ 30 سم.\n\n` +
        (listText ? `ودول أشهر القطع المتوفرة في المتجر عندنا:\n${listText}` : ''),
      quickReplies: ['🛠️ عايز أركب منظومة الحساسات دي', '📱 عايز أقلب الشقة سمارت هوم', '👨‍💼 حولني لمهندس الآن'],
      actions: [
        { label: '🚨 افتح قسم حساسات الأمان', href: '/store?cat=safety_sensors' },
        { label: '🛠️ احجز تركيب وصيانة', href: '/store?tab=maintenance' },
      ],
    };
  }

  // 7. Smart Home & Low Current Systems ("عايز أقلب الشقة سمارت من غير تكسير")
  if (
    hasAny(normMsg, [
      'سمارت',
      'smart',
      'تحكم عن بعد',
      'تحكم بالموبايل',
      'زيجبي',
      'zigbee',
      'اليكسا',
      'جوجل هوم',
      'قفل ذكي',
      'بصمه',
      'ستائر',
      'شترات',
      'تيار خفيف',
      'كاميرات',
      'انتركم',
      'شبكات',
      'فايبر',
      'ساوند',
      'اكسس بوينت',
      'واي فاي بيقطع',
      'من غير تكسير',
    ])
  ) {
    const smartProducts = products
      .filter((p) => p.category === 'smart_home' || p.category === 'low_current')
      .slice(0, 4);
    const listText = smartProducts
      .map((p) => `• ${p.name}${p.price > 0 ? ` — ${p.price.toLocaleString('en-US')} ${p.currency}` : ''}`)
      .join('\n');

    return {
      shouldReply: true,
      senderName,
      intent: 'smart_home_low_current',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `أحلى حاجة في **السمارت هوم والتيار الخفيف** عندنا في فاي تك ${honorific} إننا نقدر ننفذهولك سواء لسه بتأسس ع الطوب أو حتى **بعد ما شطبت وسكنت من غير تكسير ولا بهدلة خالص!** 📱✨\n\n` +
        `إيه اللي نقدر نعملهولك في الشقة؟\n` +
        `✅ **مفاتيح تاتش وريليهات ذكية (Zigbee 3.0 & Wi-Fi):** بتركب مكان المفاتيح العادية أو وراها، تتحكم في النور والتكييف والسخان والشتر من موبايلك أو بصوتك (Alexa / Google).\n` +
        `✅ **أقفال ذكية للباب المصفح:** تفتح بالبصمة، الكارت، الباسورد، أو تبعت كود مؤقت لأي ضيف وإنت بره البيت.\n` +
        `✅ **تأسيس تيار خفيف مظبوط:** نقاط Wi-Fi سقفية (Access Points) تنهي مشكلة تقطيع النت، كاميرات مراقبة 4K، إنتركم ذكي، وساوند سيستم في السقف.\n` +
        `🎁 وعاملين **${SMART_BUNDLES.length} باقات سمارت جاهزة** في المتجر تقدر تختار منها اللي يناسب حجم شقتك.\n\n` +
        (listText ? `أمثلة من القطع المتاحة:\n${listText}\n\n` : '') +
        `💡 *نصيحة مهندس:* لو لسه بتأسس كهرباء، خلي الكهربائي ينزل فردة نيوترال (Neutral) جوه كل علبة مفتاح؛ دي بتريحك جداً في تركيب أي مفتاح سمارت قدام!`,
      quickReplies: ['🚨 منظومة حساسات الغاز والمية', '🛠️ عايز مهندس يأسس أو يركب سمارت', '👨‍💼 حولني لمهندس الآن'],
      actions: [
        { label: '📱 افتح قسم السمارت هوم', href: '/store?cat=smart_home' },
        { label: '📡 قسم التيار الخفيف والشبكات', href: '/store?cat=low_current' },
      ],
    };
  }

  // 8. Execution & Maintenance Services (Specific or General across 10 trades + HVAC)
  const matchedMnt = findMatchingMaintenanceService(normMsg, maintenanceServices);
  const asksMaintenanceOrExec =
    Boolean(matchedMnt) ||
    hasAny(normMsg, [
      'صيانه',
      'تنفيذ',
      'تاسيس',
      'اصلاح',
      'عطل',
      'فني',
      'صنايعي',
      'كشف تسريب',
      'سباك',
      'كهربائي',
      'نقاش',
      'مبلط',
      'ترميم',
      'تكييف',
      'كونسيلد',
      'اسبليت',
      'فريون',
      'دكت',
      'ضغط هيدروليكي',
      'بتقشر',
      'رطوبه',
      'بيطبل',
      'قفله',
      'بتنقط',
    ]);

  if (asksMaintenanceOrExec) {
    if (matchedMnt) {
      const feeText =
        matchedMnt.visitFee > 0
          ? `${matchedMnt.visitFee.toLocaleString('en-US')} ${matchedMnt.currency}`
          : 'المعاينة والتسعير حسب البند على الطبيعة (من غير أي تسعير جزافي مسبق)';

      return {
        shouldReply: true,
        senderName,
        intent: 'maintenance_execution',
        confidence: 'high',
        needsHuman: false,
        replyText:
          `ولا تشيل هم ${honorific}! في فاي تك عندنا فريق متخصص لبند **${matchedMnt.title}** ${matchedMnt.icon} تحت إشراف هندسي مباشر:\n\n` +
          `🏗️ **لو بتأسس أو بتنفذ جديد بنعمل إيه؟**\n• ${matchedMnt.executionScope.slice(0, 3).join('\n• ')}\n\n` +
          `🔧 **لو عندك عطل أو محتاج صيانة وعلاج جذري:**\n• ${matchedMnt.maintenanceScope.slice(0, 3).join('\n• ')}\n\n` +
          `💡 **الخلاصة الهندسية من واقع خبرتنا:**\n${matchedMnt.recommendation}\n\n` +
          `🛡️ **الضمان:** ${matchedMnt.warrantyLabel}\n💰 **التكلفة:** ${feeText}`,
        quickReplies: ['🛠️ احجز معاينة أو فني للبند ده', '💰 تكلفة التشطيب الكامل للشقة', '👨‍💼 حولني لمهندس الآن'],
        actions: [{ label: '🛠️ اطلب خدمة التنفيذ أو الصيانة الآن', href: '/store?tab=maintenance' }],
      };
    }

    return {
      shouldReply: true,
      senderName,
      intent: 'maintenance_execution',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `من عنيا ${honorific}! قسم **التنفيذ والصيانة الهندسية** في فاي تك بيغطي الـ 10 بنود الأساسية للشقة بصنايعية وفنيين معتمدين وتحت إشراف مهندس موقع 🛠️👷‍♂️:\n\n` +
        `⚡ **الكهرباء واللوحات:** تأسيس، علاج القفلات، وموازنة الأحمال.\n` +
        `🚰 **السباكة والعزل:** كشف تسريب بدون تكسير، خلاطات دفن، واختبار كبس 10 بار.\n` +
        `🎨 **الدهانات وعلاج الرطوبة:** تقشير وعلاج التمليح والنشع من الجذور ودهان جوتن.\n` +
        `🟫 **البورسلان والسيراميك والرخام:** تركيب بالليزر والكلبسات وعلاج التطبيل.\n` +
        `🛋️ **الجبس بورد والديكور:** أسقف معلقة، بديل خشب وبديل رخام، وبروفايل ليد.\n` +
        `❄️ **التكييفات (كونسيلد واسبليت):** تأسيس نحاس وصرف، صيانة، وشحن فريون.\n` +
        `📱 **السمارت هوم، التيار الخفيف، وحساسات الأمان.**\n\n` +
        `قولي أنهي بند فيهم اللي محتاجه دلوقتي وأنا أشرحلك تفاصيله بالتفصيل!`,
      quickReplies: [
        '🚰 عندي مشكلة سباكة أو تسريب مية',
        '⚡ عندي مشكلة كهرباء أو تأسيس',
        '❄️ تأسيس أو صيانة تكييف',
        '👨‍💼 حولني لمهندس الآن',
      ],
      actions: [{ label: '🛠️ افتح قسم التنفيذ والصيانة', href: '/store?tab=maintenance' }],
    };
  }

  // 9. Store Products & Trade Catalog ("بكام الخامات / عندكم سلك سويدي أو خلاطات جروهي؟")
  const matchedProductCat = findMatchingProductCategory(normMsg);
  const asksStoreOrProducts =
    Boolean(matchedProductCat) ||
    hasAny(normMsg, ['منتج', 'منتجات', 'اسعار المنتجات', 'كتالوج', 'متجر', 'ادوات', 'خامات', 'توريد', 'بكام', 'سعر']);

  if (asksStoreOrProducts) {
    const filtered = matchedProductCat
      ? products.filter((p) => p.category === matchedProductCat)
      : products;
    const catMeta = matchedProductCat
      ? PRODUCT_CATEGORIES.find((c) => c.id === matchedProductCat)
      : null;
    const topItems = filtered
      .slice(0, 4)
      .map((p) => {
        const priceLabel =
          p.price > 0
            ? `${p.price.toLocaleString('en-US')} ${p.currency} / ${p.unit}`
            : `التسعير حسب الكمية (${p.unit}) — ضيفه في السلة وهنبعتلك عرض سعر فوري`;
        return `• ${p.name} — **${priceLabel}**`;
      })
      .join('\n');

    return {
      shouldReply: true,
      senderName,
      intent: 'products_catalog',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `يا هلا بيك ${honorific}! في **${catMeta ? `قسم ${catMeta.title} ${catMeta.icon}` : 'متجر فاي تك الهندسي 🛒'}** بنوفرلك الخامات والأنظمة الأصلية المعتمدة بضمان الوكيل:\n` +
        `تقدر تطلب **توريد الخامات بس** لحد باب موقعك، أو تطلبها **شاملة التركيب الهندسي المعتمد** بمعرفتنا.\n\n` +
        (topItems ? `ودي عينة من البنود الموجودة في القسم ده:\n${topItems}` : ''),
      quickReplies: ['🛒 إزاي أطلب من المتجر والسلة؟', '🛠️ ممكن توريد بالتركيب؟', '👨‍💼 حولني لمهندس الآن'],
      actions: [
        {
          label: catMeta ? `تصفح قسم ${catMeta.shortTitle}` : '🛒 افتح المتجر الكامل',
          href: catMeta ? `/store?cat=${catMeta.id}` : '/store',
        },
      ],
    };
  }

  // 10. Real Estate Offers & Installments ("عندكم شقق متشطبة أو بالتقسيط؟")
  if (
    hasAny(normMsg, [
      'عقار',
      'عقارات',
      'شقه للبيع',
      'شقق',
      'وحدات',
      'فيلا للبيع',
      'دوبلكس',
      'محل تجاري',
      'عياده',
      'مقر اداري',
      'تقسيط',
      'بالتقسيط',
      'مقدم',
      'استلام فوري',
    ])
  ) {
    const availableProps = properties.filter((pr) => pr.status !== 'sold').slice(0, 3);
    const propLines = availableProps
      .map((pr) => {
        const pricePart = pr.price > 0 ? ` — ${pr.price.toLocaleString('en-US')} ${pr.currency}` : '';
        const payPart =
          pr.downPaymentPct !== undefined
            ? ` (بمقدم ${pr.downPaymentPct}%${pr.installmentYears ? ` وتقسيط مريح لحد ${pr.installmentYears} سنين` : ''})`
            : '';
        return `🏢 **${pr.title}** (${pr.areaSqm} م² — ${pr.city})${pricePart}${payPart}`;
      })
      .join('\n');

    return {
      shouldReply: true,
      senderName,
      intent: 'real_estate',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `أيوه طبعاً ${honorific}! 🏢 عندنا في **قسم الاستثمار العقاري بفاي تك** وحدات سكنية وإدارية وتجارية مختارة بعناية، ومتشطبة بأعلى مواصفة هندسية وتجهيز سمارت هوم:\n\n` +
        (propLines || 'متاح شقق، دوبلكس، فيلات، وعيادات ومقرات إدارية في مواقع مميزة بالقاهرة والمنصورة.') +
        `\n\nتقدر تتفرج على تفاصيل وصور كل وحدة وتحجز ميعاد معاينة على الطبيعة في الوقت اللي يناسبك.`,
      quickReplies: ['👨‍💼 حولني لمهندس العقارات الآن', '📍 عناوين الفروع ومواعيد الشغل'],
      actions: [{ label: '🏢 شوف كل عروض العقارات المتاحة', href: '/real-estate' }],
    };
  }

  // 11. Warranty, Engineering Supervision & Work Stages ("إيه الضمان اللي بتدوه؟")
  if (hasAny(normMsg, ['ضمان', 'اشراف', 'استلام', 'جوده', 'مراحل العمل', 'خطوات', 'التزام', 'bim', 'ايه اللي يضمن'])) {
    const compList = commitments
      .slice(0, 3)
      .map((cm) => `✅ **${cm.title}:** ${cm.text}`)
      .join('\n');
    return {
      shouldReply: true,
      senderName,
      intent: 'warranty_supervision',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `ده أهم سؤال تسأله قبل ما تبدأ مع أي شركة ${honorific}! 🛡️\n` +
        `إحنا في **فاي تك الهندسية** بنضمنلك حقك هندسياً وقانونياً في العقد:\n` +
        (compList ||
          '✅ **رسومات تنفيذية (Shop Drawings)** معتمدة قبل ما نبدأ عشان مفيش حاجة تتعمل بالتخمين.\n' +
            '✅ **إشراف هندسي واستلام بالأجهزة:** استلام المحارة والسيراميك بالليزر، وكبس السباكة بضغط 10 بار، واختبار الكهرباء بالميجر.\n' +
            '✅ **شفافية كاملة في الحسابات:** كل بند بيتسلم بمحضره ومستخلصه.') +
        `\n\n📌 وفوق ده كله بتاخد **ضمان هندسي موثق يوصل لـ 10 سنين** على التأسيسات والعزل والسمارت هوم، يعني إحنا معاك حتى بعد ما تسكن!`,
      quickReplies: ['💰 شقتي ع الطوب وعايز أعرف تكلفة التشطيب', '👨‍💼 حولني لمهندس الآن'],
    };
  }

  // 12. Cart, Account Registration & How to Order ("إزاي أطلب من السلة؟")
  if (hasAny(normMsg, ['سله', 'حساب', 'تسجيل دخول', 'ازاي اطلب', 'طريقه الطلب', 'حجز', 'طلب عرض سعر'])) {
    return {
      shouldReply: true,
      senderName,
      intent: 'cart_order_help',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `الطلب من متجر فاي تك سهل وبسيط جداً ${honorific} 🛒✨:\n` +
        `1️⃣ ادخل على **المتجر** أو تبويب **التنفيذ والصيانة** واختار البنود أو الخامات اللي محتاجها.\n` +
        `2️⃣ دوس **«أضف للسلة»**، وممكن كمان تعلم صح على خيار **«شامل التركيب الهندسي»** لو عايزنا نركبهولك.\n` +
        `3️⃣ دوس إرسال الطلب، هيطلعلك رقم مرجعي فوراً والمهندس هيكلمك يأكد معاك المقايسة وميعاد التوريد أو المعاينة.`,
      quickReplies: ['⚡ شوف منتجات الكهرباء والسباكة والسمارت', '👨‍💼 حولني لمهندس الآن'],
      actions: [{ label: '🛒 افتح المتجر الآن', href: '/store' }],
    };
  }

  // 13. Contact Info, Branches & Working Hours ("عنوانكم فين ورقمكم كام؟")
  if (hasAny(normMsg, ['عنوان', 'فرع', 'فروع', 'مكانكم', 'مواعيد', 'ساعات العمل', 'رقم', 'تليفون', 'واتس', 'تواصل', 'ايميل'])) {
    return {
      shouldReply: true,
      senderName,
      intent: 'contact_info',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `تنورنا في أي وقت ${honorific}! 📍 دي عناويننا وأرقام التواصل المباشرة في **فاي تك الهندسية**:\n` +
        `• **الفروع ونطاق العمل:** ${offices.join(' · ')}\n` +
        `• **العنوان:** ${contact.address}\n` +
        `• **رقم التليفون والواتساب الرسمي:** ${contact.phone}\n` +
        `• **مواعيد العمل:** ${contact.hours}\n` +
        (contact.email ? `• **الإيميل:** ${contact.email}` : ''),
      quickReplies: ['💰 شقتي ع الطوب وعايز أعرف تكلفة التشطيب', '👨‍💼 حولني لمهندس الآن'],
      actions: buildContactActions(siteContent),
    };
  }

  // 14. Greeting / Thanks (when already in active stage)
  if (
    hasAny(normMsg, [
      'سلام',
      'مرحبا',
      'اهلا',
      'صباح',
      'مساء',
      'ازيك',
      'عامل ايه',
      'اخبارك',
      'ارغب في الاستفسار',
      'شكرا',
      'متشكر',
      'تسلم',
      'تمام',
      'يعطيك العافيه',
      'الله ينور',
      'ربنا يباركلك',
    ]) &&
    normMsg.split(' ').length <= 12
  ) {
    return {
      shouldReply: true,
      senderName,
      intent: 'greeting',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `حبيبي ${honorific}، منورنا في فاي تك الهندسية والله! 👷‍♂️✨\n` +
        `أنا تحت أمرك في أي سؤال هندسي أو فني — قولي بتفكر في إيه وأنا معاك.`,
      quickReplies: DEFAULT_QUICK_MENU,
      actions: [
        { label: '🛒 المتجر والسمارت هوم', href: '/store' },
        { label: '🛠️ التنفيذ والصيانة', href: '/store?tab=maintenance' },
      ],
    };
  }

  // 15. Fallback / Bot Stuck -> Automatic Human Handover in natural Egyptian Colloquial
  return {
    shouldReply: true,
    senderName,
    intent: 'fallback_escalate',
    confidence: 'low',
    needsHuman: true,
    escalationReason: `سؤال خاص/معقد لم يتطابق مع السيناريوهات الآلية ويحتاج رد المهندس: "${questionText.slice(0, 110)}"`,
    replyText:
      `سؤالك ده تفصيلي ومهم جداً ${honorific} 🤝\n` +
      `وعشان ما أفتيش أو أديك معلومة عامة، النقطة دي محتاجة رأي المهندس المختص بنفسه عشان يحسبهالك صح على الطبيعة.\n\n` +
      `${chatBot.escalationText}`,
    quickReplies: DEFAULT_QUICK_MENU.slice(0, 4),
    actions: buildContactActions(siteContent),
  };
}

/**
 * الدالة الرئيسية للرد التفاعلي المرحلي بالعامية المصرية:
 * التدفق:
 * 1) العميل يسأل سؤاله الأول -> نرحب بيه بالعامية المصرية ونطلب اسمه الكريم للتشرف بمعرفته.
 * 2) العميل يكتب اسمه -> نرحب بيه باسمه، ونشرحله إجابة سؤاله بالتفصيل بالعامية المصرية الذكية، وبعدها نطلب رقم تليفونه جوه المحادثة.
 * 3) العميل يكتب رقم تليفونه -> نأكد تسجيل الرقم وإبلاغ المهندس المختص، وتكمل المحادثة التفاعلية.
 */
export function generateSmartAutoReply(params: {
  messageText: string;
  visitorName?: string;
  visitorPhone?: string;
  pageUrl?: string;
  requestHuman?: boolean;
  conversationStage?: ChatConversationStage;
  pendingQuestion?: string;
  previousMessages?: Array<{ sender: 'visitor' | 'admin'; text: string; intent?: string }>;
  siteContent?: AutoResponderSiteContent;
}): AutoReplyResult {
  const {
    messageText,
    visitorName = '',
    visitorPhone = '',
    requestHuman = false,
    conversationStage,
    pendingQuestion = '',
    previousMessages = [],
    siteContent,
  } = params;

  const chatBot: ChatBotConfig = {
    enabled: siteContent?.CHAT_BOT?.enabled ?? DEFAULT_CHAT_BOT_CONFIG.enabled,
    botName: siteContent?.CHAT_BOT?.botName || DEFAULT_CHAT_BOT_CONFIG.botName,
    welcomeText: siteContent?.CHAT_BOT?.welcomeText || DEFAULT_CHAT_BOT_CONFIG.welcomeText,
    escalationText: siteContent?.CHAT_BOT?.escalationText || DEFAULT_CHAT_BOT_CONFIG.escalationText,
    customRules:
      Array.isArray(siteContent?.CHAT_BOT?.customRules) && siteContent!.CHAT_BOT!.customRules!.length > 0
        ? siteContent!.CHAT_BOT!.customRules!
        : DEFAULT_CHAT_BOT_CONFIG.customRules,
  };

  const senderName = chatBot.botName;

  if (!chatBot.enabled && !requestHuman) {
    return {
      shouldReply: false,
      replyText: '',
      senderName,
      intent: 'disabled',
      confidence: 'high',
      needsHuman: false,
      quickReplies: [],
    };
  }

  const currentName = visitorName.trim();
  const currentPhone = visitorPhone.trim();
  const detectedPhoneInMsg = extractPhoneFromMessage(messageText);

  // If visitor explicitly clicked "تحويل لمهندس" at any stage, handle immediately
  if (requestHuman) {
    return buildTopicExplanation({
      questionText: messageText,
      visitorName: currentName,
      visitorPhone: currentPhone || detectedPhoneInMsg || '',
      requestHuman: true,
      previousMessages,
      siteContent,
      chatBot,
    });
  }

  // Determine effective stage if not explicitly passed:
  const effectiveStage: ChatConversationStage =
    conversationStage ||
    (currentName && currentPhone
      ? 'active'
      : currentName
        ? 'awaiting_phone'
        : previousMessages.some((m) => m.sender === 'visitor')
          ? 'awaiting_name'
          : 'ask_question');

  // =========================================================================
  // STAGE 1: Visitor just sent their FIRST message (Question first -> Ask Name)
  // =========================================================================
  if (effectiveStage === 'ask_question' && !currentName) {
    const greetingOnly = isSimpleGreeting(messageText);
    return {
      shouldReply: true,
      senderName,
      intent: 'ask_for_name',
      confidence: 'high',
      needsHuman: false,
      nextStage: 'awaiting_name',
      pendingQuestion: greetingOnly ? '' : messageText,
      quickReplies: [], // No options before getting acquainted!
      replyText: greetingOnly
        ? `وعليكم السلام ورحمة الله وبركاته، أهلاً بيك ومنورنا في فاي تك الهندسية 👷‍♂️✨\n\nنتشرف باسم حضرتك الكريم الأول؟`
        : `أهلاً بيك ومنورنا في فاي تك الهندسية 👷‍♂️✨\nسؤالك في الجون، ومن عنيا هشرحلك كل تفصيلة هندسية حالاً.. بس نتشرف باسم حضرتك الكريم الأول؟`,
    };
  }

  // =========================================================================
  // STAGE 2: We asked for Visitor's Name -> Visitor replies with Name
  //          -> Greet by Name + Explain Question in detail + Ask for Phone!
  // =========================================================================
  if (effectiveStage === 'awaiting_name' && !currentName) {
    const { name: parsedName, additionalQuestion } = extractNameFromMessage(messageText);

    if (parsedName) {
      const questionToExplain = additionalQuestion || pendingQuestion;

      // If visitor had only said "السلام عليكم" in Turn 1 and only said "أحمد" in Turn 2 (no question yet):
      if (!questionToExplain || isSimpleGreeting(questionToExplain)) {
        return {
          shouldReply: true,
          senderName,
          intent: 'name_captured_ask_question',
          confidence: 'high',
          needsHuman: false,
          extractedName: parsedName,
          nextStage: 'awaiting_phone',
          pendingQuestion: '',
          quickReplies: [],
          replyText:
            `منورنا يا أستاذ ${parsedName} 🌟 تشرفنا بمعرفتك والله!\n\n` +
            `قولي بقى يا هندسة، إيه السؤال أو البند اللي شاغل بالك في الشقة أو التشطيب أو السمارت هوم عشان أشرحهولك بالتفصيل؟`,
        };
      }

      // Explain their question in full detail now!
      const explanation = buildTopicExplanation({
        questionText: questionToExplain,
        visitorName: parsedName,
        visitorPhone: detectedPhoneInMsg || '',
        previousMessages,
        siteContent,
        chatBot,
      });

      const resolvedPhone = detectedPhoneInMsg || '';
      const askPhoneFooter = resolvedPhone
        ? `\n\n✅ وكمان سجلت رقم تليفونك (${resolvedPhone}) عشان المهندس المختص يتابع معاك بنفسه.`
        : `\n\n━━━━━━━━━━━━━━━━━━━━\n📱 تشرفنا بيك يا أستاذ ${parsedName}.. ممكن تسيبلنا **رقم تليفونك (أو الواتساب)** هنا في الشات عشان المهندس المختص يبعتلك المقايسة أو الكتالوج التفصيلي ويتابع معاك؟`;

      return {
        ...explanation,
        extractedName: parsedName,
        extractedPhone: resolvedPhone || undefined,
        nextStage: resolvedPhone ? 'active' : 'awaiting_phone',
        pendingQuestion: '',
        quickReplies: resolvedPhone ? explanation.quickReplies : [],
        replyText:
          `منورنا يا أستاذ ${parsedName} 🌟 تشرفنا بحضرتك!\n` +
          `بص يا سيدي، دي الخلاصة الهندسية بخصوص سؤالك:\n\n` +
          `${explanation.replyText}` +
          askPhoneFooter,
      };
    }

    // Visitor typed another question instead of their name — explain it AND politely ask for name & phone
    const combinedQuestion = pendingQuestion ? `${pendingQuestion} — ${messageText}` : messageText;
    const explanation = buildTopicExplanation({
      questionText: combinedQuestion,
      visitorName: '',
      visitorPhone: detectedPhoneInMsg || '',
      previousMessages,
      siteContent,
      chatBot,
    });

    return {
      ...explanation,
      extractedPhone: detectedPhoneInMsg || undefined,
      nextStage: 'awaiting_name',
      pendingQuestion: '',
      quickReplies: [],
      replyText:
        `من عنيا يا فندم، دي التفاصيل الهندسية بخصوص سؤالك 👇\n\n` +
        `${explanation.replyText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n🤝 ونتشرف إنك تكتبلنا **اسم حضرتك الكريم ورقم تليفونك** هنا في الشات عشان نسجل طلبك باسمك ويتابع معاك المهندس المختص.`,
    };
  }

  // =========================================================================
  // STAGE 3: We explained the question & asked for Phone Number
  //          -> Visitor provides Phone Number (or asks a follow-up question)
  // =========================================================================
  if (effectiveStage === 'awaiting_phone' && !currentPhone) {
    if (detectedPhoneInMsg) {
      const textWithoutPhone = toEnglishDigits(messageText)
        .replace(/(?:\+?\d[\d\s()-]{7,16}\d)/g, '')
        .replace(/^(?:ده|هذا)?\s*(?:رقمي|رقم التليفون|رقم الجوال|تليفوني|جوالي|واتس|واتساب)[\s:،-]*/i, '')
        .trim();

      if (textWithoutPhone.length > 5 && !isSimpleGreeting(textWithoutPhone)) {
        const followUp = buildTopicExplanation({
          questionText: textWithoutPhone,
          visitorName: currentName,
          visitorPhone: detectedPhoneInMsg,
          previousMessages,
          siteContent,
          chatBot,
        });
        return {
          ...followUp,
          extractedPhone: detectedPhoneInMsg,
          nextStage: 'active',
          needsHuman: true,
          escalationReason:
            followUp.escalationReason ||
            `اكتمال بيانات العميل (${currentName} — ${detectedPhoneInMsg}) ومتابعة الاستفسار`,
          replyText:
            `تسلم يا أستاذ ${currentName} 🙏 سجلت رقم تليفونك (${detectedPhoneInMsg}) وبلغت المهندس المختص فوراً.\n\n` +
            `وبالنسبة لسؤالك التاني:\n${followUp.replyText}`,
        };
      }

      return {
        shouldReply: true,
        senderName,
        intent: 'phone_captured_complete',
        confidence: 'high',
        needsHuman: true,
        escalationReason: `عميل جديد أتم التعارف وسجل رقم جواله (${currentName} — ${detectedPhoneInMsg})`,
        extractedPhone: detectedPhoneInMsg,
        nextStage: 'active',
        quickReplies: DEFAULT_QUICK_MENU,
        actions: buildContactActions(siteContent),
        replyText:
          `تسلم يا أستاذ ${currentName}، نورتنا والله! 🙏✨\n` +
          `تم تسجيل رقمك (${detectedPhoneInMsg}) بنجاح، وبعتنا ملف استفسارك للمهندس المختص وهيتواصل معاك في أقرب وقت.\n\n` +
          `لو في بالك أي سؤال تاني اكتبهولي هنا براحتك، أو اختار من المواضيع دي:`,
      };
    }

    // Visitor asked a question instead of typing a phone number -> Explain it & gently ask for phone
    const explanation = buildTopicExplanation({
      questionText: messageText,
      visitorName: currentName,
      visitorPhone: '',
      previousMessages,
      siteContent,
      chatBot,
    });

    return {
      ...explanation,
      nextStage: 'awaiting_phone',
      quickReplies: [],
      replyText:
        `${explanation.replyText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n📱 يا أستاذ ${currentName}، متنساش تسيبلنا **رقم تليفونك (أو الواتساب)** هنا في الشات عشان المهندس المختص يقدر يبعتلك المقايسة والكتالوج ويتابع معاك.`,
    };
  }

  // =========================================================================
  // STAGE 4: Active Conversation (Name & Phone already known)
  // =========================================================================
  const activeExplanation = buildTopicExplanation({
    questionText: messageText,
    visitorName: currentName,
    visitorPhone: currentPhone || detectedPhoneInMsg || '',
    requestHuman,
    previousMessages,
    siteContent,
    chatBot,
  });

  return {
    ...activeExplanation,
    extractedPhone: !currentPhone && detectedPhoneInMsg ? detectedPhoneInMsg : undefined,
    nextStage: 'active',
  };
}

/**
 * تعزيز الرد بالذكاء الاصطناعي التوليدي (Gemini) باللهجة العامية المصرية عند توفر GEMINI_API_KEY
 * مع الحفاظ الكامل على قواعد التدفق المرحلي، عدم اختلاق أي أسعار، والرجوع الفوري للرد الهندسي المدمج عند عدم توفر المفتاح.
 */
export async function generateEgyptianColloquialAiReply(params: {
  messageText: string;
  visitorName?: string;
  visitorPhone?: string;
  pageUrl?: string;
  requestHuman?: boolean;
  conversationStage?: ChatConversationStage;
  pendingQuestion?: string;
  previousMessages?: Array<{ sender: 'visitor' | 'admin'; text: string; intent?: string }>;
  siteContent?: AutoResponderSiteContent;
}): Promise<AutoReplyResult> {
  const baseResult = generateSmartAutoReply(params);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !baseResult.shouldReply) {
    return baseResult;
  }

  // Stage transition turns that only ask for name or confirm phone are already optimal & fast
  if (
    baseResult.intent === 'ask_for_name' ||
    baseResult.intent === 'name_captured_ask_question' ||
    baseResult.intent === 'phone_captured_complete' ||
    baseResult.intent === 'human_handoff' ||
    baseResult.intent === 'disabled'
  ) {
    return baseResult;
  }

  const effectiveName = baseResult.extractedName || params.visitorName || '';
  const effectivePhone = baseResult.extractedPhone || params.visitorPhone || '';
  const questionAnalyzed = params.pendingQuestion || params.messageText;
  const needsPhoneAsk = baseResult.nextStage === 'awaiting_phone' && !effectivePhone;

  const recentTranscript = (params.previousMessages || [])
    .slice(-6)
    .map((m) => `${m.sender === 'visitor' ? 'العميل' : 'المستشار الهندسي'}: ${m.text}`)
    .join('\n');

  const systemInstruction = [
    'أنت "المستشار الهندسي الذكي" لشركة فاي تك (Phi Tech) للمقاولات والتشطيبات والأنظمة الذكية (Smart Home & Low Current) في مصر.',
    'تحدث باللهجة العامية المصرية الطبيعية جداً والاحترافية والودودة (مثل مهندس استشاري مصري خبير وفاهم شغله كويس: "بص يا فندم"، "منورنا يا أستاذ..."، "خليني أجيبلك الخلاصة الهندسية"، "من غير تكسير ولا بهدلة").',
    'قواعد صارمة لا يمكن مخالفتها:',
    '1. اعتمد حصرياً على الحقائق الهندسية الموجودة في "الرد المرجعي المعتمد" أدناه ولا تخترع أي أسعار أو أرقام غير مذكورة فيه.',
    '2. إذا كان العميل قد عرّف نفسه باسمه، نادِه باسمه بود واحترام (يا أستاذ ...).',
    needsPhoneAsk
      ? '3. اختم ردك 반드시 بطلب رقم التليفون أو الواتساب داخل الشات بلطف حتى يرسل له المهندس المختص المقايسة أو الكتالوج.'
      : '3. لا تطلب الاسم أو رقم التليفون إذا كان مسجلاً بالفعل.',
    baseResult.needsHuman
      ? '4. أبلغ العميل بوضوح أنه تم تحويل المحادثة وإرسال إشعار للمهندس المختص ليتابع معه خلال دقائق.'
      : '4. قدم إجابة هندسية شافية وواضحة في نقاط منظمة وسهلة القراءة.',
  ].join('\n');

  const userPrompt = [
    recentTranscript ? `سياق المحادثة السابقة:\n${recentTranscript}\n` : '',
    `اسم العميل الحالي: ${effectiveName || 'غير معروف بعد'}`,
    `سؤال العميل: "${questionAnalyzed}"`,
    `الرد المرجعي المعتمد من قاعدة بيانات فاي تك:\n${baseResult.replyText}`,
    '\nأعد صياغة الرد المرجعي أعلاه بأسلوب ذكاء اصطناعي مصري طبيعي وجذاب ومقنع (بين 4 إلى 9 أسطر منظمة) مع الحفاظ على جميع المعلومات الفنية وطلب الرقم أو التحويل للمهندس إن وُجد في الرد المرجعي.',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4200);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 550,
          },
        }),
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return baseResult;
    const data = await res.json();
    const aiText = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (aiText.length >= 40) {
      return {
        ...baseResult,
        replyText: aiText,
      };
    }
    return baseResult;
  } catch {
    clearTimeout(timeout);
    return baseResult;
  }
}
