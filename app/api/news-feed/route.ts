import { NextRequest, NextResponse } from 'next/server';
import { parseRssXml, type ParsedNewsFeedItem } from '@/lib/rssNewsParser';

export const dynamic = 'force-dynamic';

type FeedPresetKey = 'all' | 'real_estate_eg' | 'real_estate_sa' | 'economy';

interface FeedSource {
  name: string;
  url: string;
  defaultTag: string;
}

const FEED_CATALOG: Record<Exclude<FeedPresetKey, 'all'>, FeedSource[]> = {
  real_estate_eg: [
    {
      name: 'أخبار جوجل — عقارات ومواد بناء مصر',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent('السوق العقاري التطوير العقاري أسعار الأسمنت الحديد مصر')}&hl=ar&gl=EG&ceid=EG:ar`,
      defaultTag: 'عقارات مصر',
    },
  ],
  real_estate_sa: [
    {
      name: 'أخبار جوجل — عقارات السعودية والرياض',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent('السوق العقاري الرياض مشاريع عقارية التطوير العقاري السعودية')}&hl=ar&gl=SA&ceid=SA:ar`,
      defaultTag: 'عقارات السعودية',
    },
  ],
  economy: [
    {
      name: 'سكاي نيوز عربية — اقتصاد',
      url: 'https://www.snabusiness.com/rss/iqtisad/rss.xml',
      defaultTag: 'اقتصاد',
    },
    {
      name: 'CNN الاقتصادية',
      url: 'https://cnnbusinessarabic.com/rssFeed/0',
      defaultTag: 'أسواق واقتصاد',
    },
    {
      name: 'أخبار جوجل — اقتصاد مصر والسعودية',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent('اقتصاد الاستثمار البنوك الفائدة مصر السعودية')}&hl=ar&gl=EG&ceid=EG:ar`,
      defaultTag: 'اقتصاد',
    },
  ],
};

function resolveSources(topic: string | null): FeedSource[] {
  if (topic === 'real_estate_eg' || topic === 'real_estate_sa' || topic === 'economy') {
    return FEED_CATALOG[topic];
  }
  return [
    ...FEED_CATALOG.real_estate_eg,
    ...FEED_CATALOG.real_estate_sa,
    ...FEED_CATALOG.economy.slice(0, 2),
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const sources = resolveSources(topic);

  const results = await Promise.all(
    sources.map(async (src) => {
      try {
        const res = await fetch(src.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PhiTechNewsReader/1.0)',
            Accept: 'application/rss+xml, application/xml, text/xml;q=0.9',
          },
          signal: AbortSignal.timeout(7000),
          cache: 'no-store',
        });
        if (!res.ok) return [] as ParsedNewsFeedItem[];
        const xml = await res.text();
        return parseRssXml(xml, src.name, src.defaultTag, 10);
      } catch {
        return [] as ParsedNewsFeedItem[];
      }
    })
  );

  // Interleave items cleanly across sources and remove duplicate headlines.
  const seen = new Set<string>();
  const combined: ParsedNewsFeedItem[] = [];
  const maxLen = Math.max(0, ...results.map((list) => list.length));

  for (let i = 0; i < maxLen; i += 1) {
    for (const list of results) {
      const item = list[i];
      if (!item) continue;
      const key = item.title.replace(/\s+/g, ' ').trim();
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
      if (combined.length >= 24) break;
    }
    if (combined.length >= 24) break;
  }

  return NextResponse.json(
    {
      ok: true,
      topic: topic || 'all',
      fetchedAt: new Date().toISOString(),
      items: combined,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
