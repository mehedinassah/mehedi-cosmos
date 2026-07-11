# COSMOS-OS — Technical Architecture & Implementation Blueprint

**Project:** Immersive 3D Portfolio — Mehedi Hassan
**Phase:** Pre-production / Phase 1 Deliverable
**Status:** DRAFT — pending approval
**Authority hierarchy:** (1) Conversation decisions → (2) Master Prompt → (3) Future Design Bible chapters

---

## 0. Executive Summary & Contested Decisions

Before the blueprint, four architectural decisions where the Master Prompt's stated stack conflicts with the stated priority order (Performance → UX → Story → Technical excellence → Visual fidelity). These require your sign-off because they deviate from the Master Prompt.

### D1 — Content storage: static build-time modules, NOT Prisma/Supabase at runtime
The Master Prompt lists Prisma + Supabase. Portfolio content (planets, projects, skills, stations) changes at author-time, not runtime. A runtime DB adds: cold-start latency, a failure mode (DB down = empty universe), serialization cost, and hosting complexity — for zero user-facing benefit.

**Recommendation:** All world content lives in typed TypeScript/JSON content modules, validated at build time (Zod), tree-shaken and code-split per region. Supabase is retained for exactly two runtime concerns: (a) contact form submissions from the Black Hole, (b) optional anonymous exploration analytics. Prisma is dropped entirely unless a CMS phase is added later.

### D2 — Animation authority: one timeline owner, not three
GSAP + Framer Motion + Theatre.js overlap ~80%. Three animation systems fighting over the same camera/object transforms is the #1 cause of jank and unmaintainable motion code in R3F projects.

**Recommendation:**
- **GSAP** = single runtime authority for all 3D motion (camera travel, reveals, orbital choreography) via one master timeline per journey.
- **Theatre.js** = dev-only authoring tool. Sequences are authored in Theatre Studio, then exported as static JSON keyframe data consumed by a thin playback layer. Theatre core is NOT shipped in the production bundle.
- **Framer Motion** = 2D DOM overlay only (holographic HUD text fade-ins, accessibility mode). Never touches the WebGL scene graph.

### D3 — Renderer: WebGL2 primary, WebGPU as flagged enhancement — single GLSL codebase
Shipping dual GLSL + WGSL/TSL shader codebases doubles shader maintenance for a v1. Three.js's WebGPURenderer + TSL is usable but its post-processing and ecosystem (drei, pmndrs postprocessing) still lag the WebGL path.

**Recommendation:** Author all shaders in GLSL against WebGL2. WebGPU is a Phase 3+ enhancement behind a capability flag, adopted only for compute-heavy subsystems (particle simulation) where the win is measurable. This is "WebGPU if available" honored in spirit without doubling the shader pipeline.

