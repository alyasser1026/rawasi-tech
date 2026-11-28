/**
 * Shared in-memory per-IP sliding-window rate limiter for public and protected API routes.
 */

const rateGlobal = globalThis as typeof globalThis & {
  __phiApiRateLimitMap?: Map<string, number[]>;
};

function getRateMap(): Map<string, number[]> {
  if (!rateGlobal.__phiApiRateLimitMap) {
    rateGlobal.__phiApiRateLimitMap = new Map<string, number[]>();
  }
  return rateGlobal.__phiApiRateLimitMap;
}

/**
 * Extracts the caller's best-effort IP address from reverse proxy headers.
 */
export function extractRequestIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp.slice(0, 64);
  return 'unknown';
}

/**
 * Checks whether the caller IP may proceed within the configured sliding window.
 */
export function checkIpRateLimit(
  req: Request,
  bucket: string,
  maxRequests: number,
  windowMs = 60_000
): { allowed: boolean; ip: string; remaining: number } {
  const ip = extractRequestIp(req);
  const map = getRateMap();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (map.get(key) || []).filter((ts) => ts > cutoff);

  if (recent.length >= maxRequests) {
    map.set(key, recent);
    return { allowed: false, ip, remaining: 0 };
  }

  recent.push(now);
  map.set(key, recent);

  if (map.size > 2000) {
    for (const [entryKey, timestamps] of map.entries()) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
        map.delete(entryKey);
      }
    }
  }

  return { allowed: true, ip, remaining: Math.max(0, maxRequests - recent.length) };
}
