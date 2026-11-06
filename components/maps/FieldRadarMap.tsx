"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  MapPin, 
  Layers, 
  Navigation, 
  Eye, 
  ShieldCheck, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  ExternalLink,
  Users,
  Coins,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export interface ProjectMapItem {
  id: string;
  Property: string;
  client?: { name?: string };
  status?: string;
  current_stage?: string;
  estimated_budget?: number;
  todayWorkers?: number;
  totalTodayCost?: number;
  activeTasks?: string[];
  location_address?: string;
  location_url?: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geofence_radius?: number; // meters, default 200
}

export interface SiteVisitPin {
  id: string;
  project_id: string;
  title: string;
  status: string;
  inspector_name?: string;
  visit_date?: string;
  notes?: string;
  photo_before_url?: string;
  photo_after_url?: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_location_name?: string;
}

interface FieldRadarMapProps {
  projects: ProjectMapItem[];
  siteVisits?: SiteVisitPin[];
  onSelectProject?: (projectId: string) => void;
  height?: string;
}

// Coordinates helper: parse lat/lng from Google Maps link or fallback to realistic distributed coordinates
function resolveProjectCoordinates(proj: ProjectMapItem, index: number): [number, number] {
  if (proj.geo_lat && proj.geo_lng && !isNaN(proj.geo_lat) && !isNaN(proj.geo_lng)) {
    return [Number(proj.geo_lat), Number(proj.geo_lng)];
  }

  // Parse from location_url if present
  if (proj.location_url) {
    const match = proj.location_url.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
  }

  // Default cluster (New Cairo / Fifth Settlement hub) with organic dispersion
  const baseLat = 30.0131;
  const baseLng = 31.4913;
  const angle = (index * 137.5 * Math.PI) / 180; // Golden angle dispersion
  const radiusKm = 0.8 + (index * 0.45);
  const latOffset = (radiusKm / 111) * Math.cos(angle);
  const lngOffset = (radiusKm / (111 * Math.cos((baseLat * Math.PI) / 180))) * Math.sin(angle);

  return [baseLat + latOffset, baseLng + lngOffset];
}

