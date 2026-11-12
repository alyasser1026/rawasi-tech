"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  BIM_LAYERS,
  type BimLayerId,
  TOWER_DIMS,
  TOWER_SPEC_CARDS,
  TOWER_TOTAL_HEIGHT,
  type TowerSpecCard,
} from './capital-tower-model';
import { type Three, buildCapitalTowerBimAssembly, createDisposables } from './capital-tower-three';

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

type BimFocusPreset = 'tower' | 'foundation' | 'typical' | 'core';

const BIM_PRESETS: Record<BimFocusPreset, { label: string; pos: [number, number, number]; target: [number, number, number]; maxFloor: number; specKey: string }> = {
  tower: { label: 'البرج كامل', pos: [40, 27, 68], target: [0, 20.0, 0], maxFloor: 13, specKey: 'facade' },
  foundation: { label: 'اللبشة والخوازيق', pos: [26, 8, 30], target: [0, 0, 0], maxFloor: 0, specKey: 'foundation' },
  typical: { label: 'الدور المتكرر (140/185/205 م²)', pos: [24, 24, 28], target: [0, 14, 0], maxFloor: 5, specKey: 'wall' },
  core: { label: 'قلب المصاعد و MEP', pos: [22, 26, 26], target: [1.4, 18, -0.8], maxFloor: 13, specKey: 'core' },
};

