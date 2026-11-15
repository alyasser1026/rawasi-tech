import type { Metadata } from 'next';
import StoreClient from '../site/StoreClient';
import { sanitizeContent } from '../site/site-content';

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
    'متجر فاي تك لتوريد وتركيب أدوات الكهرباء والسباكة والدهانات والسيراميك والرخام والديكورات وأجهزة السمارت هوم والتيار الخفيف وحساسات الحريق والغاز والمياه.',
};

export default async function StorePage() {
  const content = await getPublished();
  return <StoreClient content={content} />;
}
