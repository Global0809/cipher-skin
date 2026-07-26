// ═══════════════════════════════════════════════════
// cipher.skin — DOM layer: loader, chrome, form, callouts
// ═══════════════════════════════════════════════════

const WA_NUMBER = '918448506089';
const EMAIL = 'cipher.skin@gmail.com';

export function initLoader({ onBegin }) {
  const fill = document.getElementById('loader-fill');
  const status = document.getElementById('loader-status');
  const btn = document.getElementById('begin-btn');
  const loader = document.getElementById('loader');

  const stages = [
    [12, 'CALIBRATING OPTICS'],
    [34, 'POLISHING PEARL CLEARCOAT'],
    [58, 'SEALING LIGHT CAVITY'],
    [82, 'CHARGING 365NM EMITTERS'],
    [100, 'DIAGNOSTIC ENVIRONMENT READY'],
  ];
  let stage = 0;
  const tick = setInterval(() => {
    if (stage >= stages.length) { clearInterval(tick); return; }
    const [pct, label] = stages[stage++];
    fill.style.width = pct + '%';
    status.textContent = label;
    if (pct === 100) { btn.disabled = false; btn.classList.add('is-ready'); }
  }, 420);

  btn.addEventListener('click', () => {
    loader.classList.add('is-done');
    if (window.gsap) {
      gsap.to(loader, { opacity: 0, duration: 1.1, ease: 'power2.inOut', onComplete: () => loader.remove() });
    } else {
      loader.remove();
    }
    document.body.classList.remove('is-locked');
    document.body.classList.add('is-live');
    onBegin();
  }, { once: true });
}

export function initSoundToggle(audio) {
  const btn = document.getElementById('sound-toggle');
  const sync = () => btn.setAttribute('aria-pressed', String(!audio.muted));
  sync();
  btn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    sync();
    if (!audio.muted) audio.blip();
  });
}

export function initMicroSounds(audio) {
  document.querySelectorAll('a.chrome-cta, .submit-btn, .begin-btn, .foot-links a').forEach((el) => {
    el.addEventListener('mouseenter', () => audio.blip());
  });
}

export function initForm(audio) {
  const form = document.getElementById('lead-form');
  const fields = ['f-name', 'f-brand', 'f-locations', 'f-contact'].map((id) => document.getElementById(id));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    fields.forEach((f) => {
      const bad = !f.value || !f.value.trim();
      f.classList.toggle('is-error', bad);
      if (bad) ok = false;
    });
    if (!ok) return;

    const [name, brand, locations, contact] = fields.map((f) => f.value.trim());
    const msg =
      `Hello cipher.skin — I'd like to secure a Clarisse Mark II demo unit.\n\n` +
      `Name: ${name}\nSalon brand: ${brand}\nLocations: ${locations}\nContact: ${contact}`;
    audio.thud();
    const btn = form.querySelector('.submit-btn span');
    btn.textContent = 'OPENING WHATSAPP…';
    setTimeout(() => { btn.textContent = 'SECURE A DEMO UNIT'; }, 3200);
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  fields.forEach((f) => f.addEventListener('input', () => f.classList.remove('is-error')));

  // Keep the mailto in sync with a helpful body
  const alt = document.querySelector('.form-alt a');
  alt.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Demo Unit Request — Clarisse Mark II')}` +
    `&body=${encodeURIComponent('Hello cipher.skin,\n\nI would like to secure a Clarisse Mark II demo unit for my salon chain.\n\nName:\nSalon brand:\nLocations:\nPhone:\n')}`;
}

/* ── 3D-anchored callouts (hygiene section) ──
   Returns an updater the render loop calls each frame. Zero per-frame allocations. */
export function makeCalloutUpdater(camera, anchors) {
  const els = {
    chin: document.getElementById('co-chin'),
    forehead: document.getElementById('co-forehead'),
    cavity: document.getElementById('co-cavity'),
  };
  els.forehead.classList.add('flip');
  const KEYS = Object.keys(els);
  const scratch = anchors.chin.position.clone(); // reusable Vector3
  let visible = 0;   // driven by cinema.js (0..1)
  let wasHidden = false;

  const update = () => {
    if (visible === 0) {
      if (!wasHidden) {
        for (const key of KEYS) els[key].style.opacity = 0;
        wasHidden = true;
      }
      return;
    }
    wasHidden = false;
    const w = window.innerWidth, h = window.innerHeight;
    for (const key of KEYS) {
      const el = els[key];
      anchors[key].getWorldPosition(scratch);
      scratch.project(camera);
      const behind = scratch.z > 1;
      const x = (scratch.x * 0.5 + 0.5) * w;
      const y = (-scratch.y * 0.5 + 0.5) * h;
      const off = behind || x < 0 || x > w || y < 0 || y > h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = off ? 0 : visible;
    }
  };
  update.setVisible = (o) => { visible = o; };
  return update;
}

/* ── trailing focus-frame cursor (desktop only) ── */
export function initCursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const c = document.getElementById('cursor');
  if (!c || !window.gsap) return;
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    c.classList.add('is-on');
  }, { passive: true });
  const hoverables = 'a, button, input, select, .mode, .stat';
  document.addEventListener('pointerover', (e) => {
    c.classList.toggle('is-hover', !!(e.target.closest && e.target.closest(hoverables)));
  });
  gsap.ticker.add(() => {
    x += (tx - x) * 0.2;
    y += (ty - y) * 0.2;
    c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  });
}

/* ── magnetic pull on primary CTAs (desktop only) ── */
export function initMagnetic() {
  if (!matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('.chrome-cta, .submit-btn, .begin-btn').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${(dx * 0.12).toFixed(1)}px, ${(dy * 0.22).toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ── live scan counter on the dashboard ── */
export function initScanFeed() {
  const el = document.getElementById('scan-count');
  if (!el) return;
  let n = 847;
  setInterval(() => {
    n += 1 + Math.floor(Math.random() * 3);
    el.textContent = String(n).padStart(4, '0');
  }, 4200);
}

/* ── smooth in-page anchors: instant jumps corrupt scrubbed timelines ── */
export function initAnchors() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });
  });
}

/* rail progress + section index */
export function initRail() {
  const fillEl = document.getElementById('rail-fill');
  const current = document.getElementById('rail-current');
  const sections = [...document.querySelectorAll('.section')];

  const onScroll = () => {
    const doc = document.documentElement;
    const p = doc.scrollTop / (doc.scrollHeight - doc.clientHeight);
    fillEl.style.height = (p * 100).toFixed(2) + '%';
    const mid = doc.scrollTop + window.innerHeight * 0.5;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (mid >= sections[i].offsetTop) {
        current.textContent = sections[i].dataset.index;
        break;
      }
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
