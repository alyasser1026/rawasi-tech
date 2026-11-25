/**
 * chat-bot-config.ts — إعدادات وأنواع الشات الآلي الخفيفة للواجهة والمحتوى العام.
 * مفصولة عن محرك الرد (lib/copilot/chat-auto-responder.ts) حتى لا يدخل كود المحرك في حزمة المتصفح.
 */

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

export const DEFAULT_CHAT_BOT_CONFIG: ChatBotConfig = {
  enabled: true,
  botName: '🤖 مستشار فاي تك الذكي',
  welcomeText:
    'أهلاً بيك في فاي تك 👋 قولي بتسأل عن إيه (مقاولات، تشطيب، صيانة، منتجات، سمارت هوم) وهساعدك فوراً.',
  escalationText: 'أقدر أساعدك في طلب التواصل مع القسم المختص بعد اكتمال بياناتك وتأكيد الإرسال.',
  customRules: [
    {
      id: 'rule-contracts',
      title: 'نظام الدفعات والميزانية',
      keywords:
        'نظام الدفعات, دفعات, تعاقد, عقد, مستخلص, مستخلصات, نسبه الاشراف, طرق الدفع, غالي, غاليه, حنينه, علي قد الايد, ميزانيه, بتقسطوا التشطيب',
      reply:
        'شغالين بمقايسة واضحة على قد ميزانيتك (Open Book):\n' +
        '• الدفعات مرتبطة بالاستلام الفعلي لكل مرحلة.\n' +
        '• تسعير واضح للخامات والمصنعيات بدون مصاريف مخفية.',
      quickReplies: ['💰 تكلفة تشطيب الشقة', '👨‍💼 تحويل لمهندس'],
    },
    {
      id: 'rule-survey',
      title: 'المعاينة والرفع المساحي بالليزر',
      keywords:
        'معاينه, رفع مساحي, شوب درونج, مخططات تنفيذيه, هندسي بالليزر, هتيجو امتى, تيجوا تعاينوا, مهندس يعاين',
      reply:
        'بنبدأ برفع مساحي ومخططات تنفيذية لتنسيق الكهرباء والسباكة والتكييف قبل الشغل. موعد المعاينة يتحدد بعد التواصل وتأكيد المواعيد المتاحة.',
      quickReplies: ['عندي شقة ع الطوب', 'عندي فيلا للمعاينة', '👨‍💼 تحويل لمهندس'],
    },
    {
      id: 'rule-locations',
      title: 'المحافظات ونطاق الشغل والشحن',
      keywords:
        'محافظات, شحن, توصيل خارج, اسكندريه, الدلتا, الجيزه, اكتوبر, التجمع, العاصمه, زايد, المنصوره, بتشتغلوا فين',
      reply:
        'إمكانية التنفيذ أو الصيانة أو الشحن تتأكد حسب عنوانك ونوع الخدمة. رسوم وموعد التوصيل يحتاجوا تأكيد الفريق قبل الطلب.',
      quickReplies: ['أطلب معاينة', '🛒 فتح المتجر', '👨‍💼 تحويل لمهندس'],
    },
  ],
};
