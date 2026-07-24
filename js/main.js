// ═══════════════════════════════════════════════════
// cipher.skin — boot, render pipeline, adaptive quality
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCapsule } from './capsule.js';
import { AudioEngine } from './audio.js';
import { initCinematography } from './cinema.js';
import { initLoader, initSoundToggle, initMicroSounds, initForm, makeCalloutUpdater, initRail, initCursor, initMagnetic, initScanFeed, initAnchors } from './ui.js';

const audio = new AudioEngine();
let renderer = null;

try {
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('scene'),
    antialias: false,
    powerPreference: 'high-performance',
  });
  if (!renderer.getContext()) throw new Error('no-gl');
} catch (err) {
  renderer = null;
}

if (!renderer) {
  // ── graceful non-WebGL path: content stays readable, form still works ──
  document.body.classList.add('no-webgl');
  document.getElementById('webgl-fallback').hidden = false;
  initLoader({ onBegin: () => { audio.init(); } });
  initSoundToggle(audio);
  initForm(audio);
  initRail();
  initCursor();
  initMagnetic();
  initScanFeed();
  initAnchors();
} else {
  boot();
}

function boot() {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.transmissionResolutionScale = 0.5; // jade refraction reads identically at half res

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.045);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 40);

  // studio reflections for the pearl clearcoat — no HDR download needed
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const capsule = buildCapsule();
  scene.add(capsule.group);
  scene.add(capsule.lights.rim, capsule.lights.rimTarget, capsule.lights.fill, capsule.lights.backGlow);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));

  /* -- bio-motes: dust-of-light drifting through the void -- */
  const isCoarsePre = matchMedia('(pointer: coarse)').matches;
  const MOTES = isCoarsePre ? 320 : 560;
  const pGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(MOTES * 3);
  const mCol = new Float32Array(MOTES * 3);
  const mSpeed = new Float32Array(MOTES);
  const palette = [new THREE.Color(0xdfe2ea), new THREE.Color(0xcda9f0), new THREE.Color(0x9fe8ff)];
  for (let i = 0; i < MOTES; i++) {
    mPos[i * 3] = (Math.random() - 0.5) * 9;
    mPos[i * 3 + 1] = (Math.random() - 0.5) * 6;
    mPos[i * 3 + 2] = (Math.random() - 0.5) * 7 - 0.5;
    const r = Math.random();
    const c = r < 0.62 ? palette[0] : r < 0.86 ? palette[1] : palette[2];
    mCol[i * 3] = c.r; mCol[i * 3 + 1] = c.g; mCol[i * 3 + 2] = c.b;
    mSpeed[i] = 0.018 + Math.random() * 0.05;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
  const motes = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.02, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(motes);

  /* ── post pipeline (single pass instances, tier-assembled) ── */
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 1.45);
  const bokehPass = new BokehPass(scene, camera, { focus: 3.2, aperture: 0.00016, maxblur: 0.0075 });
  const outputPass = new OutputPass();
  const smaaPass = new SMAAPass(innerWidth, innerHeight);

  const isCoarse = matchMedia('(pointer: coarse)').matches;
  let tier = isCoarse ? 'MID' : 'HIGH';
  const TIER_DPR = { HIGH: Math.min(devicePixelRatio, 1.6), MID: Math.min(devicePixelRatio, 1.4), LOW: 1 };

  // one composer for life — tiers only toggle passes (no target reallocation, no leaks)
  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bokehPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  composer.addPass(smaaPass);

  function applyTier() {
    renderer.setPixelRatio(TIER_DPR[tier]);
    renderer.setSize(innerWidth, innerHeight);
    bokehPass.enabled = tier === 'HIGH';
    smaaPass.enabled = tier !== 'LOW';
    composer.setSize(innerWidth, innerHeight);
    capsule.setTier(tier);
  }
  applyTier();

  // mobile URL-bar collapse fires height-only resizes constantly — ignore those
  let lastW = innerWidth;
  let resizeT = 0;
  addEventListener('resize', () => {
    if (isCoarse && innerWidth === lastW) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      lastW = innerWidth;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
    }, 250);
  });

  /* ── camera state, scrubbed by cinema.js ── */
  const state = {
    px: -1.9, py: -0.5, pz: 2.4,
    tx: 0.3, ty: 0.2, tz: 0,
    rotY: 0.15, grpX: 0,
    env: 1.0,   // master environment dimmer, scrubbed by cinema.js
  };
  const target = new THREE.Vector3();
  const pointer = { x: 0, y: 0 };
  if (!isCoarse) {
    addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  const calloutUpdate = makeCalloutUpdater(camera, capsule.anchors);
  const intro = initCinematography({ state, capsule, audio, calloutUpdate, bloomPass });

  initLoader({ onBegin: () => { audio.init(); intro(); } });
  initSoundToggle(audio);
  initMicroSounds(audio);
  initForm(audio);
  initRail();
  initCursor();
  initMagnetic();
  initScanFeed();
  initAnchors();

  /* ── adaptive quality: degrade before it ever stutters ──
     baseline-aware so a Low-Power-Mode 30Hz rAF cap isn't mistaken for GPU overload */
  let frames = 0, acc = 0, baselineFPS = 0;
  function sampleFPS(dt) {
    frames++; acc += dt;
    if (frames >= 50) {
      const fps = frames / acc;
      baselineFPS = Math.max(baselineFPS, fps);
      if (fps < 45 && fps < baselineFPS * 0.75 && tier !== 'LOW') {
        tier = tier === 'HIGH' ? 'MID' : 'LOW';
        applyTier();
      }
      frames = 0; acc = 0;
    }
  }

  /* ── render loop ── */
  const clock = new THREE.Clock();
  let smoothX = state.px, smoothY = state.py, smoothZ = state.pz;
  let smoothTX = state.tx, smoothTY = state.ty, smoothTZ = state.tz;

  const frame = (dt, t) => {
    const k = 1 - Math.exp(-dt * 6.5);

    smoothX += (state.px + pointer.x * 0.09 - smoothX) * k;
    smoothY += (state.py - pointer.y * 0.07 - smoothY) * k;
    smoothZ += (state.pz - smoothZ) * k;
    smoothTX += (state.tx - smoothTX) * k;
    smoothTY += (state.ty - smoothTY) * k;
    smoothTZ += (state.tz - smoothTZ) * k;

    camera.position.set(smoothX, smoothY, smoothZ);
    target.set(smoothTX, smoothTY, smoothTZ);
    camera.lookAt(target);

    scene.environmentIntensity = state.env;
    scene.environmentRotation.y = t * 0.03;   // reflections slowly alive on the clearcoat

    // massive machine, faint breath of life
    capsule.group.rotation.y = state.rotY + Math.sin(t * 0.22) * 0.018;
    capsule.group.position.x = state.grpX;
    capsule.group.position.y = Math.sin(t * 0.5) * 0.006;
    capsule.animate(t);

    // motes drift upward and wrap
    for (let i = 0; i < MOTES; i++) {
      mPos[i * 3 + 1] += mSpeed[i] * dt;
      if (mPos[i * 3 + 1] > 3) mPos[i * 3 + 1] = -3;
    }
    pGeo.attributes.position.needsUpdate = true;
    motes.rotation.y = t * 0.012;

    if (tier === 'HIGH') {
      bokehPass.uniforms.focus.value = camera.position.distanceTo(target);
    }

    calloutUpdate();
    composer.render(dt);
  };

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    frame(dt, clock.elapsedTime);
    sampleFPS(dt);
  });

  // QA/debug hook: manual frame stepping for automated visual review
  window.__cs = { frame, state, camera, capsule, bloomPass };
}
