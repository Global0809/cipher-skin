// ═══════════════════════════════════════════════════
// Clarisse Mark II — procedural digital twin
// Stadium-oval monocoque swept from real product photos
// ═══════════════════════════════════════════════════
import * as THREE from 'three';

/* Stadium (obround) path in the XY plane.
   a = end-cap radius (half width), s = straight half-length.
   Returns u∈[0,1] → { x, y, nx, ny } with outward normal. */
function stadiumPath(a, s) {
  const arc = Math.PI * a;
  const straight = 2 * s;
  const total = 2 * arc + 2 * straight;
  return (u) => {
    let t = (u % 1) * total;
    if (t < straight) return { x: a, y: -s + t, nx: 1, ny: 0 };
    t -= straight;
    if (t < arc) {
      const th = t / a;
      return { x: Math.cos(th) * a, y: s + Math.sin(th) * a, nx: Math.cos(th), ny: Math.sin(th) };
    }
    t -= arc;
    if (t < straight) return { x: -a, y: s - t, nx: -1, ny: 0 };
    t -= straight;
    const th = Math.PI + t / a;
    return { x: Math.cos(th) * a, y: -s + Math.sin(th) * a, nx: Math.cos(th), ny: Math.sin(th) };
  };
}

/* Sweep a 2D rim profile [ [d, z], ... ] around a stadium path.
   d = offset along the outward normal, z = depth. Seam-free (modular indexing). */