### D4 — Accessibility: a parallel semantic layer is mandatory, not optional
A pure-WebGL site is invisible to screen readers, keyboard users, low-end devices, and users with `prefers-reduced-motion`. This is a legal/ethical floor and also an SEO floor (crawlers see nothing). The Master Prompt is silent here; the priority order (UX #2) demands it.

**Recommendation:** Every celestial object has a mirrored semantic DOM node ("Mission Log" mode — an in-fiction observatory log, so it serves Story, not just compliance). Detailed in §15.

---

## 1. Repository Structure

Single Next.js (App Router) repository. Monorepo is over-engineering for one deployable.

```
cosmos-os/
├── docs/                         # Design Bible chapters (source of truth mirrors)
│   ├── 00_MASTER_PROMPT.md
│   ├── 01_DESIGN_BIBLE.md ... 12_QA_CHECKLIST.md
│   └── adr/                      # Architecture Decision Records (D1–D4 above become ADR-001..004)
├── public/
│   ├── assets/                   # Post-pipeline runtime assets (KTX2, meshopt GLB, HDR)
│   └── fallback/                 # Static OG images, reduced-mode imagery
├── src/
│   ├── app/                      # Next.js App Router (see §2)
│   ├── content/                  # Typed world content (see §12)
│   ├── engine/                   # Renderer-agnostic core (see §3)
│   ├── world/                    # Celestial object implementations
│   ├── camera/                   # Camera system (see §5)
│   ├── navigation/               # Travel graph + input (see §6)
│   ├── shaders/                  # GLSL pipeline (see §8)
│   ├── ui/                       # 2D overlay + Mission Log
│   ├── audio/                    # Positional audio manager
│   ├── state/                    # Zustand stores (see §4)
│   ├── perf/                     # Quality manager, budgets, telemetry
│   └── lib/                      # Utilities, math, easing
├── tools/
│   ├── asset-pipeline/           # CLI: gltf-transform, KTX2 encode, validation
│   ├── theatre-export/           # Theatre.js JSON → runtime keyframe format
│   └── content-validate/         # Zod validation of /src/content at build
├── tests/
│   ├── unit/                     # Math, graph, state logic (Vitest)
│   ├── visual/                   # Screenshot regression per region (Playwright)
│   └── perf/                     # Automated FPS/memory budget CI checks
└── .github/workflows/            # CI: typecheck, content-validate, perf budget, deploy
```

## 2. Folder Hierarchy — `src/` Detail

```
src/
├── app/
│   ├── layout.tsx                # Font loading, theme, analytics
│   ├── page.tsx                  # Single route. The universe. No other pages.
│   ├── log/page.tsx              # Mission Log (semantic/accessible mirror, SSR'd)
│   └── api/contact/route.ts      # Black Hole transmission → Supabase
│
├── engine/
│   ├── Canvas.tsx                # Single R3F <Canvas>; renderer config; color mgmt
│   ├── Scene.tsx                 # Root scene graph; region mounting
│   ├── FloatingOrigin.ts         # World-space rebasing (see §3.3)
│   ├── FrameScheduler.ts         # Priority-bucketed per-frame work
│   ├── RegionManager.ts          # Mount/unmount/suspend regions by proximity
│   └── capabilities.ts           # GPU tier detect, WebGPU/WebGL2 probe, memory
│
├── world/
│   ├── sun/          (CentralStar, CoronaShader, FlareSystem, IdentityEmergence)
│   ├── planets/      (PlanetFactory, Atmosphere, CityLights, Clouds, per-planet overrides)
│   ├── constellations/ (SkillGraph, StarNode, RelationLines, HoverHighlight)
│   ├── stations/     (OrbitalStation, DockingSequence, InteriorReveal)
│   ├── observatory/  (Telescope, ResearchLens)
│   ├── fleet/        (GitHubFleet, ShipInstance, CommitStream)
│   ├── nebula/       (InnovationNebula, VolumetricSlices)
│   ├── blackhole/    (EventHorizon, LensingShader, AudioDamper, ContactCore)
│   └── ambient/      (Starfield, MilkyWay, DustField, DriftController)
│
├── camera/           (CameraDirector, TravelController, OrbitController,
│                      FocusController, BreathingIdle, journeys/*.json)
├── navigation/       (TravelGraph, HoverPipeline, IntentResolver, InputMap)
├── shaders/          (chunks/, materials/, post/  — see §8)
├── ui/               (hud/, holo/, log/, intro/)
├── state/            (worldStore, journeyStore, qualityStore, uiStore, audioStore)
└── perf/             (QualityManager, Budgets.ts, AdaptiveResolver, Telemetry)
```

## 3. Scene Architecture

### 3.1 Single Canvas, Region Graph
One persistent `<Canvas>` for the entire experience (page never changes — Master Prompt). The universe is partitioned into **Regions**, each a self-contained scene subgraph:

```
UniverseRoot
├── AmbientLayer          (always mounted: starfield, Milky Way, dust — cheap, instanced)
├── Region:Sun            (always mounted — "always visible" per Master Prompt, but LOD'd)
├── Region:About
├── Region:Projects       (contains sub-regions per planet: Perico, Top-Line, Whispers, banauAI, AndroidCluster)
├── Region:Skills
├── Region:Experience
├── Region:Observatory
├── Region:Fleet
├── Region:Nebula
└── Region:BlackHole
```

### 3.2 Region Lifecycle (RegionManager)
Each region has four states driven by camera proximity and travel intent:

| State | Meaning | Cost |
|---|---|---|
| `COLD` | Not loaded. Placeholder impostor (billboard sprite at correct position). | ~0 |
| `WARMING` | Assets streaming in (triggered when travel *toward* it begins, or proximity < prefetch radius). | Network/decode |
| `ACTIVE` | Full fidelity subgraph mounted, updates ticking. | Full |
| `SUSPENDED` | Mounted but frame updates paused, materials downgraded (camera departed, may return). | GPU memory only |

Travel intent (not just proximity) drives warming: the moment a user clicks a destination, its region begins streaming while the camera cruise plays — the ~2–4 s cinematic travel time IS the loading screen. This is the core loading trick of the whole architecture (§13).

### 3.3 Scale & Precision — Floating Origin
Galaxy-scale distances break 32-bit float precision (jitter). Two mitigations, both used:
1. **Compressed diegetic scale:** world units are narrative, not astronomical. Total traversable space ≈ 100k units, planets ≈ 50–200 units radius.
2. **Floating origin rebasing:** when camera distance from origin exceeds 20k units, translate the entire world so camera returns near origin. Invisible, standard technique. Combined with `logarithmicDepthBuffer` only if z-fighting is observed (it has a perf cost — measure first).

### 3.4 Frame Scheduler
A single `useFrame` root dispatches into priority buckets to prevent 40 components each registering their own frame callbacks:

- `P0 critical` — camera, input, floating origin (every frame)
- `P1 hero` — sun plasma, active region animation (every frame)
- `P2 ambient` — drift, twinkle, cloud scroll (every frame, but simulated at half-rate on low tier)
- `P3 lazy` — suspended-region idle, LOD checks, culling sweeps (round-robin, budgeted ~0.5 ms/frame)

## 4. State Management Architecture

**Zustand** (transient-safe, subscribe-outside-React, standard in R3F ecosystem). Redux is overkill; React context would cause render storms.

Five stores, strict ownership, no cross-writing:

| Store | Owns | Written by | Read by |
|---|---|---|---|
| `worldStore` | Region states, object registry, discovery flags ("visited Whispers") | RegionManager | everything |
| `journeyStore` | Current location, travel state machine (`IDLE / ACCEL / CRUISE / DECEL / ORBIT / FOCUS / REVEAL`), destination, progress 0–1 | CameraDirector | UI, audio, RegionManager |
| `qualityStore` | GPU tier, resolution scale, feature flags (volumetrics on/off, particle counts) | QualityManager | all renderers |
| `uiStore` | Hover target, active label, holo panel state, intro phase, reduced-motion flag | HoverPipeline, intro | UI layer |
| `audioStore` | Master volume, region soundscape, black-hole damping factor | journey subscriptions | AudioManager |

**Critical rule:** per-frame values (camera position, travel progress) are read via `store.getState()` inside `useFrame` or via refs — never via React subscription. React re-renders only on discrete state changes (arrived, hovered, quality tier changed).

The journey state machine is the spine of the entire product: camera, audio, region warming, UI reveals, and analytics all subscribe to its transitions. It is implemented as an explicit FSM (XState-style but hand-rolled, ~150 LOC) with legal-transition enforcement — this is what guarantees "nothing teleports."

## 5. Camera System Architecture

The camera is the protagonist. It is the only "player character."

### 5.1 Layered controller stack (CameraDirector)
Exactly one controller owns the camera per journey state; the Director arbitrates and cross-fades ownership:

```
CameraDirector (FSM-driven)
├── IntroController      # Darkness → particle → universe formation (Theatre-authored, baked)
├── TravelController     # A→B flight: accel / cruise / decel along travel splines
├── OrbitController      # Constrained orbit around focused object (damped, limited)
├── FocusController      # Final approach + framing for reveal (composition-aware)
└── BreathingIdle        # Additive layer: low-amplitude Perlin drift, always on
                         #   → "camera breathes", "nothing ever perfectly still"
```

BreathingIdle is *additive* (applied after the owning controller, in local space, amplitude ≤ 0.3% of focal distance) so it never fights ownership.

### 5.2 Travel splines, not free pathfinding
Every legal A→B route is a pre-authored Catmull-Rom/Bézier spline stored in the Travel Graph (§6). Authored in Theatre.js dev tooling, exported to JSON. Runtime evaluates spline position + a look-target curve + an easing profile:

- **Accel:** custom ease-in (power3.in region), FOV widens 2–4° (speed sensation)
- **Cruise:** near-constant velocity; subtle roll banking on curves; motion-line particles
- **Decel:** long ease-out (expo.out region), FOV settles, destination fills frame
- Total duration scales with graph distance but is clamped 2.5–6 s (UX > realism)

**Never linear. Never teleport** is enforced structurally: the only way to change location is `journeyStore.requestTravel(nodeId)`, which must traverse the FSM through ACCEL→CRUISE→DECEL. There is no `setPosition` API exposed outside the Director.

### 5.3 Interruption & re-targeting
User clicks a new destination mid-cruise: TravelController computes a blend spline from current position/velocity to the new route (Hermite join preserving velocity vector) — no snap, no restart. This is the hardest camera problem in the project and gets its own design doc in the Camera System phase.

### 5.4 Orbit constraints
OrbitController: damped spherical coords, polar clamp (±60°), zoom clamp per-object (`minDist`/`maxDist` from content data), inertia with exponential decay. Touch: one-finger orbit, pinch zoom, two-finger pan disabled (pan breaks the "physically anchored" fiction).

## 6. Navigation Architecture

### 6.1 Travel Graph (the real sitemap)
A directed graph. Nodes = destinations; edges = authored spline routes.

```
SUN ↔ ABOUT ↔ PROJECTS ↔ SKILLS ↔ EXPERIENCE ↔ OBSERVATORY ↔ FLEET ↔ NEBULA ↔ BLACKHOLE
         (spine, matches Master Prompt world structure)

+ PROJECTS ↔ {Perico, TopLine, Whispers, banauAI, AndroidCluster}   (local edges)
+ SUN → any spine node (return-home shortcuts, still flown, longer cruise)
```

Non-adjacent travel routes through intermediate waypoints (fly *past* regions, not through a wormhole) — this is what makes the universe feel physically connected. Waypoint pass-bys double as free exposure to unexplored regions (discovery incentive).

### 6.2 Interaction pipeline (per Master Prompt sequence)
```
Pointer move → GPU-friendly raycast (BVH via three-mesh-bvh, throttled 30 Hz, layer-masked)
  → HOVER: emissive glow ramp (150 ms) → orbit-path visualization fade-in → holo label
  → CLICK/TAP: IntentResolver validates (not already there, not mid-critical-sequence)
  → journeyStore.requestTravel(nodeId)
  → CameraDirector executes → REVEAL state → region's reveal choreography plays
```
No popups. No modals. Reveals are in-world: holographic panels rise from surfaces, station interiors open, constellations brighten. All reveal content is diegetic 3D or 3D-anchored DOM (`drei/Html` with occlusion) — chosen per surface in the World Rendering phase.

### 6.3 Input map
| Input | Action |
|---|---|
| Pointer hover | Highlight pipeline |
| Click/tap object | Travel or reveal |
| Drag | Orbit (when in ORBIT/FOCUS) |
| Scroll/pinch | Zoom within clamp; at max zoom-out, gentle pull-back to overview framing |
| `Tab / Shift+Tab` | Cycle focusable celestial objects (keyboard nav — a11y) |
| `Enter` | Activate focused object |
| `Esc` | Return to parent node (zoom out one level) |
| `M` | Toggle Mission Log |

A minimal, fade-away wayfinding affordance (a "star chart" summonable, not a persistent menu) prevents the classic exploration-site failure: users getting lost and leaving. Exploration over navigation does not mean navigation withheld — it means navigation earned/diegetic. Flagged for Design Bible ratification.

## 7. Asset Pipeline

### 7.1 Principle: procedural-first
Stars, nebulas, dust, plasma, atmospheres, constellations are **procedural (shader/instancing)** — near-zero download, infinite resolution, animatable. Authored meshes only where procedural fails: stations, ships, telescopes, planet surface detail kits.

### 7.2 Pipeline (offline, in `tools/asset-pipeline`, runs in CI)
```
Source (Blender .blend / .gltf)
  → gltf-transform: dedupe, prune, weld, quantize
  → meshopt compression (NOT Draco — faster decode, better for many small meshes)
  → KTX2/BasisU texture encode (UASTC for normals/data, ETC1S for albedo)
  → LOD chain generation (LOD0/1/2 + billboard impostor)
  → validation: triangle/texture budget per asset class → CI fails on breach
  → /public/assets/{region}/...
```

### 7.3 Budgets (per asset class — enforced, not aspirational)
| Class | Tris (LOD0) | Textures | Notes |
|---|---|---|---|
| Planet body | 20k (sphere + displacement) | 2× 2k KTX2 | detail via shader |
| Station | 60k | 4k atlas | single draw where possible |
| Ship (instanced) | 3k | shared 1k atlas | GPU instancing, fleet = 1 draw call |
| Telescope/props | 15k | 2k atlas | |

Total initial payload target: **< 3.5 MB** before first interactivity (procedural-first makes this achievable); full experience streamed total **< 25 MB**.

### 7.4 HDR / environment
One shared low-res HDR for PBR ambient (64–128 px prefiltered PMREM) + procedural starfield for the visible background. No 8k skyboxes.

## 8. Shader Pipeline

### 8.1 Structure
```
shaders/
├── chunks/        # #include-style GLSL modules: noise3d, fbm, curl, atmosphere_scatter,
│                  #   fresnel, tonemap_agx, dither, remap  (single source of shared math)
├── materials/     # One folder per material: {name}.vert, {name}.frag, {name}.ts (uniforms/defines)
│   ├── sun_plasma/  corona/  flare/
│   ├── atmosphere/  clouds/  city_lights/
│   ├── nebula_volume/  constellation_star/  relation_line/
│   ├── blackhole_lensing/  accretion/
│   └── holo_panel/  starfield/  dust/
└── post/          # Composer passes: bloom (selective), vignette, film grain,
                   #   chromatic aberration (black hole only), god rays (sun only)
```

- Build-time GLSL assembly via `vite-plugin-glsl`-equivalent for Next (custom loader): `#include "chunks/fbm.glsl"` resolved at build; dead-code stripped by defines.
- All custom materials extend a thin `BaseCosmosShaderMaterial` that auto-wires global uniforms (`uTime`, `uQualityTier`, `uCameraNear/Far`) from one UBO-like update point — no per-material time plumbing.
- **Quality defines, not branches:** low tier compiles cheaper variants (`#define OCTAVES 3` vs `6`, volumetric ray steps 16 vs 64). QualityManager triggers recompilation on tier change (rare event, acceptable hitch masked during travel).
- Post-processing: `pmndrs/postprocessing` (merged passes, half-float). Bloom is selective (emissive luminance threshold), god rays only when sun is on-screen (frustum-gated), lensing pass only mounted in BlackHole region.

### 8.2 The five expensive shaders, ranked by risk
1. Black hole lensing (screen-space UV distortion approximation, NOT ray-marched GR — looks right, costs little)
2. Nebula volumetrics (camera-facing slice stack or single-pass raymarch ≤ 48 steps; slice stack on mobile)
3. Sun plasma + corona (fbm layers + fresnel rim + flare sprite system)
4. Atmosphere scattering (precomputed-LUT single-scatter approximation, per-planet tint params)
5. Cloud layer (scrolling fbm on separate sphere shell, cheap)

Each gets a standalone prototype + perf measurement before integration (Shader phase).

## 9. Performance Strategy

### 9.1 Frame budgets (from Master Prompt targets)
| Tier | Target | Frame budget | Resolution scale | Key cuts |
|---|---|---|---|---|
| Desktop dGPU | 60 FPS | 16.6 ms | 1.0 (DPR ≤ 2) | none |
| Laptop iGPU | 45–60 | 16.6–22 ms | 0.85–1.0 | volumetric steps ↓, particle ½ |
| Tablet | 45 | 22 ms | 0.75 | slice nebula, no god rays |
| Mobile | 30 min | 33 ms | 0.6–0.75 (DPR clamp 1.5) | §10 |

### 9.2 QualityManager (adaptive, closed-loop)
1. **Static probe at boot:** `detect-gpu` tier + `navigator.deviceMemory` + screen class → initial tier.
2. **Dynamic loop:** rolling 120-frame percentile FPS. Sustained < target − 10% → step down one rung on the degradation ladder; sustained headroom > 25% for 10 s → step up (max one step above probe tier).
3. **Degradation ladder (in order):** resolution scale → post-pass count → particle counts → volumetric steps → shadow removal → shader tier defines → ambient sim to half-rate. Order chosen so the *composition* survives even at floor — story is never cut, only fidelity.

### 9.3 Standing techniques (from Master Prompt, all confirmed)
LOD (mesh + shader + impostor), GPU instancing (starfield, dust, fleet, city lights as instanced points), frustum culling (+ per-region bounding-sphere culling before raycast), texture streaming (KTX2 mip streaming per region state), lazy region mounting, compressed assets, procedural generation, adaptive quality.

### 9.4 Perf CI
Playwright + headless GPU run flies a scripted journey through all regions; fails the build if p95 frame time or heap exceeds budget on the reference config. Perf is a test, not a hope.

## 10. Mobile Adaptation Strategy

Not a separate site — the same universe, adapted:

- **Rendering:** DPR clamp 1.5, resolution scale 0.6–0.75, nebula = slices, no god rays, bloom at ¼ res, particles ≤ 25% desktop counts, `powerPreference: 'high-performance'`, no MSAA (FXAA-lite pass or none).
- **Interaction:** hover doesn't exist → first tap = highlight + label (hover state), second tap = travel. Orbit = one finger, pinch = zoom. Touch targets get enlarged invisible raycast proxies (≥ 44 px screen-space).
- **Intro:** shortened formation sequence (~40% duration) — mobile attention economics.
- **Layout:** holo panels reflow to bottom-sheet-style diegetic panels (still in-world, camera frames them lower).
- **Thermal:** visibilitychange + sustained-low-FPS → proactive tier drop; battery saver detection (`navigator.getBattery` where available) → start one tier lower.
- **Hard floor:** devices below WebGL2 or failing a 2 s boot benchmark are routed to Mission Log mode with a courteous in-fiction message ("telescope bandwidth insufficient — accessing observatory log"). Story preserved even in failure.

## 11. Content Management Strategy

Per decision D1: **content-as-code**.

- `/src/content/*.ts` typed modules, one per region + `universe.ts` (graph wiring).
- Zod schemas in `/src/content/schema.ts`; `tools/content-validate` runs in CI — a typo in a project description or a dangling graph edge fails the build, never ships.
- Copy (labels, reveal text, station logs) lives beside structure in the same modules — single source, no CMS round-trips.
- Adding a project = add one content file + one authored route spline + optional per-planet shader overrides. Documented as a runbook in `docs/`.
- If a real CMS is ever required (it is not, for a personal portfolio), the Zod schema becomes the contract and a build-time fetch replaces the static import — zero runtime architecture change. This is why Prisma is dropped now: it buys nothing and costs setup.

## 12. Data Model

TypeScript-first (Zod-mirrored). Core shape:

```ts
// Every navigable thing is a CelestialBody node in one registry.
type CelestialKind = 'star' | 'planet' | 'moon' | 'constellation'
                   | 'station' | 'observatory' | 'fleet' | 'nebula' | 'blackhole';

interface CelestialBody {
  id: string;                    // 'planet.perico'
  kind: CelestialKind;
  name: string;
  meaning: string;               // REQUIRED. The semantic reason this object exists.
                                 // Enforces "every celestial object must have semantic meaning".
  parent?: string;               // orbital hierarchy ('planet.perico' → 'sun')
  orbit?: { radiusU: number; periodS: number; inclinationDeg: number; phase: number };
  scaleU: number;
  visual: { paletteRef: string; shaderProfile: string; overrides?: Record<string, number> };
  camera: { minDist: number; maxDist: number; revealFraming: FramingSpec };
  reveal: RevealSpec;            // choreography id + content payload
  audio?: { soundscapeRef: string };
  log: MissionLogEntry;          // REQUIRED semantic mirror (a11y/SEO) — see §15
}

interface Project extends CelestialBody {   // kind: 'planet' | 'moon'
  role: string; stack: string[]; period: string;
  narrative: StoryBeat[];        // ordered beats the reveal choreography consumes
  links: { live?: string; repo?: string; caseStudy?: string };
  metrics?: { label: string; value: string }[];   // shown diegetically, never as cards
}

interface Skill { id: string; name: string; domain: SkillDomain;
  relatedTo: string[];           // edges → constellation lines
  magnitude: 1|2|3|4|5;          // star brightness/size — NOT a progress bar; it's
                                 // visual hierarchy (which stars anchor the constellation)
  evidence?: string[];           // project ids — hovering a skill glows the planets using it
}

interface Station extends CelestialBody {   // kind: 'station'  (experience entries)
  org: string; role: string; period: string;
  discoveries: Discovery[];      // dockable info nodes — replaces timeline entries
}

interface TravelEdge { from: string; to: string; splineRef: string;
  durationS: number; waypoints?: string[]; bidirectional: boolean; }

interface Universe { bodies: CelestialBody[]; skills: Skill[];
  edges: TravelEdge[]; intro: IntroSpec; }
```

Notes:
- `magnitude` on skills deliberately replaces proficiency percentages with *visual hierarchy* semantics — compliant with "no progress bars, no percentages" while still letting core skills anchor constellations.
- `meaning` being a required field is a build-time enforcement of the Master Prompt's "no decorative objects" rule.
- Cross-linking (`Skill.evidence` → planets) creates the discovery web that rewards exploration.

## 13. Loading Strategy

The intro IS the loader. No spinner is a hard requirement; therefore boot must be honest about what it needs *before first pixel* and defer everything else.

**Phase L0 — Shell (< 150 KB JS + critical CSS):** Next.js shell, canvas boot, capability probe, intro shader (tiny, procedural). First pixel = darkness + single particle within ~1 s on 4G.

**Phase L1 — Formation (during intro, ~8–12 s desktop):** while the universe forms (pure procedural — costs nothing to download), stream in parallel: core shader chunks, sun materials, ambient instancing buffers, Region:Sun assets, spine spline data, first-hop region impostors. Formation choreography is *paced by real load progress* where possible (stars ignite as their buffers land) — diegetic progress without a bar. If loading finishes early, choreography plays out at authored pace; if late, formation gently sustains (nebula evolution loop) — never a stall, never a spinner.

**Phase L2 — Steady state:** RegionManager streams by travel intent + prefetch radius (§3.2). Travel duration masks region loads. Decode off-main-thread (KTX2 worker, meshopt worker).

**Phase L3 — Idle prefetch:** `requestIdleCallback` warms adjacent regions in graph order.

Failure handling: any region asset failure → region stays as impostor with a diegetic "signal lost — retrying" shimmer; retry with backoff; universe never hard-crashes because one GLB 404'd.

## 14. Progressive Enhancement Strategy

Capability ladder, decided at boot, upgradeable mid-session only upward:

1. **No JS / crawler** → SSR'd Mission Log (full content, semantic HTML). SEO lives here.
2. **No WebGL2 / failed benchmark / data-saver** → Mission Log mode + static hero imagery.
3. **WebGL2 low tier** → full universe, floor quality ladder.
4. **WebGL2 high tier** → full fidelity (reference experience).
5. **WebGPU flag (Phase 3+)** → compute-path particles/nebula only; identical art direction.

`prefers-reduced-motion` → camera cuts replaced with 400 ms dissolves-in-place (the *one* sanctioned exception to "nothing teleports" — motion-sickness safety overrides fiction; the FSM still runs so all systems stay consistent), ambient drift amplitude → 0, flares/twinkle static. `prefers-reduced-data` → tier floor + no idle prefetch.

## 15. Accessibility Strategy

**Mission Log (the load-bearing a11y system):** a parallel semantic DOM — in-fiction framed as the observatory's exploration log — SSR'd at `/log` and toggleable in-experience (`M`). Every `CelestialBody.log` entry renders as structured HTML: headings, project details, links, skills as real lists. Screen readers get 100% of the content; the 3D layer becomes progressive decoration on top of a complete document. This also solves SEO and the no-WebGL fallback in one system.

- **Keyboard:** full traversal — `Tab` cycles focusable bodies (visible in-world focus ring: a subtle orbital reticle), `Enter` travels, `Esc` ascends, arrows orbit. Focus order follows the travel graph spine.
- **Screen reader in 3D mode:** `aria-live="polite"` narration channel announces journey transitions ("Traveling to Perico — industrial world") and reveal summaries; canvas itself `role="application"` with instructions.
- **Vestibular safety:** reduced-motion path (§14); FOV-change effects removed under reduced motion; no flashing above 3 Hz anywhere (flare design constraint).
- **Contrast & text:** all reveal text also exists as DOM (3D-anchored via `drei/Html` or Log), meeting WCAG AA contrast against its holo backing; minimum rendered text size 14 px effective.
- **Audio:** all sound optional, off until first interaction (autoplay policy anyway), visual equivalents for audio cues (black-hole "sound fades" is mirrored by visual quieting).
- **Target:** WCAG 2.2 AA on the Mission Log path; best-effort operability on the 3D path (industry-honest framing: the 3D canvas cannot itself be AA, the parallel path is how flagship 3D sites meet obligations).

---

## 16. Phase Plan (per your stated order — confirmed, no skipping)

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | **This document** | Your approval of D1–D4 + blueprint |
| 2 | Galaxy Architecture (region layout, ambient systems, spatial composition spec) | Design review |
| 3 | Camera System (Director, controllers, spline format, interruption math) | Prototype at 60 FPS w/ placeholder spheres |
| 4 | Navigation System (travel graph, hover pipeline, input, wayfinding) | Full traversal on placeholders |
| 5 | World Rendering (per-region visual builds, shaders, reveals) | Per-region QA vs 12_QA_CHECKLIST |
| 6 | Intro, audio, Mission Log, polish, perf hardening | Budget CI green on all tiers |

## 17. Open Questions Requiring Design Bible / Your Ruling

1. **D1–D4 sign-off** (content-as-code; single animation authority; GLSL-first; Mission Log mandate).
2. Summonable star chart (§6.3) — approve as the wayfinding affordance, or propose alternative?
3. Reduced-motion dissolve exception to "nothing teleports" (§14) — approve?
4. Intro duration 8–12 s desktop / ~5 s mobile with skip affordance after first visit (session-stored) — a no-skip intro on repeat visits will hurt return UX. Approve skip-on-return?
5. Audio scope: full positional soundscape vs. minimal (drone + travel + black-hole damping)? Affects Phase 6 budget.
6. `banauAI`, `Top-Line`, `Whispers`, Android projects — content details needed before Phase 5 (I will not invent project facts).

**END OF PHASE 1 DELIVERABLE**
