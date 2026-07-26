// ===================================================
// cipher.skin — scroll cinematography
// One continuous camera performance, scrubbed by scroll.
// ===================================================

export function initCinematography({ state, capsule, audio, calloutUpdate, bloomPass, isCoarse = false }) {
  const { lights, mats } = capsule;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = isCoarse || window.matchMedia('(max-width: 900px)').matches;
  const bloomBase = compact ? 0.32 : 0.5;
  const bloomUV = compact ? 0.72 : 1.05;
  const scrub = reduced ? true : 0.9;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true }); // URL-bar collapse must not refresh everything

  const scrubTLs = []; // creation order = section order; used for the pre-init pass below
  const sectionTLs = [];
  const addSectionTimeline = (timeline) => {
    scrubTLs.push(timeline);
    sectionTLs.push(timeline);
    return timeline;
  };

  const modeEls = {
    vis: document.getElementById('mode-vis'),
    pol: document.getElementById('mode-pol'),
    uv: document.getElementById('mode-uv'),
  };
  const setMode = (key) => {
    for (const k of Object.keys(modeEls)) modeEls[k].classList.toggle('is-active', k === key);
    if (key === 'uv') document.body.classList.add('uv-active');
    else document.body.classList.remove('uv-active');
  };

  /* -- generic copy fade for sticky sections (hero handled by its own timeline) -- */
  ['#design', '#hygiene', '#optics', '#revenue'].forEach((sel) => {
    const copy = document.querySelector(`${sel} .copy`);
    if (!copy) return;
    scrubTLs.push(gsap.timeline({
      scrollTrigger: { trigger: sel, start: 'top top', end: 'bottom bottom', scrub },
    })
      .fromTo(copy, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out' }, 0.02)
      .to(copy, { opacity: 0, y: -26, duration: 0.12, ease: 'power2.in' }, 0.86));
  });

  /* ========== 1 - HERO: macro reveal + rim sweep ========== */
  const heroCopy = document.querySelector('#hero .copy');
  const applyHeroCopyFromProgress = (progress) => {
    const raw = Math.max(0, Math.min(1, (progress - 0.48) / 0.17));
    const eased = raw * raw * (3 - 2 * raw);
    gsap.set(heroCopy, { opacity: 1 - eased, y: -30 * eased });
  };
  addSectionTimeline(gsap.timeline({
    scrollTrigger: {
      trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub,
      onUpdate(st) { applyHeroCopyFromProgress(st.progress); },
      onLeave() { applyHeroCopyFromProgress(1); },
      onLeaveBack() { applyHeroCopyFromProgress(0); },
    },
  })
    .to(state, {
      assembly: 1,
      fieldEnergy: 0.68,
      fieldViolet: 0.86,
      fieldCyan: 0.42,
      fieldGrid: 0.78,
      ease: 'none',
      duration: 0.88,
    }, 0.04)
    .to(state, { fieldEnergy: 0.36, fieldGrid: 0.28, duration: 0.08, ease: 'power1.out' }, 0.92)
    .to(state, { px: 0, py: 0.05, pz: 4.35, tx: 0, ty: 0, tz: 0, ease: 'power1.inOut', duration: 1 }, 0)
    .to(state, { rotY: -0.12, ease: 'power1.inOut', duration: 1 }, 0)
    .fromTo(lights.rim, { intensity: 1.3 }, { intensity: 1.9, duration: 0.5, ease: 'sine.inOut' }, 0)
    .to(lights.rim.position, { x: -2.6, y: 1.3, duration: 1, ease: 'sine.inOut' }, 0)
    .to('.scroll-cue', { opacity: 0, duration: 0.1 }, 0.06));

  /* ========== 2 - INDUSTRIAL DESIGN: pirouette to the seamless monocoque ========== */
  addSectionTimeline(gsap.timeline({ scrollTrigger: { trigger: '#design', start: 'top bottom', end: 'bottom bottom', scrub } })
    .to(state, { px: 3.15, py: 1.2, pz: 2.2, tx: 0, ty: 0, tz: 0, ease: 'power1.inOut', duration: 1 }, 0)
    // Front three-quarter beauty pose, one brief rear inspection, then back to the useful face.
    .to(state, { rotY: -0.55, ease: 'power1.inOut', duration: 0.46 }, 0)
    .to(state, { rotY: -2.82, ease: 'power2.inOut', duration: 0.12 }, 0.46)
    .to(state, { rotY: -0.35, ease: 'power2.inOut', duration: 0.12 }, 0.61)
    .to(state, {
      fieldEnergy: 0.32, fieldViolet: 0.74, fieldCyan: 0.2, fieldGrid: 0.24,
      ease: 'power1.inOut', duration: 1,
    }, 0)
    .to(lights.rim.position, { x: -2.0, y: 2.1, z: -2.0, duration: 1, ease: 'sine.inOut' }, 0)
    .to(lights.rim, { intensity: 1.1, duration: 0.4 }, 0.2)
    .to(lights.backGlow, { intensity: 1.15, duration: 0.08, ease: 'power2.out' }, 0.51)
    .to(lights.backGlow, { intensity: 0.12, duration: 0.12, ease: 'power2.in' }, 0.61));

  /* ========== 3 - HYGIENE: glide to the jade bio-interfaces ========== */
  addSectionTimeline(gsap.timeline({
    scrollTrigger: {
      trigger: '#hygiene', start: 'top bottom', end: 'bottom bottom', scrub,
      onUpdate(st) {
        const p = st.progress;
        const vis = p > 0.32 && p < 0.9 ? Math.min(1, (p - 0.32) / 0.08) * Math.min(1, (0.9 - p) / 0.06) : 0;
        calloutUpdate.setVisible(Math.max(0, Math.min(1, vis)));
      },
    },
  })
    .to(state, { px: 0.72, py: -0.1, pz: 1.5, tx: -0.1, ty: -0.52, tz: 0.22, ease: 'power1.inOut', duration: 1 }, 0)
    .to(state, { rotY: 0.3, ease: 'power2.out', duration: 0.2 }, 0)
    .to(state, {
      fieldEnergy: 0.5, fieldViolet: 0.34, fieldCyan: 0.82, fieldGrid: 0.62,
      ease: 'power1.inOut', duration: 1,
    }, 0)
    .to(lights.visLight, { intensity: 0.32, duration: 0.4 }, 0.35)   // soft glow to see the jade
    .to(lights.rim, { intensity: 0.55, duration: 0.5 }, 0));

  /* ========== 4 - TRI-SPECTRAL: the ignition sequence ==========
     Mode cards / tint / sounds are driven from progress (direction-aware),
     never from timeline .call() — those misfire on reverse scrubs. */
  let modeKey = null;
  const applyModeFromProgress = (p, direction) => {
    const key = p < 0.28 ? null : p < 0.52 ? 'vis' : p < 0.74 ? 'pol' : 'uv';
    if (key === modeKey) return;
    modeKey = key;
    setMode(key);
    if (!reduced && direction > 0 && key) {
      if (key === 'uv') audio.uvShimmer();
      else { audio.whoosh(); audio.shutter(); }
    }
  };

  const opticsTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: '#optics', start: 'top bottom', end: 'bottom bottom', scrub,
      onUpdate(st) {
        if (st.isActive) applyModeFromProgress(st.progress, st.direction);
        else { modeKey = null; setMode(null); }
      },
      onLeave() { modeKey = null; setMode(null); },
      onLeaveBack() { modeKey = null; setMode(null); },
    },
  })
    // settle to a frontal, reverent view while the world goes dark
    .to(state, { px: 0, py: 0, pz: 2.4, tx: 0, ty: 0, tz: -0.1, ease: 'power1.inOut', duration: 0.22 }, 0)
    .to(state, { rotY: 0, ease: 'power1.inOut', duration: 0.22 }, 0)
    .to(lights.rim, { intensity: 0.12, duration: 0.18 }, 0.02)
    .to(lights.fill, { intensity: 0.03, duration: 0.18 }, 0.02)
    .to(state, { env: 0.1, duration: 0.2, ease: 'power1.inOut' }, 0.02)
    .to(state, {
      fieldEnergy: 0.16, fieldViolet: 0.26, fieldCyan: 0.12, fieldGrid: 0.14,
      duration: 0.2, ease: 'power1.inOut',
    }, 0.02)
    .to(lights.visLight, { intensity: 0, duration: 0.1 }, 0)
    // -- VIS --
    .to(mats.visHaloMat, { emissiveIntensity: 3.4, duration: 0.05, ease: 'power3.out' }, 0.3)
    .to(lights.visLight, { intensity: 1.4, duration: 0.05 }, 0.3)
    .to(state, {
      fieldEnergy: 0.46, fieldViolet: 0.2, fieldCyan: 0.42, fieldGrid: 0.58,
      duration: 0.08, ease: 'power2.out',
    }, 0.3)
    // -- POL --
    .to(mats.visHaloMat, { emissiveIntensity: 0.55, duration: 0.05 }, 0.52)
    .to(lights.visLight, { intensity: 0.3, duration: 0.05 }, 0.52)
    .to(mats.polHaloMat, { emissiveIntensity: 3.4, duration: 0.05, ease: 'power3.out' }, 0.52)
    .to(lights.polLight, { intensity: 1.5, duration: 0.05 }, 0.52)
    .to(state, {
      fieldEnergy: 0.58, fieldViolet: 0.28, fieldCyan: 0.88, fieldGrid: 0.74,
      duration: 0.08, ease: 'power2.out',
    }, 0.52)
    // -- UV 365nm --
    .to(mats.polHaloMat, { emissiveIntensity: 0.4, duration: 0.05 }, 0.74)
    .to(lights.polLight, { intensity: 0.2, duration: 0.05 }, 0.74)
    .to(mats.uvBarMat, { emissiveIntensity: 4.6, duration: 0.06, ease: 'power3.out' }, 0.74)
    .to(lights.uvLight, { intensity: 2.6, duration: 0.06 }, 0.74)
    .to(bloomPass, { strength: bloomUV, duration: 0.1 }, 0.74)
    .to(state, {
      fieldEnergy: 0.96, fieldViolet: 1, fieldCyan: 0.18, fieldGrid: 0.88,
      duration: 0.1, ease: 'power2.out',
    }, 0.74)
    .to(state, { pz: 2.15, duration: 0.24, ease: 'power1.inOut' }, 0.74);
  addSectionTimeline(opticsTimeline);

  /* ========== 5 - REVENUE: pivot to the dashboard ========== */
  const dashLive = () => {
    const dash = document.querySelector('.dash');
    if (!dash) return;
    dash.classList.add('is-live');
    const el = document.getElementById('score-num');
    const num = { v: 0 };
    gsap.to(num, { v: 78, duration: 1.4, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(num.v); } });
  };

  addSectionTimeline(gsap.timeline({ scrollTrigger: { trigger: '#revenue', start: 'top bottom', end: 'bottom bottom', scrub } })
    .to(state, { px: -0.35, py: 0.12, pz: 3.4, tx: -0.45, ty: 0, tz: 0, ease: 'power1.inOut', duration: 1 }, 0)
    .to(state, { rotY: -0.9, grpX: -0.62, ease: 'power1.inOut', duration: 1 }, 0)
    .to(state, {
      fieldEnergy: 0.64, fieldViolet: 0.72, fieldCyan: 0.7, fieldGrid: 0.82,
      ease: 'power1.inOut', duration: 1,
    }, 0)
    .to(mats.uvBarMat, { emissiveIntensity: 0, duration: 0.2 }, 0)
    .to(lights.uvLight, { intensity: 0, duration: 0.2 }, 0)
    .to(mats.visHaloMat, { emissiveIntensity: 1.3, duration: 0.3 }, 0.1)
    .to(lights.visLight, { intensity: 1.1, duration: 0.3 }, 0.1)
    .to(state, { env: 0.55, duration: 0.3, ease: 'power1.inOut' }, 0.1)
    .to(lights.backGlow, { intensity: 2.4, duration: 0.4 }, 0.1)
    .to(lights.rim, { intensity: 0.85, duration: 0.4 }, 0.1)
    .to(bloomPass, { strength: bloomBase, duration: 0.15 }, 0.05)
    .call(dashLive, null, 0.32)
    .fromTo('.dash', { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.3)
    .fromTo('#ring-fg', { strokeDashoffset: 327 }, { strokeDashoffset: 327 * (1 - 0.78), duration: 0.25, ease: 'power2.inOut' }, 0.36)
    .to('.dash', { opacity: 0, y: -30, duration: 0.12, ease: 'power2.in' }, 0.88));

  /* ========== 6 - PARTNERSHIP: steady, inviting glow ========== */
  addSectionTimeline(gsap.timeline({ scrollTrigger: { trigger: '#partner', start: 'top bottom', end: 'top 20%', scrub } })
    .to(state, { px: 0, py: 0.85, pz: 5.7, tx: 0, ty: 0.42, tz: 0, ease: 'power1.inOut', duration: 1 }, 0)
    .to(state, { rotY: -0.05, grpX: 0, env: 0.28, ease: 'power1.inOut', duration: 1 }, 0)
    .to(state, {
      fieldEnergy: 0.42, fieldViolet: 0.52, fieldCyan: 0.66, fieldGrid: 0.38,
      ease: 'power1.inOut', duration: 1,
    }, 0)
    .to(lights.backGlow, { intensity: 2.4, duration: 0.6 }, 0.2)
    .to(lights.backGlow.color, { r: 0.35, g: 0.75, b: 1.0, duration: 0.6 }, 0.2)
    .to(lights.rim, { intensity: 0.32, duration: 0.6 }, 0.2)
    .to(mats.visHaloMat, { emissiveIntensity: 1.2, duration: 0.6 }, 0.2));

  gsap.from('.founders, .lead-form', {
    scrollTrigger: { trigger: '#partner', start: 'top 55%' },
    opacity: 0, y: 40, duration: 1.1, stagger: 0.12, ease: 'power3.out',
  });

  /* -- pre-initialize every scrubbed timeline in section order --
     .to() tweens lazily capture start values on first render; without this pass,
     an anchor jump (header CTA -> #partner) initializes them out of order and
     permanently corrupts the camera path. Forward then reverse locks the chain. */
  ScrollTrigger.refresh();
  scrubTLs.forEach((tl) => tl.progress(1, true));
  for (let i = scrubTLs.length - 1; i >= 0; i--) scrubTLs[i].progress(0, true);

  /* -- catch-up arbiter --
     On a fast multi-section jump (scrollbar drag, PageDown spam), the scrub
     catch-up tweens of ALREADY-LEFT sections keep animating and their final
     renders overwrite the active section's camera state. Complete stale
     catch-ups instantly so the active section is always the last writer. */
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate() {
      for (const tl of sectionTLs) {
        const st = tl.scrollTrigger;
        if (st && !st.isActive) {
          const tw = st.getTween && st.getTween();
          if (tw && tw.isActive()) tw.progress(1);
        }
      }
    },
  });

  /* direct loads at a #hash land mid-page: render the chain up to that point in order */
  if (window.scrollY > 4) {
    [...ScrollTrigger.getAll()]
      .filter((s) => s.animation)
      .sort((a, b) => a.start - b.start)
      .forEach((s) => s.animation.progress(s.progress, true));
  }
  const opticsST = opticsTimeline.scrollTrigger;
  if (opticsST && opticsST.isActive) applyModeFromProgress(opticsST.progress, 0);
  else { modeKey = null; setMode(null); }

  /* -- section-boundary snap with magnetic thud --
     radius is viewport-relative: a fraction of total page scroll punishes
     gentle phone swipes by yanking them back to the boundary they left. */
  if (!reduced) {
    const doc = document.documentElement;
    let bounds = [];
    let radius = 0.02;
    const measure = () => {
      const max = doc.scrollHeight - window.innerHeight;
      bounds = [...document.querySelectorAll('.section')].map((s) => s.offsetTop / max).filter((b) => b <= 1);
      radius = (window.innerHeight * 0.22) / max;
    };
    measure();
    ScrollTrigger.addEventListener('refresh', measure);
    ScrollTrigger.create({
      start: 0, end: 'max',
      snap: {
        snapTo: (value) => {
          let best = value;
          for (const b of bounds) if (Math.abs(b - value) < radius && Math.abs(b - value) < Math.abs(best - value)) best = b;
          return best;
        },
        duration: { min: 0.2, max: 0.45 },
        ease: 'power2.inOut',
        onComplete: () => audio.thud(),
      },
    });
  }

  /* -- intro performance after BEGIN -- */
  return function intro() {
    gsap.set('#hero .copy', { opacity: 1 });
    if (reduced || window.scrollY > 4) {
      gsap.set('#hero .reveal', { opacity: 1, y: 0 });
      if (reduced) gsap.set('.scroll-cue', { opacity: 0 });
      ScrollTrigger.refresh();
      return;
    }
    const tl = gsap.timeline();
    tl.from(state, { px: -2.5, py: -0.75, pz: 2.1, tx: 0.4, ty: 0.3, duration: 2.6, ease: 'power3.out' }, 0)
      .from(lights.rim, { intensity: 0, duration: 1.8, ease: 'power2.out' }, 0)
      .fromTo('#hero .reveal', { opacity: 0, y: 42 }, { opacity: 1, y: 0, duration: 1.3, stagger: 0.14, ease: 'power3.out' }, 0.7)
      .fromTo('.scroll-cue', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.9);
    // an impatient scroll must not fight the intro for the camera
    addEventListener('scroll', () => {
      if (tl.isActive()) tl.progress(1, true);
      tl.kill();
    }, { once: true, passive: true });
    ScrollTrigger.refresh();
  };
}
