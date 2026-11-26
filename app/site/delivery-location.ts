/**
 * delivery-location.ts — نوع ومعقّم إحداثيات موقع التوصيل والمعاينة (صالح للعميل والخادم).
 */

export interface DeliveryLocation {
  lat: number;
  lng: number;
  mapUrl: string;
  accuracyMeters?: number;
  source?: 'gps' | 'map_pin';
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function parseFiniteCoord(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') {
    return null;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function sanitizeDeliveryLocation(raw: unknown): DeliveryLocation | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const rawLat = parseFiniteCoord(obj.lat);
  const rawLng = parseFiniteCoord(obj.lng);
  if (rawLat === null || rawLng === null) return null;
  if (rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) return null;

  const lat = Number(rawLat.toFixed(6));
  const lng = Number(rawLng.toFixed(6));

  const out: DeliveryLocation = {
    lat,
    lng,
    mapUrl: buildGoogleMapsUrl(lat, lng),
  };

  const rawAcc = parseFiniteCoord(obj.accuracyMeters);
  if (rawAcc !== null && rawAcc >= 0 && rawAcc <= 50_000) {
    out.accuracyMeters = Math.round(rawAcc);
  }

  if (obj.source === 'gps' || obj.source === 'map_pin') {
    out.source = obj.source;
  }

  return out;
}
