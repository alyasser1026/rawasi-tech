import { NextResponse } from 'next/server';
import { sanitizeContent } from '@/app/site/site-content';
import { queryStoreCatalog } from '@/lib/store-catalog-server';

export const runtime = 'nodejs';

let publishedCmsCache: { loadedAt: number; products?: ReturnType<typeof sanitizeContent>['products'] } = {
  loadedAt: 0,
};

async function getPublishedCmsProducts() {
  const now = Date.now();
  if (now - publishedCmsCache.loadedAt < 60_000) {
    return publishedCmsCache.products;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return undefined;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/website_public_content`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    if (!r.ok) return publishedCmsCache.products;
    const sanitized = sanitizeContent(await r.json());
    publishedCmsCache = { loadedAt: now, products: sanitized.products };
    return sanitized.products;
  } catch {
    return publishedCmsCache.products;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const q = searchParams.get('q') || '';
    const brandsRaw = searchParams.get('brands') || '';
    const brands = brandsRaw
      ? brandsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const onlyFeatured = searchParams.get('onlyFeatured') === '1';
    const onlyInStock = searchParams.get('onlyInStock') === '1';
    const onlyDiscounted = searchParams.get('onlyDiscounted') === '1';
    const minRaw = searchParams.get('minPrice');
    const maxRaw = searchParams.get('maxPrice');
    const minPrice = minRaw !== null && minRaw !== '' && Number.isFinite(Number(minRaw)) ? Number(minRaw) : null;
    const maxPrice = maxRaw !== null && maxRaw !== '' && Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : null;

    const sortParam = searchParams.get('sort') || 'featured';
    const sort =
      sortParam === 'default' ||
      sortParam === 'name_asc' ||
      sortParam === 'price_asc' ||
      sortParam === 'price_desc'
        ? sortParam
        : 'featured';

    const page = Number(searchParams.get('page') || 1) || 1;
    const pageSize = Number(searchParams.get('pageSize') || 24) || 24;

    const cmsProducts = await getPublishedCmsProducts();
    const result = await queryStoreCatalog(
      {
        category,
        q,
        brands,
        onlyFeatured,
        onlyInStock,
        onlyDiscounted,
        minPrice,
        maxPrice,
        sort,
        page,
        pageSize,
      },
      cmsProducts
    );

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'تعذر تحميل كتالوج المتجر' },
      { status: 500 }
    );
  }
}
