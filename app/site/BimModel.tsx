"use client";

import React, { useEffect, useRef, useState } from 'react';
import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;
type LayerId = 'structure' | 'masonry' | 'mep' | 'finish';

const LAYERS: { id: LayerId; label: string; color: string }[] = [
  { id: 'structure', label: 'الهيكل الخرساني', color: '#8d949b' },
  { id: 'masonry', label: 'المباني والجدران', color: '#d9c7a8' },
  { id: 'mep', label: 'التأسيسات (MEP)', color: '#2f8fdc' },
  { id: 'finish', label: 'التشطيبات', color: '#c75517' },
];

type Info = { title: string; ifc: string; text: string };
const INFO: Record<string, Info> = {
  foundation: { title: 'لبشة الأساسات', ifc: 'IfcFooting', text: 'خرسانة مسلحة تنقل أحمال المبنى إلى التربة، وتُعزل مائيًا قبل الردم.' },
  column: { title: 'عمود خرساني', ifc: 'IfcColumn', text: 'عنصر رأسي يحمل أحمال الأسقف. تُحدَّد أبعاده وتسليحه من الحسابات الإنشائية.' },
  slab: { title: 'سقف / بلاطة', ifc: 'IfcSlab', text: 'بلاطة خرسانية مسلحة. يُنسَّق مرور التأسيسات فيها قبل الصب.' },
  beam: { title: 'كمرة', ifc: 'IfcBeam', text: 'تنقل أحمال البلاطات إلى الأعمدة.' },
  wall: { title: 'جدار مباني', ifc: 'IfcWall', text: 'مباني طوب مع أعتاب فوق الفتحات، ثم لياسة وعزل حسب الموضع.' },
  duct: { title: 'دكت تكييف', ifc: 'IfcDuctSegment', text: 'مجرى هواء مخفي فوق السقف المعلق، يُحدَّد مساره في المخططات التنفيذية.' },
  diffuser: { title: 'مخرج هواء', ifc: 'IfcAirTerminal', text: 'مخرج خطي مدمج في السقف المعلق.' },
  pipe: { title: 'ماسورة تغذية', ifc: 'IfcPipeSegment', text: 'صاعد رئيسي للتغذية بالمياه داخل مجرى التأسيسات.' },
  drain: { title: 'صاعد صرف', ifc: 'IfcPipeSegment', text: 'مسار الصرف الرأسي بميول مدروسة.' },
  conduit: { title: 'مسار كهرباء', ifc: 'IfcCableCarrierSegment', text: 'مواسير وحوامل كابلات تُؤسَّس قبل اللياسة.' },
  panel: { title: 'لوحة توزيع', ifc: 'IfcElectricDistributionBoard', text: 'نقطة توزيع التيار الكهربائي للدور.' },
  floorfinish: { title: 'أرضية التشطيب', ifc: 'IfcCovering', text: 'بلاط أو رخام على مونة، فوق طبقات العزل والتسوية.' },
  ceiling: { title: 'سقف معلق', ifc: 'IfcCovering', text: 'جبس بورد بتجاويف إضاءة مخفية، يغطي الدكتات والمواسير.' },
  glass: { title: 'فتحة زجاجية', ifc: 'IfcWindow', text: 'زجاج مزدوج بإطار ألومنيوم ضمن فتحة في المباني.' },
  facade: { title: 'تكسية الواجهة', ifc: 'IfcCovering', text: 'ألواح تكسية على هيكل تثبيت خلف الواجهة.' },
};

