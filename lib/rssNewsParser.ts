/**
 * Pure RSS XML parser and categorizer for Arabic economic and real-estate feeds.
 */

export interface ParsedNewsFeedItem {
  id: string;
  title: string;
  source: string;
  link: string;
  pubDate: string;
  tag: string;
  suggestedHref: string;
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtmlEntities(input: string): string {
  return String(input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-z]+);/gi, (full, name) => ENTITY_MAP[name.toLowerCase()] ?? full);
}

export function stripXmlTags(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferNewsTopicAndHref(title: string, defaultTag = 'أخبار اقتصادية'): {
  tag: string;
  suggestedHref: string;
} {
  const lower = title.toLowerCase();
  if (/حديد|أسمنت|اسمنت|مواد البناء|تشطيب|خرسانة|دهان|سيراميك|رخام/.test(lower)) {
    return { tag: 'مواد البناء', suggestedHref: '/sections/materials' };
  }
  if (/عقار|عقارات|عقاري|شقق|فيلا|وحدات|سكنية|تطوير|إسكان|مدن جديدة|أراضي|تمليك|متر/.test(lower)) {
    return { tag: 'عقارات', suggestedHref: '/sections/real-estate' };
  }
  if (/ذكي|سمارت|تكنولوجيا|ذكاء اصطناعي|طاقة متجددة|أتمتة/.test(lower)) {
    return { tag: 'تكنولوجيا', suggestedHref: '/sections/smart-home' };
  }
  if (/مقاولات|بناء|إنشاءات|مشاريع|بنية تحتية|تكييف/.test(lower)) {
    return { tag: 'مقاولات', suggestedHref: '/sections/contracting' };
  }
  return { tag: defaultTag, suggestedHref: '/store' };
}

function splitHeadlineAndSource(rawTitle: string, fallbackSource: string): {
  title: string;
  source: string;
} {
  const cleaned = stripXmlTags(rawTitle);
  const idx = cleaned.lastIndexOf(' - ');
  if (idx > 18) {
    const headline = cleaned.slice(0, idx).trim();
    const src = cleaned.slice(idx + 3).trim();
    if (src && src.length <= 48) {
      return { title: headline, source: src };
    }
  }
  return { title: cleaned, source: fallbackSource };
}

function extractTagValue(block: string, tagName: string): string {
  const m = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(block);
  return m ? m[1] : '';
}

export function parseRssXml(
  xml: string,
  fallbackSource: string,
  defaultTag = 'اقتصاد',
  limit = 15
): ParsedNewsFeedItem[] {
  const items: ParsedNewsFeedItem[] = [];
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    if (items.length >= limit) break;
    const block = match[1];
    const rawTitle = extractTagValue(block, 'title');
    if (!rawTitle) continue;

    const { title, source } = splitHeadlineAndSource(rawTitle, fallbackSource);
    if (!title || title.length < 8) continue;

    const rawLink = stripXmlTags(extractTagValue(block, 'link'));
    const link = /^https?:\/\//i.test(rawLink) ? rawLink : '';
    const pubDate = stripXmlTags(extractTagValue(block, 'pubDate'));
    const sourceNode = stripXmlTags(extractTagValue(block, 'source')) || source;
    const { tag, suggestedHref } = inferNewsTopicAndHref(title, defaultTag);

    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash * 31 + title.charCodeAt(i)) | 0;
    }

    items.push({
      id: `rss-${Math.abs(hash).toString(36)}`,
      title: title.slice(0, 200),
      source: sourceNode,
      link,
      pubDate,
      tag,
      suggestedHref,
    });
  }

  return items;
}