export default function BimModel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{
    applyState: (layers: Record<BimLayerId, boolean>, explodeVal: number, maxFloor: number) => void;
    setPose: (pos: [number, number, number], target: [number, number, number]) => void;
    reset: () => void;
  } | null>(null);

  const [visible, setVisible] = useState<Record<BimLayerId, boolean>>({
    structure: true,
    core: true,
    masonry: true,
    mep: true,
    finish: true,
  });
  const [explode, setExplode] = useState(0);
  const [floorSlice, setFloorSlice] = useState<number>(TOWER_DIMS.totalFloorsIncludingPodium);
  const [activePreset, setActivePreset] = useState<BimFocusPreset>('tower');
  const [info, setInfo] = useState<TowerSpecCard>(TOWER_SPEC_CARDS.slab);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!isWebGLSupported()) {
      setStatus('unsupported');
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      let THREE: Three;
      let OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
      try {
        THREE = await import('three');
        OrbitControls = (await import('three/examples/jsm/controls/OrbitControls.js')).OrbitControls;
      } catch {
        if (!disposed) setStatus('unsupported');
        return;
      }
      if (disposed) return;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        });
      } catch {
        if (!disposed) setStatus('unsupported');
        return;
      }

      renderer.domElement.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          if (!disposed) setStatus('unsupported');
        },
        false
      );
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const disp = createDisposables();
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.15, 240);
      const HOME = new THREE.Vector3(...BIM_PRESETS.tower.pos);
      const TARGET = new THREE.Vector3(...BIM_PRESETS.tower.target);
      camera.position.copy(HOME);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x7c838b, 1.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.85);
      sun.position.set(28, 52, 32);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xbcd2e6, 0.65);
      fill.position.set(-28, 20, -24);
      scene.add(fill);

      const grid = new THREE.GridHelper(54, 54, 0xc9ced3, 0xe3e6e9);
      grid.position.y = -0.02;
      (grid.material as import('three').Material).transparent = true;
      (grid.material as import('three').Material).opacity = 0.72;
      scene.add(grid);

      const bim = buildCapitalTowerBimAssembly(THREE, disp, scene, TOWER_DIMS.residentialFloors);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(TARGET);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 12;
      controls.maxDistance = 155;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.55;
      controls.enablePan = false;
      renderer.domElement.style.touchAction = 'pan-y';

      let desiredPos = HOME.clone();
      let desiredTarget = TARGET.clone();
      let lerpActive = false;

      const stopAuto = () => {
        controls.autoRotate = false;
        lerpActive = false;
      };
      controls.addEventListener('start', stopAuto);

      const ray = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const hit = (ev: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(pointer, camera);
        const visibleMeshes = bim.pickables.filter((o) => {
          if (!o.visible) return false;
          let p = o.parent;
          while (p) {
            if (!p.visible) return false;
            p = p.parent;
          }
          return true;
        });
        const hits = ray.intersectObjects(visibleMeshes, false);
        return (hits[0]?.object as import('three').Mesh | undefined) ?? null;
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerType !== 'mouse') return;
        renderer.domElement.style.cursor = hit(ev) ? 'pointer' : 'grab';
      };

      let selected: import('three').Mesh | null = null;
      let selMat: import('three').Material | null = null;
      const clearSel = () => {
        if (selected && selMat) selected.material = selMat;
        selected = null;
        selMat = null;
      };

      const selectMesh = (m: import('three').Mesh | null) => {
        clearSel();
        if (!m) return;
        selected = m;
        selMat = m.material as import('three').Material;
        const std = selMat as import('three').MeshStandardMaterial;
        if (typeof std.clone === 'function') {
          const hl = disp.add(std.clone());
          hl.emissive = new THREE.Color(0xc75517);
          hl.emissiveIntensity = 0.58;
          hl.transparent = false;
          hl.opacity = 1;
          m.material = hl;
        }
        const key = String(m.userData.specKey || 'slab');
        if (TOWER_SPEC_CARDS[key]) setInfo(TOWER_SPEC_CARDS[key]);
      };

      let downAt = { x: 0, y: 0 };
      const onDown = (ev: PointerEvent) => {
        downAt = { x: ev.clientX, y: ev.clientY };
      };
      const onUp = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) return;
        selectMesh(hit(ev));
      };

      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);

      let explodeV = 0;
      const applyState = (layers: Record<BimLayerId, boolean>, expVal: number, maxFloor: number) => {
        explodeV = expVal;
        (Object.keys(layers) as BimLayerId[]).forEach((id) => {
          bim.layerGroups[id].visible = layers[id];
          if (!layers[id] && selected && selected.userData.layer === id) {
            clearSel();
          }
        });
        for (const tr of bim.trackers) {
          tr.mesh.visible = tr.floorIndex <= maxFloor || tr.floorIndex === -1;
          const deltaY = tr.floorIndex < 0 ? 0 : tr.floorIndex * explodeV * 1.45;
          tr.mesh.position.y = tr.baseY + deltaY;
        }
      };

      apiRef.current = {
        applyState,
        setPose: (pos, target) => {
          desiredPos = new THREE.Vector3(...pos);
          desiredTarget = new THREE.Vector3(...target);
          lerpActive = true;
        },
        reset: () => {
          desiredPos = HOME.clone();
          desiredTarget = TARGET.clone();
          lerpActive = true;
          controls.autoRotate = true;
          clearSel();
        },
      };

      const resize = () => {
        const w = host.clientWidth || 640;
        const h = host.clientHeight || 440;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      let raf = 0;
      let running = true;
      const clock = new THREE.Clock();
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) controls.autoRotate = false;

      const frame = () => {
        if (!running) return;
        const t = clock.getElapsedTime();
        if (lerpActive) {
          camera.position.lerp(desiredPos, 0.1);
          controls.target.lerp(desiredTarget, 0.1);
          if (camera.position.distanceTo(desiredPos) < 0.08) lerpActive = false;
        }
        const travelSpan = TOWER_TOTAL_HEIGHT - TOWER_DIMS.podiumHeight - 2;
        const baseBottom = TOWER_DIMS.podiumHeight + 1.2 + explodeV * 1.45;
        for (const cab of bim.elevatorCabs) {
          const norm = (Math.sin(t * 0.45 + cab.phase) + 1) * 0.5;
          cab.mesh.position.y = baseBottom + norm * (travelSpan * (1 + explodeV * 0.42));
        }
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };

      const io = new IntersectionObserver(
        (entries) => {
          const on = entries[0]?.isIntersecting ?? true;
          if (on && !running) {
            running = true;
            raf = requestAnimationFrame(frame);
          }
          if (!on) {
            running = false;
            cancelAnimationFrame(raf);
          }
        },
        { threshold: 0.05 }
      );
      io.observe(host);
      raf = requestAnimationFrame(frame);
      setStatus('ready');

      cleanup = () => {
        running = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        controls.dispose();
        disp.disposeAll();
        renderer.dispose();
        renderer.domElement.remove();
        apiRef.current = null;
      };
    };

    void start();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    apiRef.current?.applyState(visible, explode, floorSlice);
  }, [visible, explode, floorSlice]);

  const toggle = (id: BimLayerId) => {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
  };

  const applyPreset = (key: BimFocusPreset) => {
    setActivePreset(key);
    const p = BIM_PRESETS[key];
    setFloorSlice(p.maxFloor);
    setInfo(TOWER_SPEC_CARDS[p.specKey] ?? TOWER_SPEC_CARDS.slab);
    apiRef.current?.setPose(p.pos, p.target);
  };

  return (
    <div className="pw-bim">
      <div className="pw-bim-stage" style={{ minHeight: '500px' }}>
        <div
          ref={hostRef}
          className="pw-bim-canvas"
          role="img"
          aria-label="التوأم الرقمي BIM ثلاثي الأبعاد لبرج كابيتال يوضح اللبشة والأعمدة والقلب الإنشائي والشقق الثلاث والتأسيسات"
        />
        {status === 'loading' && <div className="pw-bim-note">جاري تحميل التوأم الرقمي لبرج كابيتال…</div>}
        {status === 'unsupported' && <div className="pw-bim-note">متصفحك لا يدعم العرض ثلاثي الأبعاد.</div>}
        <div className="pw-bim-hint">برج كابيتال BIM (13 مستوى + مصاعد متحركة) · اسحب للتدوير · اضغط على أي عنصر</div>
        <button
          type="button"
          className="pw-bim-reset"
          onClick={() => {
            setActivePreset('tower');
            setFloorSlice(TOWER_DIMS.totalFloorsIncludingPodium);
            setExplode(0);
            apiRef.current?.reset();
          }}
        >
          إعادة ضبط الكاميرا
        </button>
      </div>

      <aside className="pw-bim-panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(Object.keys(BIM_PRESETS) as BimFocusPreset[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`pw-chip ${activePreset === k ? 'is-on' : ''}`}
              onClick={() => applyPreset(k)}
            >
              {BIM_PRESETS[k].label}
            </button>
          ))}
        </div>

        <h3>طبقات نموذج BIM — برج كابيتال</h3>
        <div className="pw-bim-layers">
          {BIM_LAYERS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`pw-chip ${visible[l.id] ? 'is-on' : ''}`}
              aria-pressed={visible[l.id]}
              onClick={() => toggle(l.id)}
            >
              <i style={{ background: l.color }} />
              {l.label}
            </button>
          ))}
        </div>

        <label className="pw-range">
          <span>فصل الأدوار رأسياً ({Math.round(explode * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
          />
        </label>

        <label className="pw-range">
          <span>
            القطع الأفقي للأدوار ({floorSlice === 13 ? 'كل الأدوار الـ 12 + البوديوم' : floorSlice === 0 ? 'البوديوم والأساسات فقط' : `حتى الدور ${floorSlice}`})
          </span>
          <input
            type="range"
            min={0}
            max={TOWER_DIMS.totalFloorsIncludingPodium}
            step={1}
            value={floorSlice}
            onChange={(e) => setFloorSlice(Number(e.target.value))}
          />
        </label>

        <div className="pw-bim-info" aria-live="polite">
          <span className="pw-ifc">{info.ifc}</span>
          <h4>{info.title}</h4>
          <p>{info.material}</p>
          <p style={{ marginTop: '6px', fontWeight: 700, color: '#c75517' }}>{info.boqMetric}</p>
        </div>

        <p className="pw-bim-disclaimer">
          نموذج هندسي متكامل يطابق تقسيمات برج كابيتال (شقة 140 م² + شقة 185 م² + شقة 205 م² وقلب المصعدين المزدوج).
        </p>
      </aside>
    </div>
  );
}
