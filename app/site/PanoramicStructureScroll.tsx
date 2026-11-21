'use client';

import { useEffect, useRef, useState } from 'react';

const STAGES = ['تجهيز الأساسات', 'التسليح وصب الأعمدة', 'الأسقف وتمديدات الخدمات', 'إنشاءات · سباكة · كهرباء', 'اكتمل الهيكل وتجهيز الخدمات'];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function PanoramicStructureScroll() {
  const hostRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let failed = false;
    const cleanups: (() => void)[] = [];
    const release = () => {
      while (cleanups.length) cleanups.pop()?.();
    };

    async function initialize() {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      if (!context) { setFallback(true); return; }
      cleanups.push(() => {
        if (!context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext();
      });
      const [THREE, { createConcreteStructure }, { createBuildingServices }, { createConstructionDetails }, { RoomEnvironment }] = await Promise.all([
        import('three'),
        import('./concrete-structure-three'),
        import('./building-services-three'),
        import('./construction-details-three'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
      ]);
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      cleanups.push(() => {
        renderer.dispose();
        renderer.domElement.remove();
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.6));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host!.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
      let cameraDistance = 33;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.22;
      room.dispose();
      pmrem.dispose();
      cleanups.push(() => environment.dispose());
      const atmosphere = new THREE.Fog(0x252d2f, 43, 143);
      scene.background = new THREE.Color(0x252d2f);
      scene.fog = atmosphere;
      const texture = await new THREE.TextureLoader().loadAsync('/sections/concrete-surface.webp');
      if (disposed) { texture.dispose(); return; }
      cleanups.push(() => texture.dispose());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.5, 1.5);
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const structure = createConcreteStructure(THREE, texture);
      cleanups.push(() => structure.dispose());
      scene.add(structure.group);
      const services = createBuildingServices(THREE);
      const construction = createConstructionDetails(THREE);
      cleanups.push(() => services.dispose(), () => construction.dispose());
      scene.add(services.group, construction.group);
      scene.add(new THREE.HemisphereLight(0xd8e4ea, 0x6b6960, 0.95));

      const sun = new THREE.DirectionalLight(0xfff4e6, 3.8);
      sun.position.set(-18, 30, 22);
      sun.castShadow = true;
      const shadowSize = window.innerWidth < 700 ? 1024 : 2048;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 21, bottom: -15, near: 1, far: 90 });
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.035;
      cleanups.push(() => sun.shadow.dispose());
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xe5e9ed, 0.55);
      fill.position.set(18, 12, -12);
      scene.add(fill);

      const groundTexture = texture.clone();
      groundTexture.repeat.set(24, 24);
      cleanups.push(() => groundTexture.dispose());
      const groundGeometry = new THREE.PlaneGeometry(600, 600);
      const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x66665e, map: groundTexture });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.43;
      ground.receiveShadow = true;
      scene.add(ground);
      cleanups.push(() => { groundGeometry.dispose(); groundMaterial.dispose(); });

      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let target = 0;
      let current = 0;
      let frameId = 0;
      let previousTime = 0;
      let lastStage = -1;
      let lastPercent = -1;

      function updateStatus(value: number) {
        const stage = motion.matches ? 4 : value < 0.12 ? 0 : value < 0.25 ? 1 : value < 0.39 ? 2 : value < 0.9 ? 3 : 4;
        if (stage !== lastStage && statusRef.current) statusRef.current.textContent = STAGES[stage];
        lastStage = stage;
        const percent = Math.round(value * 100);
        if (percent !== lastPercent) {
          progressRef.current?.style.setProperty('--build-progress', String(motion.matches ? 1 : value));
          host!.dataset.buildProgress = String(percent);
          lastPercent = percent;
        }
      }

      function readProgress() {
        const page = host!.closest('.pw') || document.documentElement;
        const pageTop = page.getBoundingClientRect().top;
        const traveled = Math.max(0, -pageTop);
        const total = Math.max(1, page.scrollHeight - window.innerHeight);
        const story = page.querySelector('#portals');
        const storyEnd = story
          ? Math.min(total, Math.max(1, story.getBoundingClientRect().bottom - pageTop - window.innerHeight))
          : total;
        // Most assembly happens while the service chapters leave the scene visible.
        // Keep the completed frame behind the catalog, contact section, and finale.
        target = clamp(storyEnd >= total
          ? traveled / total
          : traveled <= storyEnd ? 0.9 * traveled / storyEnd
            : 0.9 + 0.1 * (traveled - storyEnd) / (total - storyEnd));
        updateStatus(target);
        if (!motion.matches) wake();
      }

      function resize() {
        const width = host!.clientWidth || window.innerWidth;
        const height = host!.clientHeight || window.innerHeight;
        const aspect = width / Math.max(1, height);
        camera.aspect = aspect;
        cameraDistance = Math.max(33, 27 / aspect);
        atmosphere.near = cameraDistance * 1.3;
        atmosphere.far = atmosphere.near + 100;
        camera.far = atmosphere.far + 30;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        readProgress();
        wake();
      }

      function render(time: number) {
        frameId = 0;
        if (disposed || failed || document.hidden) return;
        const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.064) : 1 / 60;
        previousTime = time;
        const desired = motion.matches ? 1 : target;
        current += (desired - current) * (1 - Math.exp(-delta * 14));
        const moving = Math.abs(desired - current) > 0.0003;
        if (!moving) current = desired;
        structure.setProgress(current);
        services.setProgress(current);
        construction.setProgress(current);
        const angle = -0.56 + current * 0.12;
        camera.position.set(Math.sin(angle) * cameraDistance, 6.1 + cameraDistance * 0.32, Math.cos(angle) * cameraDistance);
        camera.lookAt(0, 6.1, 0);
        renderer.render(scene, camera);
        host!.dataset.sceneReady = 'true';
        host!.dataset.renderProgress = current.toFixed(4);
        host!.dataset.renderSettled = String(!moving);
        if (moving) wake();
      }

      function wake() {
        if (!disposed && !failed && !frameId && !document.hidden) frameId = requestAnimationFrame(render);
      }

      const motionChanged = () => {
        current = motion.matches ? 1 : target;
        lastPercent = -1;
        updateStatus(target);
        wake();
      };
      const visibilityChanged = () => {
        if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
        else { previousTime = 0; readProgress(); wake(); }
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        failed = true;
        release();
        if (!disposed) setFallback(true);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host!);
      const page = host!.closest('.pw');
      if (page) observer.observe(page);
      window.addEventListener('scroll', readProgress, { passive: true });
      window.addEventListener('resize', resize, { passive: true });
      motion.addEventListener('change', motionChanged);
      document.addEventListener('visibilitychange', visibilityChanged);
      renderer.domElement.addEventListener('webglcontextlost', contextLost);
      cleanups.push(() => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        window.removeEventListener('scroll', readProgress);
        window.removeEventListener('resize', resize);
        motion.removeEventListener('change', motionChanged);
        document.removeEventListener('visibilitychange', visibilityChanged);
        renderer.domElement.removeEventListener('webglcontextlost', contextLost);
        delete host!.dataset.sceneReady;
      });

      readProgress();
      current = motion.matches ? 1 : target;
      resize();
    }

    initialize().catch(() => {
      failed = true;
      release();
      if (!disposed) setFallback(true);
    });
    return () => { disposed = true; release(); };
  }, []);

  return (
    <div className="pw-construction" data-fallback={fallback ? 'true' : 'false'} aria-hidden="true">
      <div className="pw-construction-horizon" />
      <div ref={hostRef} className="pw-construction-canvas" style={{ visibility: fallback ? 'hidden' : 'visible' }} />
      {fallback && (
        <picture>
          <source media="(max-width:700px)" srcSet="/sections/concrete-frame-poster-mobile.webp" />
          {/* The decorative poster also works without a WebGL context. */}
          <img className="pw-construction-poster" src="/sections/concrete-frame-poster.webp" alt="" width="1600" height="1000" />
        </picture>
      )}
      <div className="pw-construction-shade" />
      <div className="pw-construction-status">
        <span className="pw-construction-dot" />
        <span ref={statusRef}>{fallback ? 'الهيكل الخرساني' : STAGES[0]}</span>
        <div ref={progressRef} className="pw-construction-track"><span /></div>
      </div>
    </div>
  );
}
