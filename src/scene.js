import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // No ambient. The void is absolute. No lights at all for the PoC —
  // the only "visible" surfaces are the sonar point cloud (additive, self-lit).
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.05,
    200,
  );
  camera.position.set(0, 0, 0);

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  // iOS Safari fires resize on orientation but not always with the new size — re-tick:
  window.addEventListener('orientationchange', () => {
    setTimeout(onResize, 200);
  });

  // WebGL context loss — re-init flag for callers
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    console.warn('[scene] WebGL context lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    console.warn('[scene] WebGL context restored');
  });

  return {
    renderer,
    scene,
    camera,
    isContextLost: () => contextLost,
    dispose() {
      renderer.dispose();
      window.removeEventListener('resize', onResize);
    },
  };
}
