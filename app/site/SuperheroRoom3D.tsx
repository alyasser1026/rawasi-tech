"use client";

import React, { useEffect, useRef, useState } from 'react';
import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;
type ViewMode = 'split' | '3d' | 'render';
type ThemePreset = 'dark' | 'light' | 'overdrive';
type CameraPreset = 'overview' | 'bed' | 'armor' | 'desk' | 'ceiling';

export interface RoomElementSpec {
  id: string;
  title: string;
  category: string;
  code: string;
  material: string;
  executionNote: string;
  approxPrice: string;
  hotspotX: number; // percentage on 2D render
  hotspotY: number; // percentage on 2D render
  color: string;
}

export const ROOM_SPECS: Record<string, RoomElementSpec> = {
  heroWall: {
    id: 'heroWall',
    title: 'جدار السوبر هيرو (تكسيات 3D + بديل خشب + شعار مضيء)',
    category: 'التشطيبات المعمارية والديكور',
    code: 'FIN-WALL-3D01',
    material: 'شرائح بديل الخشب WPC + ألواح جيومترك 3D فحمية (#0c0907) مع بروفايل ليد عنبري (#f97316)',
    executionNote: 'يُنفذ شاسيه خشبي أو معدني موزون بالليزر مع تأسيس مسارات كابلات 24V خلف الألواح ومفاتيح ديمر ذكية.',
    approxPrice: '1,850 - 2,600 ج.م / م²',
    hotspotX: 54,
    hotspotY: 46,
    color: '#f97316',
  },
  floatingBed: {
    id: 'floatingBed',
    title: 'السرير المعلق بإضاءة محيطية (Floating Platform Bed)',
    category: 'النجارة المعمارية والفرش الثابت',
    code: 'FUR-BED-FL02',
    material: 'شاسيه كونتر معالج بارتداد داخلي 18 سم + تنجيد جلد لؤلؤي (#f7eee2) + شريط ليد سفلي مخفي بحساس حركة',
    executionNote: 'يثبت الشاسيه الحامل في الأرضية والحائط الخلفي قبل تركيب البورسلين أو فوقه بمسامير تثبيت مع عزل اهتزاز.',
    approxPrice: '28,000 - 42,000 ج.م للوحدة',
    hotspotX: 49,
    hotspotY: 74,
    color: '#fb923c',
  },
  armorCabinet: {
    id: 'armorCabinet',
    title: 'كابينة عرض الدروع والمقتنيات (Museum Display Pods)',
    category: 'أعمال الزجاج والنجارة الفاخرة',
    code: 'FIN-GLS-CAB03',
    material: 'زجاج سيكوريت فائق النقاء 10 مم بإطارات ألومنيوم أنودايز أسود + إضاءة سبوت متحفية CRI>95 وخلفية مضيئة',
    executionNote: 'تُركب علب التغذية الكهربائية والمحولات (Drivers) في تجويف علوي مخفي سهل الصيانة مع تهوية حرارية.',
    approxPrice: '4,200 - 5,800 ج.م / م²',
    hotspotX: 16,
    hotspotY: 52,
    color: '#f59e0b',
  },
  commandDesk: {
    id: 'commandDesk',
    title: 'منصة القيادة والمكتب الذكي (Smart Command & Gaming Station)',
    category: 'الأنظمة الذكية وتقنية المعلومات IT',
    code: 'IT-DESK-CMD04',
    material: 'سطح كاربون فايبر كابولي محمول على كوابيل حديد مخفية + إدارة كابلات مدمجة + مخارج Cat6A / Fiber',
    executionNote: 'تأسيس علب أرضية أو حائطية مزدوجة (تيار خفيف + قوى UPS) لمنع ظهور أي أسلاك خارجية.',
    approxPrice: '19,500 - 32,000 ج.م للوحدة',
    hotspotX: 86,
    hotspotY: 64,
    color: '#0ea5e9',
  },
  ceilingMep: {
    id: 'ceilingMep',
    title: 'السقف المعلق والتكييف المخفي (Gypsum Cove & Linear AC)',
    category: 'الأسقف والكهروميكانيك (MEP)',
    code: 'MEP-CEIL-AC05',
    material: 'جبس بورد أبيض/أخضر ببيت نور محيطي + تراك لايت مغناطيسي (Magnetic Track) + جريلات تكييف Linear Slot',
    executionNote: 'يتم تنسيق مناسيب دكت التكييف المخفي (Concealed Duct) وصرف التكييف واختبارها قبل تقفيل ألواح الجبس.',
    approxPrice: '950 - 1,450 ج.م / م²',
    hotspotX: 50,
    hotspotY: 16,
    color: '#10b981',
  },
  marbleFloor: {
    id: 'marbleFloor',
    title: 'أرضيات رخام نيرو ماركينا الأسود والسجاد الهندسي',
    category: 'أعمال الأرضيات والرخام',
    code: 'FIN-FLR-MRB06',
    material: 'ألواح رخام نيرو ماركينا إسباني أو بورسلين كالاكاتا أسود مقاس 120×240 سم بقطع ليزر وجلي كريستال',
    executionNote: 'التركيب بمادة لاصقة إسمنتية مرنة (C2TE S1) مع كلبسات تسوية (Leveling Clips) ولحامات إيبوكسي مطابقة للون.',
    approxPrice: '1,650 - 2,900 ج.م / م²',
    hotspotX: 28,
    hotspotY: 88,
    color: '#a855f7',
  },
};

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

