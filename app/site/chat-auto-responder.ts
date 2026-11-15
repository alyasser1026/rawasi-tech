/**
 * chat-auto-responder.ts — محرك المحادثة الهندسية التفاعلية متعددة المراحل مع التحويل التلقائي للمهندس
 *
 * تدفق المحادثة الاحترافي:
 * 1. العميل يطرح سؤاله مباشرة بدون فورم معقد وبلا قوائم خيارات مسبقة.
 * 2. البوت يرحب به باحترافية ويستأذنه في التعرف على اسمه الكريم أولاً.
 * 3. بعد كتابة الاسم، يرحب البوت بالعميل باسمه ويشرح له إجابة سؤاله الهندسي بالتفصيل، ثم يطلب رقم جواله داخل المحادثة للمتابعة.
 * 4. بعد كتابة رقم الجوال، يحفظه النظام ويخطر المهندس المختص فوراً، وتستمر المحادثة التفاعلية أو يتم التحويل المباشر للمهندس عند الحاجة.
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
  botName: '🤖 المستشار الهندسي — فاي تك',
  welcomeText:
    'أهلاً بحضرتك في شركة فاي تك للمقاولات والتشطيبات والأنظمة الذكية 👷‍♂️✨ تفضل بطرح سؤالك أو استفسارك مباشرةً وسأكون سعيداً بمساعدتك.',
  escalationText:
    'تم تحويل محادثتك الآن مباشرة إلى المهندس المختص 👨‍💻🔔 وإرسال إشعار فوري بتفاصيل استفسارك ليتابع معك هنا أو عبر الواتساب خلال دقائق.',
  customRules: [
    {
      id: 'rule-contracts',
      title: 'نظام التعاقد والدفعات والمستخلصات',
      keywords: 'نظام الدفعات, دفعات, تعاقد, عقد, مستخلص, مستخلصات, نسبه الاشراف, طرق الدفع',
      reply:
        'في شركة فاي تك نعمل بنظام تعاقد شفاف ومقايسة مفتوحة البنود (Open Book) أو دفعات مرحلية مرتبطة بالاستلام الفعلي على الموقع:\n• دفعة تعاقد وتجهيز المخططات التنفيذية (Shop Drawings)\n• دفعات مرحلية تُصرف فقط بعد استلام كل بند هندسياً (تأسيس ثم تشطيب)\n• تقارير ومستخلصات رقمية واضحة لمتابعة كل بند بدقة.',
      quickReplies: ['💰 أسعار التشطيب والمقايسة للمتر', '👨‍💼 تحويل لمهندس الآن'],
    },
    {
      id: 'rule-survey',
      title: 'آلية المعاينة والرفع المساحي بالليزر',
      keywords: 'معاينه, رفع مساحي, شوب درونج, مخططات تنفيذيه, هندسي بالليزر, هتيجو امتى',
      reply:
        'تبدأ كل مشاريع فاي تك بزيارة معاينة ورفع مساحي دقيق بالليزر (Laser Survey) لتحديد حالة المبنى، وتنسيق مسارات الكهرباء والسباكة والتكييف المخفي (Shop Drawings) قبل البدء لتفادي أي تكسير أو هالك في الخامات.',
      quickReplies: ['شقة 150 متر على الطوب', 'فيلا / دوبلكس للمعاينة', '👨‍💼 تحويل لمهندس الآن'],
    },
    {
      id: 'rule-locations',
      title: 'المحافظات ونطاق التغطية والشحن',
      keywords: 'محافظات, شحن, توصيل خارج, اسكندريه, الدلتا, الجيزه, اكتوبر, التجمع, العاصمه, زايد, المنصوره',
      reply:
        'تغطي فاي تك أعمال التنفيذ والتشطيب والصيانة الهندسية في:\n📍 القاهرة الكبرى (التجمع، مدينة نصر، المعادي، الشيخ زايد، 6 أكتوبر، العاصمة الإدارية)\n📍 المنصورة ومحافظات الدلتا\n📍 كما يتاح توريد وشحن جميع منتجات المتجر والسمارت هوم وحساسات الأمان لجميع المحافظات.',
      quickReplies: ['طلب معاينة ومقايسة', '🛒 فتح المتجر وإضافة للسلة', '👨‍💼 تحويل لمهندس الآن'],
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
  'سعر',
  'اسعار',
  'عايز',
  'عاوز',
  'محتاج',
  'اريد',
  'استفسار',
  'تشطيب',
  'سباكه',
  'كهرباء',
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
    'هاي',
    'الو',
    'هلا',
    'يا هندسه',
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
  const parts = cleaned.split(/[،,\n-]|(?:\s+وكنت\s+)|(?:\s+وعايز\s+)|(?:\s+ومحتاج\s+)|(?:\s+وبسأل\s+)/);
  let candidate = (parts[0] || '').trim();
  const rest = parts.slice(1).join(' ').trim();

  // Strip greetings and name prefixes
  candidate = candidate
    .replace(/^(?:السلام عليكم|وعليكم السلام|اهلا بك|اهلا|مرحبا|صباح الخير|مساء الخير|تشرفنا|مع حضرتك|انا اسمي|اسمي|انا|معاك|معك|اخوك|الاسم|المهندس|مهندس|استاذ|الاستاذ|دكتور|الدكتور|الحاج)+[\s:،-]*/gi, '')
    .replace(/^(?:انا اسمي|اسمي|انا|معاك|معك|الاسم|استاذ|مهندس)+[\s:،-]*/gi, '')
    .trim();

  const normCand = normalizeArabic(candidate);
  if (!normCand) return { name: null };

  const words = candidate.split(/\s+/).filter(Boolean);
  // If candidate has digits or looks like a pure technical question without a name
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
  '💰 أسعار التشطيب والمقايسة للمتر',
  '⚡ أسعار منتجات الكهرباء والسباكة والسمارت هوم',
  '🛠️ طلب تنفيذ أو صيانة (كهرباء/سباكة/تكييف)',
  '🚨 منظومة حساسات الغاز والمياه والحريق',
  '🏢 عروض الشقق والوحدات العقارية والتقسيط',
  '👨‍💼 تحويل لمهندس الآن',
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
      label: '🛒 تصفح المتجر والأسعار',
      href: '/store',
    },
  ];
}

