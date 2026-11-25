-- ============================================================================
-- PhiTech Store Copilot — Database-Backed Training Tables
-- 1) store_copilot_training_config : إعدادات الشخصية واللهجة والقواعد التدريبية
-- 2) store_copilot_knowledge       : قاعدة المعرفة والسياسات المخصصة القابلة للتدريب من الإدارة
--    RLS مفعّل بدون صلاحيات قراءة عامة (يُدار ويُقرأ عبر الباك اند وخدمة الإدارة فقط).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.store_copilot_training_config (
  id text PRIMARY KEY DEFAULT 'default',
  persona_name text NOT NULL DEFAULT 'كوبايلوت متجر فاي تك الذكي',
  tone_guidelines text NOT NULL DEFAULT 'تحدّث بالعامية المصرية الودودة والمهذبة والمباشرة (واضحة ومختصرة ومركزة على إفادة العميل).',
  extra_system_rules text NOT NULL DEFAULT '',
  forbidden_claims text NOT NULL DEFAULT '',
  sales_handoff_prompt text NOT NULL DEFAULT 'عايز تتكلم مع المبيعات مباشرة ولا نبدأ هنا بالمنتج اللي بتدور عليه؟',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_copilot_training_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.store_copilot_training_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.store_copilot_knowledge (
  id serial PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'sales_policy', 'shipping', 'warranty', 'installation', 'maintenance', 'smart_home', 'finishing')),
  keywords text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  priority integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_knowledge_active
  ON public.store_copilot_knowledge (is_active, priority DESC, id DESC);

ALTER TABLE public.store_copilot_knowledge ENABLE ROW LEVEL SECURITY;

INSERT INTO public.store_copilot_knowledge (title, category, keywords, answer, priority, is_active)
SELECT
  'سياسة الشحن والتوصيل للمحافظات',
  'shipping',
  ARRAY['شحن', 'توصيل', 'محافظات', 'مصاريف الشحن', 'مدة التوصيل', 'القاهرة', 'الجيزة', 'الدلتا'],
  'منتجات المتجر وأنظمة السمارت هوم متاح شحنها لجميع محافظات مصر، وتكلفة وموعد التوصيل بيتأكدوا حسب المحافظة وحجم الطلب عند مراجعة الطلب مع فريق المبيعات.',
  20,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_copilot_knowledge WHERE title = 'سياسة الشحن والتوصيل للمحافظات'
);

INSERT INTO public.store_copilot_knowledge (title, category, keywords, answer, priority, is_active)
SELECT
  'المعاينة والرفع المساحي بالليزر',
  'installation',
  ARRAY['معاينة', 'رفع مساحي', 'ليزر', 'تاسيس', 'مخططات', 'التركيب', 'تركيبات'],
  'بنبدأ خدمات التنفيذ والتركيبات بمعاينة هندسية ورفع مساحي لتحديد المسارات ونقاط الكهرباء والسباكة والتكييف بدقة قبل التنفيذ، وتكلفة التركيب أو المعاينة بتتحدد حسب المساحة وحجم الأعمال.',
  20,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_copilot_knowledge WHERE title = 'المعاينة والرفع المساحي بالليزر'
);

INSERT INTO public.store_copilot_knowledge (title, category, keywords, answer, priority, is_active)
SELECT
  'الضمان وخدمة ما بعد البيع',
  'warranty',
  ARRAY['ضمان', 'استبدال', 'صيانة بعد التركيب', 'شهادة ضمان', 'اعطال'],
  'المنتجات الأصلية تخضع لضمان الوكيل المعتمد حسب نوع الصنف، وأعمال التركيب والتنفيذ التابعة لفاي تك لها متابعة وضمان حسب نطاق التعاقد المتفق عليه.',
  15,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_copilot_knowledge WHERE title = 'الضمان وخدمة ما بعد البيع'
);