export default function SuperheroRoom3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [themePreset, setThemePreset] = useState<ThemePreset>('dark');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [showCeiling, setShowCeiling] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<RoomElementSpec>(ROOM_SPECS.heroWall);
  const [webglStatus, setWebglStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading');

  const sceneApiRef = useRef<{
    setTheme: (t: ThemePreset) => void;
    setCamPreset: (c: CameraPreset) => void;
    setCeilingVisible: (v: boolean) => void;
    setAutoRotate: (v: boolean) => void;
    highlightGroup: (id: string) => void;
  } | null>(null);

  useEffect(() => {
    if (viewMode === 'render') return;
    const host = hostRef.current;
    if (!host) return;

    if (!isWebGLSupported()) {
      setWebglStatus('unsupported');
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    const initScene = async () => {
      let THREE: Three;
      let OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
      try {
        THREE = await import('three');
        OrbitControls = (await import('three/examples/jsm/controls/OrbitControls.js')).OrbitControls;
      } catch {
        if (!disposed) setWebglStatus('unsupported');
        return;
      }
      if (disposed) return;

      let renderer: ThreeNS.WebGLRenderer;
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
      renderer.toneMappingExposure = 1.15;

      host.innerHTML = '';
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0c0907);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
      camera.position.set(7.2, 4.3, 8.8);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, 1.5, -0.5);
      controls.minDistance = 3.2;
      controls.maxDistance = 18;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;

      const disposables: { dispose: () => void }[] = [];
      const pickables: ThreeNS.Object3D[] = [];
      const neonMaterials: ThreeNS.MeshStandardMaterial[] = [];

      const createMat = (params: ThreeNS.MeshStandardMaterialParameters) => {
        const m = new THREE.MeshStandardMaterial(params);
        disposables.push(m);
        return m;
      };

      // Shared Dynamic Materials
      const matFloor = createMat({ color: 0x0f0c0a, roughness: 0.18, metalness: 0.25 });
      const matBackWallRight = createMat({ color: 0x14110f, roughness: 0.65, metalness: 0.15 });
      const matSlatWood = createMat({ color: 0x3b2618, roughness: 0.55, metalness: 0.08 });
      const matWallPearl = createMat({ color: 0xd8cbb8, roughness: 0.72, metalness: 0.05 });
      const matObsidianTrim = createMat({ color: 0x0c0907, roughness: 0.35, metalness: 0.45 });
      const matBedLeather = createMat({ color: 0xd9a87e, roughness: 0.48, metalness: 0.05 });
      const matBedSheet = createMat({ color: 0x171412, roughness: 0.8, metalness: 0.02 });
      const matPillowPearl = createMat({ color: 0xf7eee2, roughness: 0.75, metalness: 0.02 });
      const matRugBase = createMat({ color: 0xeaddca, roughness: 0.9, metalness: 0.0 });
      const matRugAccent = createMat({ color: 0xd97706, roughness: 0.85, metalness: 0.05 });
      const matGlass = createMat({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.22,
        roughness: 0.08,
        metalness: 0.3,
      });
      const matCarbonDesk = createMat({ color: 0x16181d, roughness: 0.3, metalness: 0.6 });
      const matGoldArmor = createMat({ color: 0xf59e0b, roughness: 0.22, metalness: 0.88 });
      const matRedArmor = createMat({ color: 0xb91c1c, roughness: 0.28, metalness: 0.75 });
      const matTitaniumArmor = createMat({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });
      const matCeiling = createMat({ color: 0xe7dfd3, roughness: 0.82, metalness: 0.04 });

      const matNeonOrange = createMat({
        color: 0xf97316,
        emissive: 0xf97316,
        emissiveIntensity: 2.8,
        roughness: 0.2,
      });
      const matNeonCyan = createMat({
        color: 0x0ea5e9,
        emissive: 0x0ea5e9,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      });
      const matNeonWhite = createMat({
        color: 0xfff7ed,
        emissive: 0xfed7aa,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      neonMaterials.push(matNeonOrange, matNeonCyan, matNeonWhite);

      const addBox = (
        specId: string,
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
        mat: ThreeNS.Material,
        parent: ThreeNS.Object3D = scene
      ) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { specId };
        parent.add(mesh);
        pickables.push(mesh);
        return mesh;
      };

      const addCyl = (
        specId: string,
        rTop: number,
        rBot: number,
        h: number,
        segs: number,
        x: number,
        y: number,
        z: number,
        mat: ThreeNS.Material,
        parent: ThreeNS.Object3D = scene
      ) => {
        const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { specId };
        parent.add(mesh);
        pickables.push(mesh);
        return mesh;
      };

      // Room dimensions
      const RW = 8.4; // width X
      const RD = 7.4; // depth Z
      const RH = 3.6; // height Y

      // 1. FLOOR & GEOMETRIC RUG (marbleFloor)
      const floorMesh = addBox('marbleFloor', RW, 0.16, RD, 0, -0.08, 0, matFloor);
      floorMesh.castShadow = false;

      // Subtle Marble Grid Lines on Floor
      const floorGrid = new THREE.GridHelper(RW - 0.2, 7, 0x29221c, 0x1f1915);
      floorGrid.position.y = 0.003;
      scene.add(floorGrid);

      // Geometric Rug under Bed
      addBox('marbleFloor', 4.3, 0.025, 3.8, 0, 0.013, 0.1, matRugBase);
      addBox('marbleFloor', 1.2, 0.028, 1.2, -1.2, 0.015, 1.1, matRugAccent);
      addBox('marbleFloor', 1.1, 0.028, 1.0, 1.25, 0.015, 1.25, matRugAccent);
      addBox('marbleFloor', 1.4, 0.028, 0.9, -0.4, 0.015, -0.8, matRugAccent);

      // 2. BACK FEATURE WALL (heroWall) at Z = -RD/2
      const backZ = -RD / 2;
      addBox('heroWall', RW, RH, 0.18, 0, RH / 2, backZ, matBackWallRight);

      // Left half of back wall: Vertical Timber Slats (X from -4.0 to +0.2)
      for (let x = -3.95; x <= 0.2; x += 0.11) {
        addBox('heroWall', 0.055, RH - 0.2, 0.06, x, RH / 2, backZ + 0.11, matSlatWood);
      }
      // Subtle top & side orange LED frame around slats
      addBox('heroWall', 4.2, 0.03, 0.04, -1.85, RH - 0.14, backZ + 0.13, matNeonOrange);

      // Right half of back wall: 3D Faceted Obsidian Panels with Glowing Orange Seams (X from +0.3 to +4.0)
      const panelCoords = [
        { x: 0.95, y: 2.9, w: 1.15, h: 0.85, d: 0.09, rx: 0.03, ry: -0.04 },
        { x: 2.15, y: 2.9, w: 1.15, h: 0.85, d: 0.12, rx: -0.04, ry: 0.03 },
        { x: 3.35, y: 2.9, w: 1.1, h: 0.85, d: 0.08, rx: 0.02, ry: -0.03 },
        { x: 0.95, y: 1.95, w: 1.15, h: 0.9, d: 0.11, rx: -0.03, ry: 0.04 },
        { x: 2.15, y: 1.95, w: 1.15, h: 0.9, d: 0.08, rx: 0.04, ry: -0.02 },
        { x: 3.35, y: 1.95, w: 1.1, h: 0.9, d: 0.12, rx: -0.02, ry: 0.04 },
        { x: 0.95, y: 1.0, w: 1.15, h: 0.88, d: 0.08, rx: 0.03, ry: 0.02 },
        { x: 2.15, y: 1.0, w: 1.15, h: 0.88, d: 0.11, rx: -0.03, ry: -0.03 },
        { x: 3.35, y: 1.0, w: 1.1, h: 0.88, d: 0.09, rx: 0.02, ry: 0.03 },
      ];
      panelCoords.forEach((p) => {
        const m = addBox('heroWall', p.w, p.h, p.d, p.x, p.y, backZ + 0.11, matObsidianTrim);
        m.rotation.set(p.rx, p.ry, 0);
      });

      // Glowing Orange LED Seams between the geometric panels
      addBox('heroWall', 3.5, 0.022, 0.05, 2.15, 2.42, backZ + 0.11, matNeonOrange);
      addBox('heroWall', 3.5, 0.022, 0.05, 2.15, 1.46, backZ + 0.11, matNeonOrange);
      const seamDiag1 = addBox('heroWall', 0.024, 2.7, 0.05, 1.54, 1.95, backZ + 0.11, matNeonOrange);
      seamDiag1.rotation.z = 0.08;
      const seamDiag2 = addBox('heroWall', 0.024, 2.7, 0.05, 2.76, 1.95, backZ + 0.11, matNeonOrange);
      seamDiag2.rotation.z = -0.07;

      // CENTERPIECE GLOWING PHITECH SUPERHERO EMBLEM on Back Wall (X = -0.35, Y = 2.32)
      const emblemGroup = new THREE.Group();
      emblemGroup.position.set(-0.35, 2.32, backZ + 0.16);
      scene.add(emblemGroup);

      // Outer & Inner Glowing Neon Rings
      const ringGeo1 = new THREE.TorusGeometry(0.56, 0.022, 16, 64);
      const ringGeo2 = new THREE.TorusGeometry(0.45, 0.016, 16, 64);
      disposables.push(ringGeo1, ringGeo2);
      const ring1 = new THREE.Mesh(ringGeo1, matNeonOrange);
      const ring2 = new THREE.Mesh(ringGeo2, matNeonOrange);
      ring1.userData = { specId: 'heroWall' };
      ring2.userData = { specId: 'heroWall' };
      emblemGroup.add(ring1, ring2);
      pickables.push(ring1, ring2);

      // Twin PhiTech Crane Pillars + Superhero Mask Visor inside Emblem
      addBox('heroWall', 0.075, 0.92, 0.035, -0.065, 0, 0.01, matNeonOrange, emblemGroup);
      addBox('heroWall', 0.075, 0.92, 0.035, 0.065, 0, 0.01, matNeonOrange, emblemGroup);
      // Top T-bars of PhiTech Towers
      addBox('heroWall', 0.16, 0.04, 0.035, -0.09, 0.45, 0.01, matNeonOrange, emblemGroup);
      addBox('heroWall', 0.16, 0.04, 0.035, 0.09, 0.45, 0.01, matNeonOrange, emblemGroup);
      // Superhero Glowing Eyes / Visor Bar across the Emblem
      const eyeLeft = addBox('heroWall', 0.18, 0.04, 0.04, -0.17, 0.08, 0.02, matNeonWhite, emblemGroup);
      eyeLeft.rotation.z = -0.18;
      const eyeRight = addBox('heroWall', 0.18, 0.04, 0.04, 0.17, 0.08, 0.02, matNeonWhite, emblemGroup);
      eyeRight.rotation.z = 0.18;

      // 3. FLOATING PLATFORM BED (floatingBed) centered around X = -0.35
      const bedX = -0.35;
      // Recessed Base + Orange Under-Bed Neon Strip
      addBox('floatingBed', 1.9, 0.14, 2.0, bedX, 0.07, -2.1, matObsidianTrim);
      addBox('floatingBed', 2.05, 0.035, 2.12, bedX, 0.12, -2.1, matNeonOrange);
      // Floating Platform Frame
      addBox('floatingBed', 2.42, 0.16, 2.45, bedX, 0.22, -2.15, matBedLeather);
      // Headboard (Two plush pearl-tan cushions)
      addBox('floatingBed', 1.16, 0.92, 0.18, bedX - 0.59, 0.72, -3.32, matBedLeather);
      addBox('floatingBed', 1.16, 0.92, 0.18, bedX + 0.59, 0.72, -3.32, matBedLeather);
      // Mattress & Dark Duvet
      addBox('floatingBed', 2.16, 0.26, 2.15, bedX, 0.41, -2.12, matBedSheet);
      addBox('floatingBed', 2.18, 0.06, 0.45, bedX, 0.55, -2.85, matPillowPearl);
      // Pillows
      addBox('floatingBed', 0.78, 0.16, 0.42, bedX - 0.52, 0.6, -3.05, matPillowPearl);
      addBox('floatingBed', 0.78, 0.16, 0.42, bedX + 0.52, 0.6, -3.05, matPillowPearl);
      addBox('floatingBed', 0.55, 0.15, 0.32, bedX, 0.62, -2.92, matObsidianTrim);

      // Two Nightstands
      addBox('floatingBed', 0.62, 0.38, 0.52, bedX - 1.65, 0.19, -3.2, matObsidianTrim);
      addBox('floatingBed', 0.62, 0.38, 0.52, bedX + 1.65, 0.19, -3.2, matObsidianTrim);
      // Mini Superhero Arc Lamp on left nightstand
      addCyl('floatingBed', 0.08, 0.1, 0.22, 16, bedX - 1.65, 0.49, -3.2, matGoldArmor);
      addCyl('floatingBed', 0.09, 0.09, 0.06, 16, bedX - 1.65, 0.62, -3.2, matNeonOrange);

      // 4. LEFT WALL — MUSEUM ARMOR & HELMET DISPLAY CABINETS (armorCabinet) at X = -RW/2
      const leftX = -RW / 2;
      addBox('armorCabinet', 0.55, RH, RD, leftX + 0.27, RH / 2, 0, matWallPearl);
      // Dark Display Recess Box
      addBox('armorCabinet', 0.45, 2.25, 5.2, leftX + 0.34, 1.55, 0.1, matObsidianTrim);

      // 3 Vertical Glass Front Panels + Frames
      const bayZs = [-1.6, 0.1, 1.8];
      bayZs.forEach((bz) => {
        // Top spotlight inside each bay
        addCyl('armorCabinet', 0.07, 0.07, 0.03, 16, leftX + 0.38, 2.62, bz, matNeonWhite);
        // Glass Shelf
        addBox('armorCabinet', 0.36, 0.025, 1.45, leftX + 0.38, 1.52, bz, matGlass);
        // Front Glass Door
        addBox('armorCabinet', 0.02, 2.18, 1.5, leftX + 0.56, 1.55, bz, matGlass);
      });

      // Bay 1 (Z = -1.6): Stylized Superhero Helmets + Glowing Wall Emblem
      addCyl('armorCabinet', 0.16, 0.13, 0.32, 18, leftX + 0.36, 1.72, -1.8, matObsidianTrim);
      addBox('armorCabinet', 0.04, 0.05, 0.18, leftX + 0.51, 1.76, -1.8, matNeonOrange); // glowing visor
      addCyl('armorCabinet', 0.16, 0.13, 0.32, 18, leftX + 0.36, 0.78, -1.6, matRedArmor);
      addBox('armorCabinet', 0.04, 0.14, 0.18, leftX + 0.5, 0.78, -1.6, matGoldArmor); // gold faceplate

      // Bay 2 (Z = +0.1): Centerpiece Superhero Shield (Iconic Tapered Crest)
      const shieldMesh = addCyl('armorCabinet', 0.48, 0.38, 0.08, 6, leftX + 0.38, 1.55, 0.1, matGoldArmor);
      shieldMesh.rotation.z = Math.PI / 2;
      const shieldCore = addCyl('armorCabinet', 0.16, 0.16, 0.1, 16, leftX + 0.41, 1.55, 0.1, matNeonCyan);
      shieldCore.rotation.z = Math.PI / 2;

      // Bay 3 (Z = +1.8): Titanium & Gold Helmets
      addCyl('armorCabinet', 0.15, 0.12, 0.3, 18, leftX + 0.36, 1.72, 1.8, matGoldArmor);
      addCyl('armorCabinet', 0.15, 0.12, 0.3, 18, leftX + 0.36, 0.78, 1.8, matTitaniumArmor);

      // 5. RIGHT WALL & SMART COMMAND DESK (commandDesk) at X = +RW/2
      const rightX = RW / 2;
      addBox('commandDesk', 0.22, RH, RD, rightX - 0.11, RH / 2, 0, matWallPearl);
      // Dark Vertical Accent Column on Right Wall with Cyan & Orange Edge LED
      addBox('commandDesk', 0.28, RH, 1.25, rightX - 0.16, RH / 2, -1.2, matObsidianTrim);
      addBox('commandDesk', 0.03, RH - 0.3, 0.03, rightX - 0.29, RH / 2, -0.57, matNeonCyan);
      addBox('commandDesk', 0.03, RH - 0.3, 0.03, rightX - 0.29, RH / 2, -1.83, matNeonOrange);

      // Cantilevered Carbon-Fiber Command Desk (Z = 0.85)
      const deskZ = 0.95;
      addBox('commandDesk', 1.15, 0.08, 2.55, rightX - 0.72, 0.76, deskZ, matCarbonDesk);
      // Desk glowing LED edge
      addBox('commandDesk', 0.025, 0.025, 2.52, rightX - 1.29, 0.76, deskZ, matNeonOrange);
      addBox('commandDesk', 0.04, 0.05, 2.4, rightX - 0.26, 0.82, deskZ, matNeonCyan);
      // Angled Desk Support Legs with Neon Strips
      const leg1 = addBox('commandDesk', 0.8, 0.08, 0.08, rightX - 0.62, 0.38, deskZ + 1.1, matCarbonDesk);
      leg1.rotation.z = 0.65;
      const legLed = addBox('commandDesk', 0.75, 0.03, 0.09, rightX - 0.62, 0.38, deskZ + 1.1, matNeonOrange);
      legLed.rotation.z = 0.65;

      // Curved Ultrawide Command Monitor
      addBox('commandDesk', 0.08, 0.32, 0.12, rightX - 0.45, 0.94, deskZ, matCarbonDesk); // stand
      addBox('commandDesk', 0.06, 0.56, 1.55, rightX - 0.54, 1.26, deskZ, matObsidianTrim); // screen frame
      // Glowing Cyan HUD Screen Surface
      const hudMat = createMat({
        color: 0x083344,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.95,
        roughness: 0.15,
      });
      neonMaterials.push(hudMat);
      addBox('commandDesk', 0.02, 0.5, 1.48, rightX - 0.57, 1.26, deskZ, hudMat);
      // HUD Center Radar Circle
      const radarRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 12, 32), matNeonCyan);
      radarRing.rotation.y = -Math.PI / 2;
      radarRing.position.set(rightX - 0.585, 1.26, deskZ);
      radarRing.userData = { specId: 'commandDesk' };
      scene.add(radarRing);

      // Keyboard & Mouse Pad
      addBox('commandDesk', 0.35, 0.015, 0.95, rightX - 0.92, 0.81, deskZ, matObsidianTrim);

      // Ergonomic Superhero Gaming/Command Chair
      const chairX = rightX - 1.55;
      const chairZ = deskZ - 0.05;
      addCyl('commandDesk', 0.04, 0.04, 0.42, 12, chairX, 0.25, chairZ, matTitaniumArmor); // piston
      addBox('commandDesk', 0.55, 0.05, 0.55, chairX, 0.06, chairZ, matCarbonDesk); // wheel base
      addBox('commandDesk', 0.54, 0.08, 0.54, chairX, 0.48, chairZ, matBedLeather); // seat
      const chairBack = addBox('commandDesk', 0.1, 0.88, 0.5, chairX - 0.24, 0.92, chairZ, matCarbonDesk);
      chairBack.rotation.z = 0.12;
      addBox('commandDesk', 0.12, 0.18, 0.26, chairX - 0.29, 1.42, chairZ, matObsidianTrim); // headrest

      // 6. SUSPENDED CEILING, COVE LED & LINEAR AC DIFFUSERS (ceilingMep)
      const ceilingGroup = new THREE.Group();
      scene.add(ceilingGroup);

      // Main Center Ceiling Slab
      addBox('ceilingMep', RW - 1.4, 0.12, RD - 1.4, 0, RH - 0.06, 0, matCeiling, ceilingGroup);
      // Perimeter Drop Soffits
      addBox('ceilingMep', RW, 0.28, 0.95, 0, RH - 0.14, -RD / 2 + 0.47, matCeiling, ceilingGroup);
      addBox('ceilingMep', 0.95, 0.28, RD, -RW / 2 + 0.47, RH - 0.14, 0, matCeiling, ceilingGroup);
      addBox('ceilingMep', 0.95, 0.28, RD, RW / 2 - 0.47, RH - 0.14, 0, matCeiling, ceilingGroup);

      // Glowing Orange Cove LED Strips along Ceiling Perimeter
      addBox('ceilingMep', RW - 1.7, 0.04, 0.06, 0, RH - 0.2, -RD / 2 + 0.96, matNeonOrange, ceilingGroup);
      addBox('ceilingMep', 0.06, 0.04, RD - 1.5, -RW / 2 + 0.96, RH - 0.2, 0, matNeonOrange, ceilingGroup);
      addBox('ceilingMep', 0.06, 0.04, RD - 1.5, RW / 2 - 0.96, RH - 0.2, 0, matNeonOrange, ceilingGroup);

      // Black Magnetic Track Lighting Rail on Ceiling
      addBox('ceilingMep', 4.4, 0.03, 0.07, 0, RH - 0.13, -1.9, matObsidianTrim, ceilingGroup);
      addBox('ceilingMep', 0.07, 0.03, 3.8, -2.2, RH - 0.13, 0, matObsidianTrim, ceilingGroup);
      addBox('ceilingMep', 0.07, 0.03, 3.8, 2.2, RH - 0.13, 0, matObsidianTrim, ceilingGroup);

      // Linear AC Slot Diffusers
      addBox('ceilingMep', 0.14, 0.02, 3.6, -2.85, RH - 0.13, 0, matObsidianTrim, ceilingGroup);
      addBox('ceilingMep', 0.14, 0.02, 3.6, 2.85, RH - 0.13, 0, matObsidianTrim, ceilingGroup);

      // 7. SCENE LIGHTING
      const ambientLight = new THREE.AmbientLight(0xffe8d6, 0.55);
      scene.add(ambientLight);

      const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e1b18, 0.65);
      scene.add(hemiLight);

      const mainSpot = new THREE.DirectionalLight(0xfff3e0, 1.35);
      mainSpot.position.set(5, 8, 6);
      mainSpot.castShadow = true;
      mainSpot.shadow.mapSize.width = 1024;
      mainSpot.shadow.mapSize.height = 1024;
      scene.add(mainSpot);

      // Point Lights for Superhero Glow
      const emblemLight = new THREE.PointLight(0xf97316, 4.5, 6.5);
      emblemLight.position.set(-0.35, 2.3, backZ + 0.65);
      scene.add(emblemLight);

      const underBedLight = new THREE.PointLight(0xf97316, 3.2, 4.2);
      underBedLight.position.set(bedX, 0.18, -1.6);
      scene.add(underBedLight);

      const armorLight = new THREE.PointLight(0xfbbf24, 2.8, 4.5);
      armorLight.position.set(leftX + 0.9, 2.1, 0.1);
      scene.add(armorLight);

      const deskCyanLight = new THREE.PointLight(0x0ea5e9, 2.6, 4.2);
      deskCyanLight.position.set(rightX - 0.8, 1.4, deskZ);
      scene.add(deskCyanLight);

      // Camera Animation Target
      const targetCamPos = new THREE.Vector3(7.2, 4.3, 8.8);
      const targetLookAt = new THREE.Vector3(0, 1.5, -0.5);
      let isTransitioningCam = false;

      // Raycasting on click
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downX = 0;
      let downY = 0;

      const onPointerDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
        isTransitioningCam = false;
      };

      const onPointerUp = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pickables, false);
        const hit = hits.find((h) => h.object.visible && h.object.parent?.visible !== false);
        if (hit && hit.object.userData?.specId) {
          const spec = ROOM_SPECS[hit.object.userData.specId];
          if (spec) setSelectedSpec(spec);
        }
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      // Resize Handler
      const onResize = () => {
        if (!host) return;
        const w = host.clientWidth || 640;
        const h = host.clientHeight || 460;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      onResize();
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
      ro?.observe(host);

      // Expose API to React Controls
      let currentTheme: ThemePreset = 'dark';
      sceneApiRef.current = {
        setTheme: (t: ThemePreset) => {
          currentTheme = t;
          if (t === 'light') {
            scene.background = new THREE.Color(0xf7eee2);
            matFloor.color.setHex(0x221d1a);
            matWallPearl.color.setHex(0xf5ece0);
            matCeiling.color.setHex(0xfcf9f4);
            ambientLight.intensity = 1.35;
            mainSpot.intensity = 2.1;
            emblemLight.intensity = 2.6;
            matNeonOrange.emissiveIntensity = 1.8;
          } else if (t === 'overdrive') {
            scene.background = new THREE.Color(0x060403);
            matFloor.color.setHex(0x090706);
            matWallPearl.color.setHex(0xb8ab99);
            matCeiling.color.setHex(0xd6cbbd);
            ambientLight.intensity = 0.35;
            mainSpot.intensity = 0.85;
            emblemLight.intensity = 6.8;
            underBedLight.intensity = 5.2;
            deskCyanLight.intensity = 4.5;
            matNeonOrange.emissiveIntensity = 4.2;
            matNeonCyan.emissiveIntensity = 3.6;
          } else {
            // Default Obsidian Dark (#0c0907)
            scene.background = new THREE.Color(0x0c0907);
            matFloor.color.setHex(0x0f0c0a);
            matWallPearl.color.setHex(0xd8cbb8);
            matCeiling.color.setHex(0xe7dfd3);
            ambientLight.intensity = 0.55;
            mainSpot.intensity = 1.35;
            emblemLight.intensity = 4.5;
            underBedLight.intensity = 3.2;
            deskCyanLight.intensity = 2.6;
            matNeonOrange.emissiveIntensity = 2.8;
            matNeonCyan.emissiveIntensity = 2.2;
          }
        },
        setCamPreset: (preset: CameraPreset) => {
          isTransitioningCam = true;
          if (preset === 'overview') {
            targetCamPos.set(7.2, 4.3, 8.8);
            targetLookAt.set(0, 1.5, -0.5);
          } else if (preset === 'bed') {
            targetCamPos.set(-0.35, 2.1, 2.8);
            targetLookAt.set(-0.35, 1.4, -3.2);
          } else if (preset === 'armor') {
            targetCamPos.set(1.2, 1.8, 0.4);
            targetLookAt.set(-4.0, 1.55, 0.1);
          } else if (preset === 'desk') {
            targetCamPos.set(0.2, 1.75, 1.1);
            targetLookAt.set(3.8, 1.2, 0.95);
          } else if (preset === 'ceiling') {
            targetCamPos.set(0, 1.2, 3.4);
            targetLookAt.set(0, 3.4, -1.2);
          }
        },
        setCeilingVisible: (v: boolean) => {
          ceilingGroup.visible = v;
        },
        setAutoRotate: (v: boolean) => {
          controls.autoRotate = v;
          controls.autoRotateSpeed = 1.4;
        },
        highlightGroup: (id: string) => {
          const spec = ROOM_SPECS[id];
          if (spec) setSelectedSpec(spec);
        },
      };

      // Animation Loop
      let raf = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        raf = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        if (currentTheme === 'overdrive') {
          const pulse = 3.5 + Math.sin(t * 3.5) * 1.2;
          matNeonOrange.emissiveIntensity = pulse;
          emblemLight.intensity = 5.5 + Math.sin(t * 3.5) * 1.8;
        }

        if (isTransitioningCam) {
          camera.position.lerp(targetCamPos, 0.08);
          controls.target.lerp(targetLookAt, 0.08);
          if (camera.position.distanceTo(targetCamPos) < 0.05) {
            isTransitioningCam = false;
          }
        }

        controls.update();
        renderer.render(scene, camera);
      };
      animate();
      setWebglStatus('ready');

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      };
    };

    initScene();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [viewMode]);

  const handleThemeChange = (t: ThemePreset) => {
    setThemePreset(t);
    sceneApiRef.current?.setTheme(t);
  };

  const handleCameraChange = (c: CameraPreset) => {
    setCameraPreset(c);
    sceneApiRef.current?.setCamPreset(c);
    if (c === 'bed') setSelectedSpec(ROOM_SPECS.heroWall);
    if (c === 'armor') setSelectedSpec(ROOM_SPECS.armorCabinet);
    if (c === 'desk') setSelectedSpec(ROOM_SPECS.commandDesk);
    if (c === 'ceiling') setSelectedSpec(ROOM_SPECS.ceilingMep);
  };

  const handleToggleCeiling = () => {
    const next = !showCeiling;
    setShowCeiling(next);
    sceneApiRef.current?.setCeilingVisible(next);
  };

  const handleToggleRotate = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    sceneApiRef.current?.setAutoRotate(next);
  };

  return (
    <div
      dir="rtl"
      style={{
        background: themePreset === 'light' ? '#f7eee2' : '#0c0907',
        color: themePreset === 'light' ? '#1c1815' : '#fefcf9',
        borderRadius: '26px',
        padding: '24px',
        boxShadow: '0 28px 60px -18px rgba(0,0,0,0.65)',
        border: '1px solid rgba(249, 115, 22, 0.22)',
        transition: 'background 0.35s ease, color 0.35s ease',
      }}
    >
      {/* Top Control Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom:
            themePreset === 'light'
              ? '1px solid rgba(28, 24, 21, 0.1)'
              : '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/brand/phitech-dual-logo.jpg"
            alt="شعار فاي تك"
            style={{
              width: '68px',
              height: '46px',
              objectFit: 'cover',
              borderRadius: '10px',
              border: '1px solid rgba(249, 115, 22, 0.4)',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'rgba(249, 115, 22, 0.16)',
                  color: '#f97316',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                PHI TECH 3D INTERIOR STUDIO
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  opacity: 0.75,
                  fontFamily: 'monospace',
                }}
              >
                #0c0907 DARK • #f7eee2 LIGHT • #f97316 AMBER
              </span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, marginTop: '4px' }}>
              غرفة سوبر هيرو ثلاثية الأبعاد (نموذج 3D تفاعلي + ريندر تنفيذي واقعي)
            </h3>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            background: themePreset === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
            padding: '5px',
            borderRadius: '14px',
          }}
        >
          {[
            { id: 'split' as ViewMode, label: '⚡ عرض مزدوج (3D + ريندر)' },
            { id: '3d' as ViewMode, label: '🎮 جولة 3D تفاعلية (Three.js)' },
            { id: 'render' as ViewMode, label: '📸 الريندر الواقعي والنقاط الهندسية' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setViewMode(m.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.82rem',
                background: viewMode === m.id ? '#f97316' : 'transparent',
                color: viewMode === m.id ? '#ffffff' : 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Toolbar: Lighting Mode + Camera Angles */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        {/* Theme / Lighting Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, opacity: 0.8 }}>نظام الإضاءة والهوية:</span>
          {[
            { id: 'dark' as ThemePreset, label: '🌙 الوضع الليلي (#0c0907)' },
            { id: 'light' as ThemePreset, label: '☀️ الوضع النهاري (#f7eee2)' },
            { id: 'overdrive' as ThemePreset, label: '🔥 طاقة السوبر هيرو القصوى' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleThemeChange(t.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border:
                  themePreset === t.id
                    ? '1.5px solid #f97316'
                    : '1px solid rgba(150,150,150,0.25)',
                background:
                  themePreset === t.id ? 'rgba(249, 115, 22, 0.18)' : 'transparent',
                color: themePreset === t.id ? '#f97316' : 'inherit',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Camera Presets & Toggles (when 3D is active) */}
        {viewMode !== 'render' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'overview' as CameraPreset, label: 'منظور شامل' },
              { id: 'bed' as CameraPreset, label: 'جدار الهيرو والسرير' },
              { id: 'armor' as CameraPreset, label: 'كابينة الدروع' },
              { id: 'desk' as CameraPreset, label: 'منصة القيادة' },
              { id: 'ceiling' as CameraPreset, label: 'السقف والتكييف' },
            ].map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => handleCameraChange(cam.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    cameraPreset === cam.id
                      ? '#f97316'
                      : themePreset === 'light'
                      ? 'rgba(0,0,0,0.07)'
                      : 'rgba(255,255,255,0.08)',
                  color: cameraPreset === cam.id ? '#fff' : 'inherit',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {cam.label}
              </button>
            ))}

            <button
              type="button"
              onClick={handleToggleCeiling}
              style={{
                padding: '5px 11px',
                borderRadius: '8px',
                border: '1px dashed rgba(249, 115, 22, 0.5)',
                background: 'transparent',
                color: '#f97316',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {showCeiling ? 'إخفاء السقف' : 'إظهار السقف'}
            </button>

            <button
              type="button"
              onClick={handleToggleRotate}
              style={{
                padding: '5px 11px',
                borderRadius: '8px',
                border: 'none',
                background: autoRotate ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                color: autoRotate ? '#fff' : '#10b981',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {autoRotate ? '⏸ إيقاف الدوران' : '🔄 دوران تلقائي'}
            </button>
          </div>
        )}
      </div>

      {/* Main Stage Grid (Split / 3D Only / Render Only) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            viewMode === 'split' ? 'repeat(auto-fit, minmax(340px, 1fr))' : '1fr',
          gap: '20px',
          marginBottom: '20px',
        }}
      >
        {/* 1. Interactive Three.js 3D Stage */}
        {viewMode !== 'render' && (
          <div
            style={{
              position: 'relative',
              minHeight: viewMode === '3d' ? '540px' : '440px',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              background: themePreset === 'light' ? '#efe4d4' : '#090705',
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
                جاري بناء غرفة السوبر هيرو ثلاثية الأبعاد (Three.js)...
              </div>
            )}

            {webglStatus === 'unsupported' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  textAlign: 'center',
                  gap: '12px',
                }}
              >
                <p style={{ fontWeight: 800 }}>
                  المتصفح الحالي لا يدعم WebGL؛ يمكنك استعراض الريندر ثلاثي الأبعاد بالنقاط التفاعلية.
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode('render')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  عرض الريندر ثلاثي الأبعاد
                </button>
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(12, 9, 7, 0.78)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 800,
                border: '1px solid rgba(249, 115, 22, 0.4)',
                pointerEvents: 'none',
              }}
            >
              🎮 نموذج 3D حي — اسحب للتدوير • عجلة الماوس للتكبير • اضغط على أي عنصر للفحص
            </div>
          </div>
        )}

        {/* 2. Photorealistic 3D Render Stage with Interactive Engineering Hotspots */}
        {viewMode !== '3d' && (
          <div
            style={{
              position: 'relative',
              minHeight: viewMode === 'render' ? '540px' : '440px',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              background: '#0c0907',
            }}
          >
            <img
              src="/brand/superhero-room-3d.jpg"
              alt="تصميم ثري دي غرفة سوبر هيرو — فاي تك للمقاولات والتوريدات"
              style={{
                width: '100%',
                height: '100%',
                minHeight: viewMode === 'render' ? '540px' : '440px',
                objectFit: 'cover',
                display: 'block',
                filter:
                  themePreset === 'light'
                    ? 'brightness(1.12) contrast(1.02)'
                    : themePreset === 'overdrive'
                    ? 'saturate(1.35) contrast(1.12)'
                    : 'none',
                transition: 'filter 0.35s ease',
              }}
            />

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
                fontSize: '0.75rem',
                fontWeight: 800,
                border: '1px solid rgba(249, 115, 22, 0.4)',
              }}
            >
              📸 ريندر 3D تنفيذي واقعي — اضغط على النقاط المضيئة لعرض توصيف البند والتكلفة
            </div>

            {/* Interactive Hotspots on Render */}
            {Object.values(ROOM_SPECS).map((spec, idx) => {
              const isSelected = selectedSpec.id === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSelectedSpec(spec)}
                  title={spec.title}
                  style={{
                    position: 'absolute',
                    left: `${spec.hotspotX}%`,
                    top: `${spec.hotspotY}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isSelected ? '36px' : '30px',
                    height: isSelected ? '36px' : '30px',
                    borderRadius: '50%',
                    background: isSelected ? '#f97316' : 'rgba(12, 9, 7, 0.85)',
                    color: '#fff',
                    border: `2px solid ${spec.color}`,
                    boxShadow: `0 0 16px ${spec.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: isSelected ? 10 : 5,
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Element Quick Selector Chips + Engineering Dossier Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
          alignItems: 'stretch',
        }}
      >
        {/* Quick Element Buttons */}
        <div
          style={{
            background:
              themePreset === 'light'
                ? 'rgba(255, 255, 255, 0.75)'
                : 'rgba(255, 255, 255, 0.04)',
            borderRadius: '18px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f97316' }}>
            عناصر وبنود تنفيذ الغرفة (اضغط للفحص الهندسي):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {Object.values(ROOM_SPECS).map((spec, idx) => {
              const active = selectedSpec.id === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSelectedSpec(spec)}
                  style={{
                    textAlign: 'right',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: active
                      ? `1.5px solid ${spec.color}`
                      : '1px solid rgba(150,150,150,0.2)',
                    background: active
                      ? 'rgba(249, 115, 22, 0.14)'
                      : themePreset === 'light'
                      ? '#fff'
                      : 'rgba(12, 9, 7, 0.6)',
                    color: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    transition: 'all 0.18s',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: spec.color,
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ lineHeight: 1.35 }}>{spec.title.split('(')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Element Engineering Specification Card */}
        <div
          style={{
            background:
              themePreset === 'light'
                ? 'rgba(255, 255, 255, 0.9)'
                : 'rgba(22, 18, 15, 0.9)',
            borderRadius: '18px',
            padding: '20px',
            border: `1px solid ${selectedSpec.color}55`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  background: `${selectedSpec.color}22`,
                  color: selectedSpec.color,
                  padding: '3px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                {selectedSpec.category}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  opacity: 0.75,
                }}
              >
                CODE: {selectedSpec.code}
              </span>
            </div>

            <h4 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '8px' }}>
              {selectedSpec.title}
            </h4>

            <div style={{ fontSize: '0.84rem', lineHeight: 1.65, display: 'grid', gap: '6px' }}>
              <div>
                <strong style={{ color: '#f97316' }}>الخامات والمواصفات: </strong>
                <span>{selectedSpec.material}</span>
              </div>
              <div>
                <strong style={{ color: '#10b981' }}>أصول التنفيذ والاستلام (فاي تك): </strong>
                <span>{selectedSpec.executionNote}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid rgba(150,150,150,0.2)',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontWeight: 700, opacity: 0.8 }}>السعر الاسترشادي التقديري (نوفمبر 2026):</span>
            <strong style={{ color: '#f97316', fontSize: '1rem', fontWeight: 900 }}>
              {selectedSpec.approxPrice}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
