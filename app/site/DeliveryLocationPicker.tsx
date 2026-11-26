"use client";

import React, { useEffect, useRef, useState } from 'react';
import { buildGoogleMapsUrl, type DeliveryLocation } from './delivery-location';

export interface DeliveryLocationPickerProps {
  value: DeliveryLocation | null;
  onChange: (loc: DeliveryLocation | null) => void;
  compact?: boolean;
}

const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];

function upsertLeafletPin(
  L: any,
  map: any,
  markerRef: React.MutableRefObject<any>,
  lat: number,
  lng: number,
  onDragEndCoords: (dLat: number, dLng: number) => void
) {
  if (!markerRef.current) {
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#ea580c;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.45);transform:rotate(-45deg);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
    const mk = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
    mk.on('dragend', () => {
      const pos = mk.getLatLng();
      onDragEndCoords(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
    });
    markerRef.current = mk;
  } else {
    markerRef.current.setLatLng([lat, lng]);
  }
}

export default function DeliveryLocationPicker({
  value,
  onChange,
  compact = false,
}: DeliveryLocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [tileMode, setTileMode] = useState<'street' | 'satellite'>('street');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const layersRef = useRef<{ street: any; satellite: any }>({ street: null, satellite: null });
  const leafletRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const latestValueRef = useRef(value);

  onChangeRef.current = onChange;
  latestValueRef.current = value;

  useEffect(() => {
    if (!open) {
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        layersRef.current = { street: null, satellite: null };
      }
      return;
    }

    let active = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current || mapRef.current) return;
      const L = (await import('leaflet')).default;
      if (!active || !mapContainerRef.current) return;
      leafletRef.current = L;

      const current = latestValueRef.current;
      const startCenter: [number, number] = current ? [current.lat, current.lng] : DEFAULT_CENTER;
      const startZoom = current ? 16 : 11;

      const map = L.map(mapContainerRef.current, {
        center: startCenter,
        zoom: startZoom,
        zoomControl: true,
        attributionControl: false,
      });

      const street = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      );
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      );

      street.addTo(map);
      layersRef.current = { street, satellite };
      mapRef.current = map;

      const placeMarker = (lat: number, lng: number, source: 'gps' | 'map_pin', acc?: number) => {
        const cleanLat = Number(lat.toFixed(6));
        const cleanLng = Number(lng.toFixed(6));
        const nextLoc: DeliveryLocation = {
          lat: cleanLat,
          lng: cleanLng,
          mapUrl: buildGoogleMapsUrl(cleanLat, cleanLng),
          source,
          ...(typeof acc === 'number' ? { accuracyMeters: Math.round(acc) } : {}),
        };
        onChangeRef.current(nextLoc);
        upsertLeafletPin(L, map, markerRef, cleanLat, cleanLng, (dLat, dLng) => {
          onChangeRef.current({
            lat: dLat,
            lng: dLng,
            mapUrl: buildGoogleMapsUrl(dLat, dLng),
            source: 'map_pin',
          });
        });
      };

      if (current) {
        placeMarker(current.lat, current.lng, current.source || 'map_pin', current.accuracyMeters);
      }

      map.on('click', (ev: any) => {
        if (!ev?.latlng) return;
        placeMarker(ev.latlng.lat, ev.latlng.lng, 'map_pin');
      });

      setMapReady(true);
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          // ignore
        }
      }, 100);
    }

    void initMap();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        layersRef.current = { street: null, satellite: null };
      }
      setMapReady(false);
    };
  }, [open]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const { street, satellite } = layersRef.current;
    if (!street || !satellite) return;
    if (tileMode === 'satellite') {
      if (mapRef.current.hasLayer(street)) mapRef.current.removeLayer(street);
      if (!mapRef.current.hasLayer(satellite)) mapRef.current.addLayer(satellite);
    } else {
      if (mapRef.current.hasLayer(satellite)) mapRef.current.removeLayer(satellite);
      if (!mapRef.current.hasLayer(street)) mapRef.current.addLayer(street);
    }
  }, [tileMode, mapReady]);

  const handleUseCurrentGps = () => {
    setGpsError('');
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setGpsError('متصفحك لا يدعم تحديد الموقع التلقائي، يمكنك الضغط مباشرة على الخريطة لوضع الدبوس.');
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        const cleanLat = Number(pos.coords.latitude.toFixed(6));
        const cleanLng = Number(pos.coords.longitude.toFixed(6));
        const acc = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : undefined;
        const nextLoc: DeliveryLocation = {
          lat: cleanLat,
          lng: cleanLng,
          mapUrl: buildGoogleMapsUrl(cleanLat, cleanLng),
          source: 'gps',
          ...(acc !== undefined ? { accuracyMeters: acc } : {}),
        };
        onChange(nextLoc);

        const map = mapRef.current;
        const L = leafletRef.current;
        if (map && L) {
          map.setView([cleanLat, cleanLng], 17);
          upsertLeafletPin(L, map, markerRef, cleanLat, cleanLng, (dLat, dLng) => {
            onChangeRef.current({
              lat: dLat,
              lng: dLng,
              mapUrl: buildGoogleMapsUrl(dLat, dLng),
              source: 'map_pin',
            });
          });
        }
      },
      (err) => {
        setGpsBusy(false);
        if (err.code === 1) {
          setGpsError('تم رفض إذن الموقع من المتصفح — يمكنك اختيار موقعك يدوياً بالضغط على الخريطة.');
        } else if (err.code === 3) {
          setGpsError('انتهت مهلة تحديد الموقع (GPS) — اضغط على الخريطة لوضع الدبوس يدوياً.');
        } else {
          setGpsError('تعذر تحديد موقع GPS حالياً — يمكنك تحريك الخريطة ووضع الدبوس يدوياً.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  if (!open) {
    if (value) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            padding: compact ? '6px 9px' : '8px 10px',
            borderRadius: '10px',
            border: '1px solid #86efac',
            background: '#f0fdf4',
            fontSize: compact ? '0.72rem' : '0.78rem',
            color: '#166534',
            fontWeight: 700,
          }}
        >
          <div>
            📍 <strong>تم تحديد الموقع الدقيق:</strong>{' '}
            <code dir="ltr">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</code>
            {typeof value.accuracyMeters === 'number' ? ` (±${value.accuracyMeters}م)` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={value.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0369a1', fontWeight: 800, textDecoration: 'underline' }}
            >
              خرائط جوجل ↗
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                border: '1px solid #86efac',
                background: '#ffffff',
                color: '#166534',
                borderRadius: '7px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              تعديل الدبوس
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#dc2626',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✕ إزالة
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: compact ? '7px 10px' : '9px 12px',
          borderRadius: '10px',
          border: '1.5px dashed #cbd5e1',
          background: '#f8fafc',
          color: '#0f172a',
          fontSize: compact ? '0.74rem' : '0.8rem',
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        📍 تحديد موقعي على الخريطة للتوصيل/المعاينة (اختياري)
      </button>
    );
  }

  return (
    <div
      style={{
        border: '1.5px solid #cbd5e1',
        borderRadius: '12px',
        padding: compact ? '8px' : '10px',
        background: '#ffffff',
        display: 'grid',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <button
          type="button"
          onClick={handleUseCurrentGps}
          disabled={gpsBusy}
          style={{
            border: 'none',
            borderRadius: '8px',
            padding: '5px 10px',
            background: '#0284c7',
            color: '#ffffff',
            fontSize: '0.73rem',
            fontWeight: 800,
            cursor: gpsBusy ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {gpsBusy ? 'جارٍ تحديد موقعك...' : '🎯 استخدم موقعي الحالي (GPS)'}
        </button>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setTileMode('street')}
            style={{
              border: `1px solid ${tileMode === 'street' ? '#ea580c' : '#cbd5e1'}`,
              background: tileMode === 'street' ? '#fff7ed' : '#f8fafc',
              color: tileMode === 'street' ? '#c2410c' : '#334155',
              borderRadius: '7px',
              padding: '4px 8px',
              fontSize: '0.71rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            خريطة
          </button>
          <button
            type="button"
            onClick={() => setTileMode('satellite')}
            style={{
              border: `1px solid ${tileMode === 'satellite' ? '#ea580c' : '#cbd5e1'}`,
              background: tileMode === 'satellite' ? '#fff7ed' : '#f8fafc',
              color: tileMode === 'satellite' ? '#c2410c' : '#334155',
              borderRadius: '7px',
              padding: '4px 8px',
              fontSize: '0.71rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            قمر صناعي
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.71rem', color: '#475569', fontWeight: 700 }}>
        اضغط في أي نقطة على الخريطة أو اسحب الدبوس البرتقالي لتحديد موقع التوصيل/المعاينة بدقة:
      </div>

      {gpsError && (
        <div
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.71rem',
            fontWeight: 700,
          }}
        >
          ⚠️ {gpsError}
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: compact ? '200px' : '250px',
          borderRadius: '10px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          background: '#e2e8f0',
        }}
      />

      {value && (
        <div style={{ fontSize: '0.71rem', color: '#166534', fontWeight: 800 }}>
          📌 الإحداثيات المحددة: <code dir="ltr">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</code>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            border: 'none',
            borderRadius: '8px',
            padding: '6px 12px',
            background: 'linear-gradient(135deg, #f97316 0%, #c75517 100%)',
            color: '#ffffff',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ✅ تأكيد هذا الموقع
        </button>

        <button
          type="button"
          onClick={() => {
            onChange(null);
            setGpsError('');
            setOpen(false);
          }}
          style={{
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '6px 10px',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: '0.72rem',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          🗑️ إلغاء الموقع
        </button>
      </div>
    </div>
  );
}
