/**
 * chat-auto-responder.ts — محرك الرد الآلي الهندسي التفاعلي للشات الحي مع التحويل التلقائي للمهندس
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
}

export const DEFAULT_CHAT_BOT_CONFIG: ChatBotConfig = {
  enabled: true,
  botName: '🤖 المساعد الهندسي التفاعلي — فاي تك',
  welcomeText:
    'أهلاً بك في شركة فاي تك الهندسية 👷‍♂️✨ معك المساعد الهندسي الفوري للرد على جميع استفسارات التشطيب، المنتجات، السمارت هوم، حساسات الأمان، التنفيذ والصيانة، والعقارات — مع إمكانية تحويلك للمهندس المختص في أي لحظة.',
  escalationText:
    'تم تحويل محادثتك الآن مباشرة إلى المهندس المختص 👨‍💻🔔 وإرسال إشعار فوري برقم جوالك وتفاصيل استفسارك ليتواصل معك هنا أو عبر الواتساب خلال دقائق.',
  customRules: [
    {
      id: 'rule-contracts',
      title: 'نظام التعاقد والدفعات والمستخلصات',
      keywords: 'نظام الدفعات, دفعات, تعاقد, عقد, مستخلص, مستخلصات, نسبه الاشراف, طرق الدفع',
      reply:
        'في شركة فاي تك نعمل بنظام تعاقد شفاف ومقايسة مفتوحة البنود (Open Book) أو دفعات مرحلية مرتبطة بالاستلام الفعلي على الموقع:\n• دفعة تعاقد وتجهيز المخططات التنفيذية (Shop Drawings)\n• دفعات مرحلية تُصرف فقط بعد استلام كل بند هندسياً (تأسيس ثم تشطيب)\n• تقارير ومستخلصات رقمية واضحة لمتابعة كل جنيه بدقة.\n\nهل تفضل التعاقد بالمقايسة المفتوحة أم التشطيب المتكامل؟',
      quickReplies: ['💰 أسعار التشطيب والمقايسة للمتر', '👨‍💼 تحويل لمهندس الآن'],
    },
    {
      id: 'rule-survey',
      title: 'آلية المعاينة والرفع المساحي بالليزر',
      keywords: 'معاينه, رفع مساحي, شوب درونج, مخططات تنفيذيه, هندسي بالليزر, هتيجو امتى',
      reply:
        'تبدأ كل مشاريع فاي تك بزيارة معاينة ورفع مساحي دقيق بالليزر (Laser Survey) لتحديد حالة المبنى، وتنسيق مسارات الكهرباء والسباكة والتكييف المخفي (Shop Drawings) قبل البدء لتفادي أي تكسير.\n\nاكتب لي (نوع الوحدة + المساحة التقريبية + المنطقة) وسنحجز لك أقرب موعد معاينة فوراً أو نُحوّلك للمهندس.',
      quickReplies: ['شقة 150 متر على الطوب', 'فيلا / دوبلكس للمعاينة', '👨‍💼 تحويل لمهندس الآن'],
    },
    {
      id: 'rule-locations',
      title: 'المحافظات ونطاق التغطية والشحن',
      keywords: 'محافظات, شحن, توصيل خارج, اسكندريه, الدلتا, الجيزه, اكتوبر, التجمع, العاصمه, زايد, المنصوره',
      reply:
        'تغطي فاي تك أعمال التنفيذ والتشطيب والصيانة الهندسية في:\n📍 القاهرة الكبرى (التجمع، مدينة نصر، المعادي، الشيخ زايد، 6 أكتوبر، العاصمة الإدارية)\n📍 المنصورة ومحافظات الدلتا\n📍 كما يتاح توريد وشحن جميع منتجات المتجر والسمارت هوم وحساسات الأمان لجميع المحافظات.\n\nما هي منطقتك الحالية لننسق لك أقرب فريق هندسي؟',
      quickReplies: ['طلب معاينة ومقايسة', '🛒 فتح المتجر وإضافة للسلة', '👨‍💼 تحويل لمهندس الآن'],
    },
  ],
};

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeArabic(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
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

export function generateSmartAutoReply(params: {
  messageText: string;
  visitorName: string;
  visitorPhone: string;
  pageUrl?: string;
  requestHuman?: boolean;
  previousMessages?: Array<{ sender: 'visitor' | 'admin'; text: string; intent?: string }>;
  siteContent?: AutoResponderSiteContent;
}): AutoReplyResult {
  const {
    messageText,
    visitorName,
    visitorPhone,
    requestHuman = false,
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
  const normMsg = normalizeArabic(messageText);

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
      replyText: `${chatBot.escalationText}\n\n👤 العميل: ${visitorName}\n📱 الرقم المسجل: ${visitorPhone}\n💡 إذا كنت مستعجلاً يمكنك الضغط على زر الواتساب المباشر أدناه للتحدث الفوري مع المهندس.`,
      quickReplies: ['📍 عناوين الفروع ومواعيد العمل', '🛒 فتح المتجر والأسعار'],
      actions: buildContactActions(siteContent),
    };
  }

  // 2. Interactive Lead Qualification (User gave project dimensions / city / unit condition)
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
  const hasUnitOrProjectContext =
    hasAny(normMsg, ['شقه', 'فيلا', 'دوبلكس', 'مكتب', 'عياده', 'محل', 'تشطيب', 'معاينه', 'مقايسه', 'تاسيس']) ||
    previousMessages.some((m) => m.intent === 'finishing_quote' || m.intent === 'maintenance_execution');

  if ((hasArea || (hasLocationOrCondition && hasUnitOrProjectContext)) && !hasAny(normMsg, ['فرع', 'فروع', 'عنوان', 'مكانكم'])) {
    return {
      shouldReply: true,
      senderName,
      intent: 'lead_qualified',
      confidence: 'high',
      needsHuman: true,
      escalationReason: `عميل مؤهل شارك تفاصيل المشروع: "${messageText.slice(0, 100)}"`,
      replyText:
        `ممتاز جداً يا أستاذ ${visitorName} 👍 تم تسجيل تفاصيل وحدتك بنجاح:\n` +
        `📝 "${messageText}"\n\n` +
        `✅ تم تحويل طلبك الآن بشكل عاجل للمهندس المختص لمراجعة المساحة والمواصفات وتجهيز عرض السعر/المعاينة والرد عليك هنا أو على رقمك (${visitorPhone}).\n` +
        `💡 نصيحة فاي تك: قبل أي تكسير أو تأسيس، نُعد لك مخططات تنفيذية (Shop Drawings) لتوزيع الكهرباء والسباكة والتكييف المخفي وتفادي الهالك.`,
      quickReplies: ['🛡️ الضمان الهندسي ومراحل الاستلام', '📍 عناوين الفروع ومواعيد العمل'],
      actions: [
        { label: `💬 متابعة فورية عبر واتساب`, href: `https://wa.me/${cleanWa}`, external: true },
        { label: '🛠️ تصفح خدمات التنفيذ والصيانة', href: '/store?tab=maintenance' },
      ],
    };
  }

  // 3. Custom Rules configured from /website-admin
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

  // 4. Site FAQs matching
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

  // 5. Finishing Quote & Price per Meter Scenario
  if (
    hasAny(normMsg, [
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
    ])
  ) {
    return {
      shouldReply: true,
      senderName,
      intent: 'finishing_quote',
      confidence: 'high',
      needsHuman: false,
      replyText:
        `أهلاً بك يا أستاذ ${visitorName} 🏗️\n` +
        `في فاي تك يتم تحديد تكلفة التشطيب بدقة من خلال **مقايسة هندسية مفتوحة البنود** بعد المعاينة (وليس برقم تقديري غير دقيق)، لأن السعر يختلف حسب:\n` +
        `1️⃣ حالة الوحدة الحالية (طوب أحمر أم نصف تشطيب)\n` +
        `2️⃣ نوع الخامات (سيراميك / بورسلان ألواح كبيرة / رخام)\n` +
        `3️⃣ نطاق الأنظمة الذكية (سمارت هوم + تكييف مخفي + حساسات أمان)\n\n` +
        `📩 لإعطائك تقديراً هندسياً سريعاً وتحويلك للمهندس فوراً: اكتب لي **(المساحة بالمتر + المنطقة + طوب أحمر أم نصف تشطيب)** أو اختر من الخيارات بالأسفل:`,
      quickReplies: [
        'شقة 150 متر على الطوب',
        'شقة 200 متر نصف تشطيب',
        'فيلا / دوبلكس للمعاينة',
        '👨‍💼 تحويل لمهندس الآن',
      ],
      actions: [{ label: '🛠️ باقات التنفيذ والتأسيس الهندسي', href: '/store?tab=maintenance' }],
    };
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
        `🚨 منظومة الأمان والحساسات الذكية من فاي تك توفر حماية 24/7 للمنزل والشركة:\n` +
        `• حساس غاز + **محبس غلق أوتوماتيكي** يقطع الغاز ميكانيكياً فور استشعار أي تسريب.\n` +
        `• حساس تسرب مياه يغلق المحبس الرئيسي ويرسل تنبيهاً فورياً للجوال.\n` +
        `• كاشف دخان وحرارة ذكي مرتبط بالجوال وصافرة الإنذار.\n\n` +
        `💡 *توصية هندسية:* يُركب حساس الغاز الطبيعي أعلى الجدار (30 سم من السقف)، وحساس أنبوبة البوتاجاز أسفل الجدار (30 سم من الأرض).\n\n` +
        (listText ? `أبرز المنتجات المتاحة:\n${listText}` : ''),
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
        `📱 أنظمة **السمارت هوم والتيار الخفيف** في فاي تك متاحة للتأسيس الجديد أو التركيب في الشقق المتشطبة **بدون أي تكسير**:\n` +
        `✅ تحكم كامل في الإضاءة والتكييف والستائر من الجوال أو بالأوامر الصوتية (Alexa / Google Home).\n` +
        `✅ أقفال ذكية بالبصمة والرقم السري + كاميرات AI + إنتركم IP + شبكات Mesh Wi-Fi.\n` +
        `🎁 تتوفر **${SMART_BUNDLES.length} باقات ذكية جاهزة** داخل المتجر.\n\n` +
        (listText ? `أبرز الأصناف المتاحة:\n${listText}\n\n` : '') +
        `💡 *توصية هندسية:* عند التأسيس الجديد، احرص على وجود سلك Neutral في علب المفاتيح وفصل مواسير التيار الخفيف عن الكهرباء 20 سم.`,
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
          `🏗️ **نطاق التنفيذ والتأسيس:**\n• ${matchedMnt.executionScope.slice(0, 2).join('\n• ')}\n\n` +
          `🔧 **نطاق الصيانة ومعالجة الأعطال:**\n• ${matchedMnt.maintenanceScope.slice(0, 2).join('\n• ')}\n\n` +
          `💡 ${matchedMnt.recommendation}\n\n` +
          `🛡️ الضمان: ${matchedMnt.warrantyLabel} | 💰 الرسوم: ${feeText}`,
        quickReplies: ['شقة 150 متر على الطوب', '👨‍💼 تحويل لمهندس الآن', '📍 عناوين الفروع ومواعيد العمل'],
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
        `🛠️ قسم **التنفيذ والصيانة الشاملة** في فاي تك يغطي 10 تخصصات هندسية بإشراف مهندسين وفنيين معتمدين:\n` +
        `⚡ الكهرباء واللوحات • 🚰 السباكة وكشف التسريبات • 🎨 الدهانات والعزل المائي\n` +
        `🟫 البورسلان والسيراميك • 🪨 الرخام والجرانيت • 🛋️ الجبس بورد والديكور\n` +
        `📱 السمارت هوم • 📡 التيار الخفيف • 🚨 حساسات الأمان • ❄️ التكييف المخفي والاسبليت\n\n` +
        `اختر التخصص أو اضغط بالأسفل للدخول على صفحة التنفيذ والصيانة وحجز موعد مباشرة:`,
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
            : `السعر عند الطلب (${p.unit}) — أضف للسلة لطلب عرض سعر`;
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
        `يضم المتجر ${products.length} منتجاً في ${PRODUCT_CATEGORIES.length} أقسام هندسية، ويمكنك إضافة أي منتج لسلتك مع خيار «شامل التركيب الهندسي المعتمد».\n\n` +
        (topItems ? `عينة من المنتجات:\n${topItems}` : ''),
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
        `🏢 **عروض العقارات والوحدات المتاحة في فاي تك** (تشطيبات هندسية فاخرة وسمارت هوم):\n\n` +
        (propLines || 'تتوفر شقق، دوبلكس، فيلات، ومعارض تجارية بمواقع متميزة في القاهرة والمنصورة.') +
        `\n\nيمكنك حجز موعد معاينة للوحدة مباشرة من صفحة العقارات أو التحدث مع مستشارنا العقاري.`,
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
        `\n\n📌 نقدم ضماناً هندسياً موثقاً على أعمال التأسيسات والعزل والأنظمة الذكية بعد تسليم المشروع.`,
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
        `🛒 **خطوات الطلب واستخدام سلة فاي تك بسهولة:**\n` +
        `1️⃣ تصفح المتجر أو تبويب التنفيذ والصيانة واختر البنود المطلوبة.\n` +
        `2️⃣ عند الضغط على «أضف للسلة»، يمكنك تسجيل الدخول بحسابك أو إنشاء حساب جديد خلال ثوانٍ لتحفظ سلتك باسمك.\n` +
        `3️⃣ فعّل خيار **«شامل التركيب الهندسي»** لأي منتج إذا أردت التوريد مع التنفيذ.\n` +
        `4️⃣ أرسل الطلب لتصلنا تفاصيله فوراً مع كود متابعة وإشعار واتساب وتليجرام.`,
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
        (contact.email ? `• البريد الإلكتروني: ${contact.email}\n` : '') +
        `\nتحت أمرك في أي وقت!`,
      quickReplies: ['💰 أسعار التشطيب والمقايسة للمتر', '👨‍💼 تحويل لمهندس الآن'],
      actions: buildContactActions(siteContent),
    };
  }

  // 14. Greeting / Generic Starter / Thanks
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
        `أهلاً بك يا أستاذ ${visitorName} في فاي تك 👷‍♂️✨\n` +
        `${chatBot.welcomeText}\n\n` +
        `اختر الموضوع الذي تحب الاستفسار عنه بالأسفل، أو اكتب سؤالك مباشرة:`,
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
    escalationReason: `سؤال خاص/معقد لم يتطابق مع السيناريوهات الآلية ويحتاج رد المهندس: "${messageText.slice(0, 110)}"`,
    replyText:
      `شكراً لاستفسارك يا أستاذ ${visitorName} 🤝\n` +
      `هذا الاستفسار يتطلب مراجعة هندسية مخصصة لضمان إجابة دقيقة 100%.\n\n` +
      `${chatBot.escalationText}\n` +
      `📌 يمكنك أيضاً استعراض أحد الأقسام السريعة بالأسفل أو فتح الواتساب المباشر مع المهندس الآن:`,
    quickReplies: DEFAULT_QUICK_MENU.slice(0, 4),
    actions: buildContactActions(siteContent),
  };
}
