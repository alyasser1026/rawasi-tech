"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  BIM_LAYERS,
  type BimLayerId,
  CAPITAL_APARTMENTS,
  EXTERIOR_CAMERA_PRESETS,
  TOTAL_NET_RESIDENTIAL_AREA,
  TOWER_DIMS,
  TOWER_SPEC_CARDS,
  TOWER_TOTAL_HEIGHT,
  type TowerLightingPreset,
  type TowerSpecCard,
  type TowerViewMode,
  type UnitId,
} from './capital-tower-model';
import {
  type Three,
  buildCapitalTowerBimAssembly,
  buildEntranceLobbyScene,
  buildTowerExteriorScene,
  buildTypicalFloorCutawayScene,
  createArchitecturalMaterials,
  createDisposables,
} from './capital-tower-three';

type EngineMode = 'arch3d' | 'bim';
type ExteriorCamKey = keyof typeof EXTERIOR_CAMERA_PRESETS;

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

const VIEW_TABS: { id: TowerViewMode; icon: string; label: string; specKey: string }[] = [
  { id: 'exterior', icon: '🏢', label: 'واجهة برج كابيتال (12 دور)', specKey: 'facade' },
  { id: 'entrance', icon: '🚪', label: 'المدخل الفندقي والمصاعد', specKey: 'entrance' },
  { id: 'typical', icon: '📐', label: 'الدور المتكرر (530 م²)', specKey: 'wall' },
  { id: 'apt01', icon: '🛋️', label: 'شقة 01 (140 م²)', specKey: 'interiorFinish' },
  { id: 'apt02', icon: '🏡', label: 'شقة 02 (185 م²)', specKey: 'interiorFinish' },
  { id: 'apt03', icon: '✨', label: 'شقة 03 (205 م²)', specKey: 'interiorFinish' },
];

const VIEW_CAMERA_POSE: Record<
  Exclude<TowerViewMode, 'exterior'>,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  entrance: { pos: [0, 2.4, 13.8], target: [0, 2.2, -1.5] },
  typical: { pos: [2.0, 36, 26], target: [0, 0.5, 0] },
  apt01: { pos: CAPITAL_APARTMENTS.apt01.cameraPos, target: CAPITAL_APARTMENTS.apt01.cameraTarget },
  apt02: { pos: CAPITAL_APARTMENTS.apt02.cameraPos, target: CAPITAL_APARTMENTS.apt02.cameraTarget },
  apt03: { pos: CAPITAL_APARTMENTS.apt03.cameraPos, target: CAPITAL_APARTMENTS.apt03.cameraTarget },
};

const BIM_OVERVIEW_POSE = {
  pos: [40, 27, 68] as [number, number, number],
  target: [0, 20.0, 0] as [number, number, number],
};