function findMatchingMaintenanceService(
  normMsg: string,
  services: WebsiteMaintenanceService[]
): WebsiteMaintenanceService | null {
  const tradeMatchers: Array<{ category: WebsiteMaintenanceService['category']; keywords: string[] }> = [
    { category: 'hvac', keywords: ['تكييف', 'تكيف', 'كونسيلد', 'اسبليت', 'فريون', 'دكت', 'كمبريسور', 'hvac'] },
    { category: 'electrical', keywords: ['كهرباء', 'كهربا', 'كهربائي', 'قواطع', 'لوحه توزيع', 'افياش', 'قفله', 'ميجر'] },
    { category: 'plumbing', keywords: ['سباكه', 'سباك', 'تسريب مياه', 'تسرب مياه', 'صرف', 'خلاط', 'طرد', 'ضغط هيدروليكي', 'مواسير'] },
    { category: 'paint', keywords: ['دهان', 'دهانات', 'نقاشه', 'نقاش', 'رطوبه', 'عزل', 'معجون', 'تقشر'] },
    { category: 'ceramics', keywords: ['سيراميك', 'بورسلان', 'بورسلين', 'بلاط', 'مبلط', 'ليزر', 'كلبسات'] },
    { category: 'marble', keywords: ['رخام', 'جرانيت', 'جلي', 'تلميع', 'درج', 'احجار'] },
    { category: 'decor', keywords: ['جبس', 'جبس بورد', 'ديكور', 'ديكورات', 'بديل خشب', 'بديل رخام', 'تجليد'] },
    { category: 'smart_home', keywords: ['سمارت', 'تحكم عن بعد', 'زيجبي', 'قفل ذكي', 'مفتاح ذكي', 'ستائر'] },
    { category: 'low_current', keywords: ['تيار خفيف', 'كاميرات', 'انتركم', 'شبكات', 'واي فاي', 'فايبر', 'صوتيات'] },
    { category: 'safety_sensors', keywords: ['حساس', 'غاز', 'حريق', 'دخان', 'انذار', 'محبس تلقائي'] },
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
 * محرك الإجابة الهندسية الموضوعية (يُستدعى لشرح السؤال بالتفصيل بعد معرفة الاسم أو أثناء المحادثة)
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

  const displayVisitor = visitorName || 'الكريم';
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

  // 1. Direct Human Handoff Request
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
        `${chatBot.escalationText}\n\n` +
        (visitorName ? `👤 العميل: أستاذ ${visitorName}\n` : '') +
        (visitorPhone
          ? `📱 الرقم المسجل: ${visitorPhone}`
          : `📱 فضلاً اكتب رقم جوالك هنا في المحادثة ليتواصل معك المهندس المختص فوراً.`),
      quickReplies: ['📍 عناوين الفروع ومواعيد العمل', '🛒 فتح المتجر والأسعار'],
      actions: buildContactActions(siteContent),
    };
  }

  // 2. Finishing Quote & Price per Meter Scenario (Checked BEFORE generic lead_qualified so "تشطيب شقة 150 متر" gets a full explanation!)
  const asksFinishing = hasAny(normMsg, [
    'تشطيب',
    'تشطيبات',
    'مقايسه',
    'سعر المتر',
    'تكلفه تشطيب',
    'باقات التشطيب',
    'مقاولات',
    'سوبر لوكس',
    'الترا لوكس',
    'تسليم مفتاح',
    'بناء',
    'خرسانه',
  ]);
  const hasArea = /\b\d{2,4}\s*(متر|م2|م²|m2|م)\b/.test(normMsg);
  const hasLocationOrCondition = hasAny(normMsg, [
    'طوب احمر',
    'علي الطوب',
    'نصف تشطيب',
    'على المحاره',
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
    'بكره',
    'غدا',
    'النهارده',
  ]);

  if (asksFinishing) {
    const qualifiedWithDetails = hasArea || hasLocationOrCondition;
    const baseReply =
      `بخصوص أعمال **التشطيبات المعمارية والمقاولات** في شركة فاي تك 🏗️:\n` +
      `نحن نعمل بمنهجية هندسية متكاملة تضمن لك أعلى جودة دون أي هالك أو مفاجآت مالية:\n` +
      `1️⃣ **معاينة ورفع مساحي بالليزر (Laser Survey):** لفحص حالة المبنى واستلام المحاور.\n` +
      `2️⃣ **مخططات تنفيذية (Shop Drawings 2D/3D):** لتنسيق مسارات الكهرباء والسباكة والتكييف المخفي والسمارت هوم على الورق قبل أول يوم عمل.\n` +
      `3️⃣ **مقايسة هندسية مفتوحة البنود (Open Book):** تسعير دقيق لكل بند حسب حالة الوحدة (طوب أحمر أم نصف تشطيب) ونوع الخامات المعتمدة.\n` +
      `4️⃣ **إشراف هندسي وضمان موثق:** استلام بالليزر وضغط هيدروليكي 10 بار للسباكة مع ضمان 10 سنوات على التأسيسات.`;

    if (qualifiedWithDetails) {
      return {
        shouldReply: true,
        senderName,
        intent: 'lead_qualified',
        confidence: 'high',
        needsHuman: true,
        escalationReason: `عميل تشطيبات شارك تفاصيل وحدته: "${questionText.slice(0, 100)}"`,
        replyText: `${baseReply}\n\n✅ تم تسجيل تفاصيل وحدتك («${questionText}») لإعداد المقايسة التقديرية.`,
        quickReplies: [
          '🛡️ الضمان الهندسي ومراحل الاستلام',
          '⚡ باقات السمارت هوم المتكاملة',
          '👨‍💼 تحويل لمهندس الآن',
        ],
        actions: [{ label: '🛠️ استعراض بنود التنفيذ والتأسيس', href: '/store?tab=maintenance' }],
      };
    }

    return {
      shouldReply: true,
      senderName,
      intent: 'finishing_quote',
      confidence: 'high',
      needsHuman: false,
      replyText: `${baseReply}\n\n💡 يمكنك أيضاً ذكر المساحة التقريبية والمنطقة وحالة الوحدة (طوب أحمر / نصف تشطيب) لتجهيز المقايسة المناسبة لك.`,
      quickReplies: [
        '🛡️ الضمان الهندسي ومراحل الاستلام',
        '⚡ باقات السمارت هوم المتكاملة',
        '👨‍💼 تحويل لمهندس الآن',
      ],
      actions: [{ label: '🛠️ استعراض بنود التنفيذ والتأسيس', href: '/store?tab=maintenance' }],
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
        `ممتاز جداً يا أستاذ ${displayVisitor} 👍 تم تسجيل بيانات ومواصفات وحدتك:\n` +
        `📝 «${questionText}»\n\n` +
        `في فاي تك نبدأ بعمل رفع مساحي بالليزر وإعداد مخططات (Shop Drawings) لتوزيع الفرش والكهرباء والسباكة والتكييف المخفي قبل التنفيذ، ثم تقديم مقايسة كميات تفصيلية واضحة لكل بند.\n` +
        `✅ تم إشعار المهندس المختص بتفاصيل وحدتك لترتيب المعاينة والمقايسة.`,
      quickReplies: ['🛡️ الضمان الهندسي ومراحل الاستلام', '📍 عناوين الفروع ومواعيد العمل'],
      actions: [
        { label: `💬 متابعة فورية عبر واتساب`, href: `https://wa.me/${cleanWa}`, external: true },
        { label: '🛠️ تصفح خدمات التنفيذ والصيانة', href: '/store?tab=maintenance' },
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
            : ['👨‍💼 تحويل لمهندس الآن', '💰 أسعار التشطيب والمقايسة للمتر'],
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
        replyText: `📌 ${faq.q}\n\n${faq.a}`,
        quickReplies: ['👨‍💼 تحويل لمهندس الآن', '💰 أسعار التشطيب والمقايسة للمتر'],
      };
    }
  }

  // 6. Safety Sensors (Gas, Fire, Water Leak + Auto Shutoff)
  if (hasAny(normMsg, ['حساس', 'حساسات', 'حريق', 'دخان', 'غاز', 'تسرب', 'تسريب', 'انذار', 'محبس تلقائي', 'محبس غاز'])) {
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
        `🚨 **منظومة الأمان والحساسات الذكية من فاي تك** توفر حماية استباقية 24/7 للمنزل والمقر الإداري:\n` +
        `• **حساس الغاز الذكي + محبس الفصل الأوتوماتيكي:** يغلق خط الغاز ميكانيكياً خلال ثوانٍ فور استشعار أي تسرب ويرسل تنبيهاً للجوال.\n` +
        `• **حساس تسرب المياه الأرضي:** يوضع أسفل الأحواض والغسالات ويغلق المحبس الرئيسي تلقائياً لمنع غرق الأرضيات.\n` +
        `• **حساس الدخان والحرارة الذكي:** يعمل بصافرة إنذار مبكر مع تنبيه فوري على تطبيق الهاتف.\n\n` +
        `💡 *توصية فاي تك الهندسية:* يُركب حساس الغاز الطبيعي (الميثان الأخف من الهواء) أعلى الجدار على بُعد 30 سم من السقف، بينما يُركب حساس غاز الأنبوبة (LPG) أسفل الجدار على ارتفاع 30 سم من الأرض.\n\n` +
        (listText ? `أبرز القطع المتوفرة بالمتجر:\n${listText}` : ''),
      quickReplies: ['🛠️ طلب تركيب وصيانة الحساسات', '⚡ باقات السمارت هوم المتكاملة', '👨‍💼 تحويل لمهندس الآن'],
      actions: [
        { label: '🚨 فتح قسم حساسات الأمان', href: '/store?cat=safety_sensors' },
        { label: '🛠️ حجز تركيب وصيانة', href: '/store?tab=maintenance' },
      ],
    };
  }

  // 7. Smart Home & Low Current Systems
  if (
    hasAny(normMsg, [
      'سمارت',
      'smart',
      'تحكم عن بعد',
      'زيجبي',
      'zigbee',
      'اليكسا',
      'جوجل هوم',
      'قفل ذكي',
      'بصمه',
      'ستائر',
      'تيار خفيف',
      'كاميرات',
      'انتركم',
      'شبكات',
      'فايبر',
      'ساوند',
      'اكسس بوينت',
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
        `📱 **أنظمة السمارت هوم والتيار الخفيف في فاي تك** مصممة للعمل سواء في مرحلة التأسيس أو في الوحدات المتشطبة **بدون أي تكسير**:\n` +
        `✅ تحكم كامل عن بُعد في الإضاءة، التكييفات، السخانات، والشتر والستائر عبر الجوال والأوامر الصوتية.\n` +
        `✅ أقفال ذكية بالبصمة والكارت والرقم السري المؤقت.\n` +
        `✅ شبكات تيار خفيف متكاملة (كاميرات مراقبة IP بدقة 4K، إنتركم ذكي، نقاط Wi-Fi 6 سقفية، وأنظمة صوتيات).\n` +
        `🎁 تتوفر **${SMART_BUNDLES.length} باقات ذكية متكاملة** داخل المتجر.\n\n` +
        (listText ? `أبرز المنتجات:\n${listText}\n\n` : '') +
        `💡 *توصية هندسية:* احرص دائماً على تمديد سلك Neutral داخل علب المفاتيح وفصل مسارات التيار الخفيف عن الكهرباء القوية بمسافة 20 سم.`,
      quickReplies: ['🚨 منظومة حساسات الغاز والمياه والحريق', '🛠️ حجز تأسيس تيار خفيف', '👨‍💼 تحويل لمهندس الآن'],
      actions: [
        { label: '📱 فتح قسم السمارت هوم', href: '/store?cat=smart_home' },
        { label: '📡 قسم التيار الخفيف والشبكات', href: '/store?cat=low_current' },
      ],
    };
  }

  // 8. Execution & Maintenance Services (Specific or General across 10 trades + HVAC)
  const matchedMnt = findMatchingMaintenanceService(normMsg, maintenanceServices);
  const asksMaintenanceOrExec = hasAny(normMsg, [
    'صيانه',
    'تنفيذ',
    'تاسيس',
    'اصلاح',
    'عطل',
    'فني',
    'كشف تسريب',
    'سباك',
    'كهربائي',
    'ترميم',
    'تكييف',
    'كونسيلد',
    'اسبليت',
    'فريون',
    'دكت',
    'ضغط هيدروليكي',
  ]);

  if (asksMaintenanceOrExec) {
    if (matchedMnt) {
      const feeText =
        matchedMnt.visitFee > 0
          ? `${matchedMnt.visitFee.toLocaleString('en-US')} ${matchedMnt.currency}`
          : 'المعاينة والتسعير حسب البند (بدون سعر مسبق)';

      return {
        shouldReply: true,
        senderName,
        intent: 'maintenance_execution',
        confidence: 'high',
        needsHuman: false,
        replyText:
          `${matchedMnt.icon} **${matchedMnt.title}** (${matchedMnt.code})\n\n` +
          `🏗️ **نطاق التنفيذ والتأسيس:**\n• ${matchedMnt.executionScope.slice(0, 3).join('\n• ')}\n\n` +
          `🔧 **نطاق الصيانة ومعالجة الأعطال:**\n• ${matchedMnt.maintenanceScope.slice(0, 3).join('\n• ')}\n\n` +
          `💡 ${matchedMnt.recommendation}\n\n` +
          `🛡️ الضمان: ${matchedMnt.warrantyLabel} | 💰 الرسوم: ${feeText}`,
        quickReplies: ['💰 أسعار التشطيب والمقايسة للمتر', '👨‍💼 تحويل لمهندس الآن'],
        actions: [{ label: '🛠️ احجز خدمة التنفيذ والصيانة الآن', href: '/store?tab=maintenance' }],
      };
    }

    return {
      shouldReply: true,
      senderName,
      intent: 'maintenance_execution',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `🛠️ قسم **التنفيذ والصيانة الشاملة** في فاي تك يغطي 10 قطاعات هندسية بإشراف مهندسين وفنيين معتمدين:\n` +
        `⚡ الكهرباء واللوحات • 🚰 السباكة وكشف التسريبات • 🎨 الدهانات والعزل المائي\n` +
        `🟫 البورسلان والسيراميك • 🪨 الرخام والجرانيت • 🛋️ الجبس بورد والديكور\n` +
        `📱 السمارت هوم • 📡 التيار الخفيف • 🚨 حساسات الأمان • ❄️ التكييف المخفي والاسبليت\n\n` +
        `جميع الأعمال تُسلّم وفق أصول الصناعة (استلام ليزر، اختبار ضغط 10 بار، وفحص حراري للكهرباء) مع ضمان معتمد.`,
      quickReplies: ['صيانة وإصلاح سباكة وكشف تسريب', 'تأسيس وصيانة تكييف مخفي', '👨‍💼 تحويل لمهندس الآن'],
      actions: [{ label: '🛠️ فتح تبويب التنفيذ والصيانة', href: '/store?tab=maintenance' }],
    };
  }

  // 9. Store Products & Trade Catalog
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
            : `السعر حسب الكمية (${p.unit}) — أضف للسلة لطلب عرض سعر`;
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
        `${catMeta ? `${catMeta.icon} **${catMeta.title}**` : '🛒 **متجر فاي تك للتشطيبات والأنظمة الذكية**'}\n` +
        `يضم المتجر ${products.length} منتجاً معتمداً في ${PRODUCT_CATEGORIES.length} أقسام هندسية، مع إمكانية طلب **التوريد فقط** أو **التوريد شامل التركيب الهندسي المعتمد**.\n\n` +
        (topItems ? `أبرز البنود المتوفرة:\n${topItems}` : ''),
      quickReplies: ['🛒 طريقة الطلب واستخدام السلة', '🛠️ هل يتوفر تركيب وصيانة؟', '👨‍💼 تحويل لمهندس الآن'],
      actions: [
        {
          label: catMeta ? `تصفح قسم ${catMeta.shortTitle}` : '🛒 فتح متجر المنتجات الكامل',
          href: catMeta ? `/store?cat=${catMeta.id}` : '/store',
        },
      ],
    };
  }

  // 10. Real Estate Offers & Installments
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
            ? ` (مقدم ${pr.downPaymentPct}%${pr.installmentYears ? ` وتقسيط حتى ${pr.installmentYears} سنوات` : ''})`
            : '';
        return `🏢 ${pr.title} (${pr.areaSqm} م² — ${pr.city})${pricePart}${payPart}`;
      })
      .join('\n');

    return {
      shouldReply: true,
      senderName,
      intent: 'real_estate',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `🏢 **عروض العقارات والوحدات المتاحة في فاي تك** (تشطيبات هندسية فاخرة وتجهيز سمارت هوم):\n\n` +
        (propLines || 'تتوفر شقق، دوبلكس، فيلات، ومقرات إدارية وتجارية بمواقع متميزة في القاهرة والمنصورة.') +
        `\n\nيمكنك استعراض المواصفات الكاملة وحجز موعد معاينة ميدانية للوحدة.`,
      quickReplies: ['👨‍💼 تحويل لمهندس الآن', '📍 عناوين الفروع ومواعيد العمل'],
      actions: [{ label: '🏢 استعراض كل عروض العقارات', href: '/real-estate' }],
    };
  }

  // 11. Warranty, Engineering Supervision & Work Stages
  if (hasAny(normMsg, ['ضمان', 'اشراف', 'استلام', 'جوده', 'مراحل العمل', 'خطوات', 'التزام', 'bim'])) {
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
        `🛡️ **منظومة الجودة والضمان في فاي تك الهندسية:**\n` +
        (compList ||
          '✅ مخططات تنفيذية (Shop Drawings) قبل العمل\n✅ إشراف هندسي يومي واستلام بالليزر والضغط الهيدروليكي\n✅ متابعة رقمية شفافة للمقايسات والمستخلصات') +
        `\n\n📌 نقدم ضماناً هندسياً موثقاً يصل إلى 10 سنوات على أعمال التأسيسات والعزل والأنظمة الذكية.`,
      quickReplies: ['💰 أسعار التشطيب والمقايسة للمتر', '👨‍💼 تحويل لمهندس الآن'],
    };
  }

  // 12. Cart, Account Registration & How to Order
  if (hasAny(normMsg, ['سله', 'حساب', 'تسجيل دخول', 'ازاي اطلب', 'طريقه الطلب', 'حجز', 'طلب عرض سعر'])) {
    return {
      shouldReply: true,
      senderName,
      intent: 'cart_order_help',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `🛒 **طريقة الطلب واستخدام سلة مشتريات فاي تك:**\n` +
        `1️⃣ تصفح المتجر أو تبويب التنفيذ والصيانة واختر البنود المطلوبة.\n` +
        `2️⃣ اضغط «أضف للسلة» مع إمكانية تفعيل خيار **«شامل التركيب الهندسي»**.\n` +
        `3️⃣ أرسل الطلب ليصلنا فوراً برقم مرجعي ويتواصل معك المهندس المختص لتأكيد التوريد والتركيب.`,
      quickReplies: ['⚡ أسعار منتجات الكهرباء والسباكة والسمارت هوم', '👨‍💼 تحويل لمهندس الآن'],
      actions: [{ label: '🛒 افتح المتجر الآن', href: '/store' }],
    };
  }

  // 13. Contact Info, Branches & Working Hours
  if (hasAny(normMsg, ['عنوان', 'فرع', 'فروع', 'مكانكم', 'مواعيد', 'ساعات العمل', 'رقم', 'تليفون', 'واتس', 'تواصل', 'ايميل'])) {
    return {
      shouldReply: true,
      senderName,
      intent: 'contact_info',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `📍 **بيانات التواصل وفروع شركة فاي تك:**\n` +
        `• الفروع ومناطق العمل: ${offices.join(' · ')}\n` +
        `• العنوان: ${contact.address}\n` +
        `• رقم الجوال والواتساب الرسمي: ${contact.phone}\n` +
        `• ساعات العمل: ${contact.hours}\n` +
        (contact.email ? `• البريد الإلكتروني: ${contact.email}` : ''),
      quickReplies: ['💰 أسعار التشطيب والمقايسة للمتر', '👨‍💼 تحويل لمهندس الآن'],
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
      'ارغب في الاستفسار',
      'شكرا',
      'متشكر',
      'تسلم',
      'تمام',
      'يعطيك العافيه',
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
        `أهلاً وسهلاً بحضرتك يا أستاذ ${displayVisitor} في فاي تك 👷‍♂️✨\n` +
        `تحت أمرك في أي استفسار هندسي أو فني — تفضل بكتابة سؤالك مباشرة.`,
      quickReplies: DEFAULT_QUICK_MENU,
      actions: [
        { label: '🛒 المتجر والسمارت هوم', href: '/store' },
        { label: '🛠️ التنفيذ والصيانة', href: '/store?tab=maintenance' },
      ],
    };
  }

  // 15. Fallback / Bot Stuck -> Automatic Human Handover
  return {
    shouldReply: true,
    senderName,
    intent: 'fallback_escalate',
    confidence: 'low',
    needsHuman: true,
    escalationReason: `سؤال خاص/معقد لم يتطابق مع السيناريوهات الآلية ويحتاج رد المهندس: "${questionText.slice(0, 110)}"`,
    replyText:
      `شكراً لاستفسارك يا أستاذ ${displayVisitor} 🤝\n` +
      `هذا السؤال التفصيلي يحتاج إفادة هندسية مخصصة من المهندس المسؤول لضمان الدقة الكاملة.\n\n` +
      `${chatBot.escalationText}`,
    quickReplies: DEFAULT_QUICK_MENU.slice(0, 4),
    actions: buildContactActions(siteContent),
  };
}

