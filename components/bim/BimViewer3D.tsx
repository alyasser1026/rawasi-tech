"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { 
  Box, 
  Layers, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Upload, 
  Scissors, 
  Info, 
  Check, 
  Sparkles,
  Compass,
  FileCode2,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export interface BimElementData {
  id?: string;
  name: string;
  category: string;
  discipline: string;
  level: string;
  dimensions?: string;
  volume_m3?: number;
  rebar_weight_kg?: number;
  boq_item?: string;
  unit_rate?: number;
}

interface BimViewer3DProps {
  projectTitle?: string;
  modelUrl?: string;
  height?: string;
  onElementSelect?: (element: BimElementData | null) => void;
}

export default function BimViewer3D({
  projectTitle = "فيلا نموذج (A) - الهيكل المعماري والإنشائي 3D",
  modelUrl,
  height = "640px",
  onElementSelect
}: BimViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const proceduralGroupRef = useRef<THREE.Group | null>(null);
  const clipPlaneRef = useRef<THREE.Plane | null>(null);
  const highlightedMeshRef = useRef<THREE.Mesh | null>(null);
  const originalMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);

  // UI States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<BimElementData | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeLayers, setActiveLayers] = useState({
    foundations: true,
    columns: true,
    slabs: true,
    walls: true,
    glass: true,
    stairs: true
  });
  const [clipHeight, setClipHeight] = useState<number>(10); // 0 to 10 meters
  const [clipActive, setClipActive] = useState<boolean>(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [webGLUnsupported, setWebGLUnsupported] = useState<boolean>(false);

  // Highlight selection material
  const highlightMaterial = useRef(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false
    })
  );

  // Ghost glass material for non-structural elements
  const ghostMaterial = useRef(
    new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.85,
      ior: 1.4
    })
  );

  // =========================================================================
  // 🏛️ Procedural Parametric 3D Villa Generator (Engineered In-Memory)
  // =========================================================================
  const buildProceduralVilla = useCallback(() => {
    const root = new THREE.Group();
    root.name = 'ProceduralVillaRoot';

    // Groups per layer
    const foundationsGroup = new THREE.Group();
    foundationsGroup.name = 'layer_foundations';

    const columnsGroup = new THREE.Group();
    columnsGroup.name = 'layer_columns';

    const slabsGroup = new THREE.Group();
    slabsGroup.name = 'layer_slabs';

    const wallsGroup = new THREE.Group();
    wallsGroup.name = 'layer_walls';

    const glassGroup = new THREE.Group();
    glassGroup.name = 'layer_glass';

    const stairsGroup = new THREE.Group();
    stairsGroup.name = 'layer_stairs';

    // Materials
    const concMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.7,
      metalness: 0.15
    });

    const foundationMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.1
    });

    const brickMaterial = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.8,
      metalness: 0.05
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.2,
      transmission: 0.7
    });

    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.8
    });

    // Grid Coordinates for Columns & Footings (4 x 3 bay grid)
    const xCoords = [-6, -2, 2, 6];
    const zCoords = [-4, 0, 4];

    // 1. القواعد المسلحة ورقاب الأعمدة (Foundations & Tie Beams)
    xCoords.forEach((x, xi) => {
      zCoords.forEach((z, zi) => {
        // Footing
        const footingGeo = new THREE.BoxGeometry(1.8, 0.5, 1.8);
        const footingMesh = new THREE.Mesh(footingGeo, foundationMaterial);
        footingMesh.position.set(x, 0.25, z);
        footingMesh.castShadow = true;
        footingMesh.receiveShadow = true;
        footingMesh.userData = {
          name: `قاعدة مسلحة F${xi + 1}-${zi + 1}`,
          category: 'قواعد خرسانية مسلحة',
          discipline: 'الهيكل الإنشائي',
          level: 'منسوب التأسيس (-1.80م)',
          dimensions: '1.80 × 1.80 × 0.50 م',
          volume_m3: 1.62,
          rebar_weight_kg: 194.4,
          boq_item: 'BOQ-01 - خرسانة مسلحة للقواعد المنفصلة',
          unit_rate: 3950
        };
        foundationsGroup.add(footingMesh);

        // Column Neck
        const neckGeo = new THREE.BoxGeometry(0.35, 0.8, 0.55);
        const neckMesh = new THREE.Mesh(neckGeo, concMaterial);
        neckMesh.position.set(x, 0.5 + 0.4, z);
        neckMesh.castShadow = true;
        neckMesh.userData = {
          name: `رقبة عمود N${xi + 1}-${zi + 1}`,
          category: 'خرسانة رقاب أعمدة',
          discipline: 'الهيكل الإنشائي',
          level: 'منسوب الرقاب',
          dimensions: '0.35 × 0.55 × 0.80 م',
          volume_m3: 0.15,
          rebar_weight_kg: 21,
          boq_item: 'BOQ-02 - خرسانة مسلحة لرقاب الأعمدة',
          unit_rate: 4200
        };
        foundationsGroup.add(neckMesh);
      });
    });

    // Longitudinal Tie Beams (سملات طولية)
    zCoords.forEach((z) => {
      const beamGeo = new THREE.BoxGeometry(13.8, 0.6, 0.3);
      const beamMesh = new THREE.Mesh(beamGeo, foundationMaterial);
      beamMesh.position.set(0, 0.7, z);
      beamMesh.castShadow = true;
      beamMesh.userData = {
        name: `ميدة / سمل طولي Z=${z}`,
        category: 'سملات وميدات مسلحة',
        discipline: 'الهيكل الإنشائي',
        level: 'منسوب الميد (+0.20م)',
        dimensions: '13.8 × 0.30 × 0.60 م',
        volume_m3: 2.48,
        rebar_weight_kg: 297,
        boq_item: 'BOQ-03 - سملات وميدات ربط مسلحة',
        unit_rate: 4100
      };
      foundationsGroup.add(beamMesh);
    });

    // 2. أعمدة الدور الأرضي والأول (Ground & First Floor Columns)
    xCoords.forEach((x, xi) => {
      zCoords.forEach((z, zi) => {
        // Ground Floor Column
        const colGeo = new THREE.BoxGeometry(0.3, 3.2, 0.5);
        const colMesh = new THREE.Mesh(colGeo, concMaterial);
        colMesh.position.set(x, 1.3 + 1.6, z);
        colMesh.castShadow = true;
        colMesh.userData = {
          name: `عمود دور أرضي C${xi + 1}-${zi + 1}`,
          category: 'أعمدة خرسانية مسلحة',
          discipline: 'الهيكل الإنشائي',
          level: 'الدور الأرضي (+1.30م)',
          dimensions: '0.30 × 0.50 × 3.20 م',
          volume_m3: 0.48,
          rebar_weight_kg: 67.2,
          boq_item: 'BOQ-04 - خرسانة مسلحة لأعمدة الدور الأرضي',
          unit_rate: 4350
        };
        columnsGroup.add(colMesh);

        // First Floor Column
        const colF1Geo = new THREE.BoxGeometry(0.3, 3.0, 0.45);
        const colF1Mesh = new THREE.Mesh(colF1Geo, concMaterial);
        colF1Mesh.position.set(x, 4.7 + 1.5, z);
        colF1Mesh.castShadow = true;
        colF1Mesh.userData = {
          name: `عمود دور أول C-F1-${xi + 1}-${zi + 1}`,
          category: 'أعمدة خرسانية مسلحة',
          discipline: 'الهيكل الإنشائي',
          level: 'الدور الأول (+4.70م)',
          dimensions: '0.30 × 0.45 × 3.00 م',
          volume_m3: 0.40,
          rebar_weight_kg: 56,
          boq_item: 'BOQ-05 - خرسانة مسلحة لأعمدة الدور الأول',
          unit_rate: 4350
        };
        columnsGroup.add(colF1Mesh);
      });
    });

    // 3. الأسقف والكمرات (Slabs & Drop Beams)
    // Ground Floor Ceiling Slab (سقف الأرضي)
    const slabGeo = new THREE.BoxGeometry(14.4, 0.22, 10.4);
    const slabMesh = new THREE.Mesh(slabGeo, concMaterial);
    slabMesh.position.set(0, 4.6, 0);
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    slabMesh.userData = {
      name: 'بلاطة سقف الدور الأرضي (Solid/Flat Slab)',
      category: 'أسقف خرسانية مسلحة',
      discipline: 'الهيكل الإنشائي',
      level: 'منسوب سقف الأرضي (+4.60م)',
      dimensions: '14.40 × 10.40 × 0.22 م',
      volume_m3: 32.94,
      rebar_weight_kg: 3623,
      boq_item: 'BOQ-06 - خرسانة مسلحة لسقف الدور الأرضي',
      unit_rate: 4250
    };
    slabsGroup.add(slabMesh);

    // Roof Slab (سقف الدور الأول / السطح)
    const roofSlabGeo = new THREE.BoxGeometry(14.4, 0.22, 10.4);
    const roofSlabMesh = new THREE.Mesh(roofSlabGeo, concMaterial);
    roofSlabMesh.position.set(0, 7.8, 0);
    roofSlabMesh.castShadow = true;
    roofSlabMesh.receiveShadow = true;
    roofSlabMesh.userData = {
      name: 'بلاطة سقف الدور الأول والسطح الأخير',
      category: 'أسقف خرسانية مسلحة',
      discipline: 'الهيكل الإنشائي',
      level: 'منسوب السطح (+7.80م)',
      dimensions: '14.40 × 10.40 × 0.22 م',
      volume_m3: 32.94,
      rebar_weight_kg: 3623,
      boq_item: 'BOQ-07 - خرسانة مسلحة لسقف السطح وعزل الرطوبة',
      unit_rate: 4250
    };
    slabsGroup.add(roofSlabMesh);

    // 4. درج السلم الخرساني (Reinforced Concrete Staircase)
    for (let step = 0; step < 10; step++) {
      const stepGeo = new THREE.BoxGeometry(1.4, 0.16, 0.30);
      const stepMesh = new THREE.Mesh(stepGeo, concMaterial);
      stepMesh.position.set(-1.8, 1.3 + (step * 0.16), -2 + (step * 0.30));
      stepMesh.castShadow = true;
      stepMesh.userData = {
        name: `درجة سلم خرسانية رقم ${step + 1}`,
        category: 'سلالم خرسانية مسلحة',
        discipline: 'الهيكل الإنشائي',
        level: 'بيت الدرج',
        dimensions: '1.40 × 0.30 × 0.16 م',
        volume_m3: 0.067,
        rebar_weight_kg: 8,
        boq_item: 'BOQ-08 - خرسانة مسلحة للسلالم والقلبات',
        unit_rate: 4600
      };
      stairsGroup.add(stepMesh);
    }

    // 5. أعمال المباني وقواطع الطوب (Masonry Walls with Openings)
    // Front Wall - Ground Floor
    const wallFrontGeo = new THREE.BoxGeometry(3.6, 3.2, 0.25);
    const wallFrontMesh = new THREE.Mesh(wallFrontGeo, brickMaterial);
    wallFrontMesh.position.set(-4, 2.9, 4.1);
    wallFrontMesh.castShadow = true;
    wallFrontMesh.userData = {
      name: 'حائط مباني واجهة أمامية - دور أرضي',
      category: 'مباني طوب إسمنتي مفرغ',
      discipline: 'الأعمال المعمارية',
      level: 'الدور الأرضي',
      dimensions: '3.60 × 3.20 × 0.25 م (مباني سمك 25 سم)',
      volume_m3: 2.88,
      boq_item: 'BOQ-10 - مباني طوب إسمنتي سمك 25 سم للواجهات',
      unit_rate: 1850
    };
    wallsGroup.add(wallFrontMesh);

    const wallFront2Geo = new THREE.BoxGeometry(3.6, 3.2, 0.25);
    const wallFront2Mesh = new THREE.Mesh(wallFront2Geo, brickMaterial);
    wallFront2Mesh.position.set(4, 2.9, 4.1);
    wallFront2Mesh.castShadow = true;
    wallFront2Mesh.userData = {
      name: 'حائط مباني واجهة يمين - دور أرضي',
      category: 'مباني طوب أحمر / إسمنتي',
      discipline: 'الأعمال المعمارية',
      level: 'الدور الأرضي',
      dimensions: '3.60 × 3.20 × 0.25 م',
      volume_m3: 2.88,
      boq_item: 'BOQ-10 - مباني طوب للواجهات',
      unit_rate: 1850
    };
    wallsGroup.add(wallFront2Mesh);

    // Side Walls
    const sideWallGeo = new THREE.BoxGeometry(0.25, 3.2, 7.6);
    const sideWallLeft = new THREE.Mesh(sideWallGeo, brickMaterial);
    sideWallLeft.position.set(-6.1, 2.9, 0);
    sideWallLeft.castShadow = true;
    sideWallLeft.userData = {
      name: 'حائط مباني جانبي أيسر - دور أرضي',
      category: 'مباني طوب سمك 25 سم',
      discipline: 'الأعمال المعمارية',
      level: 'الدور الأرضي',
      dimensions: '7.60 × 3.20 × 0.25 م',
      volume_m3: 6.08,
      boq_item: 'BOQ-10 - مباني طوب للواجهات',
      unit_rate: 1850
    };
    wallsGroup.add(sideWallLeft);

    const sideWallRight = new THREE.Mesh(sideWallGeo, brickMaterial);
    sideWallRight.position.set(6.1, 2.9, 0);
    sideWallRight.castShadow = true;
    sideWallRight.userData = {
      name: 'حائط مباني جانبي أيمن - دور أرضي',
      category: 'مباني طوب سمك 25 سم',
      discipline: 'الأعمال المعمارية',
      level: 'الدور الأرضي',
      dimensions: '7.60 × 3.20 × 0.25 م',
      volume_m3: 6.08,
      boq_item: 'BOQ-10 - مباني طوب للواجهات',
      unit_rate: 1850
    };
    wallsGroup.add(sideWallRight);

    // Parapet Wall (دروة السطح)
    const parapetFrontGeo = new THREE.BoxGeometry(14.4, 1.2, 0.25);
    const parapetFront = new THREE.Mesh(parapetFrontGeo, brickMaterial);
    parapetFront.position.set(0, 8.5, 5.1);
    parapetFront.castShadow = true;
    parapetFront.userData = {
      name: 'دروة السطح الأمامية (Parapet)',
      category: 'مباني دروة السطح',
      discipline: 'الأعمال المعمارية',
      level: 'السطح (+8.50م)',
      dimensions: '14.40 × 1.20 × 0.25 م',
      volume_m3: 4.32,
      boq_item: 'BOQ-12 - مباني دروة السطح وحواجز الأمان',
      unit_rate: 1600
    };
    wallsGroup.add(parapetFront);

    // 6. التشطيبات والواجهات الزجاجية (Glass Curtain & Windows)
    const glassPaneGeo = new THREE.BoxGeometry(3.6, 2.6, 0.08);
    const glassPane = new THREE.Mesh(glassPaneGeo, glassMaterial);
    glassPane.position.set(0, 3.1, 4.1);
    glassPane.userData = {
      name: 'واجهة زجاجية دبل سيكوريت عازل للصوت والحرارة',
      category: 'واجهات زجاجية وألومنيوم',
      discipline: 'أعمال التشطيبات',
      level: 'الدور الأرضي',
      dimensions: '3.60 × 2.60 م',
      boq_item: 'BOQ-15 - واجهات زجاجية ستراكشرال دبل',
      unit_rate: 3200
    };
    glassGroup.add(glassPane);

    // Frame
    const frameGeo = new THREE.BoxGeometry(3.8, 2.8, 0.12);
    const frameWire = new THREE.Mesh(frameGeo, aluminumMaterial);
    frameWire.position.set(0, 3.1, 4.1);
    frameWire.scale.set(0.98, 0.98, 0.98);
    glassGroup.add(frameWire);

    root.add(foundationsGroup);
    root.add(columnsGroup);
    root.add(slabsGroup);
    root.add(wallsGroup);
    root.add(glassGroup);
    root.add(stairsGroup);

    return root;
  }, []);

  // =========================================================================
  // 🚀 Initialize Three.js Scene, Camera, Controls, Lights
  // =========================================================================
  useEffect(() => {
    if (!mountRef.current) return;

    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!window.WebGLRenderingContext || !gl) {
        setWebGLUnsupported(true);
        return;
      }
    } catch {
      setWebGLUnsupported(true);
      return;
    }

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const heightPx = container.clientHeight || 600;

    // 1. Scene. The transparent canvas shows the viewer's themed background.
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000);
    camera.position.set(22, 16, 26);
    cameraRef.current = camera;

    // 3. Renderer with ACES ToneMapping & Shadows
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: false });
    } catch {
      setWebGLUnsupported(true);
      return;
    }
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.target.set(0, 4, 0);
    controlsRef.current = controls;

    // 5. Lighting Setup (Photorealistic Architectural Sun & Sky)
    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x1e293b, 1.2);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    sunLight.position.set(30, 45, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-25, 20, -25);
    scene.add(fillLight);

    // 6. Ground & Precision Engineering Grid
    const gridHelper = new THREE.GridHelper(50, 50, 0xc2410c, 0x27272a);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const shadowPlaneGeo = new THREE.PlaneGeometry(100, 100);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.01;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 7. Clipping Plane (Section Plane)
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 12);
    clipPlaneRef.current = clipPlane;

    // 8. Root Group & Procedural Model
    const rootGroup = new THREE.Group();
    rootGroup.name = 'BimMasterGroup';
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    const proceduralVilla = buildProceduralVilla();
    proceduralGroupRef.current = proceduralVilla;
    rootGroup.add(proceduralVilla);

    // 9. Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 10. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate;
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [buildProceduralVilla]);

  // Update autoRotate on controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 1.5;
    }
  }, [autoRotate]);

  // Update Layers Visibility
  useEffect(() => {
    if (!proceduralGroupRef.current) return;
    const root = proceduralGroupRef.current;

    const f = root.getObjectByName('layer_foundations');
    const c = root.getObjectByName('layer_columns');
    const sl = root.getObjectByName('layer_slabs');
    const w = root.getObjectByName('layer_walls');
    const g = root.getObjectByName('layer_glass');
    const st = root.getObjectByName('layer_stairs');

    if (f) f.visible = activeLayers.foundations;
    if (c) c.visible = activeLayers.columns;
    if (sl) sl.visible = activeLayers.slabs;
    if (w) w.visible = activeLayers.walls;
    if (g) g.visible = activeLayers.glass;
    if (st) st.visible = activeLayers.stairs;
  }, [activeLayers]);

  // Update Ghost Mode (X-Ray Structural Mode)
  useEffect(() => {
    if (!proceduralGroupRef.current) return;
    const root = proceduralGroupRef.current;
    const walls = root.getObjectByName('layer_walls');
    const glass = root.getObjectByName('layer_glass');

    const applyGhost = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (ghostMode) {
            if (!mesh.userData._origMat) mesh.userData._origMat = mesh.material;
            mesh.material = ghostMaterial.current;
          } else if (mesh.userData._origMat) {
            mesh.material = mesh.userData._origMat;
          }
        }
      });
    };

    if (walls) applyGhost(walls);
    if (glass) applyGhost(glass);
  }, [ghostMode]);

  // Update Section Clipping Plane
  useEffect(() => {
    if (!clipPlaneRef.current || !rendererRef.current) return;
    if (clipActive) {
      clipPlaneRef.current.constant = clipHeight;
      rendererRef.current.clippingPlanes = [clipPlaneRef.current];
    } else {
      rendererRef.current.clippingPlanes = [];
    }
  }, [clipHeight, clipActive]);

  // =========================================================================
  // 🎯 Click-to-Inspect BIM Element (Raycasting)
  // =========================================================================
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !rootGroupRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(rootGroupRef.current.children, true);

    // Reset previous highlight
    if (highlightedMeshRef.current && originalMaterialRef.current) {
      highlightedMeshRef.current.material = originalMaterialRef.current;
      highlightedMeshRef.current = null;
      originalMaterialRef.current = null;
    }

    if (intersects.length > 0) {
      // Find the first mesh that has userData or is a valid element
      let hitMesh: THREE.Mesh | null = null;
      for (const hit of intersects) {
        if ((hit.object as THREE.Mesh).isMesh && hit.object.visible) {
          hitMesh = hit.object as THREE.Mesh;
          break;
        }
      }

      if (hitMesh) {
        highlightedMeshRef.current = hitMesh;
        originalMaterialRef.current = hitMesh.material;
        hitMesh.material = highlightMaterial.current;

        const data: BimElementData = hitMesh.userData.name ? {
          name: hitMesh.userData.name,
          category: hitMesh.userData.category || 'عنصر إنشائي',
          discipline: hitMesh.userData.discipline || 'الهندسة الإنشائية',
          level: hitMesh.userData.level || 'منسوب غير محدد',
          dimensions: hitMesh.userData.dimensions,
          volume_m3: hitMesh.userData.volume_m3,
          rebar_weight_kg: hitMesh.userData.rebar_weight_kg,
          boq_item: hitMesh.userData.boq_item,
          unit_rate: hitMesh.userData.unit_rate
        } : {
          name: hitMesh.name || 'عنصر ثلاثي الأبعاد',
          category: 'عنصر هندسي مستورد',
          discipline: 'نموذج خارجي',
          level: 'عام'
        };

        setSelectedElement(data);
        if (onElementSelect) onElementSelect(data);
        return;
      }
    }

    // Clicked empty space
    setSelectedElement(null);
    if (onElementSelect) onElementSelect(null);
  };

  // =========================================================================
  // 🎥 Camera Preset Angles
  // =========================================================================
  const setCameraPreset = (preset: 'iso' | 'top' | 'front' | 'side' | 'reset') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (preset) {
      case 'iso':
        cam.position.set(22, 16, 26);
        ctrl.target.set(0, 4, 0);
        break;
      case 'top':
        cam.position.set(0, 36, 0.1);
        ctrl.target.set(0, 4, 0);
        break;
      case 'front':
        cam.position.set(0, 5, 32);
        ctrl.target.set(0, 4, 0);
        break;
      case 'side':
        cam.position.set(32, 5, 0);
        ctrl.target.set(0, 4, 0);
        break;
      case 'reset':
        cam.position.set(22, 16, 26);
        ctrl.target.set(0, 4, 0);
        break;
    }
    ctrl.update();
  };

  // =========================================================================
  // 📂 Upload External 3D File (.glb, .gltf, .obj)
  // =========================================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sceneRef.current || !rootGroupRef.current) return;

    setIsLoadingModel(true);
    setLoadedFileName(file.name);

    const reader = new FileReader();
    const ext = file.name.split('.').pop()?.toLowerCase();

    reader.onload = async (event) => {
      const buffer = event.target?.result;
      if (!buffer) {
        setIsLoadingModel(false);
        return;
      }

      try {
        // Clear existing procedural model
        if (proceduralGroupRef.current && rootGroupRef.current) {
          rootGroupRef.current.remove(proceduralGroupRef.current);
        }

        if (ext === 'glb' || ext === 'gltf') {
          const loader = new GLTFLoader();
          loader.parse(
            buffer as ArrayBuffer,
            '',
            (gltf) => {
              const model = gltf.scene;
              fitModelToScene(model);
              rootGroupRef.current?.add(model);
              setIsLoadingModel(false);
            },
            (err) => {
              alert('فشل قراءة ملف GLTF/GLB: ' + err.message);
              setIsLoadingModel(false);
            }
          );
        } else if (ext === 'obj') {
          const text = new TextDecoder().decode(buffer as ArrayBuffer);
          const loader = new OBJLoader();
          const obj = loader.parse(text);
          fitModelToScene(obj);
          rootGroupRef.current?.add(obj);
          setIsLoadingModel(false);
        } else {
          alert('الصيغة المدعومة حالياً هي: .glb, .gltf, .obj');
          setIsLoadingModel(false);
        }
      } catch (err: any) {
        alert('حدث خطأ أثناء تحميل النموذج: ' + err.message);
        setIsLoadingModel(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Helper: auto-center & scale loaded external model
  const fitModelToScene = (model: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetDim = 15;
    const scale = targetDim / (maxDim || 1);
    model.scale.set(scale, scale, scale);

    // Center model at origin
    model.position.x = -center.x * scale;
    model.position.y = -box.min.y * scale; // Sit on ground
    model.position.z = -center.z * scale;

    // Enable shadows on children
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    setCameraPreset('iso');
  };

  return (
    <div 
      className={`bim-viewer-container ${isFullscreen ? 'fullscreen-mode' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : height,
        borderRadius: isFullscreen ? '0px' : '18px',
        overflow: 'hidden',
        border: 'none',
        boxShadow: 'var(--shadow-ambient)',
        background: 'var(--surface-card)',
        zIndex: isFullscreen ? 9999 : 'auto',
        fontFamily: 'inherit'
      }}
    >
      <style>{`
        .bim-tool-btn {
          background: var(--surface-subcard);
          color: var(--text-primary);
          border: none !important;
          box-shadow: var(--shadow-elevation);
          padding: 8px 14px;
          border-radius: 12px;
          font-size: var(--fs-xs, 12px);
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bim-tool-btn:hover {
          background: var(--surface-card-hover);
          color: var(--accent-ink);
          transform: translateY(-1.5px);
        }
        .bim-tool-btn.active {
          background: var(--action-fill);
          border: none !important;
          color: var(--action-ink);
          box-shadow: 0 4px 14px -2px var(--accent-glow);
        }
        .layer-toggle-chip {
          background: var(--surface-sunken);
          border: none !important;
          box-shadow: var(--shadow-sunken);
          color: var(--text-primary);
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: 0.2s;
        }
        .layer-toggle-chip.active {
          background: var(--accent-soft-bg);
          border: none !important;
          color: var(--accent-ink);
        }
        .bim-tool-btn:focus-visible, .layer-toggle-chip:focus-visible {
          outline: 2px solid var(--accent-ink);
          outline-offset: 2px;
        }
      `}</style>

      {/* Hidden File Input for .glb/.gltf/.obj upload */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".glb,.gltf,.obj" 
        style={{ display: 'none' }} 
        onChange={handleFileUpload} 
      />

      {/* 3D WebGL Canvas */}
      <div 
        ref={mountRef} 
        style={{ width: '100%', height: '100%', cursor: 'grab' }} 
        onPointerDown={handlePointerDown}
      />

      {webGLUnsupported && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-card)', padding: '2rem', textAlign: 'center', zIndex: 10 }}>
          <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>متصفحك لا يدعم العرض ثلاثي الأبعاد WebGL</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>يمكنك تفعيل تسريع الرسوميات (Hardware Acceleration) في إعدادات المتصفح أو فتح الصفحة عبر متصفح حديث يدعم WebGL.</p>
        </div>
      )}

      {/* Header Watermark / Title */}
      <div 
        style={{
          position: 'absolute',
          top: '14px',
          right: '16px',
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-elevation)',
          padding: '8px 16px',
          borderRadius: '14px',
          border: 'none',
          color: 'var(--text-primary)',
          zIndex: 10,
          pointerEvents: 'none'
        }}
        dir="rtl"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🏛️</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--accent-ink)' }}>
              {loadedFileName ? `نموذج مستورد: ${loadedFileName}` : projectTitle}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              مستعرض BIM الهندسي مفتوح المصدر (بديل Autodesk المجاني)
            </div>
          </div>
        </div>
      </div>

      {/* Top Left Tools: Upload, Fullscreen, Auto-Rotate, Presets */}
      <div 
        style={{
          position: 'absolute',
          top: '14px',
          left: '16px',
          display: 'flex',
          gap: '6px',
          zIndex: 10,
          flexWrap: 'wrap'
        }}
      >
        <button 
          className="bim-tool-btn" 
          onClick={() => fileInputRef.current?.click()}
          title="رفع ملف ثلاثي الأبعاد (.glb, .gltf, .obj)"
        >
          <Upload size={14} />
          رفع 3D (BIM)
        </button>

        <button 
          className={`bim-tool-btn ${ghostMode ? 'active' : ''}`}
          onClick={() => setGhostMode(!ghostMode)}
          title="وضع الأشعة السينية (إظهار الهيكل الإنشائي الداخلي والحديد)"
        >
          <Sparkles size={14} />
          الأشعة الإنشائية X-Ray
        </button>

        <button 
          className={`bim-tool-btn ${clipActive ? 'active' : ''}`}
          onClick={() => setClipActive(!clipActive)}
          title="تفعيل القطاع الهندسي المستعرض"
        >
          <Scissors size={14} />
          القطاع الهندسي
        </button>

        <button 
          className={`bim-tool-btn ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="دوران تلقائي للمعاينة الشاملة"
        >
          <RotateCw size={14} />
          دوران
        </button>

        <button 
          className="bim-tool-btn" 
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Camera View Angle Presets */}
      <div 
        style={{
          position: 'absolute',
          top: '60px',
          left: '16px',
          display: 'flex',
          gap: '4px',
          background: 'var(--surface-sunken)',
          boxShadow: 'var(--shadow-sunken)',
          padding: '4px',
          borderRadius: '12px',
          border: 'none',
          zIndex: 10
        }}
      >
        <button className="bim-tool-btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setCameraPreset('iso')}>
          منظور (3D)
        </button>
        <button className="bim-tool-btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setCameraPreset('top')}>
          أفقي (Plan)
        </button>
        <button className="bim-tool-btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setCameraPreset('front')}>
          أمامي (Front)
        </button>
        <button className="bim-tool-btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setCameraPreset('side')}>
          جانبي (Side)
        </button>
        <button className="bim-tool-btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setCameraPreset('reset')} title="إعادة ضبط">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Section Plane Cut Slider (When clipActive is ON) */}
      {clipActive && (
        <div 
          style={{
            position: 'absolute',
            top: '110px',
            left: '16px',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-elevation)',
            padding: '12px 16px',
            borderRadius: '16px',
            border: 'none',
            color: 'var(--text-primary)',
            zIndex: 10,
            width: '240px'
          }}
          dir="rtl"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '6px' }}>
            <span>ارتفاع القطاع الأفقي:</span>
            <span style={{ color: 'var(--accent-ink)' }}>{clipHeight.toFixed(1)} م</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="12" 
            step="0.2" 
            value={clipHeight} 
            onChange={(e) => setClipHeight(parseFloat(e.target.value))} 
            style={{ width: '100%', accentColor: 'var(--accent-ink)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span>الأساسات (0م)</span>
            <span>الدور الأرضي (4م)</span>
            <span>السطح (8م+)</span>
          </div>
        </div>
      )}

      {/* Bottom Layer Toggles Bar */}
      <div 
        style={{
          position: 'absolute',
          bottom: '14px',
          right: '16px',
          left: '16px',
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <div 
          style={{
            display: 'flex',
            gap: '6px',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-elevation)',
            padding: '6px 12px',
            borderRadius: '16px',
            border: 'none',
            pointerEvents: 'auto',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          <button 
            className={`layer-toggle-chip ${activeLayers.foundations ? 'active' : ''}`}
            onClick={() => setActiveLayers({ ...activeLayers, foundations: !activeLayers.foundations })}
          >
            🏗️ الأساسات
          </button>
          <button 
            className={`layer-toggle-chip ${activeLayers.columns ? 'active' : ''}`}
            onClick={() => setActiveLayers({ ...activeLayers, columns: !activeLayers.columns })}
          >
            🏛️ الأعمدة
          </button>
          <button 
            className={`layer-toggle-chip ${activeLayers.slabs ? 'active' : ''}`}
            onClick={() => setActiveLayers({ ...activeLayers, slabs: !activeLayers.slabs })}
          >
            📏 الأسقف والكمرات
          </button>
          <button 
            className={`layer-toggle-chip ${activeLayers.walls ? 'active' : ''}`}
            onClick={() => setActiveLayers({ ...activeLayers, walls: !activeLayers.walls })}
          >
            🧱 المباني
          </button>
          <button 
            className={`layer-toggle-chip ${activeLayers.glass ? 'active' : ''}`}
            onClick={() => setActiveLayers({ ...activeLayers, glass: !activeLayers.glass })}
          >
            🪟 الواجهات والزجاج
          </button>
          <button 
            className={`layer-toggle-chip ${activeLayers.stairs ? 'active' : ''}`}
            onClick={() => setActiveLayers({ ...activeLayers, stairs: !activeLayers.stairs })}
          >
            🪜 السلالم
          </button>
        </div>
      </div>

      {/* BIM Element Inspector Card (When element clicked) */}
      {selectedElement && (
        <div 
          style={{
            position: 'absolute',
            bottom: '70px',
            right: '16px',
            width: 'min(20rem, calc(100% - 2rem))',
            background: 'var(--surface-card)',
            borderRadius: '18px',
            border: 'none',
            boxShadow: 'var(--shadow-ambient)',
            padding: '16px',
            color: 'var(--text-primary)',
            zIndex: 20
          }}
          dir="rtl"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--table-zebra-bg)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px' }}>🔍</span>
              <strong style={{ fontSize: '13px', color: 'var(--accent-ink)' }}>بيانات العنصر الإنشائي (BIM)</strong>
            </div>
            <button 
              onClick={() => setSelectedElement(null)}
              aria-label="إغلاق بيانات العنصر"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', fontWeight: 900 }}
            >
              ✕
            </button>
          </div>

          <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 900 }}>
            {selectedElement.name}
          </h4>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ background: 'var(--surface-subcard)', color: 'var(--status-info)', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
              {selectedElement.category}
            </span>
            <span style={{ background: 'var(--surface-subcard)', color: 'var(--accent-ink)', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
              {selectedElement.level}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {selectedElement.dimensions && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--table-zebra-bg)', paddingBottom: '4px' }}>
                <span>الأبعاد:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedElement.dimensions}</strong>
              </div>
            )}
            {selectedElement.volume_m3 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--table-zebra-bg)', paddingBottom: '4px' }}>
                <span>الحجم الهندسي:</span>
                <strong style={{ color: 'var(--status-info)' }}>{selectedElement.volume_m3} م³</strong>
              </div>
            )}
            {selectedElement.rebar_weight_kg && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--table-zebra-bg)', paddingBottom: '4px' }}>
                <span>حديد التسليح التقديري:</span>
                <strong style={{ color: 'var(--status-warning)' }}>{selectedElement.rebar_weight_kg} كجم</strong>
              </div>
            )}
            {selectedElement.boq_item && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', background: 'var(--surface-subcard)', padding: '6px 8px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px' }}>بند المقايسة المرتبط (BOQ):</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '11px' }}>{selectedElement.boq_item}</strong>
              </div>
            )}
            {selectedElement.unit_rate && selectedElement.volume_m3 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', padding: '6px 10px', borderRadius: '10px', border: 'none' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>التكلفة التقديرية للبند:</span>
                <strong style={{ color: 'var(--accent-ink)', fontWeight: 900 }}>{formatCurrency(selectedElement.unit_rate * selectedElement.volume_m3)}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoadingModel && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--surface-flat)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            color: 'var(--text-primary)'
          }}
        >
          <RotateCw size={36} className="animate-spin" color="var(--accent-ink)" />
          <div style={{ marginTop: '14px', fontSize: '14px', fontWeight: 800 }}>
            جاري معالجة وبناء النموذج الهندسي 3D...
          </div>
        </div>
      )}
    </div>
  );
}
