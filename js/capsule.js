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
  const shell = new THREE.Mesh(sweepGeometry(outer, shellProfile, 180), pearl);
  group.add(shell);

  // flush plug hides the rear dome centre sliver + sweep pinch marks
  const backCap = new THREE.Mesh(new THREE.ShapeGeometry(stadiumShape(A * 0.35, S * 0.35), 48), pearl);
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
  group.add(cavity);

  const cavityBack = new THREE.Mesh(new THREE.ShapeGeometry(stadiumShape(A2 * 0.92, S2 * 0.92), 48), voidBlack);
  cavityBack.position.z = -0.578;
  group.add(cavityBack);

  // ── Diagnostic optics on the back wall ──
  const visHalo = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.026, 20, 90), visHaloMat);
  visHalo.scale.set(1, 1.5, 1);
  visHalo.position.z = -0.54;
  group.add(visHalo);

  const polHalo = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.021, 20, 80), polHaloMat);
  polHalo.scale.set(1, 1.45, 1);
  polHalo.position.z = -0.535;
  group.add(polHalo);

  const uvBar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.016, 0.05), uvBarMat);
  uvBar.position.set(0, 0.585, -0.12);
  uvBar.rotation.x = Math.PI / 4;
  group.add(uvBar);

  // camera module
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.04), glossBlack);
  camBody.position.set(0, 0, -0.545);
  group.add(camBody);
  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 32), glossBlack);
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(0, 0, -0.52);
  group.add(camLens);
  const camGlass = new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 24), lensMat);
  camGlass.position.set(0, 0, -0.502);
  group.add(camGlass);

  // ── Cryo-magnetic jade bio-interfaces ──
  const bowlPts = [
    new THREE.Vector2(0.001, 0), new THREE.Vector2(0.07, 0.004), new THREE.Vector2(0.115, 0.018),
    new THREE.Vector2(0.143, 0.048), new THREE.Vector2(0.149, 0.082), new THREE.Vector2(0.132, 0.076),
    new THREE.Vector2(0.095, 0.05), new THREE.Vector2(0.045, 0.034), new THREE.Vector2(0.001, 0.03),
  ];
  const chinBowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 56), jade);
  chinBowl.position.set(0, -0.545, 0.30);
  group.add(chinBowl);

  const chinPost = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.22, 28), glossBlack);
  chinPost.position.set(0, -0.66, 0.30);
  group.add(chinPost);

  const roller = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.34, 12, 32), jade);
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

  const fill = new THREE.DirectionalLight(0xbfd0e8, 0.28);
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

  return {
    group,
    anchors,
    mats: { pearl, voidBlack, jade, visHaloMat, polHaloMat, uvBarMat },
    lights: { visLight, polLight, uvLight, rim, rimTarget, fill, backGlow },
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
    },
  };
}