/**
 * الدالة الرئيسية للرد التفاعلي المرحلي:
 * التدفق:
 * 1) العميل يسأل سؤاله أولاً -> نرحب به باحترافية ونطلب اسمه الكريم للتشرف بمعرفته.
 * 2) العميل يكتب اسمه -> نرحب به باسمه، ونشرح له إجابة سؤاله بالتفصيل، ثم نطلب رقم جواله داخل المحادثة.
 * 3) العميل يكتب رقم جواله -> نؤكد تسجيل الرقم وإبلاغ المهندس المختص، وتستمر المحادثة التفاعلية.
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
  // Note: If caller passes visitorName & visitorPhone directly (e.g. direct API test), stage is 'active'
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
        ? `وعليكم السلام ورحمة الله وبركاته، أهلاً وسهلاً بحضرتك في شركة فاي تك الهندسية 👷‍♂️✨\n\nنتشرف أولاً باسم حضرتك الكريم؟`
        : `أهلاً وسهلاً بحضرتك في شركة فاي تك الهندسية 👷‍♂️✨\nاستفسار ممتاز، وبكل سرور سأشرح لحضرتك كافة التفاصيل الفنية والهندسية حالاً.\n\nنتشرف أولاً باسم حضرتك الكريم؟`,
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
            `تشرفنا بحضرتك يا أستاذ ${parsedName} 🌟 أهلاً بك في شركة فاي تك الهندسية.\n\n` +
            `تفضل بطرح سؤالك أو البند الذي تود الاستفسار عنه لأشرحه لحضرتك بالتفصيل.`,
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
        ? `\n\n✅ وتم كذلك تسجيل رقم جوالك (${resolvedPhone}) بنجاح ليتابع معك المهندس المختص.`
        : `\n\n━━━━━━━━━━━━━━━━━━━━\n📱 تشرفت بحضرتك يا أستاذ ${parsedName}.. هل يمكن تزويدنا **برقم جوالك (أو الواتساب)** هنا في المحادثة حتى يتمكن المهندس المختص من إرسال المقايسة أو الكتالوج التفصيلي لحضرتك؟`;

      return {
        ...explanation,
        extractedName: parsedName,
        extractedPhone: resolvedPhone || undefined,
        nextStage: resolvedPhone ? 'active' : 'awaiting_phone',
        pendingQuestion: '',
        quickReplies: resolvedPhone ? explanation.quickReplies : [],
        replyText:
          `تشرفنا بحضرتك يا أستاذ ${parsedName} 🌟\n` +
          `إليك التفاصيل الكاملة بخصوص استفسارك:\n\n` +
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
        `إليك التفاصيل الهندسية بخصوص سؤالك 👇\n\n` +
        `${explanation.replyText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n🤝 ونتشرف بكتابة **اسم حضرتك الكريم ورقم جوالك** هنا في المحادثة لتسجيل الاستفسار باسمك ومتابعته مع المهندس المختص.`,
    };
  }

  // =========================================================================
  // STAGE 3: We explained the question & asked for Phone Number
  //          -> Visitor provides Phone Number (or asks a follow-up question)
  // =========================================================================
  if (effectiveStage === 'awaiting_phone' && !currentPhone) {
    if (detectedPhoneInMsg) {
      // Check if visitor also included a question besides the phone number
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
            `شكراً جزيلاً يا أستاذ ${currentName} 🙏 تم حفظ رقم جوالك (${detectedPhoneInMsg}) وإشعار المهندس المختص.\n\n` +
            `وبخصوص سؤالك الإضافي:\n${followUp.replyText}`,
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
          `شكراً جزيلاً لحضرتك يا أستاذ ${currentName} 🙏✨\n` +
          `تم تسجيل رقم جوالك (${detectedPhoneInMsg}) بنجاح، وتم إرسال ملف استفسارك للمهندس المختص للتواصل معك.\n\n` +
          `إذا كان لديك أي استفسار آخر تفضل بكتابته مباشرة، أو يمكنك الاختيار من المواضيع التالية:`,
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
        `━━━━━━━━━━━━━━━━━━━━\n📱 يا أستاذ ${currentName}، فضلاً زوّدنا **برقم جوالك (أو الواتساب)** هنا في المحادثة حتى يتمكن المهندس المختص من التواصل معك وإرسال المقايسات أو الكتالوج.`,
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
    extractedPhone: (!currentPhone && detectedPhoneInMsg) ? detectedPhoneInMsg : undefined,
    nextStage: 'active',
  };
}
