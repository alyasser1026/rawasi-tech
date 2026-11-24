-- ============================================================================
-- PhiTech Store Copilot — Consolidated Migration (Stages 1, 2A & 2B)
-- 1) pg_trgm + Arabic normalization (phi_normalize_arabic)
-- 2) store_catalog_products search columns, trigger & 6 high-speed indexes
-- 3) store_search_synonyms + trigger + RLS + 65 catalog-grounded seed rows
-- 4) copilot_search_misses + copilot_log_search_miss RPC
-- 5) 5 Store Copilot RPCs (search, details, overview, estimate, submit_order)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) دالة تطبيع النص العربي والأرقام لتوحيد البحث (أ/إ/آ -> ا، ة -> ه، ى -> ي، ٠-٩ -> 0-9)
CREATE OR REPLACE FUNCTION public.phi_normalize_arabic(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT btrim(
    regexp_replace(
      replace(
        translate(
          regexp_replace(
            lower(translate(input_text, '٠١٢٣٤٥٦٧٨٩', '0123456789')),
            E'[\u064B-\u065F\u0670\u0640]',
            '',
            'g'
          ),
          'أإآٱةى',
          'ااااهي'
        ),
        'بورسلين',
        'بورسلان'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

-- 2) جدول المنتجات الرئيسي للكتالوج + عمود search_text
CREATE TABLE IF NOT EXISTS public.store_catalog_products (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  name_normalized text NOT NULL DEFAULT '',
  search_text text NOT NULL DEFAULT '',
  category text NOT NULL,
  sub_category text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT 'PhiTech',
  unit text NOT NULL DEFAULT 'قطعة',
  price numeric(14, 2) NOT NULL DEFAULT 0,
  old_price numeric(14, 2),
  install_price numeric(14, 2),
  currency text NOT NULL DEFAULT 'ج.م',
  badge text,
  description text NOT NULL DEFAULT '',
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_id text,
  image_url text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  cheapest_source_count integer NOT NULL DEFAULT 1,
  in_stock boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_catalog_products
  ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.trg_store_catalog_prepare_search()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_specs_text text := '';
BEGIN
  IF NEW.specs IS NOT NULL AND jsonb_typeof(NEW.specs) = 'array' THEN
    SELECT coalesce(string_agg(val, ' '), '')
    INTO v_specs_text
    FROM jsonb_array_elements_text(NEW.specs) AS val;
  END IF;

  NEW.name_normalized := public.phi_normalize_arabic(coalesce(NEW.name, ''));
  NEW.search_text := public.phi_normalize_arabic(
    concat_ws(
      ' ',
      NEW.name,
      NEW.code,
      NEW.brand,
      NEW.category,
      NEW.sub_category,
      NEW.badge,
      NEW.description,
      v_specs_text
    )
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_catalog_prepare_search ON public.store_catalog_products;
CREATE TRIGGER trg_store_catalog_prepare_search
  BEFORE INSERT OR UPDATE ON public.store_catalog_products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_store_catalog_prepare_search();

CREATE INDEX IF NOT EXISTS idx_store_products_search_trgm
  ON public.store_catalog_products USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_products_name_trgm
  ON public.store_catalog_products USING gin (name_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_products_cat_filter
  ON public.store_catalog_products (category, in_stock, featured DESC, price ASC);

CREATE INDEX IF NOT EXISTS idx_store_products_code_lower
  ON public.store_catalog_products (lower(code));

CREATE INDEX IF NOT EXISTS idx_store_products_brand_lower
  ON public.store_catalog_products (lower(brand));

CREATE TABLE IF NOT EXISTS public.store_media_attachments (
  id text PRIMARY KEY,
  product_id text REFERENCES public.store_catalog_products(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/webp',
  file_size integer NOT NULL DEFAULT 0,
  sha256_hash text NOT NULL,
  kind text NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'datasheet', 'document')),
  telegram_file_id text NOT NULL,
  telegram_message_id text NOT NULL DEFAULT '',
  telegram_chat_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS store_media_attachments_sha_uq
  ON public.store_media_attachments (sha256_hash, kind);

ALTER TABLE public.store_catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_media_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_catalog_public_read ON public.store_catalog_products;
CREATE POLICY store_catalog_public_read
  ON public.store_catalog_products FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS store_media_public_read ON public.store_media_attachments;
CREATE POLICY store_media_public_read
  ON public.store_media_attachments FOR SELECT TO anon, authenticated
  USING (true);

-- 3) جدول المرادفات القابل للتدريب (store_search_synonyms)
CREATE TABLE IF NOT EXISTS public.store_search_synonyms (
  id serial PRIMARY KEY,
  term text NOT NULL,
  term_normalized text NOT NULL DEFAULT '' UNIQUE,
  expand_terms text[] NOT NULL DEFAULT '{}',
  target_categories text[] NOT NULL DEFAULT '{}',
  synonym_type text NOT NULL DEFAULT 'product'
    CHECK (synonym_type IN ('brand', 'product', 'category', 'slang')),
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trg_store_synonyms_normalize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean_terms text[];
BEGIN
  NEW.term := btrim(coalesce(NEW.term, ''));
  NEW.term_normalized := public.phi_normalize_arabic(NEW.term);

  SELECT coalesce(array_agg(DISTINCT norm_t), ARRAY[]::text[])
  INTO v_clean_terms
  FROM (
    SELECT public.phi_normalize_arabic(x) AS norm_t
    FROM unnest(coalesce(NEW.expand_terms, ARRAY[]::text[]) || ARRAY[NEW.term]) AS x
  ) s
  WHERE nullif(norm_t, '') IS NOT NULL;

  NEW.expand_terms := v_clean_terms;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_synonyms_normalize ON public.store_search_synonyms;
CREATE TRIGGER trg_store_synonyms_normalize
  BEFORE INSERT OR UPDATE ON public.store_search_synonyms
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_store_synonyms_normalize();

CREATE INDEX IF NOT EXISTS idx_store_synonyms_active
  ON public.store_search_synonyms (is_active, term_normalized);

ALTER TABLE public.store_search_synonyms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_synonyms_public_read ON public.store_search_synonyms;
CREATE POLICY store_synonyms_public_read
  ON public.store_search_synonyms FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 4) جدول سجل الكلمات التي لم تجد نتائج (copilot_search_misses) لتدريب البحث
CREATE TABLE IF NOT EXISTS public.copilot_search_misses (
  id bigserial PRIMARY KEY,
  raw_query text NOT NULL,
  normalized_query text NOT NULL UNIQUE,
  category_filter text,
  brand_filter text,
  hit_count integer NOT NULL DEFAULT 1,
  last_page_url text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_synonym text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_misses_open
  ON public.copilot_search_misses (resolved, hit_count DESC, last_seen_at DESC);

ALTER TABLE public.copilot_search_misses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.copilot_log_search_miss(
  p_query text,
  p_category text DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_page_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_raw text := left(btrim(coalesce(p_query, '')), 200);
  v_norm text := public.phi_normalize_arabic(v_raw);
BEGIN
  IF length(v_norm) < 2 THEN
    RETURN;
  END IF;

  INSERT INTO public.copilot_search_misses (
    raw_query, normalized_query, category_filter, brand_filter, hit_count, last_page_url
  )
  VALUES (
    v_raw,
    v_norm,
    nullif(btrim(coalesce(p_category, '')), ''),
    nullif(btrim(coalesce(p_brand, '')), ''),
    1,
    left(coalesce(p_page_url, ''), 160)
  )
  ON CONFLICT (normalized_query) DO UPDATE
  SET
    hit_count = public.copilot_search_misses.hit_count + 1,
    raw_query = EXCLUDED.raw_query,
    category_filter = coalesce(EXCLUDED.category_filter, public.copilot_search_misses.category_filter),
    brand_filter = coalesce(EXCLUDED.brand_filter, public.copilot_search_misses.brand_filter),
    last_page_url = coalesce(EXCLUDED.last_page_url, public.copilot_search_misses.last_page_url),
    last_seen_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.copilot_log_search_miss(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_log_search_miss(text, text, text, text) TO service_role;

-- 5) بذور المرادفات الـ 65 (ON CONFLICT DO NOTHING للحفاظ على تعديلات الإدارة المخصصة)
INSERT INTO public.store_search_synonyms (term, expand_terms, target_categories, synonym_type, notes)
VALUES
  ('شنايدر', ARRAY['شنايدر', 'schneider', 'schneider electric'], ARRAY['electrical', 'low_current'], 'brand', '965 منتج إنجليزي + 321 عربي'),
  ('schneider', ARRAY['schneider', 'شنايدر'], ARRAY['electrical', 'low_current'], 'brand', 'توحيد ماركة شنايدر'),
  ('جروهي', ARRAY['جروهي', 'grohe'], ARRAY['plumbing', 'ceramics'], 'brand', '536 منتج جروهي'),
  ('grohe', ARRAY['grohe', 'جروهي'], ARRAY['plumbing', 'ceramics'], 'brand', 'توحيد ماركة جروهي'),
  ('ديورافيت', ARRAY['ديورافيت', 'duravit'], ARRAY['plumbing', 'ceramics'], 'brand', '369 منتج صحي'),
  ('duravit', ARRAY['duravit', 'ديورافيت'], ARRAY['plumbing', 'ceramics'], 'brand', 'توحيد ديورافيت'),
  ('روكا', ARRAY['روكا', 'roca'], ARRAY['plumbing', 'ceramics'], 'brand', '345 منتج روكا'),
  ('roca', ARRAY['roca', 'روكا'], ARRAY['plumbing', 'ceramics'], 'brand', 'توحيد روكا'),
  ('فوماجالي', ARRAY['fumagalli', 'فوماجالي'], ARRAY['electrical'], 'brand', '332 منتج إنارة خارجية'),
  ('جالاكسي', ARRAY['galaxy', 'galaxy lighting', 'جالاكسي'], ARRAY['electrical'], 'brand', '224 منتج إنارة'),
  ('ايديال', ARRAY['ايديال ستاندرد', 'ايديال', 'ideal standard'], ARRAY['plumbing', 'ceramics'], 'brand', '204 منتج صحي'),
  ('ليسيكو', ARRAY['ليسيكو', 'lecico'], ARRAY['plumbing', 'ceramics'], 'brand', '168 منتج صحي'),
  ('ايه بي بي', ARRAY['abb', 'ايه بي بي'], ARRAY['electrical'], 'brand', '138 منتج ABB'),
  ('باننجر', ARRAY['باننجر', 'ايجيك', 'المصريه الالمانيه', 'banninger'], ARRAY['plumbing'], 'brand', 'مواسير تغذية ألماني'),
  ('هاجر', ARRAY['هاجر', 'hager'], ARRAY['electrical'], 'brand', '87 منتج قواطع ولوحات'),
  ('جي ال سي', ARRAY['جي ال سي', 'glc'], ARRAY['paint'], 'brand', 'دهانات GLC'),
  ('glc', ARRAY['جي ال سي', 'glc'], ARRAY['paint'], 'brand', 'دهانات GLC'),
  ('كلودي', ARRAY['كلودي', 'كلودي راك', 'kludi'], ARRAY['plumbing', 'ceramics'], 'brand', 'خلاطات كلودي'),
  ('سيكا', ARRAY['سيكا', 'sika'], ARRAY['building_materials', 'paint', 'ceramics'], 'brand', 'كيماويات بناء وعزل وجراوت'),
  ('sika', ARRAY['سيكا', 'sika'], ARRAY['building_materials', 'paint', 'ceramics'], 'brand', 'كيماويات بناء سيكا'),
  ('السويدي', ARRAY['السويدي', 'السويدى', 'elsewedy'], ARRAY['electrical', 'low_current'], 'brand', 'أسلاك وكابلات السويدي'),
  ('كليوباترا', ARRAY['كليوباترا', 'cleopatra'], ARRAY['ceramics'], 'brand', 'سيراميك وبورسلان كليوباترا'),
  ('الجوهره', ARRAY['الجوهره', 'gemma'], ARRAY['ceramics'], 'brand', 'سيراميك الجوهرة'),
  ('ميديا', ARRAY['ميديا', 'midea'], ARRAY['hvac', 'appliances'], 'brand', 'تكييفات وأجهزة ميديا'),

  ('فيشه', ARRAY['فيش', 'فيشه', 'بريزه', 'مقبس', 'ماخذ'], ARRAY['electrical', 'low_current'], 'slang', 'الفيشة = بريزة/مقبس'),
  ('فيش', ARRAY['فيش', 'فيشه', 'بريزه', 'مقبس'], ARRAY['electrical', 'low_current'], 'slang', 'الفيش والبرايز (دكر/نتاية/بريزة)'),
  ('بريزه', ARRAY['بريزه', 'مقبس', 'فيشه'], ARRAY['electrical', 'low_current'], 'product', 'برايز كهرباء ونت'),
  ('وش كهربا', ARRAY['شاسيه', 'وجه', 'وش', 'اطار', 'فريم'], ARRAY['electrical'], 'slang', 'وش المفاتيح والبرايز'),
  ('مفتاح كهربا', ARRAY['مفتاح', 'لقمه', 'قواطع', 'قاطع'], ARRAY['electrical'], 'slang', 'مفاتيح إنارة وقواطع'),
  ('قواطع', ARRAY['قاطع', 'مفتاح اوتوماتيك', 'لوحه توزيع', 'قواطع'], ARRAY['electrical'], 'product', 'قواطع ولوحات'),
  ('اوتوماتيك', ARRAY['قاطع', 'مفتاح اوتوماتيك', 'لوحه'], ARRAY['electrical'], 'slang', 'مفتاح أوتوماتيك في اللوحة'),
  ('لمضه', ARRAY['لمبه', 'سبوت', 'كشاف', 'ليد', 'led'], ARRAY['electrical'], 'slang', 'اللمضة = لمبة ليد/سبوت'),
  ('اسبوت', ARRAY['سبوت', 'اسبوت', 'لمبه', 'داون لايت'], ARRAY['electrical'], 'slang', 'سبوت لايت'),
  ('كبل', ARRAY['كابل', 'سلك', 'كبل'], ARRAY['electrical', 'low_current'], 'slang', 'توحيد كبل/كابل/سلك'),
  ('سلك نت', ARRAY['سلك نت', 'كابل نت', 'cat6', 'cat 6', 'utp', 'ftp'], ARRAY['low_current'], 'product', 'كابلات الشبكات'),
  ('انترنت', ARRAY['نت', 'cat6', 'cat 6', 'utp', 'واي فاي'], ARRAY['low_current', 'smart_home'], 'slang', 'مخارج وأسلاك نت'),
  ('بواط', ARRAY['بواط', 'بواطات'], ARRAY['electrical', 'low_current', 'doors_windows'], 'product', 'بواطات تجميع كهرباء وإنتركوم'),

  ('حنفيه', ARRAY['خلاط', 'حنفيه', 'محبس'], ARRAY['plumbing', 'ceramics', 'marble'], 'slang', 'الحنفية = خلاط أو حنفية'),
  ('دش', ARRAY['دش', 'شاور', 'سماعه', 'عمود دش', 'مسطره'], ARRAY['plumbing'], 'slang', 'مستلزمات الدش والشاور'),
  ('قعده', ARRAY['قاعده', 'مرحاض', 'كومبينيشن', 'تواليت', 'صندوق طرد'], ARRAY['plumbing', 'ceramics'], 'slang', 'قاعدة حمام'),
  ('تواليت', ARRAY['قاعده', 'مرحاض', 'تواليت', 'خزان دفن'], ARRAY['plumbing', 'ceramics'], 'slang', 'قعدة حمام وتواليت'),
  ('سيفون', ARRAY['خزان دفن', 'صندوق طرد', 'سيفون', 'ماكينه طرد'], ARRAY['plumbing', 'smart_home'], 'slang', 'سيفون وخزانات دفن'),
  ('بلاعه', ARRAY['صفايه', 'بيبه', 'بلاعه', 'صرف'], ARRAY['plumbing'], 'slang', 'البلاعة = صفاية / بيبة'),
  ('ماسوره', ARRAY['ماسوره', 'مواسير', 'كوع', 'وصله', 'بوصه'], ARRAY['plumbing'], 'product', 'مواسير ولوازم تغذية وصرف'),
  ('موتور ميه', ARRAY['موتور', 'مواتير', 'مضخه', 'طلمبه'], ARRAY['plumbing'], 'slang', 'مواتير مياه'),
  ('حوض', ARRAY['حوض', 'احواض', 'حوض حمام', 'حوض مطبخ'], ARRAY['ceramics', 'marble', 'plumbing'], 'product', 'أحواض حمام ومطبخ جرانيت'),
  ('غراء سيراميك', ARRAY['لاصق سيراميك', 'ماده لصق', 'لواصق', 'سيكا'], ARRAY['ceramics', 'building_materials'], 'slang', 'مادة لصق السيراميك والبورسلان'),
  ('سقيه', ARRAY['جراوت', 'فواصل', 'سقيه', 'سقايه'], ARRAY['ceramics', 'building_materials'], 'slang', 'سقية فواصل السيراميك'),
  ('بلاط', ARRAY['سيراميك', 'بورسلان', 'ارضيات', 'بلاط'], ARRAY['ceramics'], 'slang', 'بلاط وسيراميك وبورسلان'),

  ('نقاشه', ARRAY['دهان', 'دهانات', 'بلاستيك', 'معجون', 'سيلر'], ARRAY['paint'], 'slang', 'خامات النقاشة والدهانات'),
  ('بويه', ARRAY['دهان', 'دهانات', 'بلاستيك', 'لاكيه'], ARRAY['paint'], 'slang', 'البوية = دهانات'),
  ('عزل', ARRAY['عزل', 'عوازل', 'سيكا', 'رطوبه', 'بيتومين'], ARRAY['paint', 'building_materials'], 'category', 'عزل مائي وحراري'),
  ('جيبسون بورد', ARRAY['جبس بورد', 'الواح جبس', 'جبس'], ARRAY['building_materials'], 'slang', 'ألواح جبس بورد'),
  ('لصق رخام', ARRAY['لصق رخام', 'كابسي', 'معجون رخام', 'لواصق'], ARRAY['marble'], 'product', 'لواصق ومعاجين الرخام'),

  ('كالون', ARRAY['كالون', 'قلب باب', 'قفل', 'ترباس'], ARRAY['doors_windows'], 'slang', 'كوالين وقلوب أبواب'),
  ('قفل ذكي', ARRAY['قفل ذكي', 'اقفال ذكيه', 'كالون', 'سمارت'], ARRAY['doors_windows', 'smart_home'], 'product', 'أقفال ذكية'),
  ('قفل باب', ARRAY['قفل ذكي', 'كالون', 'قفل باب', 'kdl-7891spk'], ARRAY['doors_windows', 'smart_home'], 'product', 'أقفال وكوالين الأبواب'),
  ('دور لوك', ARRAY['قفل ذكي', 'قفل باب', 'كالون', 'kdl-7891spk'], ARRAY['doors_windows', 'smart_home'], 'product', 'أقفال وكوالين أبواب ذكية'),
  ('اكسس دور', ARRAY['اكسس كنترول', 'انتركوم', 'كالون', 'قفل ذكي', 'klp-w350', 'kdl-7891spk'], ARRAY['doors_windows', 'smart_home', 'low_current', 'building_materials'], 'product', 'أكسس كنترول وإنتركوم وأقفال دخول'),
  ('اكسس كنترول', ARRAY['اكسس كنترول', 'انتركوم', 'كالون', 'قفل ذكي', 'klp-w350', 'kdl-7891spk'], ARRAY['doors_windows', 'smart_home', 'low_current', 'building_materials'], 'product', 'لوحات التحكم في الدخول وأكسس كنترول'),
  ('سمارت هوم', ARRAY['سمارت هوم', 'سمارت', 'ذكي', 'واي فاي'], ARRAY['smart_home', 'safety_sensors'], 'category', 'منتجات السمارت هوم'),
  ('انذار حريق', ARRAY['انذار حريق', 'هانيويل', 'حساس', 'كاسر'], ARRAY['safety_sensors'], 'product', 'أنظمة إنذار وحساسات أمان'),

  ('تكيف', ARRAY['تكييف', 'سبليت', 'انفرتر', 'ميديا'], ARRAY['hvac'], 'slang', 'توحيد تكيف/تكييف'),
  ('مكيف', ARRAY['تكييف', 'سبليت', 'انفرتر'], ARRAY['hvac'], 'slang', 'مكيف = تكييف'),
  ('شفاط', ARRAY['شفاط', 'شفاطات', 'بيكو', 'مروحه'], ARRAY['appliances', 'hvac'], 'product', 'شفاطات المطبخ والحمام'),
  ('سخان', ARRAY['سخان', 'سخانات', 'ترموستات سخان'], ARRAY['appliances', 'building_materials'], 'product', 'سخانات المياه'),
  ('غساله', ARRAY['غساله', 'غسالات', 'غساله اطباق', 'زانوسي', 'اريستون'], ARRAY['appliances', 'safety_sensors'], 'product', 'غسالات ملابس وأطباق'),
  ('شنيور', ARRAY['شنيور', 'دريل', 'مثقاب'], ARRAY['tools_hardware'], 'slang', 'الشنيور والبنط'),
  ('صاروخ', ARRAY['صاروخ', 'اسطوانه', 'منشار'], ARRAY['tools_hardware'], 'slang', 'صاروخ التقطيع وإكسسواراته'),
  ('عده', ARRAY['مفتاح', 'مفك', 'بنسه', 'شاكوش', 'الانكيه', 'ميزان'], ARRAY['tools_hardware'], 'slang', 'عدد وأدوات يدوية')
ON CONFLICT (term_normalized) DO NOTHING;

-- 6) دالة البحث الذكية بالمرادفات (copilot_search_products)
CREATE OR REPLACE FUNCTION public.copilot_search_products(
  p_query text DEFAULT '',
  p_category text DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_in_stock_only boolean DEFAULT false,
  p_sort text DEFAULT 'relevance',
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id text,
  code text,
  name text,
  category text,
  sub_category text,
  brand text,
  unit text,
  price numeric,
  old_price numeric,
  install_price numeric,
  currency text,
  badge text,
  in_stock boolean,
  featured boolean,
  image_url text,
  specs jsonb,
  short_description text,
  relevance_score real
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_q text := public.phi_normalize_arabic(coalesce(p_query, ''));
  v_work_q text := v_q;
  v_cat text := nullif(btrim(coalesce(p_category, '')), '');
  v_brand text := nullif(public.phi_normalize_arabic(coalesce(p_brand, '')), '');
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 8), 1), 15);
  v_groups jsonb := '[]'::jsonb;
  v_group_alts text[];
  v_tok_cats text[];
  v_brand_alts text[];
  v_boost_cats text[] := ARRAY[]::text[];
  v_like_patterns text[] := ARRAY[]::text[];
  v_expanded_words text[] := ARRAY[]::text[];
  v_expanded_q text := v_q;
  v_total_groups integer := 0;
  v_min_groups integer := 0;
  v_syn record;
  v_tok text;
BEGIN
  IF v_cat = 'all' THEN v_cat := NULL; END IF;

  IF v_q <> '' THEN
    FOR v_syn IN
      SELECT s.term_normalized, s.expand_terms, s.target_categories
      FROM public.store_search_synonyms s
      WHERE s.is_active = true
        AND position(' ' in s.term_normalized) > 0
        AND (' ' || v_work_q || ' ') LIKE ('% ' || s.term_normalized || ' %')
      ORDER BY length(s.term_normalized) DESC
    LOOP
      v_groups := v_groups || jsonb_build_array(to_jsonb(v_syn.expand_terms));
      v_boost_cats := v_boost_cats || coalesce(v_syn.target_categories, ARRAY[]::text[]);
      v_expanded_words := v_expanded_words || v_syn.expand_terms;
      v_work_q := btrim(
        regexp_replace(
          ' ' || v_work_q || ' ',
          ' ' || regexp_replace(v_syn.term_normalized, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || ' ',
          ' ',
          'g'
        )
      );
    END LOOP;

    FOR v_tok IN
      SELECT t
      FROM unnest(regexp_split_to_array(v_work_q, '\s+')) AS t
      WHERE length(t) >= 2 OR t ~ '\d'
    LOOP
      v_group_alts := NULL;
      v_tok_cats := NULL;

      SELECT s.expand_terms, s.target_categories
      INTO v_group_alts, v_tok_cats
      FROM public.store_search_synonyms s
      WHERE s.is_active = true
        AND (
          s.term_normalized = v_tok
          OR (length(v_tok) > 3 AND left(v_tok, 2) = 'ال' AND s.term_normalized = substr(v_tok, 3))
        )
      LIMIT 1;

      IF FOUND AND coalesce(cardinality(v_group_alts), 0) > 0 THEN
        v_groups := v_groups || jsonb_build_array(to_jsonb(v_group_alts));
        IF coalesce(cardinality(v_tok_cats), 0) > 0 THEN
          SELECT coalesce(array_agg(DISTINCT c), v_boost_cats)
          INTO v_boost_cats
          FROM unnest(v_boost_cats || v_tok_cats) AS c;
        END IF;
        v_expanded_words := v_expanded_words || v_group_alts;
      ELSE
        IF length(v_tok) > 3 AND left(v_tok, 2) = 'ال' THEN
          v_group_alts := ARRAY[v_tok, substr(v_tok, 3)];
        ELSE
          v_group_alts := ARRAY[v_tok];
        END IF;
        v_groups := v_groups || jsonb_build_array(to_jsonb(v_group_alts));
        v_expanded_words := v_expanded_words || v_group_alts;
      END IF;
    END LOOP;

    v_total_groups := jsonb_array_length(v_groups);
    v_min_groups := CASE
      WHEN v_total_groups <= 2 THEN v_total_groups
      ELSE ceil(v_total_groups * 0.65)::integer
    END;

    SELECT coalesce(array_agg(DISTINCT '%' || w || '%'), ARRAY[]::text[])
    INTO v_like_patterns
    FROM unnest(v_expanded_words) AS w
    WHERE length(w) >= 2 OR w ~ '\d';

    SELECT coalesce(string_agg(DISTINCT w, ' '), v_q)
    INTO v_expanded_q
    FROM unnest(v_expanded_words) AS w;
  END IF;

  IF v_brand IS NOT NULL THEN
    SELECT coalesce(array_agg(DISTINCT x), ARRAY[v_brand])
    INTO v_brand_alts
    FROM (
      SELECT v_brand AS x
      UNION
      SELECT unnest(s.expand_terms)
      FROM public.store_search_synonyms s
      WHERE s.is_active = true AND s.term_normalized = v_brand
    ) b;
  ELSE
    v_brand_alts := NULL;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT p.*
    FROM public.store_catalog_products p
    WHERE (v_cat IS NULL OR p.category = v_cat)
      AND (
        v_brand_alts IS NULL
        OR EXISTS (
          SELECT 1
          FROM unnest(v_brand_alts) AS b_alt
          WHERE public.phi_normalize_arabic(p.brand) LIKE '%' || b_alt || '%'
        )
      )
      AND (NOT coalesce(p_in_stock_only, false) OR p.in_stock = true)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR (p.price > 0 AND p.price <= p_max_price))
      AND (
        v_q = ''
        OR lower(p.code) = v_q
        OR (coalesce(cardinality(v_like_patterns), 0) > 0 AND p.search_text LIKE ANY (v_like_patterns))
        OR p.name_normalized %> v_q
        OR p.search_text %> v_q
      )
  ),
  scored AS (
    SELECT
      c.*,
      CASE
        WHEN v_total_groups = 0 THEN 0
        ELSE (
          SELECT count(*)::integer
          FROM jsonb_array_elements(v_groups) AS grp
          WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(grp) AS alt
            WHERE CASE
              WHEN length(alt) <= 4 THEN
                (' ' || regexp_replace(c.search_text, '[^0-9a-zء-ي]+', ' ', 'g') || ' ') LIKE '% ' || alt || ' %'
              ELSE
                c.search_text LIKE '%' || alt || '%'
            END
          )
        )
      END AS matched_groups,
      CASE
        WHEN v_q = '' THEN 0.0
        ELSE GREATEST(
          word_similarity(v_q, c.name_normalized),
          word_similarity(v_expanded_q, c.name_normalized)
        )
      END AS name_sim,
      CASE
        WHEN v_q = '' THEN 0.0
        ELSE word_similarity(v_q, c.search_text)
      END AS body_sim
    FROM candidates c
  ),
  ranked AS (
    SELECT
      s.*,
      (
        CASE WHEN v_q <> '' AND lower(s.code) = v_q THEN 140.0 ELSE 0.0 END
        + CASE
          WHEN v_q <> '' AND (
            CASE
              WHEN length(v_q) <= 4 THEN
                (' ' || regexp_replace(s.name_normalized, '[^0-9a-zء-ي]+', ' ', 'g') || ' ') LIKE '% ' || v_q || ' %'
              ELSE
                s.name_normalized LIKE '%' || v_q || '%'
            END
          ) THEN 55.0
          ELSE 0.0
        END
        + CASE WHEN v_total_groups > 0 AND s.matched_groups = v_total_groups THEN 50.0 ELSE 0.0 END
        + (s.matched_groups * 24.0)
        + (s.name_sim * 35.0)
        + (s.body_sim * 15.0)
        + CASE WHEN coalesce(cardinality(v_boost_cats), 0) > 0 AND s.category = ANY(v_boost_cats) THEN 14.0 ELSE 0.0 END
        + CASE WHEN s.featured THEN 2.5 ELSE 0.0 END
        + CASE WHEN s.in_stock THEN 1.5 ELSE 0.0 END
        + CASE WHEN s.price > 0 THEN 1.0 ELSE 0.0 END
        + CASE WHEN coalesce(s.media_id, '') <> '' THEN 1.0 ELSE 0.0 END
      )::real AS calc_score
    FROM scored s
    WHERE v_q = ''
       OR lower(s.code) = v_q
       OR s.matched_groups >= v_min_groups
       OR (length(v_q) > 4 AND (s.name_sim >= 0.42 OR s.body_sim >= 0.45))
  )
  SELECT
    r.id,
    r.code,
    r.name,
    r.category,
    r.sub_category,
    r.brand,
    r.unit,
    r.price,
    r.old_price,
    r.install_price,
    r.currency,
    r.badge,
    r.in_stock,
    r.featured,
    CASE
      WHEN coalesce(r.media_id, '') <> '' THEN '/api/store-media/' || r.media_id
      ELSE coalesce(r.image_url, '')
    END AS image_url,
    coalesce(r.specs, '[]'::jsonb) AS specs,
    left(coalesce(r.description, ''), 180) AS short_description,
    r.calc_score AS relevance_score
  FROM ranked r
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN CASE WHEN r.price > 0 THEN r.price ELSE 999999999 END END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN r.price END DESC NULLS LAST,
    r.calc_score DESC,
    r.featured DESC,
    r.price ASC
  LIMIT v_lim;
END;
$$;

-- 7) تفاصيل منتج كامل + 3 بدائل مقترحة
CREATE OR REPLACE FUNCTION public.copilot_get_product_details(
  p_product_id text DEFAULT NULL,
  p_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_id text := nullif(btrim(coalesce(p_product_id, '')), '');
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_prod public.store_catalog_products%ROWTYPE;
  v_alts jsonb := '[]'::jsonb;
BEGIN
  IF v_id IS NULL AND v_code IS NULL THEN
    RETURN jsonb_build_object('found', false, 'product', NULL, 'alternatives', '[]'::jsonb);
  END IF;

  SELECT *
  INTO v_prod
  FROM public.store_catalog_products p
  WHERE (v_id IS NOT NULL AND p.id = v_id)
     OR (v_code IS NOT NULL AND lower(p.code) = lower(v_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'product', NULL, 'alternatives', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(alt_row), '[]'::jsonb)
  INTO v_alts
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'code', a.code,
      'name', a.name,
      'brand', a.brand,
      'price', a.price,
      'install_price', a.install_price,
      'currency', a.currency,
      'unit', a.unit,
      'in_stock', a.in_stock,
      'image_url', CASE
        WHEN coalesce(a.media_id, '') <> '' THEN '/api/store-media/' || a.media_id
        ELSE coalesce(a.image_url, '')
      END
    ) AS alt_row
    FROM public.store_catalog_products a
    WHERE a.id <> v_prod.id
      AND a.category = v_prod.category
      AND a.in_stock = true
    ORDER BY
      (a.sub_category = v_prod.sub_category) DESC,
      (lower(a.brand) = lower(v_prod.brand)) DESC,
      abs(coalesce(a.price, 0) - coalesce(v_prod.price, 0)) ASC
    LIMIT 3
  ) sub;

  RETURN jsonb_build_object(
    'found', true,
    'product', jsonb_build_object(
      'id', v_prod.id,
      'code', v_prod.code,
      'name', v_prod.name,
      'category', v_prod.category,
      'sub_category', v_prod.sub_category,
      'brand', v_prod.brand,
      'unit', v_prod.unit,
      'price', v_prod.price,
      'old_price', v_prod.old_price,
      'install_price', v_prod.install_price,
      'currency', v_prod.currency,
      'badge', v_prod.badge,
      'description', v_prod.description,
      'specs', coalesce(v_prod.specs, '[]'::jsonb),
      'variants', coalesce(v_prod.variants, '[]'::jsonb),
      'attachments', coalesce(v_prod.attachments, '[]'::jsonb),
      'in_stock', v_prod.in_stock,
      'featured', v_prod.featured,
      'image_url', CASE
        WHEN coalesce(v_prod.media_id, '') <> '' THEN '/api/store-media/' || v_prod.media_id
        ELSE coalesce(v_prod.image_url, '')
      END
    ),
    'alternatives', v_alts
  );
END;
$$;

-- 8) ملخص الكتالوج الكلي (copilot_catalog_overview)
CREATE OR REPLACE FUNCTION public.copilot_catalog_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH cat_stats AS (
    SELECT
      category,
      count(*)::int AS product_count,
      count(*) FILTER (WHERE in_stock)::int AS in_stock_count,
      min(price) FILTER (WHERE price > 0) AS min_price,
      max(price) FILTER (WHERE price > 0) AS max_price
    FROM public.store_catalog_products
    GROUP BY category
    ORDER BY product_count DESC
  ),
  brand_stats AS (
    SELECT brand, count(*)::int AS product_count
    FROM public.store_catalog_products
    WHERE nullif(btrim(brand), '') IS NOT NULL
    GROUP BY brand
    ORDER BY product_count DESC
    LIMIT 20
  ),
  totals AS (
    SELECT
      count(*)::int AS total_products,
      count(*) FILTER (WHERE in_stock)::int AS in_stock_products,
      count(*) FILTER (WHERE coalesce(install_price, 0) > 0)::int AS with_install_price_count,
      count(*) FILTER (WHERE old_price IS NOT NULL AND old_price > price)::int AS discounted_count
    FROM public.store_catalog_products
  )
  SELECT jsonb_build_object(
    'total_products', coalesce((SELECT total_products FROM totals), 0),
    'in_stock_products', coalesce((SELECT in_stock_products FROM totals), 0),
    'with_install_price_count', coalesce((SELECT with_install_price_count FROM totals), 0),
    'discounted_count', coalesce((SELECT discounted_count FROM totals), 0),
    'categories', coalesce((SELECT jsonb_agg(to_jsonb(cat_stats)) FROM cat_stats), '[]'::jsonb),
    'top_brands', coalesce((SELECT jsonb_agg(to_jsonb(brand_stats)) FROM brand_stats), '[]'::jsonb)
  );
