import type { Metadata } from 'next';
import RealEstateClient from '../site/RealEstateClient';
import { sanitizeContent } from '../site/site-content';

export const revalidate = 120;

async function getPublished() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const r = await fetch(`${url}/rest/v1/rpc/website_public_content`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      next: { revalidate: 120 },
    });
    if (!r.ok) return {};
    return sanitizeContent(await r.json());
  } catch {
    return {};
  }
}

export const metadata: Metadata = {
  title: 'عروض العقارات والوحدات السكنية والتجارية | فاي تك',
  description:
    'استعرض أحدث عروض الشقق السكنية والدوبلكس والوحدات التجارية من فاي تك للمقاولات العامة والتشطيبات الفاخرة مع أنظمة سداد مرنة.',
};

export default async function RealEstatePage() {
  const content = await getPublished();
  return <RealEstateClient content={content} />;
}
