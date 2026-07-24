# cipher.skin — Clarisse Mark II

Launch website for the **Clarisse Mark II** AI skin-diagnostic capsule — a fully 3D, scroll-cinematic experience built for premium salon-chain buyers.

**Live:** deployed on GitHub Pages (static, no build step, no external CDNs).

## Stack

- **Three.js 0.185** (vendored) — procedural digital twin of the machine: swept stadium-oval pearl monocoque, musou-black cavity, jade bio-interfaces, VIS/POL/UV emissive lighting rig, UnrealBloom + SMAA + depth-of-field post pipeline with adaptive quality tiers (desktop → mobile).
- **GSAP 3 + ScrollTrigger** (vendored) — one continuous camera performance scrubbed by scroll, six cinematic beats, section snapping.
- **Procedural WebAudio** — zero-asset luxury soundscape (ambient hum, magnetic thuds, light-mode whooshes). Starts after first interaction; mute toggle persists.
- **No framework, no build step** — open `index.html` over any static server.

## Run locally

Any static file server works, e.g.:

```
npx serve .
```

(ES modules require http:// — opening the file directly with file:// will not work.)

## Structure

```
index.html        six sections: Hero / Industrial Design / Hygiene / Tri-Spectral / Revenue / Partnership
css/style.css     clinical-luxury design system (Space Grotesk · Manrope · JetBrains Mono, all local)
js/main.js        renderer boot, post pipeline, adaptive quality, render loop
js/capsule.js     the Clarisse Mark II digital twin (procedural geometry + PBR materials)
js/cinema.js      scroll choreography: camera, light ignition, dashboards, snap
js/audio.js       procedural sound engine
js/ui.js          loader, callouts, lead form (WhatsApp + email), rail
vendor/           three.js + GSAP, pinned and vendored
fonts/            woff2, self-hosted
assets/           logo, favicon, social card
```

## Custom domain later

GitHub Pages → repository **Settings → Pages → Custom domain**, then point a `CNAME` DNS record at `<user>.github.io`. All asset paths are relative, so the site works unchanged under any domain or subpath.

## Lead routing

The "Secure a Demo Unit" form opens WhatsApp (+91 84485 06089) with a pre-filled message; email fallback `cipher.skin@gmail.com`. Change both in `js/ui.js` (`WA_NUMBER`, `EMAIL`).