$$;

-- 9) تسعير وحساب إجمالي الطلب رسمياً (copilot_estimate_order)
CREATE OR REPLACE FUNCTION public.copilot_estimate_order(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_elem jsonb;
  v_prod public.store_catalog_products%ROWTYPE;
  v_prod_id text;
  v_code text;
  v_qty integer;
  v_with_install boolean;
  v_supply_line numeric;
  v_install_line numeric;
  v_saved_line numeric;
  v_supply_subtotal numeric := 0;
  v_install_subtotal numeric := 0;
  v_total_saved numeric := 0;
  v_has_unpriced boolean := false;
  v_has_install boolean := false;
  v_currency text := 'ج.م';
  v_lines jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object(
      'items', '[]'::jsonb,
      'missing_items', '[]'::jsonb,
      'supply_subtotal', 0,
      'install_subtotal', 0,
      'grand_total', 0,
      'total_saved', 0,
      'currency', v_currency,
      'has_unpriced_items', false,
      'has_installation', false
    );
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := nullif(btrim(coalesce(v_elem->>'product_id', v_elem->>'productId', '')), '');
    v_code := nullif(btrim(coalesce(v_elem->>'code', '')), '');

    IF v_prod_id IS NULL AND v_code IS NULL THEN
      v_missing := v_missing || jsonb_build_array(v_elem);
      CONTINUE;
    END IF;

    v_qty := CASE
      WHEN coalesce(v_elem->>'qty', '') ~ '^\d+$'
      THEN LEAST(GREATEST((v_elem->>'qty')::integer, 1), 1000)
      ELSE 1
    END;

    v_with_install := lower(coalesce(v_elem->>'with_install', v_elem->>'withInstall', 'false')) IN ('true', '1', 'yes', 't');

    SELECT *
    INTO v_prod
    FROM public.store_catalog_products p
    WHERE (v_prod_id IS NOT NULL AND p.id = v_prod_id)
       OR (v_code IS NOT NULL AND lower(p.code) = lower(v_code))
    LIMIT 1;

    IF NOT FOUND THEN
      v_missing := v_missing || jsonb_build_array(v_elem);
      CONTINUE;
    END IF;

    v_currency := coalesce(nullif(v_prod.currency, ''), v_currency);
    IF coalesce(v_prod.price, 0) <= 0 THEN
      v_has_unpriced := true;
    END IF;
    IF v_with_install THEN
      v_has_install := true;
    END IF;

    v_supply_line := round(coalesce(v_prod.price, 0) * v_qty, 2);
    v_install_line := CASE WHEN v_with_install THEN round(coalesce(v_prod.install_price, 0) * v_qty, 2) ELSE 0 END;
    v_saved_line := CASE
      WHEN v_prod.old_price IS NOT NULL AND v_prod.old_price > v_prod.price
      THEN round((v_prod.old_price - v_prod.price) * v_qty, 2)
      ELSE 0
    END;

    v_supply_subtotal := v_supply_subtotal + v_supply_line;
    v_install_subtotal := v_install_subtotal + v_install_line;
    v_total_saved := v_total_saved + v_saved_line;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'productId', v_prod.id,
        'code', v_prod.code,
        'name', v_prod.name,
        'unit', v_prod.unit,
        'qty', v_qty,
        'price', coalesce(v_prod.price, 0),
        'installPrice', coalesce(v_prod.install_price, 0),
        'withInstall', v_with_install,
        'currency', v_prod.currency,
        'lineSupplyTotal', v_supply_line,
        'lineInstallTotal', v_install_line,
        'lineTotal', v_supply_line + v_install_line,
        'installNeedsQuote', (v_with_install AND coalesce(v_prod.install_price, 0) <= 0)
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'items', v_lines,
    'missing_items', v_missing,
    'supply_subtotal', round(v_supply_subtotal, 2),
    'install_subtotal', round(v_install_subtotal, 2),
    'grand_total', round(v_supply_subtotal + v_install_subtotal, 2),
    'total_saved', round(v_total_saved, 2),
    'currency', v_currency,
    'has_unpriced_items', v_has_unpriced,
    'has_installation', v_has_install
  );
