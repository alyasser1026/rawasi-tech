'use client';

import React, { useEffect, useRef, useState } from 'react';
import type * as ThreeNS from 'three';
import type { SectionSlug } from './section-defs';

type Three = typeof ThreeNS;

interface PanoramicStructureScrollProps {
  activeSlug?: SectionSlug | null;
  containerRef?: React.RefObject<HTMLElement | null>;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (min: number, max: number, value: number) => {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
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

// توليد خامات (Textures) واقعية للخرسانة، الطوب، الرخام، والخشب بدون ملفات خارجية
function createConcreteTexture(THREE: Three): ThreeNS.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, 0, 256, 256);

  // خطوط شدات خشبية للخرسانة + حبيبات واقعية
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? 'rgba(71,85,105,0.18)' : 'rgba(226,232,240,0.14)';
    ctx.fillRect(0, y, 256, 30);
    ctx.fillStyle = 'rgba(51,65,85,0.32)';
    ctx.fillRect(0, y + 30, 256, 2);
  }
  for (let i = 0; i < 1400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 139) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(30,41,59,0.16)' : 'rgba(248,250,252,0.16)';
    ctx.fillRect(x, y, 2, 2);
  }
  // فتحات زرجينة الشدة الخرسانية (Tie-rod holes)
  for (let y = 16; y < 256; y += 64) {
    for (let x = 32; x < 256; x += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(30,41,59,0.45)';
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrickTexture(THREE: Three): ThreeNS.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#78716c'; // مونة الأسمنت
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const brickH = 256 / rows;
  const brickW = 256 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (brickW / 2);
    for (let c = -1; c <= cols; c++) {
      const shade = 0.88 + ((r * 5 + c * 3) % 5) * 0.05;
      const red = Math.min(255, Math.round(188 * shade));
      const green = Math.min(255, Math.round(86 * shade));
      const blue = Math.min(255, Math.round(54 * shade));
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.fillRect(c * brickW + offset + 2, r * brickH + 2, brickW - 4, brickH - 4);
      // فتحات الطوب المفرغ الدقيقة
      ctx.fillStyle = 'rgba(68, 28, 15, 0.25)';
      ctx.fillRect(c * brickW + offset + 8, r * brickH + 8, brickW - 16, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTravertineFinishTexture(THREE: Three): ThreeNS.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f3ece1';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 16; i++) {
    const y = i * 16;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(214, 198, 176, 0.28)' : 'rgba(255, 252, 245, 0.3)';
    ctx.fillRect(0, y, 256, 15);
    ctx.fillStyle = 'rgba(168, 148, 122, 0.35)';
    ctx.fillRect(0, y + 15, 256, 1);
  }
  for (let x = 0; x < 256; x += 64) {
    ctx.fillStyle = 'rgba(168, 148, 122, 0.28)';
    ctx.fillRect(x, 0, 1, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWoodLouverTexture(THREE: Three): ThreeNS.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7c4a27';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = x % 32 === 0 ? '#9a5b32' : '#63371b';
    ctx.fillRect(x, 0, 12, 256);
    ctx.fillStyle = '#291509';
    ctx.fillRect(x + 12, 0, 4, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function PanoramicStructureScroll({ containerRef }: PanoramicStructureScrollProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollProgressRef = useRef<number>(0);
  const smoothProgressRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hudProgress, setHudProgress] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  // حساب نسبة السكرول من أول الصفحة بالكامل حتى آخر الصفحة
  useEffect(() => {
    let rafId = 0;
    const computeScroll = () => {
      const vh = window.innerHeight || 900;
      const docEl = document.documentElement;
      const bodyEl = document.body;
      const totalHeight = Math.max(
        docEl?.scrollHeight || 0,
        bodyEl?.scrollHeight || 0,
        vh + 1
      );
      const totalScrollable = Math.max(1, totalHeight - vh);
      const traveled = window.scrollY || window.pageYOffset || 0;
      const p = clamp(traveled / totalScrollable, 0, 1);
      scrollProgressRef.current = p;
      setHudProgress(Math.round(p * 100));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeScroll);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const nx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      const ny = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      pointerRef.current = { x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) };
    };

    computeScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [containerRef]);

  // محرك المشهد البانورامي ثلاثي الأبعاد (Three.js WebGL)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!isWebGLSupported()) {
      setUseFallback(true);
      return;
    }

    let disposed = false;
    let animFrameId = 0;
    let cleanupFn = () => {};

    const initThreeScene = async () => {
      let THREE: Three;
      let RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment;
      try {
        THREE = await import('three');
        RoomEnvironment = (await import('three/examples/jsm/environments/RoomEnvironment.js'))
          .RoomEnvironment;
      } catch {
        if (!disposed) setUseFallback(true);
        return;
      }
      if (disposed) return;

      let renderer: ThreeNS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
      } catch {
        if (!disposed) setUseFallback(true);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.setClearColor(0x000000, 0);

      host.innerHTML = '';
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const scene = new THREE.Scene();

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;

      const camera = new THREE.PerspectiveCamera(
        40,
        (host.clientWidth || window.innerWidth) / Math.max(1, host.clientHeight || window.innerHeight),
        0.2,
        240
      );

      // الإضاءة الواقعية (شمس غروب معمارية + إضاءة سماء + إضاءة دافئة للتشطيب)
      const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.85);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xfff1db, 2.6);
      sunLight.position.set(22, 34, 24);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 95;
      const d = 24;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
      rimLight.position.set(-24, 18, -18);
      scene.add(rimLight);

      // إضاءات داخلية دافئة للفيلا تشتغل تدريجياً مع مرحلة التشطيب والسمارت هوم
      const interiorLights: ThreeNS.PointLight[] = [];
      const lightPositions: [number, number, number][] = [
        [0, 2.2, 0.5],
        [-3.2, 2.2, 1.5],
        [3.2, 5.8, 1.2],
        [-2.8, 5.8, 1.2],
        [0, 9.2, 0],
      ];
      for (const [lx, ly, lz] of lightPositions) {
        const pt = new THREE.PointLight(0xffb454, 0, 14, 1.6);
        pt.position.set(lx, ly, lz);
        scene.add(pt);
        interiorLights.push(pt);
      }

      // الخامات الفيزيائية (PBR Materials)
      const concreteTex = createConcreteTexture(THREE);
      const brickTex = createBrickTexture(THREE);
      const travertineTex = createTravertineFinishTexture(THREE);
      const woodTex = createWoodLouverTexture(THREE);

      const matGround = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.9,
        metalness: 0.08,
        transparent: true,
        opacity: 0.55,
      });

      const matConcrete = new THREE.MeshStandardMaterial({
        map: concreteTex,
        color: 0xcbd5e1,
        roughness: 0.78,
        metalness: 0.08,
      });

      const matConcreteDark = new THREE.MeshStandardMaterial({
        map: concreteTex,
        color: 0x94a3b8,
        roughness: 0.84,
        metalness: 0.1,
      });

      const matRebar = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.42,
        metalness: 0.82,
      });

      const matStirrup = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.5,
        metalness: 0.78,
      });

      const matBrick = new THREE.MeshStandardMaterial({
        map: brickTex,
        roughness: 0.85,
        metalness: 0.04,
      });

      const matTravertine = new THREE.MeshStandardMaterial({
        map: travertineTex,
        color: 0xfbf7f0,
        roughness: 0.38,
        metalness: 0.06,
      });

      const matWhiteArch = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.05,
      });

      const matWoodLouver = new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.48,
        metalness: 0.08,
      });

      const matDarkMullion = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.25,
        metalness: 0.85,
      });

      const matGlass = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.46,
        roughness: 0.08,
        metalness: 0.15,
        reflectivity: 0.95,
        transmission: 0.45,
      });

      const matLedGlow = new THREE.MeshStandardMaterial({
        color: 0xfDE68A,
        emissive: 0xf59e0b,
        emissiveIntensity: 0,
        roughness: 0.2,
      });

      const matPoolWater = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.25,
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      });

      // أرضية الموقع الهندسي والشبكة المعمارية
      const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), matGround);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = -0.05;
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);

      const siteGrid = new THREE.GridHelper(76, 76, 0x0284c7, 0x1e293b);
      siteGrid.position.y = -0.02;
      (siteGrid.material as ThreeNS.Material).transparent = true;
      (siteGrid.material as ThreeNS.Material).opacity = 0.35;
      scene.add(siteGrid);

      // المجموعة الرئيسية للمشهد (الفيلا + ساحة التشوينات بجوارها)
      const worldGroup = new THREE.Group();
      scene.add(worldGroup);

      // ============================================================================
      // 1️⃣ القواعد المسلحة والميد وأشاير الأعمدة (تظهر منذ البداية في الخلفية)
      // ============================================================================
      const colX = [-5.4, -1.8, 1.8, 5.4];
      const colZ = [-3.4, 0, 3.4];

      // فرشة النظافة واللبشة الخرسانية
      const raftMesh = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.36, 9.8), matConcreteDark);
      raftMesh.position.set(-1.2, 0.18, 0);
      raftMesh.receiveShadow = true;
      raftMesh.castShadow = true;
      worldGroup.add(raftMesh);

      // القواعد المنفصلة ورقاب الأعمدة التي تظهر من أول لحظة
      const footingsGroup = new THREE.Group();
      footingsGroup.position.set(-1.2, 0, 0);
      worldGroup.add(footingsGroup);

      for (const x of colX) {
        for (const z of colZ) {
          // القاعدة الخرسانية المسلحة (Stepped Footing)
          const pad1 = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.35, 1.55), matConcrete);
          pad1.position.set(x, 0.45, z);
          pad1.castShadow = true;
          pad1.receiveShadow = true;
          footingsGroup.add(pad1);

          const pad2 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.3, 1.05), matConcrete);
          pad2.position.set(x, 0.75, z);
          pad2.castShadow = true;
          pad2.receiveShadow = true;
          footingsGroup.add(pad2);
        }
      }

      // الميد الخرسانية الأرضية (Tie Beams)
      for (const z of colZ) {
        const tieX = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.38, 0.42), matConcreteDark);
        tieX.position.set(0, 0.55, z);
        tieX.castShadow = true;
        tieX.receiveShadow = true;
        footingsGroup.add(tieX);
      }
      for (const x of colX) {
        const tieZ = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 7.2), matConcreteDark);
        tieZ.position.set(x, 0.55, 0);
        tieZ.castShadow = true;
        tieZ.receiveShadow = true;
        footingsGroup.add(tieZ);
      }

      // ============================================================================
      // 2️⃣ أعمدة الخرسانة المسلحة (3 أدوار × 12 عمود = 36 عمود خرساني 3D واقعي بأشاير الحديد والكانات)
      // ============================================================================
      interface Column3DItem {
        group: ThreeNS.Group;
        concreteBody: ThreeNS.Mesh;
        rebarCage: ThreeNS.Group;
        floorIndex: number; // 0 = أرضي, 1 = أول, 2 = سطح/ملحق
        colOrder: number;
        baseY: number;
        height: number;
      }

      const columns3D: Column3DItem[] = [];
      const structureGroup = new THREE.Group();
      structureGroup.position.set(-1.2, 0, 0);
      worldGroup.add(structureGroup);

      const floorHeights = [3.6, 3.5, 3.0];
      const floorBases = [0.9, 4.75, 8.5];

      for (let f = 0; f < 3; f++) {
        const fH = floorHeights[f];
        const fBase = floorBases[f];
        let order = 0;

        for (let ix = 0; ix < colX.length; ix++) {
          for (let iz = 0; iz < colZ.length; iz++) {
            // في الدور العلوي (الملحق) نكتفي بـ 8 أعمدة لتشكيل تراس بانورامي أمامي للفيلا
            if (f === 2 && iz === 2 && (ix === 0 || ix === 3)) continue;

            const x = colX[ix];
            const z = colZ[iz];

            const colGroup = new THREE.Group();
            colGroup.position.set(x, fBase, z);
            structureGroup.add(colGroup);

            // قفص حديد التسليح والكانات داخل وفوق العمود (Rebar Cage + Stirrups)
            const rebarCage = new THREE.Group();
            const rebarH = fH + 0.65;
            const barOffsets: [number, number][] = [
              [-0.17, -0.17],
              [0.17, -0.17],
              [-0.17, 0.17],
              [0.17, 0.17],
              [0, -0.17],
              [0, 0.17],
            ];
            for (const [bx, bz] of barOffsets) {
              const bar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.024, 0.024, rebarH, 8),
                matRebar
              );
              bar.position.set(bx, rebarH / 2, bz);
              bar.castShadow = true;
              rebarCage.add(bar);
            }

            // كانات الحديد الأفقية
            for (let sy = 0.35; sy < rebarH - 0.1; sy += 0.55) {
              const stirrup = new THREE.Mesh(
                new THREE.BoxGeometry(0.38, 0.025, 0.38),
                matStirrup
              );
              stirrup.position.set(0, sy, 0);
              rebarCage.add(stirrup);
            }
            colGroup.add(rebarCage);

            // جسم العمود الخرساني المسلح (يرتفع من القاعدة لأعلى مع السكرول)
            const colGeo = new THREE.BoxGeometry(0.48, fH, 0.48);
            colGeo.translate(0, fH / 2, 0); // نقطة الارتكاز من أسفل العمود لينمو لأعلى
            const concreteBody = new THREE.Mesh(colGeo, matConcrete);
            concreteBody.castShadow = true;
            concreteBody.receiveShadow = true;
            colGroup.add(concreteBody);

            columns3D.push({
              group: colGroup,
              concreteBody,
              rebarCage,
              floorIndex: f,
              colOrder: order++,
              baseY: fBase,
              height: fH,
            });
          }
        }
      }

      // ============================================================================
      // 3️⃣ البلاطات الخرسانية والكمرات الساقطة والسلالم (تتجمع فوق الأعمدة)
      // ============================================================================
      const slabs3D: { group: ThreeNS.Group; floorIndex: number; targetY: number }[] = [];

      // بلاطة سقف الأرضي (+4.50)
      const slab1Group = new THREE.Group();
      slab1Group.position.set(0, 4.5, 0);
      const s1Main = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.28, 8.6), matConcrete);
      s1Main.castShadow = true;
      s1Main.receiveShadow = true;
      slab1Group.add(s1Main);
      // بلكونة كابولي أمامية
      const s1Cantilever = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.24, 1.8), matConcrete);
      s1Cantilever.position.set(0, 0.02, 4.8);
      s1Cantilever.castShadow = true;
      slab1Group.add(s1Cantilever);
      structureGroup.add(slab1Group);
      slabs3D.push({ group: slab1Group, floorIndex: 0, targetY: 4.5 });

      // بلاطة سقف الأول (+8.25)
      const slab2Group = new THREE.Group();
      slab2Group.position.set(0, 8.25, 0);
      const s2Main = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.28, 8.6), matConcrete);
      s2Main.castShadow = true;
      s2Main.receiveShadow = true;
      slab2Group.add(s2Main);
      const s2Cantilever = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.24, 1.5), matConcrete);
      s2Cantilever.position.set(-1.1, 0.02, 4.65);
      s2Cantilever.castShadow = true;
      slab2Group.add(s2Cantilever);
      structureGroup.add(slab2Group);
      slabs3D.push({ group: slab2Group, floorIndex: 1, targetY: 8.25 });

      // بلاطة سقف الملحق والدروة العلوية (+11.50)
      const slab3Group = new THREE.Group();
      slab3Group.position.set(0, 11.5, -0.5);
      const s3Main = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 6.8), matConcrete);
      s3Main.castShadow = true;
      s3Main.receiveShadow = true;
      slab3Group.add(s3Main);
      structureGroup.add(slab3Group);
      slabs3D.push({ group: slab3Group, floorIndex: 2, targetY: 11.5 });

      // سلم خرساني مسلح بين الأدوار
      const stairsGroup = new THREE.Group();
      for (let st = 0; st < 10; st++) {
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.34), matConcreteDark);
        stepMesh.position.set(3.6, 0.95 + st * 0.36, -1.6 + st * 0.3);
        stepMesh.castShadow = true;
        stairsGroup.add(stepMesh);
      }
      structureGroup.add(stairsGroup);

      // ============================================================================
      // 4️⃣ ساحة رصّ الخامات ثلاثية الأبعاد بجانب الهيكل الخرساني (Adjacent Materials Yard)
      // ============================================================================
      const materialsYardGroup = new THREE.Group();
      materialsYardGroup.position.set(8.6, 0, 1.2);
      worldGroup.add(materialsYardGroup);

      const matPalletWood = new THREE.MeshStandardMaterial({
        color: 0x92400e,
        roughness: 0.85,
      });

      const materialPallets3D: { group: ThreeNS.Group; index: number; targetY: number }[] = [];

      // باليتة 1: رصّات الطوب الأحمر والبلك المعماري
      const brickPallet = new THREE.Group();
      const pBase1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.6), matPalletWood);
      pBase1.position.y = 0.08;
      brickPallet.add(pBase1);
      for (let layer = 0; layer < 4; layer++) {
        const bBlock = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.34, 1.38), matBrick);
        bBlock.position.y = 0.33 + layer * 0.36;
        bBlock.castShadow = true;
        bBlock.receiveShadow = true;
        brickPallet.add(bBlock);
      }
      brickPallet.position.set(0, 0, 3.0);
      materialsYardGroup.add(brickPallet);
      materialPallets3D.push({ group: brickPallet, index: 0, targetY: 0 });

      // باليتة 2: رصّة شكاير الأسمنت والمون
      const cementPallet = new THREE.Group();
      const pBase2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.6), matPalletWood);
      pBase2.position.y = 0.08;
      cementPallet.add(pBase2);
      const matCementBag = new THREE.MeshStandardMaterial({
        color: 0xd6d3d1,
        roughness: 0.9,
      });
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 2; c++) {
          const bag = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, 0.62), matCementBag);
          bag.position.set(-0.46 + c * 0.92, 0.28 + r * 0.25, -0.34);
          bag.castShadow = true;
          cementPallet.add(bag);
          const bag2 = bag.clone();
          bag2.position.z = 0.34;
          cementPallet.add(bag2);
        }
      }
      cementPallet.position.set(0, 0, 0.7);
      materialsYardGroup.add(cementPallet);
      materialPallets3D.push({ group: cementPallet, index: 1, targetY: 0 });

      // باليتة 3: حزم حديد التسليح المشون بجوار الهيكل
      const rebarBundleGroup = new THREE.Group();
      for (let b = 0; b < 12; b++) {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 4.4, 10),
          matRebar
        );
        rod.rotation.x = Math.PI / 2;
        rod.position.set(-0.45 + (b % 4) * 0.3, 0.22 + Math.floor(b / 4) * 0.14, 0);
        rod.castShadow = true;
        rebarBundleGroup.add(rod);
      }
      rebarBundleGroup.position.set(0.2, 0, -2.1);
      materialsYardGroup.add(rebarBundleGroup);
      materialPallets3D.push({ group: rebarBundleGroup, index: 2, targetY: 0 });

      // باليتة 4: مواسير الكهروميكانيك وألواح الرخام والبورسلان للتشطيب
      const finishCrateGroup = new THREE.Group();
      const pBase4 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.7), matPalletWood);
      pBase4.position.y = 0.08;
      finishCrateGroup.add(pBase4);
      for (let s = 0; s < 5; s++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.35, 0.12), matTravertine);
        slab.position.set(0, 0.84, -0.45 + s * 0.22);
        slab.rotation.x = -0.08;
        slab.castShadow = true;
        finishCrateGroup.add(slab);
      }
      finishCrateGroup.position.set(2.8, 0, 1.4);
      materialsYardGroup.add(finishCrateGroup);
      materialPallets3D.push({ group: finishCrateGroup, index: 3, targetY: 0 });

      // ============================================================================
      // 5️⃣ حوائط المباني والطوب بين الأعمدة (تُبنى مع نزول السكرول)
      // ============================================================================
      const masonryWalls: { mesh: ThreeNS.Mesh; order: number; fullH: number }[] = [];
      const masonrySpecs: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [
        // حوائط الدور الأرضي
        { x: 0, y: 0.9, z: -3.4, w: 10.6, h: 3.45, d: 0.32 },
        { x: -5.4, y: 0.9, z: 0, w: 0.32, h: 3.45, d: 6.6 },
        { x: 5.4, y: 0.9, z: 0, w: 0.32, h: 3.45, d: 6.6 },
        { x: -1.8, y: 0.9, z: 0, w: 0.28, h: 3.45, d: 6.4 },
        // حوائط الدور الأول
        { x: 0, y: 4.75, z: -3.4, w: 10.6, h: 3.35, d: 0.32 },
        { x: -5.4, y: 4.75, z: 0, w: 0.32, h: 3.35, d: 6.6 },
        { x: 5.4, y: 4.75, z: 0, w: 0.32, h: 3.35, d: 6.6 },
        // حوائط الملحق العلوي
        { x: 0, y: 8.5, z: -3.4, w: 7.2, h: 2.85, d: 0.32 },
        { x: -3.6, y: 8.5, z: -0.5, w: 0.32, h: 2.85, d: 5.8 },
      ];

      masonrySpecs.forEach((sp, idx) => {
        const geo = new THREE.BoxGeometry(sp.w, sp.h, sp.d);
        geo.translate(0, sp.h / 2, 0);
        const wallMesh = new THREE.Mesh(geo, matBrick);
        wallMesh.position.set(sp.x, sp.y, sp.z);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        structureGroup.add(wallMesh);
        masonryWalls.push({ mesh: wallMesh, order: idx, fullH: sp.h });
      });

      // ============================================================================
      // 6️⃣ تشطيب الفيلا بالكامل (الواجهات الحجرية، الزجاج، التجاليد الخشبية، المسبح والإضاءة)
      // ============================================================================
      const finishingGroup = new THREE.Group();
      structureGroup.add(finishingGroup);

      // أ) كسوة الحجر الترافرتين واللياسة البيضاء الفاخرة للواجهات
      const claddingElements: ThreeNS.Object3D[] = [];

      const facadeBack = new THREE.Mesh(new THREE.BoxGeometry(12.75, 10.8, 0.45), matTravertine);
      facadeBack.position.set(0, 5.8, -3.55);
      facadeBack.castShadow = true;
      facadeBack.receiveShadow = true;
      finishingGroup.add(facadeBack);
      claddingElements.push(facadeBack);

      const facadeLeftWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.6, 7.4), matWhiteArch);
      facadeLeftWing.position.set(-5.55, 4.4, 0.2);
      facadeLeftWing.castShadow = true;
      finishingGroup.add(facadeLeftWing);
      claddingElements.push(facadeLeftWing);

      const facadeRightWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.6, 7.4), matTravertine);
      facadeRightWing.position.set(5.55, 4.4, 0.2);
      facadeRightWing.castShadow = true;
      finishingGroup.add(facadeRightWing);
      claddingElements.push(facadeRightWing);

      // الإطار المعماري البارز للدور الأول (Modern Architectural Frame)
      const archFrameTop = new THREE.Mesh(new THREE.BoxGeometry(13.1, 0.52, 2.4), matWhiteArch);
      archFrameTop.position.set(0, 8.35, 4.2);
      archFrameTop.castShadow = true;
      finishingGroup.add(archFrameTop);
      claddingElements.push(archFrameTop);

      const archFrameMid = new THREE.Mesh(new THREE.BoxGeometry(13.1, 0.48, 2.4), matWhiteArch);
      archFrameMid.position.set(0, 4.55, 4.4);
      archFrameMid.castShadow = true;
      finishingGroup.add(archFrameMid);
      claddingElements.push(archFrameMid);

      // تجاليد خشبية فاخرة على الواجهة والبرجولة العلوية
      const woodCladPanel = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.4, 0.18), matWoodLouver);
      woodCladPanel.position.set(-3.5, 6.45, 3.55);
      woodCladPanel.castShadow = true;
      finishingGroup.add(woodCladPanel);
      claddingElements.push(woodCladPanel);

      const pergolaGroup = new THREE.Group();
      pergolaGroup.position.set(0, 11.55, 1.4);
      for (let l = -3.6; l <= 3.6; l += 0.6) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 4.2), matWoodLouver);
        louver.position.set(l, 0, 0);
        louver.castShadow = true;
        pergolaGroup.add(louver);
      }
      finishingGroup.add(pergolaGroup);
      claddingElements.push(pergolaGroup);

      // ب) الواجهات الزجاجية والدرابزين الزجاجي (Curtain Walls & Glass Balustrades)
      const glazingElements: ThreeNS.Object3D[] = [];

      const groundGlass = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3.35, 0.14), matGlass);
      groundGlass.position.set(0, 2.65, 3.4);
      finishingGroup.add(groundGlass);
      glazingElements.push(groundGlass);

      const firstFloorGlass = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.3, 0.14), matGlass);
      firstFloorGlass.position.set(1.7, 6.45, 3.4);
      finishingGroup.add(firstFloorGlass);
      glazingElements.push(firstFloorGlass);

      const penthouseGlass = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.75, 0.14), matGlass);
      penthouseGlass.position.set(0, 10.0, 2.8);
      finishingGroup.add(penthouseGlass);
      glazingElements.push(penthouseGlass);

      // قوائم الألومنيوم السوداء (Mullions)
      for (let mx = -4.5; mx <= 4.5; mx += 1.8) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.09, 7.1, 0.2), matDarkMullion);
        mullion.position.set(mx, 4.5, 3.42);
        finishingGroup.add(mullion);
        glazingElements.push(mullion);
      }

      // درابزين البلكونة الزجاجي
      const balconyRail1 = new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.05, 0.08), matGlass);
      balconyRail1.position.set(0, 5.15, 5.55);
      finishingGroup.add(balconyRail1);
      glazingElements.push(balconyRail1);

      // ج) التراس الأمامي، المسبح العاكس، وأشرطة الليد المعمارية (Smart Home & Landscape)
      const luxuryFinishGroup = new THREE.Group();
      finishingGroup.add(luxuryFinishGroup);

      const poolDeck = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.24, 5.2), matTravertine);
      poolDeck.position.set(0, 0.14, 6.8);
      poolDeck.receiveShadow = true;
      luxuryFinishGroup.add(poolDeck);

      const poolWater = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 3.2), matPoolWater);
      poolWater.position.set(0, 0.2, 7.1);
      luxuryFinishGroup.add(poolWater);

      // أشرطة إضاءة الواجهة (LED Cove Strips)
      const ledStrip1 = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.09, 0.12), matLedGlow);
      ledStrip1.position.set(0, 4.38, 5.45);
      luxuryFinishGroup.add(ledStrip1);

      const ledStrip2 = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.09, 0.12), matLedGlow);
      ledStrip2.position.set(0, 8.18, 5.25);
      luxuryFinishGroup.add(ledStrip2);

      const ledStrip3 = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.09, 0.12), matLedGlow);
      ledStrip3.position.set(0, 11.4, 2.88);
      luxuryFinishGroup.add(ledStrip3);

      // ============================================================================
      // 7️⃣ حلقة التحريك مع السكرول (Scroll-Driven 3D Construction & Finishing Animation)
      // ============================================================================
      const onResize = () => {
        if (!host) return;
        const w = host.clientWidth || window.innerWidth;
        const h = host.clientHeight || window.innerHeight;
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize, { passive: true });

      const animate = () => {
        if (disposed) return;
        animFrameId = requestAnimationFrame(animate);

        // تنعيم حركة السكرول (Smooth Lerp)
        const targetP = scrollProgressRef.current;
        smoothProgressRef.current += (targetP - smoothProgressRef.current) * 0.09;
        const p = smoothProgressRef.current;

        // ------------------------------------------------------------------
        // أ) بناء وتجميع أعمدة الخرسانة المسلحة لأعلى (0.00 -> 0.44)
        // في البداية (p=0) تكون أعمدة الدور الأرضي ظاهرة بنسبة 45% كأعمدة خرسانية،
        // ومع نزول السكرول ترتفع أعمدة الأرضي والأول والسطح لتبني الهيكل الكامل
        // ------------------------------------------------------------------
        for (const col of columns3D) {
          let colP = 0;
          if (col.floorIndex === 0) {
            // أعمدة الأرضي موجودة منذ البداية وتكتمل فوراً مع أول سكرول
            const delay = col.colOrder * 0.008;
            colP = clamp(0.45 + smoothstep(0.0 + delay, 0.16 + delay, p) * 0.55, 0, 1);
          } else if (col.floorIndex === 1) {
            const delay = col.colOrder * 0.009;
            colP = smoothstep(0.14 + delay, 0.30 + delay, p);
          } else {
            const delay = col.colOrder * 0.01;
            colP = smoothstep(0.28 + delay, 0.42 + delay, p);
          }

          col.group.visible = colP > 0.005;
          // قفص الحديد يسبق صب الخرسانة قليلاً ليُظهر واقعية تسليح العمود
          const rebarScale = clamp(colP * 1.25, 0.01, 1);
          const concreteScale = clamp((colP - 0.08) / 0.92, 0.01, 1);
          col.rebarCage.scale.set(1, rebarScale, 1);
          col.concreteBody.scale.set(1, concreteScale, 1);
          // إخفاء أشاير الحديد العلوية بعد اكتمال تشطيب البيت
          const hideRebarTops = smoothstep(0.68, 0.82, p);
          col.rebarCage.visible = hideRebarTops < 0.98;
        }

        // ------------------------------------------------------------------
        // ب) تجميع البلاطات الخرسانية والسلالم فوق الأعمدة (0.12 -> 0.45)
        // ------------------------------------------------------------------
        for (const sl of slabs3D) {
          const start = sl.floorIndex === 0 ? 0.11 : sl.floorIndex === 1 ? 0.26 : 0.38;
          const end = start + 0.09;
          const sp = smoothstep(start, end, p);
          sl.group.visible = sp > 0.01;
          sl.group.position.y = sl.targetY + (1 - sp) * 2.8;
          sl.group.scale.set(0.92 + sp * 0.08, 1, 0.92 + sp * 0.08);
        }

        const stairsP = smoothstep(0.16, 0.32, p);
        stairsGroup.visible = stairsP > 0.01;
        stairsGroup.scale.set(1, stairsP, 1);

        // ------------------------------------------------------------------
        // ج) رصّ الخامات والتشوينات 3D بجانب الهيكل الخرساني (0.30 -> 0.62)
        // ------------------------------------------------------------------
        for (const pal of materialPallets3D) {
          const st = 0.28 + pal.index * 0.06;
          const en = st + 0.12;
          const pp = smoothstep(st, en, p);
          pal.group.visible = pp > 0.01;
          pal.group.position.y = (1 - pp) * 3.5;
          pal.group.scale.setScalar(0.6 + pp * 0.4);
        }

        // ------------------------------------------------------------------
        // د) بناء حوائط الطوب والمباني بين الأعمدة (0.40 -> 0.68)
        // ------------------------------------------------------------------
        for (const mw of masonryWalls) {
          const st = 0.38 + mw.order * 0.022;
          const en = st + 0.11;
          const wp = smoothstep(st, en, p);
          mw.mesh.visible = wp > 0.01;
          mw.mesh.scale.set(1, Math.max(0.01, wp), 1);
        }

        // ------------------------------------------------------------------
        // هـ) تشطيب البيت بالكامل: الواجهات، الزجاج، المسبح، وإضاءة السمارت هوم (0.62 -> 0.98)
        // ------------------------------------------------------------------
        const cladP = smoothstep(0.60, 0.78, p);
        for (const el of claddingElements) {
          el.visible = cladP > 0.01;
          el.scale.setScalar(0.9 + cladP * 0.1);
        }

        const glassP = smoothstep(0.72, 0.88, p);
        for (const gl of glazingElements) {
          gl.visible = glassP > 0.01;
          gl.scale.set(1, Math.max(0.01, glassP), 1);
        }

        const luxuryP = smoothstep(0.80, 0.96, p);
        luxuryFinishGroup.visible = luxuryP > 0.01;
        luxuryFinishGroup.position.y = (1 - luxuryP) * -0.8;

        // تشغيل إضاءة الليد والسمارت هوم الدافئة داخل الفيلا عند التشطيب
        matLedGlow.emissiveIntensity = luxuryP * 2.4;
        for (const pt of interiorLights) {
          pt.intensity = luxuryP * 4.2;
        }

        // ------------------------------------------------------------------
        // و) حركة الكاميرا البانورامية السينمائية مع السكرول والماوس
        // ------------------------------------------------------------------
        const camAngle = -0.38 + p * 0.62 + pointerRef.current.x * 0.08;
        const camDist = 23.5 - p * 3.2;
        const camHeight = 5.4 + p * 3.4 - pointerRef.current.y * 0.6;

        camera.position.set(
          Math.sin(camAngle) * camDist + 1.2,
          camHeight,
          Math.cos(camAngle) * camDist
        );
        camera.lookAt(0.4 - p * 0.8, 3.8 + p * 1.4, 0);

        renderer.render(scene, camera);
      };

      animate();

      cleanupFn = () => {
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(animFrameId);
        pmremGenerator.dispose();
        concreteTex.dispose();
        brickTex.dispose();
        travertineTex.dispose();
        woodTex.dispose();
        renderer.dispose();
      };
    };

    initThreeScene();

    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameId);
      cleanupFn();
    };
  }, []);

  // محرك بديل ثلاثي الأبعاد على Canvas 2D في حال عدم توفر WebGL
  useEffect(() => {
    if (!useFallback) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const drawFallback = () => {
      const w = (canvas.width = window.innerWidth || 1280);
      const h = (canvas.height = window.innerHeight || 720);
      const p = scrollProgressRef.current;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#060c17');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // رسم منظور ثلاثي الأبعاد للأعمدة الخرسانية والهيكل والتشطيب
      const cx = w * 0.46;
      const baseY = h * 0.78;
      const cols = [-220, -75, 75, 220];

      // القواعد
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 280, baseY, 560, 18);

      // الأعمدة الثلاثية الأبعاد
      const floors = 3;
      for (let f = 0; f < floors; f++) {
        const fP = clamp((p - f * 0.15) / 0.2, f === 0 ? 0.5 : 0, 1);
        if (fP <= 0) continue;
        const yBottom = baseY - f * 110;
        const colH = 100 * fP;
        for (const dx of cols) {
          const x = cx + dx;
          // وجه أمامي للعمود
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(x - 14, yBottom - colH, 22, colH);
          // وجه جانبي 3D للعمود
          ctx.fillStyle = '#64748b';
          ctx.fillRect(x + 8, yBottom - colH - 4, 10, colH);
          // أشاير حديد
          if (p < 0.75) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 8, yBottom - colH);
            ctx.lineTo(x - 8, yBottom - colH - 16);
            ctx.moveTo(x + 2, yBottom - colH);
            ctx.lineTo(x + 2, yBottom - colH - 18);
            ctx.stroke();
          }
        }
        // بلاطة السقف
        if (fP > 0.85) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(cx - 260, yBottom - 110, 520, 14);
        }
      }

      // تشطيب الواجهة والزجاج عند النزول للأقسام الأخيرة
      const finishP = smoothstep(0.6, 0.95, p);
      if (finishP > 0.02) {
        ctx.fillStyle = `rgba(248, 250, 252, ${finishP * 0.9})`;
        ctx.fillRect(cx - 255, baseY - 335, 510, 22);
        ctx.fillRect(cx - 255, baseY - 225, 510, 20);
        ctx.fillStyle = `rgba(56, 189, 248, ${finishP * 0.35})`;
        ctx.fillRect(cx - 210, baseY - 313, 420, 88);
        ctx.fillRect(cx - 210, baseY - 205, 420, 95);
      }

      raf = requestAnimationFrame(drawFallback);
    };
    drawFallback();
    return () => cancelAnimationFrame(raf);
  }, [useFallback]);

  const stageTitle =
    hudProgress < 18
      ? 'المرحلة 1/4: القواعد وأعمدة الخرسانة المسلحة (3D)'
      : hudProgress < 45
      ? 'المرحلة 2/4: تجميع أعمدة الخرسانة وبناء الهيكل الخرساني لأعلى'
      : hudProgress < 70
      ? 'المرحلة 3/4: رصّ الخامات بجوار الهيكل وبناء حوائط المباني'
      : 'المرحلة 4/4: تشطيب الفيلا بالكامل والواجهات الزجاجية وإضاءة السمارت هوم';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#070d17',
      }}
    >
      {/* الصورة البانورامية الممتدة من أول الصفحة لآخر الصفحة كخلفية بانورامية شاملة */}
      <img
        src="/sections/panorama.jpg"
        alt="بانوراما فاي تك المعمارية من أول الصفحة لآخرها"
        width={1920}
        height={1080}
        loading="eager"
        decoding="async"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `50% ${42 + hudProgress * 0.14}%`,
          transform: `scale(${1.03 + hudProgress * 0.0007})`,
          filter: 'brightness(0.58) contrast(1.08) saturate(1.12)',
          pointerEvents: 'none',
        }}
      />

      {/* مسرح الـ 3D الواقعي الكامل (الأعمدة الخرسانية + الخامات + تشطيب الفيلا) فوق البانوراما من أول الصفحة لآخرها */}
      <div
        ref={hostRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: useFallback ? 'none' : 'block',
        }}
      />

      {useFallback && (
        <canvas
          ref={fallbackCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      )}

      {/* تدرج سينمائي خفيف جداً لحماية وضوح النصوص العائمة للأقسام فوق المشهد الثلاثي الأبعاد */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(7, 13, 23, 0.08) 0%, rgba(7, 13, 23, 0.52) 100%), linear-gradient(180deg, rgba(7, 13, 23, 0.45) 0%, rgba(7, 13, 23, 0.12) 30%, rgba(7, 13, 23, 0.16) 72%, rgba(7, 13, 23, 0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* مؤشر عائم أنيق في أسفل المشهد يوضح مرحلة بناء الأعمدة وتشطيب البيت أثناء السكرول */}
      <div
        style={{
          position: 'absolute',
          bottom: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 4,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 16px',
          borderRadius: '999px',
          background: 'rgba(10, 16, 28, 0.62)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: '#f8fafc',
          fontSize: '0.78rem',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          maxWidth: '92vw',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#38bdf8' }}>🏗️ 3D LIVE</span>
        <span>{stageTitle}</span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '999px',
            background: hudProgress >= 85 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.22)',
            color: hudProgress >= 85 ? '#34d399' : '#7dd3fc',
            fontWeight: 900,
          }}
        >
          {hudProgress}%
        </span>
      </div>
    </div>
  );
}
