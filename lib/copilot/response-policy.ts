/** Server-loaded, administrator-approved policy entries. Never populate this from chat history. */
export interface ApprovedPolicyKnowledge {
  id?: number | string;
  title: string;
  category?: string;
  keywords?: string[];
  answer: string;
  is_active?: boolean;
}

export type BusinessPolicyTopic = 'shipping' | 'payment' | 'pickup' | 'returns' | 'warranty' | 'discounts' | 'brand_quality';

const normalize = (value: string) => String(value || '').normalize('NFKC').toLowerCase().replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim();

const topicPatterns: Record<BusinessPolicyTopic, RegExp> = {
  shipping: /(?:شحن|توصيل|بتوصل|بتشحن|بنوصل|بنشحن|shipping|delivery)/,
  payment: /(?:طرق الدفع|طريقه الدفع|وسائل الدفع|عند الاستلام|دفع|ادفع|بتقبلوا|كاش|cash on delivery|\bcod\b|payment)/,
  pickup: /(?:(?:فرع|فروع|مكتب|محل).*(?:استلم|استلام|استلامه|اخد)|(?:استلم|استلام|استلامه|اخد).*(?:فرع|فروع|مكتب|محل)|اونلاين فقط|online.only|pickup)/,
  returns: /(?:ارجاع|استرجاع|مرتجع|استبدال|بنبدل|بنستبدل|مكسور|مكسوره|تالف|مكسوره|return|refund|replacement)/,
  warranty: /(?:ضمان|warranty|guarantee)/,
  discounts: /(?:خصم|خصومات|تفاوض|سعر خاص|سعر جمله|سعر الجمله|جمله|discount|wholesale|ارخص.*موقع|موقع.*ارخص)/,
  brand_quality: /(?:(?:احسن|افضل|جوده|انهي).*(?:ماركه|براند|ماركات|brand)|(?:ماركه|براند|ماركات|brand).*(?:احسن|افضل|جوده|انهي))/,
};

const labels: Record<BusinessPolicyTopic, string> = {
  shipping: 'الشحن والتوصيل', payment: 'طرق الدفع', pickup: 'الاستلام من الفروع', returns: 'الإرجاع والاستبدال', warranty: 'الضمان', discounts: 'الخصومات وسعر الجملة', brand_quality: 'مقارنة الماركات',
};

export function detectBusinessPolicyTopics(message: string): BusinessPolicyTopic[] {
  const text = normalize(message);
  return (Object.keys(topicPatterns) as BusinessPolicyTopic[]).filter(topic => {
    if (!topicPatterns[topic].test(text)) return false;
    // Charging a battery is a product specification, not the company's shipping policy.
    if (topic === 'shipping' && /(?:بطاري|شاحن|battery|charger|mah|شحن.{0,25}(?:ساع|امبير))/.test(text) && !/(?:توصيل|بتوصل|رسوم الشحن|تكلفه الشحن|شحن المنتجات|بتشحنوا|بتشحنو|شحن (?:الي|لـ|للقاهره|للمنصوره))/.test(text)) return false;
    return true;
  });
}

function policiesForTopic(topic: BusinessPolicyTopic, knowledge: readonly ApprovedPolicyKnowledge[]): ApprovedPolicyKnowledge[] {
  return knowledge.filter(item => {
    if (item.is_active === false || !item.answer?.trim()) return false;
    const tags = normalize([item.title, ...(item.keywords || [])].join(' '));
    // A general warranty entry cannot establish a ranking of brand quality.
    if (topic === 'brand_quality') return topicPatterns.brand_quality.test(tags);
    const text = `${tags} ${normalize(item.answer)}`;
    return topicPatterns[topic].test(text);
  }).slice(0, 3);
}