END;
$$;

-- 10) إتمام وتسجيل الطلب أو حجز التركيب/الصيانة (محصّنة للباك إند service_role فقط)
CREATE OR REPLACE FUNCTION public.copilot_submit_order_or_service(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order_type text;
  v_name text := btrim(coalesce(p_payload->>'customerName', ''));
  v_phone text := btrim(coalesce(p_payload->>'customerPhone', ''));
  v_phone_digits text;
  v_email text := btrim(coalesce(p_payload->>'customerEmail', ''));
  v_city text := btrim(coalesce(p_payload->>'city', ''));
  v_address text := btrim(coalesce(p_payload->>'address', ''));
  v_notes text := btrim(coalesce(p_payload->>'notes', ''));
  v_user_id uuid := NULL;
  v_prefix text;
  v_ref_code text;
  v_estimate jsonb;
  v_with_installation boolean;
  v_details jsonb;
  v_saved_id text;
BEGIN
  v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');
  IF v_name = '' OR length(v_phone_digits) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'يرجى إدخال الاسم الكامل ورقم الجوال الصحيح (8 أرقام على الأقل)');
  END IF;

  v_order_type := CASE
    WHEN p_payload->>'orderType' = 'maintenance_request' THEN 'maintenance_request'
    WHEN p_payload->>'orderType' = 'property_inquiry' THEN 'property_inquiry'
    ELSE 'store_order'
  END;

  IF nullif(btrim(coalesce(p_payload->>'userId', '')), '') IS NOT NULL THEN
    BEGIN
      v_user_id := (p_payload->>'userId')::uuid;
    EXCEPTION WHEN others THEN
      v_user_id := NULL;
    END;
  END IF;

  v_estimate := public.copilot_estimate_order(coalesce(p_payload->'items', '[]'::jsonb));

  IF v_order_type = 'store_order' AND jsonb_array_length(coalesce(v_estimate->'items', '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا توجد منتجات صالحة في الطلب لإتمامه');
  END IF;

  v_with_installation := CASE
    WHEN p_payload ? 'withInstallation' THEN lower(coalesce(p_payload->>'withInstallation', 'false')) IN ('true', '1', 'yes', 't')
    WHEN p_payload ? 'with_installation' THEN lower(coalesce(p_payload->>'with_installation', 'false')) IN ('true', '1', 'yes', 't')
    ELSE coalesce((v_estimate->>'has_installation')::boolean, false)
  END;

  v_prefix := CASE
    WHEN v_order_type = 'maintenance_request' THEN 'MNT'
    WHEN v_order_type = 'property_inquiry' THEN 'PRP'
    ELSE 'ORD'
  END;
  v_ref_code := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

  v_details := jsonb_build_object(
    'refCode', v_ref_code,
    'orderType', v_order_type,
    'source', 'store_copilot_ai',
    'sessionId', nullif(btrim(coalesce(p_payload->>'sessionId', '')), ''),
    'customerName', v_name,
    'customerPhone', v_phone,
    'customerEmail', v_email,
    'city', v_city,
    'address', v_address,
    'notes', v_notes,
    'withInstallation', v_with_installation,
    'items', coalesce(v_estimate->'items', '[]'::jsonb),
    'maintenanceService', coalesce(p_payload->'maintenanceService', 'null'::jsonb),
    'property', coalesce(p_payload->'property', 'null'::jsonb),
    'supplySubtotal', coalesce((v_estimate->>'supply_subtotal')::numeric, 0),
    'installSubtotal', coalesce((v_estimate->>'install_subtotal')::numeric, 0),
    'totalAmount', coalesce((v_estimate->>'grand_total')::numeric, 0),
    'currency', coalesce(nullif(v_estimate->>'currency', ''), 'ج.م'),
    'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  INSERT INTO public.user_requests (user_id, type, category, subject, details, status)
  VALUES (
    v_user_id,
    v_order_type,
    v_ref_code,
    v_name || ' — ' || v_phone,
    v_details::text,
    'جديد'
  )
  RETURNING id::text INTO v_saved_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_saved_id,
    'refCode', v_ref_code,
    'order', v_details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.copilot_submit_order_or_service(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_submit_order_or_service(jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.copilot_search_products(text, text, text, numeric, numeric, boolean, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copilot_get_product_details(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copilot_catalog_overview() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copilot_estimate_order(jsonb) TO anon, authenticated, service_role;
