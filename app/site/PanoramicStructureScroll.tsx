'use client';

import { useEffect, useRef, useState } from 'react';

const STAGES = ['الأساسات', 'أعمدة الدور الأرضي', 'السقف الأول', 'الأدوار العلوية', 'اكتمل الهيكل'];
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
        antialias: window.devicePixelRatio < 2,
        powerPreference: 'low-power',
      });
      if (!context) { setFallback(true); return; }
      cleanups.push(() => {
        if (!context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext();
      });
      const [THREE, { createConcreteStructure }] = await Promise.all([
        import('three'),
        import('./concrete-structure-three'),
      ]);
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: window.devicePixelRatio < 2,
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
      const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.1, 160);
      const texture = new THREE.TextureLoader().load('/sections/concrete-surface.webp', () => {
        if (!disposed && !failed) {
          wake();
        }
      }, undefined, () => {
        if (disposed || failed) return;
        failed = true;
        release();
        setFallback(true);
      });
      cleanups.push(() => texture.dispose());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.5, 1.5);
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const structure = createConcreteStructure(THREE, texture);
      cleanups.push(() => structure.dispose());
      scene.add(structure.group);
      scene.add(new THREE.HemisphereLight(0xd8e4ea, 0x6b6960, 2.5));

      const sun = new THREE.DirectionalLight(0xfff7ed, 3.2);
      sun.position.set(-18, 30, 22);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 21, bottom: -15, near: 1, far: 90 });
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.035;
      cleanups.push(() => sun.shadow.dispose());
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xe5e9ed, 1.4);
      fill.position.set(18, 12, -12);
      scene.add(fill);

      const groundGeometry = new THREE.PlaneGeometry(100, 100);
      const groundMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.065;
      ground.receiveShadow = true;
      scene.add(ground);
      cleanups.push(() => { groundGeometry.dispose(); groundMaterial.dispose(); });
      const grid = new THREE.GridHelper(46, 23, 0x95734d, 0x62615b);
      grid.position.y = -0.055;
      grid.material.transparent = true;
      grid.material.opacity = 0.12;
      scene.add(grid);
      cleanups.push(() => { grid.geometry.dispose(); grid.material.dispose(); });

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
        target = clamp(-page.getBoundingClientRect().top / Math.max(1, page.scrollHeight - window.innerHeight));
        updateStatus(target);
        if (!motion.matches) wake();
      }

      function resize() {
        const width = host!.clientWidth || window.innerWidth;
        const height = host!.clientHeight || window.innerHeight;
        const aspect = width / Math.max(1, height);
        const halfHeight = Math.max(11.6, 11.6 / aspect);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
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
        const angle = -0.56 + current * 0.12;
        camera.position.set(Math.sin(angle) * 37, 23, Math.cos(angle) * 37);
        camera.lookAt(0, 6.1, 0);
        renderer.render(scene, camera);
        host!.dataset.sceneReady = 'true';
        host!.dataset.renderProgress = current.toFixed(4);
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
