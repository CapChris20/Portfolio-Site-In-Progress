# Architecture Decision Records — Portfolio Site (Folio 2025 fork)

An interactive 3D portfolio: visitors drive a vehicle around a stylized world to discover career, project and skills areas. It's built on Three.js (WebGPU renderer) with Rapier physics, bundled by Vite, and has no backend apart from an optional WebSocket server.

This project builds on **Bruno Simon's open-source [folio-2025](https://github.com/brunosimon/folio-2025)** (MIT). The engine, game-loop ordering and asset pipeline come from that codebase. This repo's own work is the customization: rebranded landing letters (`scripts/replaceLandingLetters.js`), career textures (`scripts/generateCareerTextures.js`), custom vehicles and garage, a recruiter guide (`RecruiterGuide.js`, `CareerModal.js`), new props and recolors.

These records were reconstructed from the code in this repo. No backend data or payments are involved.

---

# ADR-001: Fork an existing 3D portfolio engine instead of building one from scratch

## Context
The goal is a memorable portfolio that stands out to recruiters, shipped alongside coursework and other projects. A physics-driven 3D world from scratch takes months: renderer setup, physics integration, input, audio, a loading pipeline and quality scaling.

## Alternatives Considered
- **Build a custom Three.js scene from scratch**: Full ownership, but months of work before any portfolio content exists.
- **Conventional React/Next.js portfolio**: Fast and accessible, but it doesn't stand out.
- **Spline / no-code 3D**: Quick, but limited physics and interactivity, and it depends on a vendor runtime.

## Decision
Fork **folio-2025** (MIT) and invest effort in content and customization: custom vehicles, career and skills textures, interactive points, a recruiter guide and new props.

## Rationale
The MIT license allows reuse and modification. Starting from a production-quality engine left time for the parts that are actually about Chris.

## Tradeoffs
- **Gained:** a polished, physics-driven world on day one.
- **Cost:** recruiters who know Bruno Simon's site will recognize the base, so the custom work has to be clearly visible. `license.md` currently lists only "Chris Shina" as the copyright holder.

## What I'd Change
- **Keep the original copyright line** in `license.md` (`Copyright (c) 2025 Bruno Simon`) and add my own line for the modifications. MIT requires the original notice to be kept.
- Add a "What I built" section to the README and the in-world credits, so reviewers see the custom engineering.

## Measurement
Not applicable.

---

# ADR-002: Three.js WebGPU renderer + Rapier (WASM) physics

## Context
The world needs real vehicle physics (suspension, collisions, explosive crates) and many instanced objects (trees, flowers, fences) at 60 fps in a browser.

## Alternatives Considered
- **cannon-es**: Pure JS and simpler, but slower and less maintained than Rapier.
- **Babylon.js**: Built-in physics plugins and the editor are strong, but the upstream engine is Three.js.
- **WebGL-only renderer**: Wider device support, but loses TSL node materials and WebGPU performance.

## Decision
Use **`three/webgpu`** (falling back to WebGL2 where WebGPU isn't available) with **`@dimforge/rapier3d`** (Rust compiled to WASM). Vite plugins (`vite-plugin-wasm`, `vite-plugin-top-level-await`) load the WASM. A fixed game-loop order (inputs → player pre-physics → vehicle → physics step → objects → post-physics → view) is documented in `readme.md`.

## Rationale
Rapier's WASM solver is deterministic and fast enough for vehicle raycasts plus hundreds of colliders. The explicit loop order prevents one-frame lag between physics and camera.

## Tradeoffs
- **Gained:** smooth, stable physics, and instancing for dense foliage (`InstancedGroup.js`).
- **Cost:** a WASM payload on first load, a top-level-await build requirement, and WebGPU differences between browsers. `HeroMotorcycle.js` still creates a separate `WebGLRenderer`, which means two GPU contexts.

## What I'd Change
Render the hero motorcycle in the main WebGPU renderer (a render target or second scene) instead of a second renderer.

## Measurement
- `Quality.js` defines two quality levels (high/low) selected through `VITE_QUALITY`.
- **Not yet tracked:** fps on low-end laptops and mobile, and time to interactive.

---

# ADR-003: Static asset pipeline: Draco/KTX2 compressed GLBs + compressed variants

## Context
The world is built from many Blender-exported models and textures. Shipping the raw files would make the first load take minutes.

## Alternatives Considered
- **Ship raw GLBs**: Simple, but far too large.
- **Runtime streaming from a CDN with LOD**: Ideal, but complex.

## Decision
`npm run compress` (`scripts/compress.js`) runs `gltf-transform` (ETC1S/KTX2 textures, Draco geometry) to produce `*-compressed.glb` next to each source model, and uses `sharp` for images. `VITE_COMPRESSED` switches the game to the compressed variants. Basis and Draco decoders ship in `static/basis` and `static/draco`.

## Rationale
GPU-compressed textures (KTX2) cut both download size and VRAM, and Draco shrinks mesh data.

## Tradeoffs
- **Gained:** smaller downloads and less GPU memory.
- **Cost:** source and compressed files both live in git, so the repo is heavy. New custom props were added **without running the pipeline**.

## What I'd Change
- Run `npm run compress` on every new prop, and keep `*.source.glb` / raw Blender exports out of `static/`, since everything in `static/` gets deployed.
- Move large binaries to Git LFS.

## Measurement
- `static/` totals **≈2.8 GB** (1,066 files).
- 46 models have both versions: **205.5 MB raw → 138.4 MB compressed (−33%)**.
- **36 GLBs (~2.2 GB) have no compressed variant.** The largest are `props/pyramid.source.glb` (95 MB), `props/jesusStatue.source.glb` (94 MB), `props/Lion.glb` (93 MB), `props/Garage.glb` (93 MB), `props/Mecha.glb` (91 MB) and `props/kratos.source.glb` (90 MB). Compressing or removing these is the single biggest load-time win.

---

# ADR-004: No backend: static hosting + optional WebSocket server + localStorage

## Context
A portfolio should be cheap to host and never go down. The upstream engine supports an optional multiplayer/"whispers" server.

## Alternatives Considered
- **Always-on Node server for shared state**: Enables live features, but costs money and can go down.
- **Firebase/Supabase for shared state**: More infrastructure than a portfolio needs.

## Decision
Build a static site (`vite build` → `dist/`, deployable to Surge or any static host). `Server.js` connects to a WebSocket (msgpack-encoded) **only if `VITE_SERVER_URL` is set**, and retries every 2 s. A per-visitor UUID and achievements persist in **`localStorage`**.

## Rationale
The site works fully offline from any backend, and server features fail gracefully (`is-server-offline` class).

## Tradeoffs
- **Gained:** near-zero hosting cost and no auth or data-privacy surface.
- **Cost:** no shared features unless a server is deployed, and progress is stored per browser.

## What I'd Change
Nothing. This is the right shape for a portfolio.

## Measurement
Not applicable. `VITE_ANALYTICS_TAG` is available for page analytics.