export default function BimModel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ setLayer: (id: LayerId, on: boolean) => void; setExplode: (v: number) => void; reset: () => void } | null>(null);
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ structure: true, masonry: true, mep: true, finish: true });
  const [explode, setExplode] = useState(0);
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
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

      let renderer: ThreeNS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setStatus('unsupported');
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
      const HOME = new THREE.Vector3(19, 13, 21);
      const TARGET = new THREE.Vector3(0, 3.2, 0);
      camera.position.copy(HOME);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a929a, 1.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.9);
      sun.position.set(14, 22, 12);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xbcd2e6, 0.55);
      fill.position.set(-16, 8, -10);
      scene.add(fill);

      // ground grid
      const grid = new THREE.GridHelper(40, 40, 0xc9ced3, 0xe3e6e9);
      grid.position.y = -0.41;
      (grid.material as ThreeNS.Material).transparent = true;
      (grid.material as ThreeNS.Material).opacity = 0.7;
      scene.add(grid);

      const layerGroups: Record<LayerId, ThreeNS.Group> = {
        structure: new THREE.Group(), masonry: new THREE.Group(), mep: new THREE.Group(), finish: new THREE.Group(),
      };
      (Object.values(layerGroups) as ThreeNS.Group[]).forEach(g => scene.add(g));

      const floorBase = new Map<ThreeNS.Object3D, number>(); // base y per mesh for explode
      const pickables: ThreeNS.Object3D[] = [];
      const disposables: { dispose: () => void }[] = [];
      const mats: Record<string, ThreeNS.MeshStandardMaterial> = {};
      const mat = (key: string, color: number, opts: Partial<ThreeNS.MeshStandardMaterialParameters> = {}) => {
        if (!mats[key]) { mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05, ...opts }); disposables.push(mats[key]); }
        return mats[key];
      };
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x3c4348, transparent: true, opacity: 0.35 });
      disposables.push(edgeMat);

      const addBox = (layer: LayerId, kind: string, floor: number, w: number, h: number, d: number, x: number, y: number, z: number, material: ThreeNS.Material, edges = true) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.userData = { kind, floor, layer };
        if (edges) {
          const eg = new THREE.EdgesGeometry(geo);
          disposables.push(eg);
          mesh.add(new THREE.LineSegments(eg, edgeMat));
        }
        layerGroups[layer].add(mesh);
        floorBase.set(mesh, y);
        pickables.push(mesh);
        return mesh;
      };
      const addCyl = (layer: LayerId, kind: string, floor: number, r: number, h: number, x: number, y: number, z: number, material: ThreeNS.Material, rotZ = 0, rotX = 0) => {
        const geo = new THREE.CylinderGeometry(r, r, h, 14);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.rotation.z = rotZ; mesh.rotation.x = rotX;
        mesh.userData = { kind, floor, layer };
        layerGroups[layer].add(mesh);
        floorBase.set(mesh, y);
        pickables.push(mesh);
        return mesh;
      };

      // ── model dimensions (meters)
      const W = 12, D = 9, FH = 3.2, T = 0.25, WT = 0.25;
      const xs = [-W / 2 + 0.2, -W / 6, W / 6, W / 2 - 0.2];
      const zs = [-D / 2 + 0.2, 0, D / 2 - 0.2];

      const concrete = mat('concrete', 0xaeb4ba, { roughness: 0.9 });
      const concreteDark = mat('concreteDark', 0x9aa1a8, { roughness: 0.9 });
      const block = mat('block', 0xe4d6bd, { roughness: 0.95, transparent: true, opacity: 0.5 });
      const duct = mat('duct', 0x4aa3df, { metalness: 0.35, roughness: 0.45 });
      const diffuser = mat('diffuser', 0xdfe7ee, { metalness: 0.3, roughness: 0.4 });
      const pipeW = mat('pipeW', 0x2f6fed, { roughness: 0.4 });
      const pipeD = mat('pipeD', 0x6b7280, { roughness: 0.5 });
      const conduit = mat('conduit', 0xf2b705, { roughness: 0.5 });
      const panelM = mat('panel', 0x3a4046, { roughness: 0.6 });
      const floorFin = mat('floorFin', 0xe7dccb, { roughness: 0.55 });
      const ceilFin = mat('ceilFin', 0xf6f5f2, { roughness: 0.85 });
      const glass = mat('glass', 0x9ccbe8, { transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.2 });
      const facadeM = mat('facade', 0xc75517, { roughness: 0.55 });

      // foundation (fixed)
      addBox('structure', 'foundation', -1, W + 1.2, 0.45, D + 1.2, 0, -0.225 - 0.0, 0, concreteDark);

      // slabs: ground (on foundation), first, roof
      const slabY = [0.1, FH, FH * 2];
      slabY.forEach((y, i) => addBox('structure', 'slab', i, W + 0.6, T, D + 0.6, 0, y, 0, concrete));

      // columns for 2 floors
      for (let f = 0; f < 2; f++) {
        const y0 = f * FH + 0.1 + T / 2;
        const h = FH - T;
        for (const x of xs) for (const z of zs) addBox('structure', 'column', f, 0.4, h, 0.4, x, y0 + h / 2, z, concrete);
      }
      // beams under first + roof slabs
      for (let f = 1; f <= 2; f++) {
        const y = f * FH - T / 2 - 0.25;
        for (const z of zs) addBox('structure', 'beam', f - 1, W, 0.5, 0.3, 0, y, z, concreteDark);
        for (const x of xs) addBox('structure', 'beam', f - 1, 0.3, 0.5, D, x, y, 0, concreteDark);
      }

      // masonry walls with openings
      type Op = { c: number; w: number; sill: number; h: number; door?: boolean };
      const wallPieces = (len: number, height: number, ops: Op[]) => {
        const out: { c: number; w: number; y0: number; h: number }[] = [];
        let cursor = -len / 2;
        [...ops].sort((a, b) => a.c - b.c).forEach(o => {
          const a = o.c - o.w / 2, b = o.c + o.w / 2;
          if (a > cursor) out.push({ c: (cursor + a) / 2, w: a - cursor, y0: 0, h: height });
          if (o.sill > 0) out.push({ c: o.c, w: o.w, y0: 0, h: o.sill });
          if (o.sill + o.h < height) out.push({ c: o.c, w: o.w, y0: o.sill + o.h, h: height - o.sill - o.h });
          cursor = b;
        });
        if (cursor < len / 2) out.push({ c: (cursor + len / 2) / 2, w: len / 2 - cursor, y0: 0, h: height });
        return out;
      };
      const frontOps = (f: number): Op[] => f === 0
        ? [{ c: -3.6, w: 1.8, sill: 0.9, h: 1.3 }, { c: -0.4, w: 1.1, sill: 0, h: 2.2, door: true }, { c: 3.2, w: 2.4, sill: 0.9, h: 1.3 }]
        : [{ c: -3.6, w: 1.8, sill: 0.9, h: 1.3 }, { c: 0, w: 2.4, sill: 0.9, h: 1.3 }, { c: 3.6, w: 1.8, sill: 0.9, h: 1.3 }];
      const sideOps: Op[] = [{ c: 0, w: 1.6, sill: 0.9, h: 1.3 }];

      for (let f = 0; f < 2; f++) {
        const base = f * FH + 0.1 + T / 2;
        const H = FH - T;
        // front (+z) and back (-z)
        wallPieces(W, H, frontOps(f)).forEach(p => addBox('masonry', 'wall', f, p.w, p.h, WT, p.c, base + p.y0 + p.h / 2, D / 2, block));
        wallPieces(W, H, [{ c: -2.5, w: 1.4, sill: 0.9, h: 1.3 }, { c: 2.5, w: 1.4, sill: 0.9, h: 1.3 }]).forEach(p => addBox('masonry', 'wall', f, p.w, p.h, WT, p.c, base + p.y0 + p.h / 2, -D / 2, block));
        // sides
        for (const sx of [-W / 2, W / 2]) wallPieces(D, H, sideOps).forEach(p => addBox('masonry', 'wall', f, WT, p.h, p.w, sx, base + p.y0 + p.h / 2, p.c, block));
        // glazing
        frontOps(f).filter(o => !o.door).forEach(o => addBox('finish', 'glass', f, o.w, o.h, 0.04, o.c, base + o.sill + o.h / 2, D / 2, glass, false));
        sideOps.forEach(o => { for (const sx of [-W / 2, W / 2]) addBox('finish', 'glass', f, 0.04, o.h, o.w, sx, base + o.sill + o.h / 2, o.c, glass, false); });
        // interior partition
        addBox('masonry', 'wall', f, 0.15, H, D - 0.6, -W / 6, base + H / 2, 0, block);
      }

      // MEP
      for (let f = 0; f < 2; f++) {
        const ceilingY = (f + 1) * FH - T / 2;
        // main duct along x, branches along z
        addBox('mep', 'duct', f, W - 1.4, 0.32, 0.55, 0, ceilingY - 0.75, 0, duct);
        for (const x of [-3.6, 0.6, 3.6]) addBox('mep', 'duct', f, 0.4, 0.28, D - 2.6, x, ceilingY - 0.78, 0, duct);
        for (const x of [-3.6, 0.6, 3.6]) for (const z of [-2.8, 2.8]) addBox('mep', 'diffuser', f, 0.9, 0.05, 0.22, x, ceilingY - 0.64, z, diffuser, false);
        // risers + drains (wet core)
        // conduits (ceiling level lines)
        for (const z of [-3.2, 3.2]) addCyl('mep', 'conduit', f, 0.04, W - 1.6, 0, ceilingY - 0.42, z, conduit, Math.PI / 2);
        // electrical panel
        addBox('mep', 'panel', f, 0.5, 0.7, 0.14, -W / 2 + 0.55, f * FH + 1.6, -D / 2 + 0.3, panelM, false);
      }
      addCyl('mep', 'pipe', 0, 0.07, FH * 2 + 0.2, 4.7, FH + 0.1, -3.6, pipeW);
      addCyl('mep', 'drain', 0, 0.11, FH * 2 + 0.2, 5.1, FH + 0.1, -3.6, pipeD);

      // finishes
      for (let f = 0; f < 2; f++) {
        addBox('finish', 'floorfinish', f, W - 0.5, 0.06, D - 0.5, 0, f * FH + 0.1 + T / 2 + 0.03, 0, floorFin, false);
        addBox('finish', 'ceiling', f, W - 0.5, 0.05, D - 0.5, 0, (f + 1) * FH - T / 2 - 0.2, 0, ceilFin, false);
      }
      // facade accents on the front
      addBox('finish', 'facade', 0, 0.9, FH * 2 - 0.4, 0.14, -W / 2 + 0.05, FH, D / 2 + 0.2, facadeM, false);
      addBox('finish', 'facade', 0, 0.9, FH * 2 - 0.4, 0.14, W / 2 - 0.05, FH, D / 2 + 0.2, facadeM, false);
      addBox('finish', 'facade', 1, W + 0.8, 0.3, 0.3, 0, FH * 2 + 0.3, D / 2 + 0.05, facadeM, false);

      // ── interaction
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(TARGET);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 10;
      controls.maxDistance = 52;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.7;
      controls.enablePan = false;
      renderer.domElement.style.touchAction = 'pan-y'; // allow page scroll on touch; horizontal drags rotate
      const stopAuto = () => { controls.autoRotate = false; };
      controls.addEventListener('start', stopAuto);

      const ray = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const hit = (ev: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(pointer, camera);
        const visibleMeshes = pickables.filter(o => o.parent && (o.parent as ThreeNS.Object3D).visible);
        const hits = ray.intersectObjects(visibleMeshes, false);
        return (hits[0]?.object as ThreeNS.Mesh | undefined) ?? null;
      };
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerType !== 'mouse') return;
        renderer.domElement.style.cursor = hit(ev) ? 'pointer' : 'grab';
      };
      let selected: ThreeNS.Mesh | null = null;
      let selMat: ThreeNS.Material | null = null;
      const clearSel = () => {
        if (selected && selMat) { selected.material = selMat; }
        selected = null; selMat = null;
      };
      const selectMesh = (m: ThreeNS.Mesh | null) => {
        clearSel();
        if (!m) { setInfo(null); return; }
        selected = m;
        selMat = m.material as ThreeNS.Material;
        const hl = (selMat as ThreeNS.MeshStandardMaterial).clone();
        hl.emissive = new THREE.Color(0xc75517);
        hl.emissiveIntensity = 0.55;
        hl.transparent = false; hl.opacity = 1;
        m.material = hl;
        disposables.push(hl);
        const key = String(m.userData.kind);
        setInfo(INFO[key] ?? null);
      };
      let downAt = { x: 0, y: 0 };
      const onDown = (ev: PointerEvent) => { downAt = { x: ev.clientX, y: ev.clientY }; };
      const onUp = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) return; // drag, not click
        selectMesh(hit(ev));
      };
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);

      // API for UI
      let explodeV = 0;
      const applyExplode = () => {
        floorBase.forEach((baseY, obj) => {
          const f = (obj.userData.floor as number) ?? 0;
          obj.position.y = baseY + Math.max(0, f) * explodeV * 3.2;
        });
      };
      apiRef.current = {
        setLayer: (id, on) => { layerGroups[id].visible = on; if (!on && selected && selected.userData.layer === id) selectMesh(null); },
        setExplode: v => { explodeV = v; applyExplode(); },
        reset: () => { camera.position.copy(HOME); controls.target.copy(TARGET); controls.update(); controls.autoRotate = true; selectMesh(null); },
      };

      // sizing + loop
      const resize = () => {
        const w = host.clientWidth || 640, h = host.clientHeight || 420;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      let raf = 0;
      let running = true;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) controls.autoRotate = false;
      const frame = () => {
        if (!running) return;
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };
      const io = new IntersectionObserver(entries => {
        const on = entries[0]?.isIntersecting ?? true;
        if (on && !running) { running = true; raf = requestAnimationFrame(frame); }
        if (!on) { running = false; cancelAnimationFrame(raf); }
      }, { threshold: 0.05 });
      io.observe(host);
      raf = requestAnimationFrame(frame);
      setStatus('ready');

      cleanup = () => {
        running = false;
        cancelAnimationFrame(raf);
        io.disconnect(); ro.disconnect();
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        controls.dispose();
        disposables.forEach(d => d.dispose());
        renderer.dispose();
        renderer.domElement.remove();
        apiRef.current = null;
      };
    };

    void start();
    return () => { disposed = true; cleanup(); };
  }, []);

  const toggle = (id: LayerId) => {
    const next = !visible[id];
    setVisible(v => ({ ...v, [id]: next }));
    apiRef.current?.setLayer(id, next);
    if (!next) setInfo(null);
  };

  return (
    <div className="pw-bim">
      <div className="pw-bim-stage">
        <div ref={hostRef} className="pw-bim-canvas" role="img" aria-label="نموذج ثلاثي الأبعاد تفاعلي لفيلا من دورين يوضح الهيكل والمباني والتأسيسات والتشطيبات" />
        {status === 'loading' && <div className="pw-bim-note">جاري تحميل النموذج…</div>}
        {status === 'unsupported' && <div className="pw-bim-note">متصفحك لا يدعم العرض ثلاثي الأبعاد.</div>}
        <div className="pw-bim-hint">اسحب للتدوير · مرّر للتقريب · اضغط على أي عنصر</div>
        <button type="button" className="pw-bim-reset" onClick={() => apiRef.current?.reset()}>إعادة ضبط الكاميرا</button>
      </div>

      <aside className="pw-bim-panel">
        <h3>طبقات النموذج</h3>
        <div className="pw-bim-layers">
          {LAYERS.map(l => (
            <button key={l.id} type="button" className={`pw-chip ${visible[l.id] ? 'is-on' : ''}`} aria-pressed={visible[l.id]} onClick={() => toggle(l.id)}>
              <i style={{ background: l.color }} />
              {l.label}
            </button>
          ))}
        </div>

        <label className="pw-range">
          <span>فصل الأدوار</span>
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={e => { const v = Number(e.target.value); setExplode(v); apiRef.current?.setExplode(v); }} />
        </label>

        <div className="pw-bim-info" aria-live="polite">
          {info ? (
            <>
              <span className="pw-ifc">{info.ifc}</span>
              <h4>{info.title}</h4>
              <p>{info.text}</p>
            </>
          ) : (
            <p className="pw-muted">اضغط على أي عنصر في النموذج لعرض بياناته (نوعه وفئته في معيار IFC).</p>
          )}
        </div>
        <p className="pw-bim-disclaimer">نموذج توضيحي مبسّط لفكرة التنسيق بين القطاعات، وليس مشروعًا منفذًا.</p>
      </aside>
    </div>
  );
}
