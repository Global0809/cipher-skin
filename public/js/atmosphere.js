// ===================================================
// cipher.skin — reactive clinical void
// GPU-driven atmosphere, data motes, and diagnostic rings
// ===================================================
import * as THREE from 'three';

const TAU = Math.PI * 2;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeRing(radius, squash, z, tilt, colour) {
  const segments = 128;
  const positions = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    positions[i * 3] = Math.cos(a) * radius;
    positions[i * 3 + 1] = Math.sin(a) * radius * squash;
    positions[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  });
  const ring = new THREE.LineLoop(geometry, material);
  ring.position.z = z;
  ring.rotation.set(tilt, tilt * 0.42, tilt * 0.18);
  ring.frustumCulled = false;
  return ring;
}

export function createReactiveAtmosphere({ scene, isCoarse, reduced }) {
  const group = new THREE.Group();
  group.name = 'reactive-atmosphere';
  scene.add(group);

  const skyUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0.2 },
    uViolet: { value: 0.65 },
    uCyan: { value: 0.25 },
    uAssembly: { value: reduced ? 1 : 0 },
    uPointer: { value: new THREE.Vector2() },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(18, 36, 22),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      vertexShader: `
        varying vec3 vDirection;

        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uTime;
        uniform float uEnergy;
        uniform float uViolet;
        uniform float uCyan;
        uniform float uAssembly;
        uniform vec2 uPointer;
        varying vec3 vDirection;

        float softBand(float value, float width) {
          return 1.0 - smoothstep(width, width + 0.12, abs(value));
        }

        void main() {
          vec3 d = normalize(vDirection);
          float angle = atan(d.z, d.x);
          float horizon = pow(max(0.0, 1.0 - abs(d.y)), 2.6);
          float slowTime = uTime * 0.035;

          float foldA = sin(angle * 2.0 + d.y * 7.0 + slowTime + uPointer.x * 0.7);
          float foldB = sin(angle * -3.0 + d.y * 11.0 - slowTime * 0.7 + uPointer.y * 0.5);
          float aurora = pow(max(0.0, foldA * 0.5 + foldB * 0.24 + 0.38), 2.2) * horizon;

          float latitude = softBand(d.y + 0.18 + sin(angle * 1.5 + slowTime) * 0.09, 0.035);
          float scan = pow(max(0.0, sin(angle * 5.0 - slowTime * 2.0 + d.y * 8.0)), 18.0);
          scan *= horizon * (0.15 + uEnergy * 0.85);

          vec3 base = vec3(0.0035, 0.0045, 0.0085);
          vec3 violet = vec3(0.115, 0.032, 0.185) * uViolet;
          vec3 cyan = vec3(0.012, 0.125, 0.155) * uCyan;
          vec3 colour = base;
          colour += violet * aurora * (0.17 + uEnergy * 0.18);
          colour += cyan * (aurora * 0.42 + latitude * 0.18) * (0.12 + uEnergy * 0.2);
          colour += mix(violet, cyan, 0.48) * scan * 0.08;

          float constructionPulse = (1.0 - uAssembly) * latitude * (0.018 + uEnergy * 0.035);
          colour += mix(violet, cyan, 0.36) * constructionPulse;

          gl_FragColor = vec4(colour, 1.0);
        }
      `,
    }),
  );
  sky.name = 'clinical-void';
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  group.add(sky);

  const maxMotes = isCoarse ? 1500 : 2600;
  const motePositions = new Float32Array(maxMotes * 3);
  const moteColours = new Float32Array(maxMotes * 3);
  const motePhase = new Float32Array(maxMotes);
  const moteSize = new Float32Array(maxMotes);
  const moteBand = new Float32Array(maxMotes);
  const random = seededRandom(0xc1f3a5);

  const pearl = new THREE.Color(0xdfe2ea);
  const violet = new THREE.Color(0xcda9f0);
  const cyan = new THREE.Color(0x9fe8ff);
  for (let i = 0; i < maxMotes; i++) {
    const radius = 2.1 + Math.pow(random(), 0.55) * 6.4;
    const angle = random() * TAU;
    const height = (random() - 0.5) * 6.2;
    motePositions[i * 3] = Math.cos(angle) * radius;
    motePositions[i * 3 + 1] = height;
    motePositions[i * 3 + 2] = Math.sin(angle) * radius - 1.1;

    const choice = random();
    const colour = choice < 0.56 ? pearl : choice < 0.8 ? violet : cyan;
    moteColours[i * 3] = colour.r;
    moteColours[i * 3 + 1] = colour.g;
    moteColours[i * 3 + 2] = colour.b;
    motePhase[i] = random();
    moteSize[i] = 0.55 + random() * 1.45;
    moteBand[i] = random();
  }

  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute('color', new THREE.BufferAttribute(moteColours, 3));
  moteGeometry.setAttribute('aPhase', new THREE.BufferAttribute(motePhase, 1));
  moteGeometry.setAttribute('aSize', new THREE.BufferAttribute(moteSize, 1));
  moteGeometry.setAttribute('aBand', new THREE.BufferAttribute(moteBand, 1));

  const moteUniforms = {
    uTime: { value: 0 },
    uFlow: { value: reduced ? 0 : 1 },
    uEnergy: { value: 0.2 },
    uVelocity: { value: 0 },
    uAssembly: { value: reduced ? 1 : 0 },
    uPointScale: { value: innerHeight * Math.min(devicePixelRatio, 1.6) },
    uTierOpacity: { value: isCoarse ? 0.72 : 1 },
    uPointer: { value: new THREE.Vector2() },
  };
  const moteMaterial = new THREE.ShaderMaterial({
    uniforms: moteUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    vertexColors: true,
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      attribute float aBand;

      uniform float uTime;
      uniform float uFlow;
      uniform float uEnergy;
      uniform float uVelocity;
      uniform float uAssembly;
      uniform float uPointScale;
      uniform float uTierOpacity;
      uniform vec2 uPointer;

      varying vec3 vColour;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        float drift = uTime * (0.035 + aBand * 0.04) * uFlow;
        p.y = mod(p.y + 3.1 + drift, 6.2) - 3.1;

        float scrollWarp = uVelocity * (0.08 + aBand * 0.16);
        p.x += sin(uTime * 0.11 + aPhase * 6.2831 + p.y * 0.65) * (0.035 + scrollWarp);
        p.z += cos(uTime * 0.09 + aPhase * 6.2831) * (0.025 + scrollWarp * 0.7);
        p.xy += uPointer * vec2(0.12, -0.08) * (0.3 + aBand);

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aSize * (0.7 + uEnergy * 0.55 + uVelocity * 0.45)
          * uPointScale / max(220.0, -mvPosition.z * 260.0);

        vColour = color;
        vAlpha = (0.12 + aBand * 0.2) * (0.72 + uEnergy * 0.7);
        vAlpha *= 0.78 + (1.0 - uAssembly) * 0.32;
        vAlpha *= uTierOpacity;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColour;
      varying float vAlpha;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float radius = length(point);
        if (radius > 0.5) discard;
        float core = 1.0 - smoothstep(0.04, 0.5, radius);
        gl_FragColor = vec4(vColour * (0.62 + core * 0.55), vAlpha * core);
      }
    `,
  });

  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.name = 'data-motes';
  motes.frustumCulled = false;
  motes.renderOrder = -20;
  group.add(motes);

  const rings = [
    makeRing(2.5, 0.58, -3.7, 0.16, 0xcda9f0),
    makeRing(3.25, 0.64, -4.2, -0.24, 0x8edfff),
    makeRing(4.15, 0.54, -4.9, 0.34, 0xcda9f0),
    makeRing(5.1, 0.68, -5.7, -0.18, 0x67dff0),
  ];
  const ringGroup = new THREE.Group();
  ringGroup.name = 'diagnostic-field-rings';
  rings.forEach((ring) => ringGroup.add(ring));
  group.add(ringGroup);

  let tier = isCoarse ? 'MID' : 'HIGH';
  const counts = {
    HIGH: maxMotes,
    MID: Math.min(maxMotes, 1400),
    LOW: Math.min(maxMotes, 620),
  };

  function setTier(nextTier) {
    tier = nextTier;
    moteGeometry.setDrawRange(0, counts[tier]);
    moteUniforms.uTierOpacity.value = tier === 'HIGH' ? 1 : tier === 'MID' ? 0.72 : 0.5;
    rings.forEach((ring, index) => {
      ring.visible = tier !== 'LOW' || index < 2;
    });
  }

  function resize(height, pixelRatio) {
    moteUniforms.uPointScale.value = height * pixelRatio;
  }

  function update(dt, t, state, pointer, scrollVelocity) {
    const motionTime = reduced ? 0 : t;
    const velocity = reduced ? 0 : Math.min(1.5, scrollVelocity);
    const energy = Math.min(1.4, state.fieldEnergy + velocity * 0.38);

    skyUniforms.uTime.value = motionTime;
    skyUniforms.uEnergy.value = energy;
    skyUniforms.uViolet.value = state.fieldViolet;
    skyUniforms.uCyan.value = state.fieldCyan;
    skyUniforms.uAssembly.value = state.assembly;
    skyUniforms.uPointer.value.set(pointer.x, pointer.y);

    moteUniforms.uTime.value = motionTime;
    moteUniforms.uEnergy.value = energy;
    moteUniforms.uVelocity.value = velocity;
    moteUniforms.uAssembly.value = state.assembly;
    moteUniforms.uPointer.value.set(pointer.x, pointer.y);

    const tierOpacity = tier === 'HIGH' ? 1 : tier === 'MID' ? 0.72 : 0.5;
    const ringOpacity = Math.min(0.16, 0.012 + state.fieldGrid * 0.065 + velocity * 0.028) * tierOpacity;
    rings.forEach((ring, index) => {
      ring.material.opacity = ringOpacity * (1 - index * 0.11);
      if (!reduced) {
        ring.rotation.z = (index % 2 ? -1 : 1) * t * (0.006 + index * 0.0015)
          + pointer.x * 0.028;
      }
    });

    if (!reduced) {
      ringGroup.rotation.x += ((pointer.y * -0.025) - ringGroup.rotation.x) * Math.min(1, dt * 2.2);
      ringGroup.position.y = Math.sin(t * 0.12) * 0.035;
    }
  }

  setTier(tier);

  return {
    group,
    motes,
    rings,
    sky,
    update,
    resize,
    setTier,
    getTier: () => tier,
  };
}
