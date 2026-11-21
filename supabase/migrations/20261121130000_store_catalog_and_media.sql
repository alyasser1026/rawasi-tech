-- Reference schema for the public Store Catalog & Telegram Media Registry.
-- Live metadata/index files are synchronized into the private Supabase Storage bucket
-- `store-catalog` and streamed safely via /api/store-catalog and /api/store-media/[id].

CREATE TABLE IF NOT EXISTS public.store_catalog_products (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  name_normalized text NOT NULL DEFAULT '',
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

CREATE INDEX IF NOT EXISTS store_catalog_products_cat_idx
  ON public.store_catalog_products (category, featured DESC, price ASC);

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
