import type { Metadata } from 'next';
import PhiSite from '../site/PhiSite';
import { sanitizeContent } from '../site/site-content';

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
    title: `تسجيل الدخول | ${c.seo?.title || 'فاي تك للمقاولات العامة والتشطيبات'}`,
    description:
      c.seo?.description ||
      'بوابة تسجيل الدخول الموحدة لمنظومة فاي تك لإدارة المشاريع والمقاولات.',
  };
}

export default async function LoginPage() {
  const content = await getPublished();
  return <PhiSite content={content} initialLoginOpen={true} />;
}