export default function CapitalTower3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [engineMode, setEngineMode] = useState<EngineMode>('arch3d');
  const [viewMode, setViewMode] = useState<TowerViewMode>('exterior');
  const [lighting, setLighting] = useState<TowerLightingPreset>('brochure');
  const [extCamKey, setExtCamKey] = useState<ExteriorCamKey>('full');
  const [autoRotate, setAutoRotate] = useState(true);
  const [explode, setExplode] = useState(0);
  const [floorCut, setFloorCut] = useState<number>(TOWER_DIMS.totalFloorsIncludingPodium);
  const [layersOn, setLayersOn] = useState<Record<BimLayerId, boolean>>({
    structure: true,
    core: true,
    masonry: true,
    mep: true,
    finish: true,
  });
  const [selectedCard, setSelectedCard] = useState<TowerSpecCard>(TOWER_SPEC_CARDS.facade);
  const [webglStatus, setWebglStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading');

  const controlsApiRef = useRef<{
    setCameraPose: (pos: [number, number, number], target: [number, number, number]) => void;
    setAutoRotate: (on: boolean) => void;
    applyBimControls: (layers: Record<BimLayerId, boolean>, explodeVal: number, maxFloor: number) => void;
  } | null>(null);

  // Rebuild 3D content cleanly whenever engineMode, viewMode, or lighting changes
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!isWebGLSupported()) {
      setWebglStatus('unsupported');
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      let THREE: Three;
      let OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
      let RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment;
      try {
        THREE = await import('three');
        OrbitControls = (await import('three/examples/jsm/controls/OrbitControls.js')).OrbitControls;
        RoomEnvironment = (await import('three/examples/jsm/environments/RoomEnvironment.js')).RoomEnvironment;
      } catch {
        if (!disposed) setWebglStatus('unsupported');
        return;
      }
      if (disposed) return;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        });
      } catch {
        if (!disposed) setWebglStatus('unsupported');
        return;
      }

      renderer.domElement.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          if (!disposed) setWebglStatus('unsupported');
        },
        false
      );

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = lighting === 'daylight' ? 1.18 : lighting === 'night' ? 1.05 : 1.12;

      host.innerHTML = '';
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const disp = createDisposables();
      const scene = new THREE.Scene();

      // Atmospheric background matching lighting preset
      const bgHex =
        lighting === 'daylight' ? 0xeae2d6 : lighting === 'night' ? 0x0c0907 : 0x17120e;
      scene.background = new THREE.Color(bgHex);
      if (engineMode === 'arch3d' && viewMode === 'exterior') {
        scene.fog = new THREE.FogExp2(bgHex, 0.0045);
      }

      // Studio PBR environment reflections (works offline with 0 HDR downloads)
      const pmrem = disp.add(new THREE.PMREMGenerator(renderer));
      const envScene = new RoomEnvironment();
      const envRT = disp.add(pmrem.fromScene(envScene, 0.04));
      scene.environment = envRT.texture;
      envScene.dispose();

      // Balanced studio + golden hour lighting
      const hemiIntensity = lighting === 'daylight' ? 1.2 : lighting === 'night' ? 0.55 : 0.88;
      const sunIntensity = lighting === 'daylight' ? 2.1 : lighting === 'night' ? 0.8 : 1.55;
      const hemi = new THREE.HemisphereLight(
        lighting === 'daylight' ? 0xfff8ee : 0xffdfc2,
        lighting === 'daylight' ? 0x8d7b68 : 0x1e1712,
        hemiIntensity
      );
      scene.add(hemi);

      const sun = new THREE.DirectionalLight(0xffe6c7, sunIntensity);
      sun.position.set(28, 52, 34);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 140;
      const sb = 36;
      sun.shadow.camera.left = -sb;
      sun.shadow.camera.right = sb;
      sun.shadow.camera.top = sb;
      sun.shadow.camera.bottom = -sb;
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      const rim = new THREE.DirectionalLight(0x88b4e6, lighting === 'night' ? 0.65 : 0.42);
      rim.position.set(-28, 24, -28);
      scene.add(rim);

      if (engineMode === 'arch3d' && (viewMode === 'exterior' || viewMode === 'entrance')) {
        const lobbyFill = new THREE.PointLight(0xffb45c, lighting === 'night' ? 22 : 12, 32, 1.5);
        lobbyFill.position.set(0, viewMode === 'entrance' ? 3.8 : 2.8, viewMode === 'entrance' ? 2.4 : 15.2);
        scene.add(lobbyFill);
      }

      const camera = new THREE.PerspectiveCamera(40, 1, 0.15, 240);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = viewMode === 'entrance' ? 3.2 : 8;
      controls.maxDistance = 155;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = engineMode === 'bim' ? 0.55 : 0.45;
      renderer.domElement.style.touchAction = 'pan-y';

      const initialPose =
        engineMode === 'bim'
          ? BIM_OVERVIEW_POSE
          : viewMode === 'exterior'
          ? EXTERIOR_CAMERA_PRESETS[extCamKey]
          : VIEW_CAMERA_POSE[viewMode];

      const desiredPos = new THREE.Vector3(...initialPose.pos);
      const desiredTarget = new THREE.Vector3(...initialPose.target);
      camera.position.copy(desiredPos);
      controls.target.copy(desiredTarget);
      controls.update();

      let lerpActive = false;
      const stopAutoOnDrag = () => {
        lerpActive = false;
      };
      controls.addEventListener('start', stopAutoOnDrag);

      // Build requested scene geometry
      let pickables: import('three').Object3D[] = [];
      let applyBimFn: (layers: Record<BimLayerId, boolean>, explodeVal: number, maxFloor: number) => void = () => {};
      let elevatorCabs: { mesh: import('three').Mesh; phase: number; baseX: number; baseZ: number }[] = [];

      if (engineMode === 'bim') {
        const grid = new THREE.GridHelper(54, 54, 0x4b423b, 0x26201c);
        grid.position.y = -0.02;
        scene.add(grid);

        const bim = buildCapitalTowerBimAssembly(THREE, disp, scene, TOWER_DIMS.residentialFloors);
        pickables = bim.pickables;
        elevatorCabs = bim.elevatorCabs;

        applyBimFn = (layers, explodeVal, maxFloor) => {
          (Object.keys(layers) as BimLayerId[]).forEach((lid) => {
            bim.layerGroups[lid].visible = layers[lid];
          });
          for (const tr of bim.trackers) {
            const visibleBySlice = tr.floorIndex <= maxFloor || tr.floorIndex === -1;
            tr.mesh.visible = visibleBySlice;
            const factor = tr.floorIndex < 0 ? 0 : tr.floorIndex * explodeVal * 1.45;
            tr.mesh.position.y = tr.baseY + factor;
          }
        };
        applyBimFn(layersOn, explode, floorCut);
      } else {
        const mats = createArchitecturalMaterials(THREE, disp, lighting);
        if (viewMode === 'exterior') {
          scene.add(buildTowerExteriorScene(THREE, disp, mats, pickables));
        } else if (viewMode === 'entrance') {
          scene.add(buildEntranceLobbyScene(THREE, disp, mats, pickables));
        } else {
          scene.add(buildTypicalFloorCutawayScene(THREE, disp, mats, pickables, viewMode));
        }
      }

      // Click / Hover Raycaster -> inspects BOQ + IFC element specs or switches apartment view
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let selectedMesh: import('three').Mesh | null = null;
      let originalMat: import('three').Material | null = null;

      const hitTest = (ev: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const visibleObjs = pickables.filter((o) => {
          let cur: import('three').Object3D | null = o;
          while (cur) {
            if (!cur.visible) return false;
            cur = cur.parent;
          }
          return true;
        });
        const hits = raycaster.intersectObjects(visibleObjs, false);
        return (hits[0]?.object as import('three').Mesh | undefined) ?? null;
      };

      const clearHighlight = () => {
        if (selectedMesh && originalMat) {
          selectedMesh.material = originalMat;
        }
        selectedMesh = null;
        originalMat = null;
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (ev.pointerType !== 'mouse') return;
        renderer.domElement.style.cursor = hitTest(ev) ? 'pointer' : 'grab';
      };

      let downCoord = { x: 0, y: 0 };
      const onPointerDown = (ev: PointerEvent) => {
        downCoord = { x: ev.clientX, y: ev.clientY };
      };
      const onPointerUp = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - downCoord.x, ev.clientY - downCoord.y) > 5) return;
        const m = hitTest(ev);
        if (!m) {
          clearHighlight();
          return;
        }
        if (m.userData.unitSwitch) {
          const unit = m.userData.unitSwitch as UnitId;
          setViewMode(unit);
          setSelectedCard(TOWER_SPEC_CARDS.interiorFinish);
          return;
        }
        clearHighlight();
        selectedMesh = m;
        originalMat = m.material as import('three').Material;
        const std = originalMat as import('three').MeshStandardMaterial;
        if (typeof std.clone === 'function' && 'emissive' in std) {
          const hl = disp.add(std.clone());
          hl.emissive = new THREE.Color(0xf97316);
          hl.emissiveIntensity = 0.52;
          m.material = hl;
        }
        const sk = String(m.userData.specKey || 'facade');
        if (TOWER_SPEC_CARDS[sk]) {
          setSelectedCard(TOWER_SPEC_CARDS[sk]);
        }
      };

      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      controlsApiRef.current = {
        setCameraPose: (pos, target) => {
          desiredPos.set(...pos);
          desiredTarget.set(...target);
          lerpActive = true;
        },
        setAutoRotate: (on) => {
          controls.autoRotate = on;
        },
        applyBimControls: (layers, explodeVal, maxFloor) => applyBimFn(layers, explodeVal, maxFloor),
      };

      const resize = () => {
        const w = host.clientWidth || 680;
        const h = host.clientHeight || 480;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) controls.autoRotate = false;

      let raf = 0;
      let running = true;
      const clock = new THREE.Clock();

      const animate = () => {
        if (!running) return;
        const t = clock.getElapsedTime();

        if (lerpActive) {
          camera.position.lerp(desiredPos, 0.1);
          controls.target.lerp(desiredTarget, 0.1);
          if (camera.position.distanceTo(desiredPos) < 0.08) lerpActive = false;
        }

        // Smooth elevator travel animation inside Capital Tower BIM core
        if (elevatorCabs.length > 0) {
          const travelSpan = TOWER_TOTAL_HEIGHT - TOWER_DIMS.podiumHeight - 2;
          const baseBottom = TOWER_DIMS.podiumHeight + 1.2 + (explode * 1.45);
          for (const cab of elevatorCabs) {
            const norm = (Math.sin(t * 0.45 + cab.phase) + 1) * 0.5;
            cab.mesh.position.y = baseBottom + norm * (travelSpan * (1 + explode * 0.42));
          }
        }

        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };

      const io = new IntersectionObserver(
        (entries) => {
          const on = entries[0]?.isIntersecting ?? true;
          if (on && !running) {
            running = true;
            raf = requestAnimationFrame(animate);
          } else if (!on) {
            running = false;
            cancelAnimationFrame(raf);
          }
        },
        { threshold: 0.05 }
      );
      io.observe(host);
      raf = requestAnimationFrame(animate);
      setWebglStatus('ready');

      cleanup = () => {
        running = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        controls.dispose();
        disp.disposeAll();
        renderer.dispose();
        renderer.domElement.remove();
        controlsApiRef.current = null;
      };
    };

    void start();
    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineMode, viewMode, lighting]);

  // Synchronize BIM sliders & layer visibility without recreating the WebGL context
  useEffect(() => {
    if (engineMode !== 'bim') return;
    controlsApiRef.current?.applyBimControls(layersOn, explode, floorCut);
  }, [engineMode, layersOn, explode, floorCut]);

  useEffect(() => {
    controlsApiRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  const handleViewSelect = (mode: TowerViewMode, specKey: string) => {
    setEngineMode('arch3d');
    setViewMode(mode);
    setExtCamKey('full');
    if (TOWER_SPEC_CARDS[specKey]) {
      setSelectedCard(TOWER_SPEC_CARDS[specKey]);
    }
  };

  const handleExtCamPreset = (key: ExteriorCamKey) => {
    setExtCamKey(key);
    const preset = EXTERIOR_CAMERA_PRESETS[key];
    controlsApiRef.current?.setCameraPose(preset.pos, preset.target);
    if (key === 'arcade') setSelectedCard(TOWER_SPEC_CARDS.podium);
    else if (key === 'terraces') setSelectedCard(TOWER_SPEC_CARDS.interiorFinish);
    else setSelectedCard(TOWER_SPEC_CARDS.facade);
  };

  const handleConvertToBim = () => {
    const next: EngineMode = engineMode === 'arch3d' ? 'bim' : 'arch3d';
    setEngineMode(next);
    if (next === 'bim') {
      setSelectedCard(TOWER_SPEC_CARDS.column);
    } else {
      setSelectedCard(TOWER_SPEC_CARDS.facade);
    }
  };

  const toggleBimLayer = (id: BimLayerId) => {
    setLayersOn((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeUnitSpec: (typeof CAPITAL_APARTMENTS)[UnitId] | null =
    viewMode === 'apt01' || viewMode === 'apt02' || viewMode === 'apt03'
      ? CAPITAL_APARTMENTS[viewMode]
      : null;

  return (
    <div
      className="ct3d-shell"
      dir="rtl"
      style={{
        borderRadius: '24px',
        padding: '22px',
        background:
          lighting === 'daylight'
            ? 'linear-gradient(155deg, #f7eee2 0%, #ede0ce 100%)'
            : 'linear-gradient(155deg, #0c0907 0%, #1c1510 55%, #120d0a 100%)',
        color: lighting === 'daylight' ? '#1c1917' : '#f7eee2',
        border: '1px solid rgba(249, 115, 22, 0.3)',
        boxShadow: '0 24px 60px -28px rgba(0, 0, 0, 0.55)',
      }}
    >
      <style>{`
        .ct3d-pill-bar { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
        .ct3d-pill {
          border: 1px solid rgba(249, 115, 22, 0.28);
          border-radius: 12px;
          padding: 8px 13px;
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ct3d-pill:hover { transform: translateY(-1px); border-color: #f97316; }
        .ct3d-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.78fr); gap: 18px; align-items: stretch; }
        .ct3d-units { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
        @media (max-width: 960px) {
          .ct3d-grid { grid-template-columns: 1fr; }
          .ct3d-units { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Top Brand Header + Immediate 3D <-> BIM Conversion CTA */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '999px',
                background: 'rgba(249, 115, 22, 0.16)',
                color: '#f97316',
                fontSize: '0.76rem',
                fontWeight: 900,
              }}
            >
              🏙️ برج كابيتال — CAPITAL TOWER · PERFECT HOME
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                background: engineMode === 'bim' ? 'rgba(14, 165, 233, 0.18)' : 'rgba(16, 185, 129, 0.16)',
                color: engineMode === 'bim' ? '#38bdf8' : '#10b981',
                fontSize: '0.74rem',
                fontWeight: 800,
              }}
            >
              {engineMode === 'bim' ? 'وضع BIM الهندسي (IFC Twin)' : 'وضع العرض المعماري 3D'}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: 'clamp(1.15rem, 2vw, 1.5rem)', fontWeight: 900 }}>
            التجسيم المعماري الاحترافي ثلاثي الأبعاد وتحويله الفوري إلى نموذج BIM
          </h3>
        </div>

        {/* Highlight Conversion Action Button */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="toggle-3d-to-bim"
            onClick={handleConvertToBim}
            style={{
              padding: '10px 18px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: '0.88rem',
              background:
                engineMode === 'bim'
                  ? 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                  : 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              boxShadow: '0 8px 22px -8px rgba(249, 115, 22, 0.7)',
            }}
          >
            {engineMode === 'bim'
              ? '🏛️ العودة إلى المجسم المعماري 3D'
              : '🧱 تحويل برج كابيتال إلى BIM (IFC Twin)'}
          </button>

          <a
            href="#bim"
            style={{
              padding: '9px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(249, 115, 22, 0.45)',
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '0.8rem',
            }}
          >
            معمل BIM المتكامل ↓
          </a>
        </div>
      </div>

      {/* Mode Switcher Bar: Exterior, Entrance, Typical Plan, Apt 01/02/03 OR BIM Disciplines */}
      <div
        className="ct3d-pill-bar"
        style={{
          padding: '10px',
          borderRadius: '16px',
          background: lighting === 'daylight' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)',
          marginBottom: '14px',
        }}
      >
        {VIEW_TABS.map((tab) => {
          const active = engineMode === 'arch3d' && viewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`view-tab-${tab.id}`}
              onClick={() => handleViewSelect(tab.id, tab.specKey)}
              className="ct3d-pill"
              style={{
                background: active ? '#f97316' : 'transparent',
                color: active ? '#fff' : 'inherit',
                borderColor: active ? '#f97316' : 'rgba(150,150,150,0.28)',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-toolbar: Lighting / Camera Angles / Auto-rotate */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <div className="ct3d-pill-bar">
          <span style={{ fontSize: '0.78rem', fontWeight: 800, opacity: 0.78 }}>الإضاءة:</span>
          {[
            { id: 'brochure' as TowerLightingPreset, label: '✨ ذهبية (البروشور)' },
            { id: 'daylight' as TowerLightingPreset, label: '☀️ نهارية' },
            { id: 'night' as TowerLightingPreset, label: '🌙 ليلية' },
          ].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLighting(l.id)}
              style={{
                padding: '5px 11px',
                borderRadius: '999px',
                border: lighting === l.id ? '1.5px solid #f97316' : '1px solid rgba(150,150,150,0.25)',
                background: lighting === l.id ? 'rgba(249, 115, 22, 0.16)' : 'transparent',
                color: lighting === l.id ? '#f97316' : 'inherit',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="ct3d-pill-bar">
          {engineMode === 'arch3d' &&
            viewMode === 'exterior' &&
            (Object.keys(EXTERIOR_CAMERA_PRESETS) as ExteriorCamKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleExtCamPreset(key)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: extCamKey === key ? '#f97316' : 'rgba(150,150,150,0.16)',
                  color: extCamKey === key ? '#fff' : 'inherit',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {EXTERIOR_CAMERA_PRESETS[key].label}
              </button>
            ))}

          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            style={{
              padding: '5px 11px',
              borderRadius: '8px',
              border: 'none',
              background: autoRotate ? '#10b981' : 'rgba(16, 185, 129, 0.16)',
              color: autoRotate ? '#fff' : '#10b981',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {autoRotate ? '⏸ إيقاف الدوران' : '🔄 دوران تلقائي'}
          </button>
        </div>
      </div>

      {/* Main 3D Stage + Right Engineering / BIM Inspector Panel */}
      <div className="ct3d-grid">
        <div
          style={{
            position: 'relative',
            minHeight: '500px',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(249, 115, 22, 0.28)',
            background: lighting === 'daylight' ? '#eae2d6' : '#090705',
          }}
        >
          <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

          {webglStatus === 'loading' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#f97316',
              }}
            >
              جاري بناء مجسم برج كابيتال ثلاثي الأبعاد…
            </div>
          )}

          {webglStatus === 'unsupported' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                fontWeight: 800,
              }}
            >
              المتصفح الحالي لا يدعم WebGL؛ استعرض بيانات الوحدات والطبقات في اللوحة المجاورة.
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(12, 9, 7, 0.8)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: '1px solid rgba(249, 115, 22, 0.45)',
              pointerEvents: 'none',
            }}
          >
            {engineMode === 'bim'
              ? '🧱 التوأم الرقمي BIM — اسحب للتدوير • اضغط أي عنصر لعرض فئة IFC'
              : '🏙️ برج كابيتال 3D — اسحب للتدوير • مرّر للتكبير • اضغط على أي جزء للفحص'}
          </div>
        </div>

        {/* Right Engineering & BIM Workbench Drawer */}
        <aside
          style={{
            borderRadius: '20px',
            padding: '18px',
            background: lighting === 'daylight' ? 'rgba(255,255,255,0.88)' : 'rgba(24, 19, 15, 0.92)',
            border: '1px solid rgba(249, 115, 22, 0.24)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* When in BIM Mode: Live Layer Controls + Floor Explode & Section Slice */}
          {engineMode === 'bim' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#38bdf8' }}>
                طبقات نموذج BIM — برج كابيتال (13 مستوى)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {BIM_LAYERS.map((layer) => {
                  const on = layersOn[layer.id];
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => toggleBimLayer(layer.id)}
                      aria-pressed={on}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 11px',
                        borderRadius: '999px',
                        border: on ? `1.5px solid ${layer.color}` : '1px solid rgba(150,150,150,0.3)',
                        background: on ? `${layer.color}22` : 'transparent',
                        color: 'inherit',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        opacity: on ? 1 : 0.55,
                      }}
                    >
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: layer.color,
                          display: 'inline-block',
                        }}
                      />
                      {layer.label}
                    </button>
                  );
                })}
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 800 }}>
                <span>فصل الأدوار رأسياً (Explode: {Math.round(explode * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))}
                  style={{ accentColor: '#38bdf8' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 800 }}>
                <span>القطع الأفقي للأدوار (إظهار حتى الدور: {floorCut === 13 ? 'السطح الكامل' : floorCut === 0 ? 'الأركيد' : `الدور ${floorCut}`})</span>
                <input
                  type="range"
                  min={0}
                  max={TOWER_DIMS.totalFloorsIncludingPodium}
                  step={1}
                  value={floorCut}
                  onChange={(e) => setFloorCut(Number(e.target.value))}
                  style={{ accentColor: '#f97316' }}
                />
              </label>
            </div>
          ) : activeUnitSpec ? (
            /* When inspecting Apartment 01 / 02 / 03 in Architectural 3D */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: `${activeUnitSpec.accent}24`,
                    color: activeUnitSpec.accent,
                    fontSize: '0.78rem',
                    fontWeight: 900,
                  }}
                >
                  {activeUnitSpec.code} · {activeUnitSpec.wingLabel}
                </span>
                <strong style={{ fontSize: '1.15rem', color: activeUnitSpec.accent }}>
                  {activeUnitSpec.areaSqm} م²
                </strong>
              </div>
              <h4 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900 }}>
                {activeUnitSpec.title} ({activeUnitSpec.enTitle})
              </h4>
              <p style={{ margin: 0, fontSize: '0.83rem', opacity: 0.88, lineHeight: 1.55 }}>
                {activeUnitSpec.summary}
              </p>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', fontWeight: 800 }}>
                <span>🛏️ {activeUnitSpec.bedrooms} غرف نوم</span>
                <span>🚿 {activeUnitSpec.bathrooms} حمامات</span>
              </div>
              <ul style={{ margin: 0, paddingInlineStart: '18px', fontSize: '0.79rem', lineHeight: 1.6, opacity: 0.9 }}>
                {activeUnitSpec.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            /* Exterior / Entrance / Typical Overview summary */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#f97316' }}>
                بطاقة المشروع — برج كابيتال (Perfect Home)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                <div style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(249,115,22,0.08)' }}>
                  <div style={{ opacity: 0.72 }}>الارتفاع</div>
                  <strong>أرضي تجاري + {TOWER_DIMS.residentialFloors} دور</strong>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(14,165,233,0.08)' }}>
                  <div style={{ opacity: 0.72 }}>صافي الدور المتكرر</div>
                  <strong>{TOTAL_NET_RESIDENTIAL_AREA} م² (3 شقق)</strong>
                </div>
              </div>
            </div>
          )}

          {/* Selected Element Technical / IFC Specification Card */}
          <div
            style={{
              borderRadius: '14px',
              padding: '14px',
              background: lighting === 'daylight' ? '#f7eee2' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${selectedCard.color}55`,
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: `${selectedCard.color}25`,
                  color: selectedCard.color,
                }}
              >
                {selectedCard.ifc}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', opacity: 0.75 }}>{selectedCard.code}</span>
            </div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900 }}>{selectedCard.title}</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.55, opacity: 0.9 }}>
              <strong style={{ color: '#f97316' }}>الخامات: </strong>
              {selectedCard.material}
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.5, opacity: 0.84 }}>
              <strong style={{ color: '#10b981' }}>أصول التنفيذ: </strong>
              {selectedCard.executionNote}
            </p>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: selectedCard.color, paddingTop: '4px', borderTop: '1px solid rgba(150,150,150,0.2)' }}>
              الحصر التقديري: {selectedCard.boqMetric}
            </div>
          </div>
        </aside>
      </div>

      {/* Interactive 3 Apartments Quick Selector Cards matching Brochure Sheets */}
      <div className="ct3d-units">
        {(['apt01', 'apt02', 'apt03'] as UnitId[]).map((uid) => {
          const apt = CAPITAL_APARTMENTS[uid];
          const isSelected = engineMode === 'arch3d' && viewMode === uid;
          return (
            <button
              key={uid}
              type="button"
              onClick={() => handleViewSelect(uid, 'interiorFinish')}
              style={{
                textAlign: 'right',
                padding: '14px 16px',
                borderRadius: '16px',
                cursor: 'pointer',
                border: isSelected ? `2px solid ${apt.accent}` : '1px solid rgba(150,150,150,0.24)',
                background: isSelected
                  ? `${apt.accent}18`
                  : lighting === 'daylight'
                  ? 'rgba(255,255,255,0.72)'
                  : 'rgba(255,255,255,0.03)',
                color: 'inherit',
                transition: 'all 0.18s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.96rem' }}>
                  {apt.title} · {apt.enTitle}
                </strong>
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: '999px',
                    background: `${apt.accent}26`,
                    color: apt.accent,
                    fontSize: '0.82rem',
                    fontWeight: 900,
                  }}
                >
                  {apt.areaSqm} م²
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.82 }}>
                {apt.bedrooms} غرف نوم · {apt.bathrooms} حمام · {apt.wingLabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
