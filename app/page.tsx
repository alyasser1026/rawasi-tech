import type { Metadata } from 'next';
import PhiSite from './site/PhiSite';
import { sanitizeContent } from './site/site-content';
import { getStoreCatalogShowcase } from '@/lib/store-catalog-server';

// الموقع العام يقرأ فقط النسخة «المنشورة» من إدارة الموقع (دالة عامة)، ولا يلمس بيانات النظام الداخلية.
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

export async function generateMetadata(): Promise<Metadata> {
  const c = await getPublished();
  return {
    title: c.seo?.title || 'فاي تك | مقاولات عامة وتشطيبات فاخرة',
    description:
      c.seo?.description ||
      'فاي تك للمقاولات العامة والتشطيبات الفاخرة: إنشاءات وعظم، تشطيبات معمارية، وكهروميكانيك وتكييف مخفي بإشراف هندسي متكامل.',
  };
}

export default async function HomePage() {
  const content = await getPublished();
  const showcase = await getStoreCatalogShowcase(36, content.products);
  return (
    <PhiSite
      content={content}
      catalogProducts={showcase.items}
      catalogTotalCount={showcase.totalCatalog}
    />
  );
}
