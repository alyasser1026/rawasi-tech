import type { Metadata } from 'next';
import PhiSite from './site/PhiSite';
import { sanitizeContent } from './site/site-content';

// الموقع العام يقرأ فقط النسخة «المنشورة» من إدارة الموقع (دالة عامة)، ولا يلمس بيانات النظام الداخلية.
export const revalidate = 300;

async function getPublished() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const r = await fetch(`${url}/rest/v1/rpc/website_public_content`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      next: { revalidate: 300 },
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
  return <PhiSite content={content} />;
}
