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
import { createReactiveAtmosphere } from './atmosphere.js';
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
  const isCoarse = matchMedia('(pointer: coarse)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactViewport = innerWidth <= 900;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = compactViewport ? 0.86 : 0.92;
  renderer.transmissionResolutionScale = 0.5; // jade refraction reads identically at half res

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.045);

  const camera = new THREE.PerspectiveCamera(innerWidth <= 520 ? 48 : 42, innerWidth / innerHeight, 0.1, 40);

  // studio reflections for the pearl clearcoat — no HDR download needed
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const capsule = buildCapsule();
  scene.add(capsule.group);
  scene.add(capsule.lights.rim, capsule.lights.rimTarget, capsule.lights.fill, capsule.lights.backGlow);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));
  const atmosphere = createReactiveAtmosphere({ scene, isCoarse, reduced: reducedMotion });

  /* ── post pipeline (single pass instances, tier-assembled) ── */
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    compactViewport ? 0.32 : 0.5,
    compactViewport ? 0.32 : 0.5,
    compactViewport ? 1.55 : 1.45,
  );
  const bokehPass = new BokehPass(scene, camera, { focus: 3.2, aperture: 0.00016, maxblur: 0.0075 });
  const outputPass = new OutputPass();
  const smaaPass = new SMAAPass(innerWidth, innerHeight);

  let tier = isCoarse ? 'MID' : 'HIGH';
  const TIER_DPR = { HIGH: Math.min(devicePixelRatio, 1.6), MID: Math.min(devicePixelRatio, 1.5), LOW: Math.min(devicePixelRatio, 1.15) };
  renderer.setPixelRatio(TIER_DPR[tier]);
  renderer.setSize(innerWidth, innerHeight, false);

  // one composer for life — tiers only toggle passes (no target reallocation, no leaks)
  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bokehPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  composer.addPass(smaaPass);

  function applyTier() {
    const dpr = TIER_DPR[tier];
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setPixelRatio(dpr);
    composer.setSize(innerWidth, innerHeight);
    bokehPass.enabled = tier === 'HIGH' && !isCoarse && innerWidth > 900;
    smaaPass.enabled = tier !== 'LOW';
    const compactRender = isCoarse || innerWidth <= 900;
    bloomPass.radius = tier === 'LOW' ? 0.2 : compactRender || tier === 'MID' ? 0.32 : 0.5;
    bloomPass.threshold = tier === 'LOW' ? 1.7 : compactRender || tier === 'MID' ? 1.55 : 1.45;
    renderer.transmissionResolutionScale = tier === 'HIGH' ? 0.75 : tier === 'MID' ? 0.65 : 0.5;
    capsule.setTier(tier);
    atmosphere.setTier(tier);
    atmosphere.resize(innerHeight, dpr);
  }
  applyTier();

  // Debounce mobile URL-bar changes without leaving a stale, browser-scaled canvas.
  let resizeT = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      camera.fov = innerWidth <= 520 ? 48 : 42;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.toneMappingExposure = innerWidth <= 900 ? 0.86 : 0.92;
      bokehPass.enabled = tier === 'HIGH' && !isCoarse && innerWidth > 900;
      renderer.setSize(innerWidth, innerHeight, false);
      composer.setSize(innerWidth, innerHeight);
      atmosphere.resize(innerHeight, TIER_DPR[tier]);
    }, 250);
  });

  /* ── camera state, scrubbed by cinema.js ── */
  const state = {
    px: -1.9, py: -0.5, pz: 2.4,
    tx: 0.3, ty: 0.2, tz: 0,
    rotY: 0.15, grpX: 0,
    env: 1.0,   // master environment dimmer, scrubbed by cinema.js
    assembly: reducedMotion ? 1 : 0,
    fieldEnergy: reducedMotion ? 0.28 : 0.42,
    fieldViolet: 0.72,
    fieldCyan: 0.28,
    fieldGrid: reducedMotion ? 0.15 : 0.42,
  };
  const target = new THREE.Vector3();
  const pointer = { x: 0, y: 0 };
  if (!isCoarse && !reducedMotion) {
    addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  const calloutUpdate = makeCalloutUpdater(camera, capsule.anchors);
  const intro = initCinematography({ state, capsule, audio, calloutUpdate, bloomPass, isCoarse });
  const snapWorldPosition = new THREE.Vector3();
  let previousAssemblyProgress = state.assembly;
  const assemblyCueQueue = [];
  let nextAssemblyCueTime = 0;
  const assemblyWeights = { structure: 0.9, shell: 0.58, optic: 0.72, jade: 0.82, final: 1 };
  const updateAssemblyCues = (t) => {
    const progress = state.assembly;
    const isReady = !reducedMotion && !document.hidden && document.body.classList.contains('is-live');
    if (!isReady) {
      assemblyCueQueue.length = 0;
      nextAssemblyCueTime = t;
      previousAssemblyProgress = progress;
      return;
    }
    if (progress < previousAssemblyProgress - 0.0001) {
      assemblyCueQueue.length = 0;
      nextAssemblyCueTime = t;
      capsule.assembly.feedback.cancel();
      previousAssemblyProgress = progress;
      return;
    }
    if (progress > previousAssemblyProgress + 0.0001) {
      const crossed = capsule.assembly.pieces.filter(
        (piece) => previousAssemblyProgress < piece.snapAt && progress >= piece.snapAt,
      );
      const cuePieces = crossed.length <= 4
        ? crossed
        : Array.from(
          new Set(Array.from({ length: 4 }, (_, index) => crossed[
            Math.round((index / 3) * (crossed.length - 1))
          ])),
        );
      const firstCueTime = Math.max(t, nextAssemblyCueTime);
      cuePieces.forEach((piece, cueIndex) => {
        assemblyCueQueue.push({ piece, at: firstCueTime + cueIndex * 0.05 });
      });
      nextAssemblyCueTime = firstCueTime + cuePieces.length * 0.05;
    }
    while (assemblyCueQueue.length && assemblyCueQueue[0].at <= t + 0.0001) {
      const { piece } = assemblyCueQueue.shift();
      if (progress + 0.0001 < piece.snapAt) continue;
      capsule.assembly.feedback.trigger(piece, t);
      camera.updateMatrixWorld();
      capsule.group.updateMatrixWorld(true);
      snapWorldPosition.copy(piece.snapPosition);
      capsule.group.localToWorld(snapWorldPosition);
      snapWorldPosition.project(camera);
      audio.assemblySnap({
        kind: piece.kind,
        weight: assemblyWeights[piece.kind] || 0.65,
        pan: snapWorldPosition.x,
        index: piece.lockOrder,
        total: capsule.assembly.pieces.length,
      });
    }
    if (!assemblyCueQueue.length) nextAssemblyCueTime = t;
    previousAssemblyProgress = progress;
  };

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
  let smoothX = state.px, smoothY = state.py, smoothZ = state.pz;
  let smoothTX = state.tx, smoothTY = state.ty, smoothTZ = state.tz;
  let lastScrollY = scrollY;
  let scrollVelocity = 0;

  const frame = (dt, t) => {
    const k = 1 - Math.exp(-dt * 6.5);
    const scrollDelta = Math.abs(scrollY - lastScrollY) / Math.max(1, innerHeight);
    const instantaneousVelocity = scrollDelta / Math.max(1 / 120, dt);
    scrollVelocity = Math.max(
      scrollVelocity * Math.exp(-dt * 3.4),
      Math.min(1.5, instantaneousVelocity * 0.12),
    );
    lastScrollY = scrollY;

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
    scene.environmentRotation.y = reducedMotion ? 0 : t * 0.03;   // reflections slowly alive on the clearcoat

    // massive machine, faint breath of life
    capsule.group.rotation.y = state.rotY + (reducedMotion ? 0 : Math.sin(t * 0.22) * 0.018);
    capsule.group.position.x = state.grpX;
    capsule.group.position.y = reducedMotion ? 0 : Math.sin(t * 0.5) * 0.006;
    capsule.animate(reducedMotion ? 0 : t, state.assembly, !reducedMotion);
    updateAssemblyCues(t);
    atmosphere.update(dt, t, state, pointer, scrollVelocity);

    if (tier === 'HIGH') {
      bokehPass.uniforms.focus.value = camera.position.distanceTo(target);
    }

    calloutUpdate();
    composer.render(dt);
  };

  let previousTime = performance.now() * 0.001;
  let elapsedTime = 0;
  renderer.setAnimationLoop((timeMs) => {
    const now = timeMs * 0.001;
    const dt = Math.min(Math.max(0, now - previousTime), 0.1);
    previousTime = now;
    elapsedTime += dt;
    frame(dt, elapsedTime);
    sampleFPS(dt);
  });
  addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      previousTime = performance.now() * 0.001;
      frames = 0;
      acc = 0;
    }
  });

  // QA/debug hook: manual frame stepping for automated visual review
  window.__cs = {
    frame,
    state,
    camera,
    capsule,
    bloomPass,
    atmosphere,
    get tier() { return tier; },
    setTier(nextTier) {
      if (!TIER_DPR[nextTier]) return;
      tier = nextTier;
      applyTier();
    },
  };
}