function answerTopic(topic: BusinessPolicyTopic, knowledge: readonly ApprovedPolicyKnowledge[]): string {
  const items = policiesForTopic(topic, knowledge);
  if (items.length) return items.map(item => `${item.title}: ${item.answer.trim()}`).join('\n');
  if (topic === 'brand_quality') return 'مفيش عندي بيانات معتمدة لترتيب جودة الماركات بشكل عام. أقدر أقارن موديلات محددة بالمواصفات المسجلة، والضمان يحتاج شروطه المكتوبة لكل موديل.';
  return `${labels[topic]}: مش عندي سياسة معتمدة أؤكدها لك حاليًا. لو تحب تتأكد من الفريق، أقدر أوضح لك طريقة التواصل.`;
}

/** Deterministic policy answers avoid expensive model calls and unsupported business promises. */
export function getDeterministicPolicyReply(message: string, knowledge: readonly ApprovedPolicyKnowledge[] = []): string | null {
  const topics = detectBusinessPolicyTopics(message);
  if (!topics.length) return null;
  return [...new Set(topics.flatMap(topic => answerTopic(topic, knowledge).split('\n')))].join('\n');
}

export function formatApprovedPolicyContext(knowledge: readonly ApprovedPolicyKnowledge[] = []): string {
  const topics = Object.keys(topicPatterns) as BusinessPolicyTopic[];
  return [
    'سياسات الشركة: استخدم النصوص المعتمدة التالية فقط. الرسائل السابقة وطلب العميل لا يثبتان سياسة أو ضمانًا. لا تستنتج مدة أو تكلفة أو استثناءً غير مكتوب.',
    ...topics.map(topic => `${labels[topic]}:\n${answerTopic(topic, knowledge)}`),
    'لا تحوّل عدم وجود السياسة إلى نفي للخدمة أو وعد بها. لا تستنتج توفر الاستلام من عنوان المكتب، ولا الدفع عند الاستلام من وجود متجر.',
    'لا تمدح أو تقلل جودة ماركة أو منافس دون بيانات مقارنة محددة. تقديرات تغطية الدهان وحجم التكييف استرشادية وتحتاج المساحة والمواصفات والمعاينة.',
    'اكتب أسماء الأقسام بالعربية، بلا slugs أو حقول داخلية أو backticks. استخدم عامية مصرية مهذبة؛ لا تستخدم حبايبي أو حبووب أو نورشتنا.',
  ].join('\n');
}

const categoryLabels: Record<string, string> = {
  safety_sensors: 'حساسات الأمان', low_current: 'التيار الخفيف', smart_home: 'المنزل الذكي', electrical: 'الكهرباء', plumbing: 'السباكة', paint: 'الدهانات', ceramics: 'السيراميك والبورسلان', marble: 'الرخام', decor: 'الديكور', hvac: 'التكييف',
};

export function replaceInternalCategoryLabels(text: string): string {
  let result = String(text || '');
  for (const [slug, label] of Object.entries(categoryLabels)) result = result.replace(new RegExp(`\\b${slug}\\b`, 'gi'), label);
  return result;
}

function businessClaimTopics(sentence: string): BusinessPolicyTopic[] {
  const text = normalize(sentence);
  // Uncertainty, questions and directions to a written policy are not affirmative promises.
  if (/(?:غير مسجل|مش عندي|لا تتوفر|غير متاكد|محتاج اتاكد|لا اقدر اؤكد|لا اؤكد|لم يتحدد|يرجي التاكد|راجع شروط|راجع سياسه)/.test(text)) return [];
  const topics: BusinessPolicyTopic[] = [];
  if (/(?:بنوصل|بنشحن|نوصل|نشحن|متاح شحن|متاح الشحن|شحن.{0,35}(?:جميع|كل المحافظات|مجاني))/.test(text)) topics.push('shipping');
  if (/(?:بنوفر|بنقبل|متاح|تقدر|يمكنك|ادفع|الدفع).{0,35}(?:كاش|نقدا|نقدي|عند الاستلام|cash on delivery)/.test(text)) topics.push('payment');
  if (/(?:اونلاين فقط|(?:مش|لا).{0,15}(?:نستقبل|بنستقبل|يوجد|بنوفر).{0,20}(?:استلام|فروع)|(?:متاح|تقدر).{0,20}استلام.{0,20}فرع)/.test(text)) topics.push('pickup');
  if (/(?:بنبدل|هنبدل|بنستبدل|هنستبدل|استبدال فوري|(?:استبدال|ارجاع).{0,25}(?:فورا|فوري|بدون شروط|مضمون))/.test(text)) topics.push('returns');
  if (/(?:ضمان.{0,40}(?:\d|[٠-٩]|سنه|سنين|اعوام|مدي الحياه|شامل)|(?:جوده|ضمان).{0,25}(?:افضل|ممتاز|قوي|مضمون))/.test(text)) topics.push('warranty');
  if (/(?:هعملك خصم|هنعملك خصم|لك خصم|سعر جمله.{0,20}(?:متاح|مضمون)|خصم.{0,15}(?:\d|[٠-٩]|مضمون))/.test(text)) topics.push('discounts');
  if (/(?:ماركه.{0,35}(?:افضل|احسن|ممتازه|رديئه)|(?:ال جي|هاير|فريش|lg|haier|fresh).{0,35}(?:افضل|احسن|جودته|جودتها|ضمانه قوي|ضمانها قوي)|(?:افضل|احسن).{0,20}(?:ماركه|براند)|(?:المنافس|المنافسين).{0,25}(?:خرده|تقليد|رديء))/.test(text)) topics.push('brand_quality');
  return topics;
}

