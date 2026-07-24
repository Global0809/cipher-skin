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
import { initLoader, initSoundToggle, initMicroSounds, initForm, makeCalloutUpdater, initRail } from './ui.js';

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
} else {
  boot();
}

function boot() {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

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

  /* ── post pipeline (single pass instances, tier-assembled) ── */
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 1.45);
  const bokehPass = new BokehPass(scene, camera, { focus: 3.2, aperture: 0.00016, maxblur: 0.0075 });
  const outputPass = new OutputPass();
  const smaaPass = new SMAAPass(innerWidth, innerHeight);
  let composer = null;

  const isCoarse = matchMedia('(pointer: coarse)').matches;
  let tier = isCoarse ? 'MID' : 'HIGH';
  const TIER_DPR = { HIGH: Math.min(devicePixelRatio, 2), MID: Math.min(devicePixelRatio, 1.6), LOW: 1 };

  function assemble() {
    renderer.setPixelRatio(TIER_DPR[tier]);
    renderer.setSize(innerWidth, innerHeight);
    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    if (tier === 'HIGH') composer.addPass(bokehPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    if (tier !== 'LOW') composer.addPass(smaaPass);
    composer.setSize(innerWidth, innerHeight);
    capsule.setTier(tier);
  }
  assemble();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
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

  /* ── adaptive quality: degrade before it ever stutters ── */
  let frames = 0, acc = 0;
  function sampleFPS(dt) {
    frames++; acc += dt;
    if (frames >= 50) {
      const fps = frames / acc;
      if (fps < 45 && tier !== 'LOW') {
        tier = tier === 'HIGH' ? 'MID' : 'LOW';
        assemble();
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

    // massive machine, faint breath of life
    capsule.group.rotation.y = state.rotY + Math.sin(t * 0.22) * 0.018;
    capsule.group.position.x = state.grpX;
    capsule.group.position.y = Math.sin(t * 0.5) * 0.006;

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