function sweepGeometry(path, profile, pathSegs = 160) {
  const Q = profile.length;
  const positions = new Float32Array(pathSegs * Q * 3);
  for (let p = 0; p < pathSegs; p++) {
    const { x, y, nx, ny } = path(p / pathSegs);
    for (let q = 0; q < Q; q++) {
      const [d, z] = profile[q];
      const i = (p * Q + q) * 3;
      positions[i] = x + nx * d;
      positions[i + 1] = y + ny * d;
      positions[i + 2] = z;
    }
  }
  const indices = [];
  for (let p = 0; p < pathSegs; p++) {
    const pn = (p + 1) % pathSegs;
    for (let q = 0; q < Q - 1; q++) {
      const a = p * Q + q, b = pn * Q + q, c = pn * Q + q + 1, d2 = p * Q + q + 1;
      indices.push(a, b, d2, b, c, d2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function stadiumShape(a, s) {
  const sh = new THREE.Shape();
  sh.absarc(0, s, a, 0, Math.PI, false);
  sh.absarc(0, -s, a, Math.PI, Math.PI * 2, false);
  sh.closePath();
  return sh;
}

/* Quarter-arc helper for profile corners */
function arcPts(cd, cz, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cd + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(value) {
  const c1 = 1.12;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

/* Extract a contiguous path sector from the indexed swept shell.
   Normals are copied from the canonical geometry so assembled panel seams vanish. */
function shellSectorGeometry(source, qCount, pathStart, pathEnd, pathSegments) {
  const sourcePosition = source.getAttribute('position');
  const sourceNormal = source.getAttribute('normal');
  const positions = [];
  const normals = [];

  const copyVertex = (index) => {
    positions.push(
      sourcePosition.getX(index),
      sourcePosition.getY(index),
      sourcePosition.getZ(index),
    );
    normals.push(
      sourceNormal.getX(index),
      sourceNormal.getY(index),
      sourceNormal.getZ(index),
    );
  };

  for (let p = pathStart; p < pathEnd; p++) {
    const pn = (p + 1) % pathSegments;
    for (let q = 0; q < qCount - 1; q++) {
      const a = p * qCount + q;
      const b = pn * qCount + q;
      const c = pn * qCount + q + 1;
      const d = p * qCount + q + 1;
      copyVertex(a); copyVertex(b); copyVertex(d);
      copyVertex(b); copyVertex(c); copyVertex(d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z);
  return { geometry, centre };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function buildCapsule() {
  const group = new THREE.Group();

  // ── Materials ──
  const pearl = new THREE.MeshPhysicalMaterial({
    color: 0xf7f5f2, metalness: 0.0, roughness: 0.34,
    clearcoat: 1.0, clearcoatRoughness: 0.12,
    iridescence: 0.5, iridescenceIOR: 1.32, iridescenceThicknessRange: [120, 400],
    sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xe9dcff),
    envMapIntensity: 0.55,
    side: THREE.DoubleSide,
  });
  const voidBlack = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.07,
    side: THREE.DoubleSide,
  });
  const glossBlack = new THREE.MeshPhysicalMaterial({
    color: 0x0b0b0e, roughness: 0.28, metalness: 0.1, clearcoat: 0.7,
    clearcoatRoughness: 0.2, envMapIntensity: 0.5,
  });
  const jade = new THREE.MeshPhysicalMaterial({
    color: 0xf5f3ea, metalness: 0.0, roughness: 0.27,
    transmission: 0.5, thickness: 0.7, ior: 1.45,
    attenuationColor: new THREE.Color(0xefe8d6), attenuationDistance: 1.2,
    clearcoat: 0.5, clearcoatRoughness: 0.25,
    sheen: 0.5, sheenColor: new THREE.Color(0xffffff),
    envMapIntensity: 0.9,
  });
  const visHaloMat = new THREE.MeshStandardMaterial({ color: 0x131313, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 });
  const polHaloMat = new THREE.MeshStandardMaterial({ color: 0x131313, emissive: 0xdfe9ff, emissiveIntensity: 0, roughness: 0.6 });
  const uvBarMat = new THREE.MeshStandardMaterial({ color: 0x0c0714, emissive: 0x8a2be2, emissiveIntensity: 0, roughness: 0.5 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x05070c, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 });

  // ── Outer shell (pearl) ──
  const A = 0.775, S = 0.30;             // outer stadium: half-width, straight half-length
  const outer = stadiumPath(A, S);
  const shellProfile = [
    [-0.30, 0.95], [-0.16, 0.95], [-0.02, 0.95],
    ...arcPts(-0.01, 0.85, 0.10, Math.PI / 2, 0, 7),  // front corner round-over
    [0.09, 0.55], [0.095, 0.1], [0.09, -0.5],          // barrel wall
    ...arcPts(-0.26, -0.5, 0.35, 0, -Math.PI / 2, 9),  // rear corner
    [-0.42, -0.955], [-0.54, -0.985], [-0.62, -0.997], [-0.68, -1.0], [-0.74, -1.0], // domed rear
  ];
  const shellSegments = 180;
  const shellGeometry = sweepGeometry(outer, shellProfile, shellSegments);
  const shell = new THREE.Mesh(shellGeometry, pearl);
  shell.name = 'canonical-shell';
  group.add(shell);

  // During the hero the monocoque is rendered as precision-cut construction
  // panels. At full assembly we swap back to the canonical one-draw shell.
  const shellSectors = new THREE.Group();
  shellSectors.name = 'shell-construction-panels';
  const sectorMeshes = [];
  const sectorCount = 12;
  for (let i = 0; i < sectorCount; i++) {
    const p0 = Math.round((i * shellSegments) / sectorCount);
    const p1 = Math.round(((i + 1) * shellSegments) / sectorCount);
    const sectorData = shellSectorGeometry(shellGeometry, shellProfile.length, p0, p1, shellSegments);
    const sector = new THREE.Mesh(sectorData.geometry, pearl);
    sector.name = `shell-panel-${String(i + 1).padStart(2, '0')}`;
    sector.position.copy(sectorData.centre);
    sectorMeshes.push(sector);
    shellSectors.add(sector);
  }
  group.add(shellSectors);

  // flush plug hides the rear dome centre sliver + sweep pinch marks
  const backCap = new THREE.Mesh(new THREE.ShapeGeometry(stadiumShape(A * 0.35, S * 0.35), 48), pearl);
  backCap.name = 'rear-dome-cap';
  backCap.position.z = -1.001;
  backCap.rotation.y = Math.PI;
  group.add(backCap);

  // ── Inner cavity (musou black) ──
  const A2 = 0.475, S2 = 0.28;           // aperture stadium
  const inner = stadiumPath(A2, S2);
  const cavityProfile = [
    [0.035, 0.952], [0.0, 0.945],
    ...arcPts(-0.05, 0.90, 0.05, Math.PI / 2 * 0.2, Math.PI / 2, 5).map(([d, z]) => [d, z]),
    [-0.05, 0.82], [0.02, 0.45], [0.065, 0.0], [0.06, -0.42],
    ...arcPts(-0.06, -0.44, 0.12, 0, -Math.PI / 2, 6),
    [-0.22, -0.575], [-0.40, -0.58],
  ];
  const cavity = new THREE.Mesh(sweepGeometry(inner, cavityProfile, 140), voidBlack);
  cavity.name = 'light-sealed-cavity';
  group.add(cavity);

  const cavityBack = new THREE.Mesh(new THREE.ShapeGeometry(stadiumShape(A2 * 0.92, S2 * 0.92), 48), voidBlack);
  cavityBack.name = 'cavity-back';
  cavityBack.position.z = -0.578;
  group.add(cavityBack);

  // ── Diagnostic optics on the back wall ──
  const visHalo = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.026, 20, 90), visHaloMat);
  visHalo.name = 'vis-halo';
  visHalo.scale.set(1, 1.5, 1);
  visHalo.position.z = -0.54;
  group.add(visHalo);

  const polHalo = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.021, 20, 80), polHaloMat);
  polHalo.name = 'pol-halo';
  polHalo.scale.set(1, 1.45, 1);
  polHalo.position.z = -0.535;
  group.add(polHalo);

  const uvBar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.016, 0.05), uvBarMat);
  uvBar.name = 'uv-emitter';
  uvBar.position.set(0, 0.585, -0.12);
  uvBar.rotation.x = Math.PI / 4;
  group.add(uvBar);

  // camera module
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.04), glossBlack);
  camBody.name = 'camera-body';
  camBody.position.set(0, 0, -0.545);
  group.add(camBody);
  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 32), glossBlack);
  camLens.name = 'camera-lens';
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(0, 0, -0.52);
  group.add(camLens);
  const camGlass = new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 24), lensMat);
  camGlass.name = 'camera-glass';
  camGlass.position.set(0, 0, -0.502);
  group.add(camGlass);

  // -- living details: idle scan beam + breathing lens pupil --
  const scanMat = new THREE.MeshStandardMaterial({
    color: 0x061014, emissive: 0x8fe4ff, emissiveIntensity: 0,
    roughness: 0.4, transparent: true, opacity: 0.9,
  });
  const scanBeam = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.008, 0.012), scanMat);
  scanBeam.name = 'idle-scan-beam';
  scanBeam.position.set(0, 0, -0.12);
  group.add(scanBeam);

  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x140a20, emissive: 0xcda9f0, emissiveIntensity: 1.0, roughness: 0.3,
  });
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.011, 20), pupilMat);
  pupil.name = 'camera-pupil';
  pupil.position.set(0, 0, -0.4935);
  group.add(pupil);

  // ── Cryo-magnetic jade bio-interfaces ──
  const bowlPts = [
    new THREE.Vector2(0.001, 0), new THREE.Vector2(0.07, 0.004), new THREE.Vector2(0.115, 0.018),
    new THREE.Vector2(0.143, 0.048), new THREE.Vector2(0.149, 0.082), new THREE.Vector2(0.132, 0.076),
    new THREE.Vector2(0.095, 0.05), new THREE.Vector2(0.045, 0.034), new THREE.Vector2(0.001, 0.03),
  ];
  const chinBowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 56), jade);
  chinBowl.name = 'jade-chin-bowl';
  chinBowl.position.set(0, -0.545, 0.30);
  group.add(chinBowl);

  const chinPost = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.22, 28), glossBlack);
  chinPost.name = 'chin-mount';
  chinPost.position.set(0, -0.66, 0.30);
  group.add(chinPost);

  const roller = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.34, 12, 32), jade);
  roller.name = 'jade-forehead-roller';
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, 0.545, 0.14);
  group.add(roller);

  // ── Internal + external lighting rig ──
  // distance cutoffs keep interior light INSIDE the cavity (no shadow maps needed)
  const visLight = new THREE.PointLight(0xffffff, 0, 1.15, 1.8);
  visLight.position.set(0, 0, -0.25);
  group.add(visLight);
  const polLight = new THREE.PointLight(0xdfe9ff, 0, 1.1, 1.8);
  polLight.position.set(0, 0.05, -0.2);
  group.add(polLight);
  const uvLight = new THREE.PointLight(0x8a2be2, 0, 1.7, 1.6);
  uvLight.position.set(0, 0.3, -0.05);
  group.add(uvLight);

  const rim = new THREE.SpotLight(0xffffff, 0, 14, 0.85, 0.9, 1.5);
  rim.position.set(2.6, 1.7, -1.6);
  const rimTarget = new THREE.Object3D();
  rim.target = rimTarget;

  const fill = new THREE.DirectionalLight(0xbfd0e8, 0.17);
  fill.position.set(-2.4, 0.6, 1.8);

  const backGlow = new THREE.PointLight(0x9b4dff, 0, 9, 1.6);
  backGlow.position.set(0, -0.1, -2.4);

  // ── Callout anchors (world-space targets for DOM labels) ──
  const anchors = {
    chin: new THREE.Object3D(), forehead: new THREE.Object3D(), cavity: new THREE.Object3D(),
  };
  anchors.chin.position.set(0.1, -0.5, 0.42);
  anchors.forehead.position.set(-0.05, 0.62, 0.26);
  anchors.cavity.position.set(0.34, 0.05, 0.6);
  group.add(anchors.chin, anchors.forehead, anchors.cavity);

  /* ── scroll assembly system ──────────────────────────────────────────────
     Every piece derives its pose directly from one progress scalar. This keeps
     reverse scroll, hash loads, and fast section jumps deterministic. */
  const assemblyPieces = [];
  const registerPiece = (object, start, end, offset, spin, startScale = 0.42, kind = 'shell') => {
    object.updateMatrix();
    const homePosition = object.position.clone();
    const homeQuaternion = object.quaternion.clone();
    const homeScale = object.scale.clone();
    const scatterPosition = homePosition.clone().add(offset);
    const scatterQuaternion = homeQuaternion.clone().multiply(
      new THREE.Quaternion().setFromEuler(spin),
    );
    const homeMatrix = new THREE.Matrix4().compose(homePosition, homeQuaternion, homeScale);
    let snapPosition = homePosition.clone();
    if (object.geometry) {
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      snapPosition = object.geometry.boundingSphere.center.clone().applyMatrix4(homeMatrix);
    }
    assemblyPieces.push({
      object,
      start,
      end,
      snapAt: start + (end - start) * 0.86,
      kind,
      startScale,
      homePosition,
      homeQuaternion,
      homeScale,
      scatterPosition,
      scatterQuaternion,
      snapPosition,
    });
  };

  registerPiece(cavityBack, 0.03, 0.17, new THREE.Vector3(0, 0.2, -1.2), new THREE.Euler(0.3, -0.5, 0.15), 0.3, 'structure');
  registerPiece(backCap, 0.07, 0.23, new THREE.Vector3(0.35, -0.2, -1.45), new THREE.Euler(-0.2, 0.65, 0.2), 0.36, 'structure');
  registerPiece(cavity, 0.12, 0.3, new THREE.Vector3(-0.75, 0.25, -0.8), new THREE.Euler(0.25, -0.48, -0.18), 0.48, 'structure');
  registerPiece(visHalo, 0.24, 0.4, new THREE.Vector3(0.8, -0.3, -0.65), new THREE.Euler(0.5, 0.35, -0.55), 0.28, 'optic');
  registerPiece(polHalo, 0.3, 0.46, new THREE.Vector3(-0.55, 0.45, -0.8), new THREE.Euler(-0.45, -0.4, 0.6), 0.24, 'optic');
  registerPiece(camBody, 0.36, 0.52, new THREE.Vector3(0.55, 0.1, -0.95), new THREE.Euler(0.7, -0.5, 0.2), 0.22, 'optic');
  registerPiece(camLens, 0.42, 0.58, new THREE.Vector3(-0.45, -0.15, -0.8), new THREE.Euler(-0.55, 0.6, -0.4), 0.18, 'optic');
  registerPiece(camGlass, 0.48, 0.64, new THREE.Vector3(0.2, 0.55, -0.72), new THREE.Euler(0.4, 0.5, 0.4), 0.12, 'optic');

  sectorMeshes.forEach((sector, index) => {
    const angle = (index / sectorCount) * Math.PI * 2;
    const radial = 0.78 + (index % 3) * 0.16;
    const stage = 0.18 + index * 0.046;
    registerPiece(
      sector,
      stage,
      Math.min(0.86, stage + 0.16),
      new THREE.Vector3(
        Math.cos(angle) * radial,
        Math.sin(angle) * radial * 0.85,
        (index % 2 ? -1 : 1) * (0.58 + (index % 4) * 0.12),
      ),
      new THREE.Euler(
        (index % 2 ? -1 : 1) * (0.28 + index * 0.025),
        Math.sin(angle) * 0.62,
        Math.cos(angle) * 0.48,
      ),
      0.62,
      'shell',
    );
  });

  registerPiece(uvBar, 0.66, 0.79, new THREE.Vector3(0.9, 0.7, 0.45), new THREE.Euler(0.8, -0.4, 0.65), 0.2, 'optic');
  registerPiece(chinPost, 0.74, 0.86, new THREE.Vector3(-0.7, -0.8, 0.55), new THREE.Euler(-0.5, 0.55, -0.35), 0.25, 'jade');
  registerPiece(chinBowl, 0.82, 0.93, new THREE.Vector3(0.75, -0.75, 0.72), new THREE.Euler(0.55, -0.65, 0.4), 0.26, 'jade');
  registerPiece(roller, 0.9, 0.985, new THREE.Vector3(-0.6, 0.95, 0.62), new THREE.Euler(-0.65, 0.5, -0.75), 0.3, 'final');

  const lockSequence = [...assemblyPieces].sort((a, b) => a.snapAt - b.snapAt);
  lockSequence.forEach((piece, lockOrder) => {
    piece.lockOrder = lockOrder;
  });

  /* A tiny pooled lock-on system adds a local halo and a handful of sparks
     exactly where each part seats. It never touches the shared pearl/jade
     materials, so one click cannot accidentally illuminate the whole machine. */
  const lockColors = {
    structure: new THREE.Color(0xc8a7ef),
    shell: new THREE.Color(0xe4d6f6),
    optic: new THREE.Color(0x8fe4ff),
    jade: new THREE.Color(0xf5fbff),
    final: new THREE.Color(0xd7b9ff),
  };
  const lockTextureCanvas = document.createElement('canvas');
  lockTextureCanvas.width = 128;
  lockTextureCanvas.height = 128;
  const lockTextureContext = lockTextureCanvas.getContext('2d');
  const lockCore = lockTextureContext.createRadialGradient(64, 64, 0, 64, 64, 62);
  lockCore.addColorStop(0, 'rgba(255,255,255,1)');
  lockCore.addColorStop(0.12, 'rgba(255,255,255,0.9)');
  lockCore.addColorStop(0.25, 'rgba(255,255,255,0.16)');
  lockCore.addColorStop(0.44, 'rgba(255,255,255,0)');
  lockCore.addColorStop(0.62, 'rgba(255,255,255,0.58)');
  lockCore.addColorStop(0.72, 'rgba(255,255,255,0.08)');
  lockCore.addColorStop(1, 'rgba(255,255,255,0)');
  lockTextureContext.fillStyle = lockCore;
  lockTextureContext.fillRect(0, 0, 128, 128);
  const lockTexture = new THREE.CanvasTexture(lockTextureCanvas);
  lockTexture.colorSpace = THREE.SRGBColorSpace;

  const lockPulseGroup = new THREE.Group();
  lockPulseGroup.name = 'assembly-lock-pulses';
  const lockPulsePool = Array.from({ length: 10 }, () => {
    const material = new THREE.SpriteMaterial({
      map: lockTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.renderOrder = 7;
    lockPulseGroup.add(sprite);
    return { sprite, startedAt: -1000, duration: 0.45, maxScale: 0.32 };
  });
  group.add(lockPulseGroup);

  const maxBurstParticles = 96;
  const burstPositions = new Float32Array(maxBurstParticles * 3);
  const burstVelocities = new Float32Array(maxBurstParticles * 3);
  const burstBirths = new Float32Array(maxBurstParticles);
  const burstLives = new Float32Array(maxBurstParticles);
  const burstColors = new Float32Array(maxBurstParticles * 3);
  const burstSizes = new Float32Array(maxBurstParticles);
  burstBirths.fill(-1000);
  const burstGeometry = new THREE.BufferGeometry();
  const burstPositionAttribute = new THREE.BufferAttribute(burstPositions, 3);
  const burstVelocityAttribute = new THREE.BufferAttribute(burstVelocities, 3);
  const burstBirthAttribute = new THREE.BufferAttribute(burstBirths, 1);
  const burstLifeAttribute = new THREE.BufferAttribute(burstLives, 1);
  const burstColorAttribute = new THREE.BufferAttribute(burstColors, 3);
  const burstSizeAttribute = new THREE.BufferAttribute(burstSizes, 1);
  [
    burstPositionAttribute,
    burstVelocityAttribute,
    burstBirthAttribute,
    burstLifeAttribute,
    burstColorAttribute,
    burstSizeAttribute,
  ].forEach((attribute) => attribute.setUsage(THREE.DynamicDrawUsage));
  burstGeometry.setAttribute('position', burstPositionAttribute);
  burstGeometry.setAttribute('aVelocity', burstVelocityAttribute);
  burstGeometry.setAttribute('aBirth', burstBirthAttribute);
  burstGeometry.setAttribute('aLife', burstLifeAttribute);
  burstGeometry.setAttribute('aColor', burstColorAttribute);
  burstGeometry.setAttribute('aSize', burstSizeAttribute);
  const burstUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.6) },
    uIntensity: { value: 1 },
  };
  const burstMaterial = new THREE.ShaderMaterial({
    uniforms: burstUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute vec3 aVelocity;
      attribute float aBirth;
      attribute float aLife;
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float age = (uTime - aBirth) / max(aLife, 0.001);
        float activeMask = step(0.0, age) * step(age, 1.0);
        float eased = 1.0 - pow(1.0 - clamp(age, 0.0, 1.0), 2.0);
        vec3 p = position + aVelocity * eased;
        p.y += 0.018 * age * age;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(0.0, aSize * uPixelRatio * (2.2 / max(1.0, -mvPosition.z)));
        vColor = aColor;
        vAlpha = activeMask * pow(1.0 - clamp(age, 0.0, 1.0), 1.8);
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float core = 1.0 - smoothstep(0.04, 0.48, d);
        float halo = 1.0 - smoothstep(0.2, 0.5, d);
        float alpha = (core * 0.8 + halo * 0.32) * vAlpha * uIntensity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor * 1.8, alpha);
      }
    `,
  });
  const lockBursts = new THREE.Points(burstGeometry, burstMaterial);
  lockBursts.name = 'assembly-lock-sparks';
  lockBursts.frustumCulled = false;
  lockBursts.renderOrder = 8;
  group.add(lockBursts);

  let lockPulseCursor = 0;
  let burstCursor = 0;
  let burstDensity = 7;
  let tierEffectScale = 1;
  const seededUnit = (seed) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  const triggerAssemblyFeedback = (piece, t) => {
    const color = lockColors[piece.kind] || lockColors.shell;
    const pulse = lockPulsePool[lockPulseCursor++ % lockPulsePool.length];
    pulse.startedAt = t;
    pulse.intensity = piece.kind === 'final' ? Math.min(1, tierEffectScale + 0.18) : tierEffectScale;
    pulse.duration = piece.kind === 'final' ? 0.66 : piece.kind === 'structure' ? 0.5 : 0.42;
    pulse.maxScale = (piece.kind === 'final' ? 0.5 : piece.kind === 'structure' ? 0.38 : 0.29)
      * (0.72 + tierEffectScale * 0.28);
    pulse.sprite.position.copy(piece.snapPosition);
    pulse.sprite.material.color.copy(color);
    pulse.sprite.material.opacity = 0.9 * pulse.intensity;
    pulse.sprite.scale.setScalar(0.055);
    pulse.sprite.visible = true;

    const outward = piece.snapPosition.clone();
    if (outward.lengthSq() < 0.01) outward.set(0, 0, 1);
    outward.normalize();
    const count = piece.kind === 'final' ? Math.min(10, burstDensity + 3) : burstDensity;
    for (let i = 0; i < count; i++) {
      const slot = burstCursor++ % maxBurstParticles;
      const i3 = slot * 3;
      const seed = (piece.lockOrder + 1) * 19.17 + i * 7.31;
      const theta = seededUnit(seed) * Math.PI * 2;
      const z = seededUnit(seed + 4.7) * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - z * z));
      const scatter = new THREE.Vector3(Math.cos(theta) * radial, Math.sin(theta) * radial, z)
        .addScaledVector(outward, 1.25)
        .normalize();
      const distance = 0.055 + seededUnit(seed + 9.1) * (piece.kind === 'final' ? 0.2 : 0.13);
      burstPositions[i3] = piece.snapPosition.x;
      burstPositions[i3 + 1] = piece.snapPosition.y;
      burstPositions[i3 + 2] = piece.snapPosition.z;
      burstVelocities[i3] = scatter.x * distance;
      burstVelocities[i3 + 1] = scatter.y * distance;
      burstVelocities[i3 + 2] = scatter.z * distance;
      burstBirths[slot] = t + i * 0.006;
      burstLives[slot] = 0.28 + seededUnit(seed + 2.6) * (piece.kind === 'final' ? 0.28 : 0.18);
      burstColors[i3] = color.r;
      burstColors[i3 + 1] = color.g;
      burstColors[i3 + 2] = color.b;
      burstSizes[slot] = 3.2 + seededUnit(seed + 1.8) * (piece.kind === 'final' ? 4.8 : 3.1);
    }
    burstPositionAttribute.needsUpdate = true;
    burstVelocityAttribute.needsUpdate = true;
    burstBirthAttribute.needsUpdate = true;
    burstLifeAttribute.needsUpdate = true;
    burstColorAttribute.needsUpdate = true;
    burstSizeAttribute.needsUpdate = true;
  };
  const updateAssemblyFeedback = (t, motion) => {
    burstUniforms.uTime.value = t;
    lockBursts.visible = motion;
    lockPulseGroup.visible = motion;
    for (const pulse of lockPulsePool) {
      if (!motion || !pulse.sprite.visible) {
        pulse.sprite.visible = false;
        continue;
      }
      const age = (t - pulse.startedAt) / pulse.duration;
      if (age >= 1) {
        pulse.sprite.visible = false;
        continue;
      }
      const phase = clamp01(age);
      const expansion = 1 - Math.pow(1 - phase, 3);
      pulse.sprite.scale.setScalar(0.055 + pulse.maxScale * expansion);
      pulse.sprite.material.opacity = Math.sin(phase * Math.PI) * (1 - phase * 0.34) * pulse.intensity;
    }
  };
  const cancelAssemblyFeedback = () => {
    for (const pulse of lockPulsePool) {
      pulse.startedAt = -1000;
      pulse.sprite.visible = false;
      pulse.sprite.material.opacity = 0;
    }
    burstBirths.fill(-1000);
    burstBirthAttribute.needsUpdate = true;
  };

  // A single instanced draw call supplies the small digital fragments that
  // bridge the gaps between the large construction panels.
  const maxShards = 280;
  const shardTargets = new Float32Array(maxShards * 3);
  const shardScatter = new Float32Array(maxShards * 3);
  const shardPhase = new Float32Array(maxShards);
  const shardSpin = new Float32Array(maxShards * 3);
  const shellPositions = shellGeometry.getAttribute('position');
  const random = seededRandom(0x51a7c2);
  for (let i = 0; i < maxShards; i++) {
    const vertex = Math.floor(random() * shellPositions.count);
    const x = shellPositions.getX(vertex);
    const y = shellPositions.getY(vertex);
    const z = shellPositions.getZ(vertex);
    const angle = random() * Math.PI * 2;
    const distance = 0.65 + random() * 1.85;
    shardTargets[i * 3] = x;
    shardTargets[i * 3 + 1] = y;
    shardTargets[i * 3 + 2] = z;
    shardScatter[i * 3] = x + Math.cos(angle) * distance;
    shardScatter[i * 3 + 1] = y + Math.sin(angle) * distance * 0.8;
    shardScatter[i * 3 + 2] = z + (random() - 0.5) * 2.7;
    shardPhase[i] = random();
    shardSpin[i * 3] = random() * Math.PI * 2;
    shardSpin[i * 3 + 1] = random() * Math.PI * 2;
    shardSpin[i * 3 + 2] = random() * Math.PI * 2;
  }

  const shardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.76,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const shards = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.0115, 0),
    shardMaterial,
    maxShards,
  );
  shards.name = 'assembly-fragments';
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;
  const shardPalette = [
    new THREE.Color(0xcda9f0),
    new THREE.Color(0x8fe4ff),
    new THREE.Color(0xf4f2ef),
  ];
  for (let i = 0; i < maxShards; i++) {
    const phase = shardPhase[i];
    shards.setColorAt(i, phase < 0.64 ? shardPalette[0] : phase < 0.86 ? shardPalette[1] : shardPalette[2]);
  }
  shards.instanceColor.needsUpdate = true;
  group.add(shards);

  const shardDummy = new THREE.Object3D();
  const shardCounts = { HIGH: 280, MID: 170, LOW: 84 };
  let activeShardCount = shardCounts.HIGH;

  const updateAssembly = (progress, t, motion = true) => {
    const p = clamp01(progress);
    const useCanonicalShell = p >= 0.997;
    shell.visible = useCanonicalShell;
    shellSectors.visible = !useCanonicalShell;

    for (const piece of assemblyPieces) {
      const raw = clamp01((p - piece.start) / Math.max(0.001, piece.end - piece.start));
      const eased = easeOutBack(raw);
      const reveal = clamp01(raw / 0.12);
      const revealEase = reveal * reveal * (3 - 2 * reveal);
      piece.object.visible = raw > 0.0001;
      piece.object.position.lerpVectors(piece.scatterPosition, piece.homePosition, eased);
      piece.object.quaternion.slerpQuaternions(piece.scatterQuaternion, piece.homeQuaternion, clamp01(eased));
      const scale = (piece.startScale + (1 - piece.startScale) * eased) * revealEase;
      piece.object.scale.set(
        piece.homeScale.x * scale,
        piece.homeScale.y * scale,
        piece.homeScale.z * scale,
      );
    }

    const powerUp = clamp01((p - 0.84) / 0.14);
    scanBeam.visible = powerUp > 0.01;
    pupil.visible = powerUp > 0.01;

    shards.count = activeShardCount;
    shards.visible = motion && p < 0.985;
    if (shards.visible) {
      const travelFade = 1 - clamp01((p - 0.7) / 0.285);
      shardMaterial.opacity = (0.14 + travelFade * 0.62) * tierEffectScale;
      for (let i = 0; i < activeShardCount; i++) {
        const phase = shardPhase[i];
        const local = clamp01((p - phase * 0.56) / 0.34);
        const eased = local * local * (3 - 2 * local);
        const curve = Math.sin(local * Math.PI) * (0.12 + phase * 0.12);
        const ix = i * 3;
        shardDummy.position.set(
          THREE.MathUtils.lerp(shardScatter[ix], shardTargets[ix], eased) + Math.sin(t * 0.8 + phase * 9) * curve,
          THREE.MathUtils.lerp(shardScatter[ix + 1], shardTargets[ix + 1], eased) + Math.cos(t * 0.65 + phase * 7) * curve,
          THREE.MathUtils.lerp(shardScatter[ix + 2], shardTargets[ix + 2], eased) + Math.sin(t * 0.5 + phase * 11) * curve * 0.7,
        );
        shardDummy.rotation.set(
          shardSpin[ix] + t * (0.2 + phase) * (1 - eased),
          shardSpin[ix + 1] - t * (0.16 + phase * 0.7) * (1 - eased),
          shardSpin[ix + 2] + t * 0.12 * (1 - eased),
        );
        const shardScale = (0.48 + phase * 0.62) * (0.32 + (1 - eased) * 0.76) * travelFade;
        shardDummy.scale.setScalar(Math.max(0.001, shardScale));
        shardDummy.updateMatrix();
        shards.setMatrixAt(i, shardDummy.matrix);
      }
      shards.instanceMatrix.needsUpdate = true;
    }

    return powerUp;
  };

  updateAssembly(1, 0, false);

  return {
    group,
    anchors,
    assembly: {
      setProgress: updateAssembly,
      shards,
      pieces: lockSequence,
      feedback: {
        trigger: triggerAssemblyFeedback,
        cancel: cancelAssemblyFeedback,
        pulses: lockPulseGroup,
        sparks: lockBursts,
      },
    },
    mats: { pearl, voidBlack, jade, visHaloMat, polHaloMat, uvBarMat },
    lights: { visLight, polLight, uvLight, rim, rimTarget, fill, backGlow },
    /* per-frame life: the machine idles like it's quietly scanning */
    animate(t, assemblyProgress = 1, motion = true) {
      const powerUp = updateAssembly(assemblyProgress, t, motion);
      updateAssemblyFeedback(t, motion);
      const cycle = (t % 5.6) / 5.6;
      let sweep = 0;
      if (cycle < 0.42) sweep = cycle / 0.42;
      else if (cycle < 0.5) sweep = 1;
      else if (cycle < 0.92) sweep = 1 - (cycle - 0.5) / 0.42;
      const eased = sweep * sweep * (3 - 2 * sweep);
      scanBeam.position.y = -0.52 + eased * 1.04;
      scanMat.emissiveIntensity = (cycle < 0.92 ? 1.9 : 0) * powerUp;
      pupilMat.emissiveIntensity = (motion
        ? 0.85 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6))
        : 1.05) * powerUp;
    },
    setTier(tier) {
      // LOW: kill refraction + iridescence (biggest shader cost), MID/HIGH: full pearl
      if (tier === 'LOW') {
        jade.transmission = 0; jade.thickness = 0;
        pearl.iridescence = 0;
      } else {
        jade.transmission = 0.5; jade.thickness = 0.7;
        pearl.iridescence = 0.5;
      }
      jade.needsUpdate = true;
      pearl.needsUpdate = true;
      activeShardCount = shardCounts[tier];
      shards.count = activeShardCount;
      burstDensity = tier === 'HIGH' ? 7 : tier === 'MID' ? 5 : 3;
      tierEffectScale = tier === 'HIGH' ? 1 : tier === 'MID' ? 0.72 : 0.5;
      burstUniforms.uIntensity.value = tierEffectScale;
      burstUniforms.uPixelRatio.value = tier === 'LOW'
        ? Math.min(window.devicePixelRatio || 1, 1.15)
        : Math.min(window.devicePixelRatio || 1, tier === 'HIGH' ? 1.6 : 1.5);
    },
  };
}