// Calculate Haversine distance in meters
function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function FieldRadarMap({
  projects,
  siteVisits = [],
  onSelectProject,
  height = '620px'
}: FieldRadarMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  
  const [mapReady, setMapReady] = useState(false);
  const [tileMode, setTileMode] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [showGeofences, setShowGeofences] = useState(true);
  const [showVisits, setShowVisits] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [selectedVisitModal, setSelectedVisitModal] = useState<SiteVisitPin | null>(null);
  const [geofenceAlert, setGeofenceAlert] = useState<{ siteName: string; distance: number; inside: boolean } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects;
    return projects.filter(p => p.status === statusFilter);
  }, [projects, statusFilter]);

  // Initialize Leaflet Map
  useEffect(() => {
    let isSubscribed = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (!isSubscribed || !mapContainerRef.current) return;

      // Create base map
      const map = L.map(mapContainerRef.current, {
        center: [30.0131, 31.4913],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      // Zoom controls in top-left
      L.control.zoom({ position: 'topleft' }).addTo(map);

      // Tile layers
      const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap & CartoDB'
      });

      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Esri World Imagery'
      });

      const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap & CartoDB'
      });

      streetLayer.addTo(map);

      layersRef.current = {
        map,
        streetLayer,
        satelliteLayer,
        darkLayer,
        markersLayer: L.layerGroup().addTo(map),
        geofencesLayer: L.layerGroup().addTo(map),
        visitsLayer: L.layerGroup().addTo(map),
        userMarkerLayer: L.layerGroup().addTo(map)
      };

      mapInstanceRef.current = map;
      setMapReady(true);
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update base tile layer on mode change
  useEffect(() => {
    if (!mapReady || !layersRef.current.map) return;
    const { map, streetLayer, satelliteLayer, darkLayer } = layersRef.current;

    map.removeLayer(streetLayer);
    map.removeLayer(satelliteLayer);
    map.removeLayer(darkLayer);

    if (tileMode === 'satellite') {
      map.addLayer(satelliteLayer);
    } else if (tileMode === 'dark') {
      map.addLayer(darkLayer);
    } else {
      map.addLayer(streetLayer);
    }
  }, [tileMode, mapReady]);

  // Render Projects & Geofences
  useEffect(() => {
    if (!mapReady || !layersRef.current.markersLayer) return;

    async function drawEntities() {
      const L = (await import('leaflet')).default;
      const { map, markersLayer, geofencesLayer } = layersRef.current;

      markersLayer.clearLayers();
      geofencesLayer.clearLayers();

      if (filteredProjects.length === 0) return;

      const bounds = L.latLngBounds([]);

      filteredProjects.forEach((proj, idx) => {
        const coords = resolveProjectCoordinates(proj, idx);
        bounds.extend(coords);

        const isExecuting = proj.status === 'قيد التنفيذ';
        const isPaused = proj.status?.includes('متوقف');
        const primaryColor = isExecuting ? '#c2410c' : isPaused ? '#ef4444' : '#0284c7';
        const ringColor = isExecuting ? '#f97316' : isPaused ? '#f87171' : '#38bdf8';

        // 1. Geofence Perimeter Circle
        if (showGeofences) {
          const radius = proj.geofence_radius || 200;
          const circle = L.circle(coords, {
            radius: radius,
            color: ringColor,
            weight: 1.5,
            dashArray: '4, 6',
            fillColor: primaryColor,
            fillOpacity: 0.12
          });
          geofencesLayer.addLayer(circle);
        }

        // 2. Custom Radar Pin (Obsidian Glass HTML Icon)
        const pinHtml = `
          <div class="radar-marker-wrap" style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div class="radar-pulse" style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${ringColor}; opacity: 0.35; animation: radarPulse 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #1c1917, #0c0a09); border: 2.5px solid ${ringColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.45); color: #fff; font-size: 15px;">
              🏗️
            </div>
            ${proj.todayWorkers && proj.todayWorkers > 0 ? `
              <div style="position: absolute; top: -4px; right: -4px; background: #22c55e; color: #fff; font-size: 10px; font-weight: 900; padding: 1px 5px; border-radius: 10px; border: 1.5px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                ${proj.todayWorkers}
              </div>
            ` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-radar-pin',
          html: pinHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          popupAnchor: [0, -20]
        });

        // 3. Popup Content
        const popupContent = `
          <div dir="rtl" style="font-family: inherit; min-width: 240px; padding: 4px; color: #0f172a;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
              <strong style="font-size: 14px; color: #1c1917;">${proj.Property}</strong>
              <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${isExecuting ? '#ffedd5' : '#e0f2fe'}; color: ${primaryColor};">
                ${proj.status || 'قيد الدراسة'}
              </span>
            </div>
            
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
              العميل: <strong style="color: #334155;">${proj.client?.name || '---'}</strong>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px;">
              <div style="background: #f8fafc; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: 700;">عمالة اليوم</div>
                <div style="font-size: 15px; font-weight: 900; color: #c2410c;">${proj.todayWorkers || 0} عامل</div>
              </div>
              <div style="background: #f8fafc; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: 700;">منصرف اليوم</div>
                <div style="font-size: 13px; font-weight: 900; color: #047857;">${formatCurrency(proj.totalTodayCost || 0)}</div>
              </div>
            </div>

            ${proj.activeTasks && proj.activeTasks.length > 0 ? `
              <div style="font-size: 10px; margin-bottom: 8px; background: #fff7ed; padding: 5px 8px; border-radius: 6px; color: #9a3412;">
                <strong>أعمال جارية:</strong> ${proj.activeTasks.slice(0, 2).join('، ')}
              </div>
            ` : ''}

            <button id="btn-open-proj-${proj.id}" style="width: 100%; background: #1c1917; color: #ea580c; border: none; padding: 7px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              دخول غرفة عمليات المشروع 🏗️
            </button>
          </div>
        `;

        const marker = L.marker(coords, { icon: customIcon }).bindPopup(popupContent, {
          closeButton: true,
          maxWidth: 290
        });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-open-proj-${proj.id}`);
          if (btn && onSelectProject) {
            btn.onclick = () => onSelectProject(proj.id);
          }
        });

        markersLayer.addLayer(marker);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }

    drawEntities();
  }, [filteredProjects, mapReady, showGeofences, onSelectProject]);

  // Render Site Visits Pins Layer
  useEffect(() => {
    if (!mapReady || !layersRef.current.visitsLayer) return;

    async function drawVisits() {
      const L = (await import('leaflet')).default;
      const { visitsLayer } = layersRef.current;
      visitsLayer.clearLayers();

      if (!showVisits || siteVisits.length === 0) return;

      siteVisits.forEach((visit) => {
        if (!visit.geo_lat || !visit.geo_lng) return;
        const coords: [number, number] = [Number(visit.geo_lat), Number(visit.geo_lng)];

        const isDone = visit.status === 'تم الإنجاز';
        const color = isDone ? '#10b981' : '#f59e0b';

        const visitIcon = L.divIcon({
          className: 'custom-visit-pin',
          html: `
            <div style="position: relative; width: 28px; height: 28px; background: ${color}; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 3px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; cursor: pointer;">
              📸
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker(coords, { icon: visitIcon });
        marker.on('click', () => {
          setSelectedVisitModal(visit);
        });

        visitsLayer.addLayer(marker);
      });
    }

    drawVisits();
  }, [siteVisits, showVisits, mapReady]);

  // Trigger Geolocation & Geofence Check
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('خدمة تحديد المواقع (GPS) غير مدعومة في متصفحك.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        setUserLocation({ lat: userLat, lng: userLng, accuracy });

        if (mapReady && layersRef.current.userMarkerLayer) {
          const L = (await import('leaflet')).default;
          const { map, userMarkerLayer } = layersRef.current;

          userMarkerLayer.clearLayers();

          // User Blue Pulse Marker
          const userIcon = L.divIcon({
            className: 'user-gps-pin',
            html: `
              <div style="position: relative; width: 24px; height: 24px;">
                <div style="position: absolute; inset: -6px; border-radius: 50%; background: #3b82f6; opacity: 0.35; animation: radarPulse 1.8s infinite;"></div>
                <div style="width: 24px; height: 24px; border-radius: 50%; background: #2563eb; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35);"></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const userMarker = L.marker([userLat, userLng], { icon: userIcon })
            .bindPopup(`<b>موقعك الحالي (GPS)</b><br/>دقة التحديد: ±${accuracy} متر`)
            .openPopup();

          userMarkerLayer.addLayer(userMarker);
          map.setView([userLat, userLng], 15);

          // Geofence Proximity Audit
          let closestSite: ProjectMapItem | null = null;
          let minDistance = Infinity;

          projects.forEach((proj, idx) => {
            const pCoords = resolveProjectCoordinates(proj, idx);
            const dist = getHaversineDistanceMeters(userLat, userLng, pCoords[0], pCoords[1]);
            if (dist < minDistance) {
              minDistance = dist;
              closestSite = proj;
            }
          });

          if (closestSite) {
            const fenceRadius = (closestSite as ProjectMapItem).geofence_radius || 200;
            const inside = minDistance <= fenceRadius;
            setGeofenceAlert({
              siteName: (closestSite as ProjectMapItem).Property,
              distance: minDistance,
              inside
            });
          }
        }
      },
      (err) => {
        alert('تعذر جلب موقعك عبر الـ GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div 
      className={`field-radar-container ${isFullscreen ? 'fullscreen-mode' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : height,
        borderRadius: isFullscreen ? '0px' : '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        zIndex: isFullscreen ? 9999 : 'auto',
        background: '#0c0a09'
      }}
    >
      <style>{`
        @keyframes radarPulse {
          0% { transform: scale(0.85); opacity: 0.6; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(12px) !important;
          border-radius: 14px !important;
          box-shadow: 0 12px 35px rgba(0,0,0,0.2) !important;
          padding: 4px !important;
        }
        .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.95) !important;
        }
        .field-map-control-btn {
          background: rgba(18, 18, 18, 0.85);
          backdrop-filter: blur(12px);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 12px;
          border-radius: 10px;
          font-size: var(--fs-xs, 12px);
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .field-map-control-btn:hover {
          background: rgba(194, 65, 12, 0.85);
          border-color: #f97316;
          transform: translateY(-1px);
        }
        .field-map-control-btn.active {
          background: #c2410c;
          border-color: #ea580c;
          color: #fff;
        }
      `}</style>

      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top Floating Control Bar */}
      <div 
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          left: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      >
        {/* Right side: Tile Mode & Filters */}
        <div style={{ display: 'flex', gap: '6px', pointerEvents: 'auto', flexWrap: 'wrap' }}>
          <button 
            className={`field-map-control-btn ${tileMode === 'streets' ? 'active' : ''}`}
            onClick={() => setTileMode('streets')}
            title="خريطة شوارع قياسية"
          >
            🗺️ شوارع
          </button>
          <button 
            className={`field-map-control-btn ${tileMode === 'satellite' ? 'active' : ''}`}
            onClick={() => setTileMode('satellite')}
            title="صور الأقمار الصناعية الفضائية"
          >
            🛰️ قمر صناعي
          </button>
          <button 
            className={`field-map-control-btn ${tileMode === 'dark' ? 'active' : ''}`}
            onClick={() => setTileMode('dark')}
            title="الوضع الليلي الأنيق"
          >
            🌙 ليلي
          </button>
          
          <button 
            className={`field-map-control-btn ${showGeofences ? 'active' : ''}`}
            onClick={() => setShowGeofences(!showGeofences)}
            title="إظهار / إخفاء الحدود الجغرافية"
          >
            <ShieldCheck size={14} />
            {showGeofences ? 'الحدود الجغرافية: مفعّلة' : 'الحدود: معطلة'}
          </button>

          {siteVisits.length > 0 && (
            <button 
              className={`field-map-control-btn ${showVisits ? 'active' : ''}`}
              onClick={() => setShowVisits(!showVisits)}
              title="زيارات الموقع والملاحظات"
            >
              <Camera size={14} />
              نقاط الزيارات ({siteVisits.length})
            </button>
          )}
        </div>

        {/* Left side: GPS Locate & Fullscreen */}
        <div style={{ display: 'flex', gap: '6px', pointerEvents: 'auto' }}>
          <button 
            className="field-map-control-btn"
            onClick={handleLocateMe}
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', borderColor: '#60a5fa' }}
            title="تحديد موقعي الميداني وتفقد نطاق العمل"
          >
            <Navigation size={14} />
            موقعي الميداني GPS
          </button>

          <button 
            className="field-map-control-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Geofence Status Banner (If located) */}
      {geofenceAlert && (
        <div 
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            left: '16px',
            maxWidth: '520px',
            margin: '0 auto',
            background: geofenceAlert.inside ? 'rgba(6, 78, 59, 0.92)' : 'rgba(127, 29, 29, 0.92)',
            backdropFilter: 'blur(16px)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '12px',
            border: `1px solid ${geofenceAlert.inside ? '#10b981' : '#f87171'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 1000,
            fontSize: 'var(--fs-xs, 12px)',
            fontWeight: 700
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {geofenceAlert.inside ? (
              <CheckCircle2 size={18} color="#34d399" />
            ) : (
              <AlertTriangle size={18} color="#fca5a5" />
            )}
            <span>
              {geofenceAlert.inside ? (
                <>أنت الآن <strong>داخل نطاق مشروع {geofenceAlert.siteName}</strong> (على مسافة {geofenceAlert.distance} م) ✅</>
              ) : (
                <>أنت <strong>خارج نطاق {geofenceAlert.siteName}</strong> (أقرب موقع يبعد {geofenceAlert.distance} م) ⚠️</>
              )}
            </span>
          </div>
          <button 
            onClick={() => setGeofenceAlert(null)}
            style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '14px', fontWeight: 900 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Site Visit Photo Inspection Modal */}
      {selectedVisitModal && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setSelectedVisitModal(null)}
        >
          <div 
            style={{
              background: '#1c1917',
              border: '1px solid #c2410c',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '20px',
              color: '#fff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#ea580c', fontWeight: 900 }}>
                📸 زيارة ميدانية: {selectedVisitModal.title}
              </h3>
              <button 
                onClick={() => setSelectedVisitModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#cbd5e1', marginBottom: '14px' }}>
              <span>التاريخ: <strong>{selectedVisitModal.visit_date || '---'}</strong></span>
              <span>المشرف: <strong>{selectedVisitModal.inspector_name || 'مهندس الموقع'}</strong></span>
              <span>الحالة: <strong style={{ color: selectedVisitModal.status === 'تم الإنجاز' ? '#10b981' : '#f59e0b' }}>{selectedVisitModal.status}</strong></span>
            </div>

            {selectedVisitModal.notes && (
              <p style={{ background: '#292524', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0', margin: '0 0 14px 0', border: '1px solid #44403c' }}>
                {selectedVisitModal.notes}
              </p>
            )}

            {/* Photos Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedVisitModal.photo_after_url ? '1fr 1fr' : '1fr', gap: '10px' }}>
              {selectedVisitModal.photo_before_url && (
                <div>
                  <div style={{ fontSize: '11px', color: '#fb923c', fontWeight: 800, marginBottom: '4px' }}>صورة المعاينة (قبل):</div>
                  <img 
                    src={selectedVisitModal.photo_before_url} 
                    alt="Before" 
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #44403c' }} 
                  />
                </div>
              )}
              {selectedVisitModal.photo_after_url && (
                <div>
                  <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 800, marginBottom: '4px' }}>صورة المعالجة (بعد):</div>
                  <img 
                    src={selectedVisitModal.photo_after_url} 
                    alt="After" 
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #44403c' }} 
                  />
                </div>
              )}
            </div>

            <button 
              onClick={() => setSelectedVisitModal(null)}
              style={{ width: '100%', marginTop: '16px', background: '#c2410c', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