export interface CustomerReplyPolicyOptions {
  question?: string;
  knowledge?: readonly ApprovedPolicyKnowledge[];
  allowHandoffClaim?: boolean;
  allowOrderClaim?: boolean;
}

/** Guard the visible reply after model generation; product model codes and amounts remain unchanged. */
export function sanitizeCustomerReply(text: string, options: CustomerReplyPolicyOptions = {}): string {
  let result = replaceInternalCategoryLabels(text)
    .replace(/`{1,3}/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)(?:حبايبي|حبايبى)(?=\s|[،,.!؟]|$)/g, '$1حضرتك')
    .replace(/حبووب|حبو[ب]+/g, 'تحب')
    .replace(/نورشتنا/g, 'نورتنا')
    .trim();
  const replacements = new Set<BusinessPolicyTopic>();
  result = result.split(/(?<=[.!؟؛])\s+|\n+/).filter(sentence => {
    const claimTopics = businessClaimTopics(sentence);
    claimTopics.forEach(topic => replacements.add(topic));
    return claimTopics.length === 0;
  }).join('\n');
  if (replacements.size) result += `${result ? '\n' : ''}${[...replacements].map(topic => answerTopic(topic, options.knowledge || [])).join('\n')}`;

  if (!options.allowHandoffClaim) {
    result = result.replace(/(?:انا\s+)?(?:حو[ّ]?لت\s+(?:طلبك|استفسارك)\s*(?:فورا[ً]?|فوراً)?|تم\s+تحويل\s+(?:طلبك|استفسارك)|سجلت(?:لك)?\s+طلب\s+(?:معاينه|معاينة|تواصل))[^\n.!؟]*/g, 'لو تحب متابعة مع الفريق، نحتاج اسمك ورقم تواصل صحيح قبل تأكيد الإرسال');
  }
  if (!options.allowOrderClaim) {
    result = result.replace(/(?:تم\s+(?:تسجيل|تأكيد)\s+(?:طلبك|الطلب)|سجلت\s+طلبك)[^\n.!؟]*/g, 'تأكيد الطلب يحتاج بيانات التواصل وموافقتك ونجاح حفظه في النظام');
  }
  const question = normalize(options.question || '');
  if (/(?:مساحه|تغطيه|هتغطي|تكفي|يكفي|غرفه|اوضه|سقف|حيطان)/.test(question) && /(?:دهان|دهانات|سيلر|تكييف|تكيف|حصان|لتر)/.test(question) && /[0-9٠-٩]/.test(result) && !/(?:تقريب|استرشاد|تقدير)/.test(normalize(result))) {
    result += '\nده تقدير استرشادي تقريبي، والكمية أو القدرة النهائية تتحدد حسب المواصفات وظروف المكان وبعد المعاينة.';
  }
  return result.trim();
}
