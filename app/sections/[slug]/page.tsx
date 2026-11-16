import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SectionDetailClient from '../../site/SectionDetailClient';
import { sanitizeContent } from '../../site/site-content';
import { PORTAL_SECTIONS, VALID_SECTION_SLUGS, type SectionSlug } from '../../site/section-defs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPublished() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const r = await fetch(`${url}/rest/v1/rpc/website_public_content`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });
    if (!r.ok) return {};
    return sanitizeContent(await r.json());
  } catch {
    return {};
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = PORTAL_SECTIONS.find((s) => s.slug === slug);
  if (!meta) {
    return { title: 'القسم غير موجود | فاي تك' };
  }
  return {
    title: `${meta.title} | فاي تك للمقاولات والتشطيبات`,
    description: meta.guideHint,
  };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!VALID_SECTION_SLUGS.has(slug)) {
    notFound();
  }
  const content = await getPublished();
  return <SectionDetailClient slug={slug as SectionSlug} content={content} />;
}
