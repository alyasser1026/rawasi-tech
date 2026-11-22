import type { Metadata } from 'next';
import StoreClient from '../site/StoreClient';
import { sanitizeContent } from '../site/site-content';
import { queryStoreCatalog } from '@/lib/store-catalog-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPublished() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const r = await fetch(`${url}/rest/v1/rpc/website_public_content`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    if (!r.ok) return {};
    return sanitizeContent(await r.json());
  } catch {
    return {};
  }
}

export const metadata: Metadata = {
  title: 'متجر المنتجات والأنظمة الذكية | فاي تك للمقاولات والتشطيبات',
  description:
    'متجر فاي تك لتوريد وتركيب أدوات الكهرباء والسباكة والدهانات والسيراميك والرخام والديكورات والتكييف ومواد البناء وأجهزة السمارت هوم والتيار الخفيف بأقل سعر موثق.',
};

export default async function StorePage() {
  const content = await getPublished();
  const [initialCatalog, discountedCatalog] = await Promise.all([
    queryStoreCatalog({ page: 1, pageSize: 24, sort: 'featured' }, content.products),
    queryStoreCatalog({ page: 1, pageSize: 12, onlyDiscounted: true, sort: 'featured' }, content.products),
  ]);
  const seenOfferIds = new Set<string>();
  const initialOffers = [...discountedCatalog.items, ...initialCatalog.items]
    .filter((item) => {
      if (seenOfferIds.has(item.id)) return false;
      seenOfferIds.add(item.id);
      return true;
    })
    .slice(0, 12);
  return (
    <StoreClient
      content={content}
      initialCatalog={initialCatalog}
      initialOffers={initialOffers}
      totalDiscountedCount={discountedCatalog.totalMatched}
    />
  );
}
