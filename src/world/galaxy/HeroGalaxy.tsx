'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import galaxyVert from '@/shaders/materials/galaxy_disc/galaxy.vert';
import galaxyFrag from '@/shaders/materials/galaxy_disc/galaxy.frag';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { useQualityStore } from '@/state/qualityStore';
import { loadSignals } from '@/state/loadSignals';
import { useDescentStore, nowS } from '@/state/descentStore';

/**
 * Global galaxy visibility. 1 = the Milky Way is the hero (opening galaxy
 * chapter and the loop's arrival back home); 0 = fully hidden while inside the
 * solar system, where the Sun is the only focus. Every galaxy layer multiplies
 * this into its own alpha, so the galaxy fades COMPLETELY away as we descend to
 * the Sun and only re-emerges from the dark on the loop climb back out — never
 * a second glowing object competing with the Sun, never a bright band behind
 * the content panel. A module ref (not store state) so per-frame writes never
 * trigger React re-renders.
 */
export const galaxyPresence = { value: 1 };

/** Per-frame driver for galaxyPresence — one writer, mounted in HeroGalaxy. */
function GalaxyPresenceDriver() {
  useFrame((_, delta) => {
    const d = useDescentStore.getState();
    let target = 1;
    if (d.stage === 'ARRIVED') {
      target = 0; // inside the solar system: galaxy gone, Sun is the hero
    } else if (d.stage === 'DESCENDING') {
      // Diving in from the galaxy: it fades right out, gone well before the Sun
      // becomes visible, so the two are never both bright at once.
      target = 1 - THREE.MathUtils.smoothstep(d.smoothed, 0.08, 0.5);
    } else if (d.stage === 'LOOPING') {
      // Climbing back out: emerge slowly from the dark, full by the arrival.
      const lp = THREE.MathUtils.clamp((nowS() - d.tStart) / d.tDur, 0, 1);
      target = THREE.MathUtils.smoothstep(lp, 0.2, 0.9);
    }
    galaxyPresence.value = THREE.MathUtils.damp(galaxyPresence.value, target, 3.5, delta);
  });
  return null;
}

/**
 * The opening scene's centerpiece — a full galaxy, built like an
 * astrophysical object rather than a particle equation. Five coupled layers:
 *   1) GalaxyDisc   — 3 stacked shader slices (disc thickness): domain-warped
 *      broken arms, star-cloud knots, filamentary dust lanes, HII regions,
 *      lopsided brightness — nothing sits on the ideal log-spiral curve
 *   2) GalaxyStars  — ~24k soft points rejection-sampled against the SAME
 *      warped density field (armDensity mirrors galaxy.frag exactly)
 *   3) GalaxyHaze   — large faint additive gas sprites on the same field:
 *      the arms fade into suspended light instead of ending cleanly
 *   4) CoreGlow     — billboard bulge sprites: the core glows out of plane
 *   5) GalaxyForeground — near-camera dust motes and loose stars, so mouse
 *      parallax (CameraDirector) separates foreground / disc / background
 * One arm region carries a subtle "beacon" brightening (shader + boosted
 * star density) — the destination cue for the journey's next chapter.
 */

export const OUTER_RADIUS = 24000;
// ARMS must be an integer: the spiral pattern wraps across the atan() angle
// seam at the -x axis, and only an integer arm count stays continuous there.
const ARMS = 2.0;
const TWIST = 2.6;
// Disc-local angle of the destination-arm cue (shader beacon + star boost).
// The descent chapter (descentPath.ts) dives into this same arm.
export const BEACON_THETA = 2.2;

// The disc is tilted for a dramatic 3/4 hero view. Where the galaxy sits and
// where the hero camera sits are DERIVED from this tilt, so the solar system
// lands inside the disc, out on the beacon arm.
export const GALAXY_TILT = new THREE.Euler(
  THREE.MathUtils.degToRad(30),
  THREE.MathUtils.degToRad(16),
  THREE.MathUtils.degToRad(-12),
);
const _tiltQ = new THREE.Quaternion().setFromEuler(GALAXY_TILT);
// Disc-plane basis in world space: the plane normal, plus the world directions
// of the beacon arm's radial and tangential axes.
const DISC_N = new THREE.Vector3(0, 1, 0).applyQuaternion(_tiltQ).normalize();
const _beaconDir = new THREE.Vector3(Math.cos(BEACON_THETA), 0, Math.sin(BEACON_THETA))
  .applyQuaternion(_tiltQ)
  .normalize();
const _beaconTan = new THREE.Vector3(-Math.sin(BEACON_THETA), 0, Math.cos(BEACON_THETA))
  .applyQuaternion(_tiltQ)
  .normalize();

// Re-center the galaxy so the WORLD ORIGIN (the solar system) sits INSIDE the
// disc, out on the beacon arm at ~0.7 radii — the very star the descent dives
// onto. This is what makes the system feel embedded in the galaxy instead of a
// separate island floating beside it: the core glows ~17k units away in the
// disc plane, the arms wrap around the planets, and there is no empty gap to
// cross. The offset mirrors descentPath's DESTINATION_STAR, so the dive lands
// on the Sun with no jump and the loop home is one continuous climb back out.
export const GALAXY_CENTER = new THREE.Vector3()
  .addScaledVector(_beaconDir, -(OUTER_RADIUS * 0.52 - 2800))
  .addScaledVector(_beaconTan, -13800);

// Hero vantage: up out of the disc plane and back over the beacon side, far
// enough that the whole spiral clears the frame. The loop home ends here.
const GALAXY_VIEW_DIR = DISC_N.clone().addScaledVector(_beaconDir, 0.5).normalize();
export const GALAXY_CAM_POS = GALAXY_CENTER.clone().addScaledVector(
  GALAXY_VIEW_DIR,
  OUTER_RADIUS * 1.75,
);
export const GALAXY_LOOK = GALAXY_CENTER.clone();

// Hero view frame — the deep field and ambient life are anchored to THIS
// (the camera's own basis), not the world origin, so they fill the entire
// frame including the outer side the origin-centred shells never reach.
export const GALAXY_AXIS = GALAXY_CENTER.clone().sub(GALAXY_CAM_POS).normalize();
export const GALAXY_RIGHT = new THREE.Vector3()
  .crossVectors(GALAXY_AXIS, new THREE.Vector3(0, 1, 0))
  .normalize();
export const GALAXY_UP = new THREE.Vector3()
  .crossVectors(GALAXY_RIGHT, GALAXY_AXIS)
  .normalize();

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- *
 * CPU port of chunks/noise3d.glsl — allocation-free, OCTAVES = 5.
 * Must stay bit-compatible in structure with the GLSL so the star and
 * gas layers cluster on the exact arms the disc shader draws.
 * ---------------------------------------------------------------- */
const fract = (x: number) => x - Math.floor(x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let hx = 0, hy = 0, hz = 0;
function hash33(px: number, py: number, pz: number) {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.103);
  let z = fract(pz * 0.0973);
  const d = x * (y + 33.33) + y * (x + 33.33) + z * (z + 33.33);
  x += d; y += d; z += d;
  hx = fract((x + y) * z);
  hy = fract(2 * x * y);
  hz = fract((x + y) * x);
}

function vnoise(px: number, py: number, pz: number): number {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  const fx = px - ix, fy = py - iy, fz = pz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const g = (ox: number, oy: number, oz: number) => {
    hash33(ix + ox, iy + oy, iz + oz);
    return hx * (fx - ox) + hy * (fy - oy) + hz * (fz - oz);
  };
  const n000 = g(0, 0, 0), n100 = g(1, 0, 0), n010 = g(0, 1, 0), n110 = g(1, 1, 0);
  const n001 = g(0, 0, 1), n101 = g(1, 0, 1), n011 = g(0, 1, 1), n111 = g(1, 1, 1);
  const z0 = n000 + ux * (n100 - n000) + uy * (n010 + ux * (n110 - n010) - (n000 + ux * (n100 - n000)));
  const z1 = n001 + ux * (n101 - n001) + uy * (n011 + ux * (n111 - n011) - (n001 + ux * (n101 - n001)));
  return (z0 + uz * (z1 - z0)) * 0.5 + 0.5;
}

function fbm(px: number, py: number, pz: number): number {
  let v = 0, a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(px, py, pz);
    px = px * 2.03 + 17.1;
    py = py * 2.03 + 17.1;
    pz = pz * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

/**
 * Mirrors galaxy.frag (uSeed = 0, t = 0): warped broken arms × knots ×
 * breaks × lopsidedness × radial falloff, plus the core bulge. Returned in
 * roughly 0..1.3 — used to rejection-sample stars and gas onto the arms.
 */
function armDensity(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rn = r / OUTER_RADIUS;
  if (rn > 1) return 0;
  const theta = Math.atan2(z, x);

  const wx = x * 0.00016, wz = z * 0.00016;
  const warp =
    (fbm(wx, 0, wz) - 0.5) * 2.4 +
    (fbm(wx * 3.7 + 19, 19, wz * 3.7 + 19) - 0.5) * 0.9;
  const phase = theta - TWIST * Math.log(Math.max(r, 1)) + warp * smoothstep(0.06, 0.4, rn);

  const armWave = Math.sin(ARMS * phase) * 0.5 + 0.5;
  const widthMod = fbm(rn * 4 + 3, phase * 0.9, 67);
  let arms = Math.pow(smoothstep(0.06 + widthMod * 0.42, 0.9, armWave), 1.3);
  const spurWave = Math.sin(ARMS * 2 * phase + 2.3) * 0.5 + 0.5;
  arms = Math.max(arms, Math.pow(smoothstep(0.7, 0.98, spurWave), 2) * 0.4);

  const lop = 0.72 + 0.28 * Math.sin(theta + rn * 1.2 + 0.9);
  const knots = smoothstep(0.34, 0.8, fbm(x * 0.00105 + 7, 41, z * 0.00105 + 7));
  const breaks = smoothstep(0.18, 0.44, fbm(x * 0.00034 + 31, 97, z * 0.00034 + 31));
  const armLight = arms * (0.3 + 0.95 * knots) * breaks * lop;

  const radialFalloff = smoothstep(1, 0.32, rn) * (0.32 + 0.68 * smoothstep(0.015, 0.16, rn));
  const coreBulge = Math.pow(smoothstep(0.22, 0, rn), 1.5);
  // Dark molecular clouds swallow starlight the same way they carve the disc
  const darkCloud =
    smoothstep(0.5, 0.8, fbm(x * 0.00052 + 13, 71, z * 0.00052 + 13)) * smoothstep(0.1, 0.28, rn);
  return armLight * radialFalloff * (1 - darkCloud * 0.55) + coreBulge;
}

/** Beacon weighting — matches the shader's destination-arm gaussian. */
function beaconBoost(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rn = r / OUTER_RADIUS;
  const theta = Math.atan2(z, x);
  const dAng = Math.atan2(Math.sin(theta - BEACON_THETA), Math.cos(theta - BEACON_THETA));
  return Math.exp(-dAng * dAng * 5) * Math.exp(-(((rn - 0.52) / 0.16) ** 2));
}

function useRevealDriver(
  apply: (value: number) => void,
  speed = 1.4,
) {
  const v = useRef(0);
  useFrame((_, delta) => {
    // The whole galaxy forms behind the preloader: it stays hidden until the
    // star field is built, then blooms to full as fast as real frames allow.
    // Because the preloader only lifts once this is essentially complete, the
    // viewer never sees a half-drawn galaxy or the compile stall.
    const target = loadSignals.galaxyReady ? 1 : 0;
    v.current = THREE.MathUtils.damp(v.current, target, speed, delta);
    if (v.current > loadSignals.galaxyBloom) loadSignals.galaxyBloom = v.current;
    // Journey presence gates every galaxy layer: full in the galaxy chapter,
    // zero inside the solar system, fading across the transitions.
    apply(v.current * galaxyPresence.value);
  });
}

/* ---------------------------------------------------------------- *
 * 1) Disc — three stacked shader slices give the disc real thickness.
 *    Same seed on every slice: the structure is coherent in Y, the way an
 *    actual thin disc is — the offset copies read as volume, not echoes.
 * ---------------------------------------------------------------- */
const SLICES: { y: number; alpha: number; octaves: number }[] = [
  { y: 0, alpha: 1.0, octaves: 5 },
  { y: 650, alpha: 0.26, octaves: 3 },
  { y: -650, alpha: 0.26, octaves: 3 },
];

function GalaxyDisc() {
  const mats = useRef<THREE.ShaderMaterial[]>([]);
  const geometry = useMemo(() => {
    // Disc must lie in XZ: the shader derives radius/angle from vPosL.xz.
    const g = new THREE.CircleGeometry(OUTER_RADIUS, 256);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const materials = useMemo(
    () =>
      SLICES.map(
        (s) =>
          new THREE.ShaderMaterial({
            vertexShader: assembleShader(galaxyVert, { OCTAVES: s.octaves }),
            fragmentShader: assembleShader(galaxyFrag, { OCTAVES: s.octaves }),
            uniforms: {
              uTime: { value: 0 },
              uOuterRadius: { value: OUTER_RADIUS },
              uArms: { value: ARMS },
              uTwist: { value: TWIST },
              uReveal: { value: 0 },
              uLayerAlpha: { value: s.alpha },
              uSeed: { value: 0 },
              uBeaconTheta: { value: BEACON_THETA },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
      ),
    [],
  );
  mats.current = materials;

  useFrame((state) => {
    for (const m of mats.current) m.uniforms.uTime.value = state.clock.elapsedTime;
  });
  useRevealDriver((v) => {
    for (const m of mats.current) m.uniforms.uReveal.value = v;
  });

  return (
    <group position={GALAXY_CENTER} rotation={GALAXY_TILT}>
      {SLICES.map((s, i) => (
        <mesh key={s.y} position={[0, s.y, 0]} geometry={geometry}>
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- *
 * 2) Stars — rejection-sampled on the warped field. Sizes chosen so points
 *    resolve as soft glows at the hero camera distance (~46k units), not
 *    1-px dots: that hard-particle look is what read as "procedural".
 * ---------------------------------------------------------------- */
/* The ~24k galaxy stars are the single most expensive thing at load: a
 * rejection-sampling loop (up to targetCount*40 noise evals) that used to run
 * SYNCHRONOUSLY in a useMemo on first render, blocking the first paint. It is
 * now generated OFF the first render, in short chunks across idle callbacks, so
 * the hero paints instantly and the arm stars fill in during the formation
 * intro (which is a particles->galaxy reveal anyway, so it reads as intended).
 * The count also scales with the quality tier now. */
type StarGen = {
  targetCount: number;
  maxAttempts: number;
  pos: Float32Array;
  size: Float32Array;
  seed: Float32Array;
  order: Float32Array;
  color: Float32Array;
  rng: () => number;
  i: number;
  attempts: number;
};

function makeStarGen(targetCount: number): StarGen {
  return {
    targetCount,
    maxAttempts: targetCount * 40,
    pos: new Float32Array(targetCount * 3),
    size: new Float32Array(targetCount),
    seed: new Float32Array(targetCount),
    order: new Float32Array(targetCount),
    color: new Float32Array(targetCount * 3),
    rng: mulberry32(777),
    i: 0,
    attempts: 0,
  };
}

function starGenDone(g: StarGen): boolean {
  return g.i >= g.targetCount || g.attempts >= g.maxAttempts;
}

// One slice: run at most `attemptBudget` samples so no slice blocks more than a
// couple ms. Called repeatedly across idle callbacks until starGenDone.
function fillStarGen(g: StarGen, attemptBudget: number): void {
  const { pos, size, seed, order, color, rng } = g;
  let used = 0;
  while (g.i < g.targetCount && g.attempts < g.maxAttempts && used < attemptBudget) {
    g.attempts++;
    used++;
    const r = Math.pow(rng(), 0.55) * OUTER_RADIUS;
    const theta = rng() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const rn = r / OUTER_RADIUS;

    let density = armDensity(x, z);
    // Large-scale patchiness: real star fields are uneven — some arm stretches
    // teem, others are nearly vacant. Stars only, not the disc glow, so the
    // patchiness reads as resolution, not holes in the light.
    const clump = smoothstep(0.3, 0.78, fbm(x * 0.00042 + 53, 23, z * 0.00042 + 53));
    density *= 0.2 + 1.6 * clump;
    density *= 1 + beaconBoost(x, z) * 1.1; // richer stellar neighborhood on the destination arm
    if (rng() > density * 0.9 + 0.03) continue;

    // Gaussian-ish vertical spread, flaring thicker toward the core
    const thickness = (1 - rn) * 1100 + 80;
    const y = ((rng() + rng() + rng() - 1.5) / 1.5) * thickness * 0.5;
    const i = g.i;
    pos.set([x, y, z], i * 3);

    let s = 200 + rng() * rng() * 620;
    if (rng() < 0.02) s = 1300 + rng() * 1200; // rare luminous giants
    if (rn < 0.14) s += 220; // dense bright core population
    size[i] = s;
    seed[i] = rng();
    order[i] = rng() * 0.4;

    const t = rng();
    const warmBias = 1 - rn;
    if (t < 0.42 + warmBias * 0.3) color.set([1.0, 0.9, 0.75], i * 3);
    else if (t < 0.75) color.set([0.62, 0.75, 1.0], i * 3);
    else if (t < 0.88) color.set([1.0, 0.62, 0.4], i * 3);
    else if (t < 0.96) color.set([0.85, 0.9, 1.0], i * 3);
    else color.set([1.0, 0.55, 0.68], i * 3);
    g.i++;
  }
}

function finishStarGen(g: StarGen): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const i = g.i;
  geo.setAttribute('position', new THREE.BufferAttribute(g.pos.subarray(0, i * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(g.size.subarray(0, i), 1));
  geo.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(g.seed.subarray(0, i), 1));
  geo.setAttribute('aIgniteOrder', new THREE.BufferAttribute(g.order.subarray(0, i), 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(g.color.subarray(0, i * 3), 3));
  return geo;
}

function GalaxyStars() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const particleScale = useQualityStore((s) => s.particleScale);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    let handle = 0;
    // Always a rich hero (>= 6k) even on weak tiers; up to 24k on desktop.
    const targetCount = Math.max(6000, Math.floor(24000 * particleScale));
    const gen = makeStarGen(targetCount);
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = (fn: () => void): number =>
      win.requestIdleCallback
        ? win.requestIdleCallback(fn, { timeout: 120 })
        : (setTimeout(fn, 0) as unknown as number);
    const step = () => {
      if (cancelled) return;
      fillStarGen(gen, 160000); // ~a few ms per slice; spread across idle time
      if (starGenDone(gen)) {
        if (!cancelled) {
          setGeometry(finishStarGen(gen));
          loadSignals.galaxyReady = true; // release the coordinated bloom
        }
      } else {
        handle = schedule(step);
      }
    };
    handle = schedule(step);
    return () => {
      cancelled = true;
      win.cancelIdleCallback?.(handle);
      window.clearTimeout(handle);
    };
  }, [particleScale]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  useRevealDriver((v) => {
    if (matRef.current) matRef.current.uniforms.uFormation.value = v;
  });

  // Until the first chunked slice-set completes, the disc glow + deep space +
  // starfield already carry the frame; the stars fade in via the reveal driver.
  if (!geometry) return null;

  return (
    <points position={GALAXY_CENTER} rotation={GALAXY_TILT} geometry={geometry} frustumCulled={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}

/* ---------------------------------------------------------------- *
 * 3) Gas haze — big, faint, additive sprites on the same warped field but
 *    spread further off-plane: light suspended in gas. This is what lets
 *    the arms dissolve into mist instead of ending at the disc's alpha.
 * ---------------------------------------------------------------- */
// Star glow profile is too hard-edged for gas: overlapping sprites read as
// bokeh circles. Cubic shoulder dissolves each sprite into formless fog.
// Shared with the descent chapter's nebula layer (DescentField.tsx).
export const hazeFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float glow = smoothstep(0.5, 0.05, length(uv));
  glow = glow * glow * glow;
  gl_FragColor = vec4(vColor, glow * vAlpha * 0.6);
  if (gl_FragColor.a < 0.004) discard;
}
`;

function GalaxyHaze() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const targetCount = 1400;
    const pos = new Float32Array(targetCount * 3);
    const size = new Float32Array(targetCount);
    const seed = new Float32Array(targetCount);
    const order = new Float32Array(targetCount);
    const color = new Float32Array(targetCount * 3);
    const rng = mulberry32(1349);

    let i = 0;
    let attempts = 0;
    while (i < targetCount && attempts < targetCount * 60) {
      attempts++;
      const r = Math.pow(rng(), 0.6) * OUTER_RADIUS;
      const theta = rng() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const density = armDensity(x, z);
      // Gas only where the arms are dense enough for sprites to overlap —
      // an isolated sprite at the rim reads as a lone bokeh circle.
      if (density < 0.18) continue;
      if (rng() > density * 0.8 + 0.04) continue;

      const rn = r / OUTER_RADIUS;
      const spread = (1 - rn * 0.7) * 900 + 200; // gas cloud rises off-plane
      const y = ((rng() + rng() + rng() - 1.5) / 1.5) * spread;
      pos.set([x, y, z], i * 3);
      // Big and individually near-invisible: the sprites must overlap into a
      // continuous fog. Smaller/brighter values read as discrete bokeh blobs.
      size[i] = 6000 + rng() * 9000;
      seed[i] = rng();
      order[i] = 0.2 + rng() * 0.6; // mist breathes in after the stars ignite

      if (rn < 0.22) color.set([0.09, 0.065, 0.04], i * 3); // warm core gas
      else {
        const t = rng();
        if (t < 0.55) color.set([0.032, 0.048, 0.08], i * 3); // cool blue arm gas
        else if (t < 0.75) color.set([0.052, 0.032, 0.065], i * 3); // purple molecular
        else if (t < 0.9) color.set([0.07, 0.038, 0.048], i * 3); // pink emission
        else color.set([0.055, 0.042, 0.032], i * 3); // brown dust glow
      }
      i++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, i * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size.subarray(0, i), 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed.subarray(0, i), 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order.subarray(0, i), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color.subarray(0, i * 3), 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: hazeFrag,
        uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  useRevealDriver((v) => {
    if (matRef.current) matRef.current.uniforms.uFormation.value = v;
  });

  return (
    <points position={GALAXY_CENTER} rotation={GALAXY_TILT} geometry={geometry} frustumCulled={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}

/* ---------------------------------------------------------------- *
 * 4) Core glow — billboard sprites: the bulge glows out of the disc plane
 *    (a flat disc can never do this), warm gold fading through amber.
 * ---------------------------------------------------------------- */
export function makeGlowTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Four nested glow shells, each softer and wider than the last: a glowing
// city seen through fog, not one clipped white bloom. Peak alphas stay well
// under 1 so the additive stack never burns to flat white.
const CORE_LAYERS: { scale: number; opacity: number; stops: [number, string][] }[] = [
  {
    scale: 3600,
    opacity: 0.85,
    stops: [
      [0, 'rgba(255,248,230,0.85)'],
      [0.35, 'rgba(255,226,176,0.3)'],
      [1, 'rgba(255,200,140,0)'],
    ],
  },
  {
    scale: 8500,
    opacity: 0.55,
    stops: [
      [0, 'rgba(255,220,160,0.5)'],
      [0.45, 'rgba(255,190,120,0.14)'],
      [1, 'rgba(255,170,100,0)'],
    ],
  },
  {
    scale: 16000,
    opacity: 0.32,
    stops: [
      [0, 'rgba(255,204,142,0.3)'],
      [0.5, 'rgba(230,164,120,0.08)'],
      [1, 'rgba(200,140,110,0)'],
    ],
  },
  {
    scale: 28000,
    opacity: 0.16,
    stops: [
      [0, 'rgba(255,214,170,0.2)'],
      [0.5, 'rgba(190,160,220,0.05)'],
      [1, 'rgba(0,0,0,0)'],
    ],
  },
];

function CoreGlow() {
  const matRefs = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const textures = useMemo(() => CORE_LAYERS.map((l) => makeGlowTexture(l.stops)), []);
  const vRef = useRef(0);

  // Reveal on intro, then a slow, staggered luminosity breath per shell so the
  // volumetric glow around the core evolves gently — never a pulse or flash.
  useFrame((state, delta) => {
    // bloom the core WITH the rest of the galaxy, behind the preloader
    const target = loadSignals.galaxyReady ? 1 : 0;
    vRef.current = THREE.MathUtils.damp(vRef.current, target, 1.4, delta);
    const t = state.clock.elapsedTime;
    for (let i = 0; i < CORE_LAYERS.length; i++) {
      const m = matRefs.current[i];
      if (m) {
        const breath = 1 + 0.08 * Math.sin(t * (0.05 + i * 0.019) + i * 1.4);
        m.opacity = vRef.current * CORE_LAYERS[i].opacity * breath * galaxyPresence.value;
      }
    }
  });

  return (
    <group position={GALAXY_CENTER}>
      {CORE_LAYERS.map((l, i) => (
        <sprite key={l.scale} scale={[l.scale, l.scale, 1]}>
          <spriteMaterial
            ref={(m) => {
              matRefs.current[i] = m;
            }}
            map={textures[i]}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0}
          />
        </sprite>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- *
 * 5) Foreground — dust motes and a few loose stars scattered in the space
 *    between the hero camera and the disc. These are what make the mouse
 *    parallax read: near things sweep, the galaxy barely moves, the
 *    background stays still — depth from motion, not from a flat sprite.
 * ---------------------------------------------------------------- */
function GalaxyForeground() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const count = 800;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const order = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const rng = mulberry32(2027);

    const axis = GALAXY_CENTER.clone().sub(GALAXY_CAM_POS).normalize();
    const right = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, axis).normalize();
    const p = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const d = 4200 + Math.pow(rng(), 1.7) * 32000; // biased close to the camera
      const lateral = Math.sqrt(rng()) * (2500 + d * 0.55);
      const a = rng() * Math.PI * 2;
      p.copy(GALAXY_CAM_POS)
        .addScaledVector(axis, d)
        .addScaledVector(right, Math.cos(a) * lateral)
        .addScaledVector(up, Math.sin(a) * lateral * 0.7);
      pos.set([p.x, p.y, p.z], i * 3);

      const isStar = rng() < 0.09;
      size[i] = isStar ? 90 + rng() * 260 : 10 + rng() * 22;
      seed[i] = rng();
      order[i] = rng();
      if (isStar) {
        color.set(rng() < 0.5 ? [1.0, 0.92, 0.8] : [0.75, 0.82, 1.0], i * 3);
      } else {
        color.set([0.2, 0.23, 0.3], i * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: 30 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  useRevealDriver((v) => {
    if (matRef.current) matRef.current.uniforms.uFormation.value = v;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}

/* ---------------------------------------------------------------- *
 * 6) Environment — the galaxy must not float on a black canvas. Huge
 *    ultra-faint gas veils hang in the space around the view axis, and pale
 *    galaxy smudges sit far behind the disc. Individually near-invisible;
 *    together they make the void read as a medium, not a backdrop.
 * ---------------------------------------------------------------- */
function GalaxyEnvironment() {
  const [veilGeo, smudgeGeo] = useMemo(() => {
    const axis = GALAXY_CENTER.clone().sub(GALAXY_CAM_POS).normalize();
    const right = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, axis).normalize();
    const p = new THREE.Vector3();

    const build = (
      count: number,
      rng: () => number,
      fill: (i: number, pos: Float32Array, size: Float32Array, col: Float32Array) => void,
    ) => {
      const pos = new Float32Array(count * 3);
      const size = new Float32Array(count);
      const seed = new Float32Array(count);
      const order = new Float32Array(count);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        fill(i, pos, size, col);
        seed[i] = rng();
        order[i] = rng();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed, 1));
      g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
      g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      return g;
    };

    // Gas veils: mid-distance, pushed off-axis so the disc itself stays clear
    const veilRng = mulberry32(4177);
    const veils = build(16, veilRng, (i, pos, size, col) => {
      const d = 9000 + veilRng() * 26000;
      const a = veilRng() * Math.PI * 2;
      const lateral = 10000 + veilRng() * 24000;
      p.copy(GALAXY_CAM_POS)
        .addScaledVector(axis, d)
        .addScaledVector(right, Math.cos(a) * lateral)
        .addScaledVector(up, Math.sin(a) * lateral * 0.8);
      pos.set([p.x, p.y, p.z], i * 3);
      size[i] = 14000 + veilRng() * 18000;
      const t = veilRng();
      if (t < 0.55) col.set([0.014, 0.022, 0.036], i * 3); // cold blue gas
      else if (t < 0.8) col.set([0.022, 0.016, 0.03], i * 3); // violet
      else col.set([0.024, 0.018, 0.013], i * 3); // warm dust
    });

    // Distant galaxy smudges: far behind the disc, spread wide
    const smRng = mulberry32(5651);
    const smudges = build(56, smRng, (i, pos, size, col) => {
      const d = 72000 + smRng() * 46000;
      const a = smRng() * Math.PI * 2;
      const lateral = Math.sqrt(smRng()) * (14000 + d * 0.75);
      p.copy(GALAXY_CAM_POS)
        .addScaledVector(axis, d)
        .addScaledVector(right, Math.cos(a) * lateral)
        .addScaledVector(up, Math.sin(a) * lateral * 0.7);
      pos.set([p.x, p.y, p.z], i * 3);
      size[i] = 260 + smRng() * 900;
      const t = smRng();
      if (t < 0.5) col.set([0.1, 0.11, 0.16], i * 3);
      else if (t < 0.8) col.set([0.13, 0.1, 0.09], i * 3);
      else col.set([0.09, 0.11, 0.14], i * 3);
    });

    return [veils, smudges];
  }, []);

  const [veilMat, smudgeMat] = useMemo(
    () =>
      [0, 1].map(
        () =>
          new THREE.ShaderMaterial({
            vertexShader: starVert,
            fragmentShader: hazeFrag,
            uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ) as [THREE.ShaderMaterial, THREE.ShaderMaterial],
    [],
  );

  useFrame((state) => {
    veilMat.uniforms.uTime.value = state.clock.elapsedTime;
    smudgeMat.uniforms.uTime.value = state.clock.elapsedTime;
  });
  useRevealDriver((v) => {
    veilMat.uniforms.uFormation.value = v;
    smudgeMat.uniforms.uFormation.value = v;
  });

  return (
    <group name="galaxy-environment">
      <points geometry={veilGeo} frustumCulled={false}>
        <primitive object={veilMat} attach="material" />
      </points>
      <points geometry={smudgeGeo} frustumCulled={false}>
        <primitive object={smudgeMat} attach="material" />
      </points>
    </group>
  );
}

/* ---------------------------------------------------------------- *
 * 7) Deep field — the universe AROUND the galaxy. Anchored to the hero
 *    view frame (not the origin) so it fills every edge, layered by depth so
 *    the void reads as volume, and CLUSTERED so the eye always finds a dense
 *    patch here and a lone bright giant there — never an empty corner.
 * ---------------------------------------------------------------- */
type RNG = () => number;
type DeepLayer = {
  count: number;
  rMin: number;
  rMax: number;
  thetaMax: number; // angular radius of the view cone it fills
  clusterFrac: number; // fraction of points pulled into clusters
  wobble: number; // slow drift (star.vert) — larger for nearer layers
  frag: string;
  size: (rng: RNG) => number;
  color: (rng: RNG) => [number, number, number];
};

const _cd = new THREE.Vector3();
function coneDir(rng: RNG, thetaMax: number, out: THREE.Vector3): THREE.Vector3 {
  const cosT = 1 - rng() * (1 - Math.cos(thetaMax));
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = rng() * Math.PI * 2;
  return out
    .copy(GALAXY_AXIS)
    .multiplyScalar(cosT)
    .addScaledVector(GALAXY_RIGHT, sinT * Math.cos(phi))
    .addScaledVector(GALAXY_UP, sinT * Math.sin(phi))
    .normalize();
}

function buildDeepLayer(spec: DeepLayer, seed: number): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const { count } = spec;
  const clusters: THREE.Vector3[] = [];
  const nClusters = 9 + Math.floor(rng() * 9);
  for (let k = 0; k < nClusters; k++) clusters.push(coneDir(rng, spec.thetaMax * 0.92, new THREE.Vector3()));

  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tw = new Float32Array(count);
  const order = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    if (rng() < spec.clusterFrac) {
      const c = clusters[(rng() * clusters.length) | 0];
      // tight gaussian-ish jitter around the cluster centre
      const j = 0.11 * (rng() + rng() + rng() - 1.5) / 1.5;
      dir
        .set(rng() - 0.5, rng() - 0.5, rng() - 0.5)
        .multiplyScalar(Math.abs(j))
        .add(c)
        .normalize();
    } else {
      coneDir(rng, spec.thetaMax, dir);
    }
    const r = spec.rMin + rng() * (spec.rMax - spec.rMin);
    tmp.copy(GALAXY_CAM_POS).addScaledVector(dir, r);
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    size[i] = spec.size(rng);
    tw[i] = rng();
    order[i] = rng() * 0.6;
    col.set(spec.color(rng), i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(tw, 1));
  g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  return g;
}

const DEEP_LAYERS: DeepLayer[] = [
  // L1 — very distant, tiny, near-static pinpoints (the deepest layer)
  {
    count: 7200, rMin: 68000, rMax: 104000, thetaMax: 1.18, clusterFrac: 0.62, wobble: 0, frag: starFrag,
    size: (r) => 200 + r() * r() * 430,
    color: (r) => {
      const t = r();
      return t < 0.45 ? [0.72, 0.78, 0.88] : t < 0.7 ? [0.6, 0.7, 0.92] : t < 0.86 ? [0.92, 0.83, 0.7] : [0.5, 0.55, 0.66];
    },
  },
  // L2 — medium stars, faint drift
  {
    count: 3400, rMin: 44000, rMax: 67000, thetaMax: 1.1, clusterFrac: 0.5, wobble: 7, frag: starFrag,
    size: (r) => 250 + r() * 540,
    color: (r) => {
      const t = r();
      return t < 0.4 ? [0.95, 0.95, 1.0] : t < 0.66 ? [0.7, 0.8, 1.0] : t < 0.85 ? [1.0, 0.82, 0.6] : [1.0, 0.6, 0.5];
    },
  },
  // L3 — brighter stars + scattered blue/orange/red giants (bloom catches these)
  {
    count: 760, rMin: 30000, rMax: 50000, thetaMax: 1.04, clusterFrac: 0.42, wobble: 12, frag: starFrag,
    size: (r) => (r() < 0.12 ? 900 + r() * 900 : 420 + r() * 700),
    color: (r) => {
      const t = r();
      return t < 0.34 ? [1.0, 0.98, 0.95] : t < 0.6 ? [0.55, 0.68, 1.0] : t < 0.85 ? [1.0, 0.72, 0.42] : [1.0, 0.5, 0.4];
    },
  },
  // L4 — occasional nearby glowing stars, slow drift, lens-bloom scale
  {
    count: 40, rMin: 12000, rMax: 26000, thetaMax: 0.95, clusterFrac: 0.28, wobble: 46, frag: starFrag,
    size: (r) => 1300 + r() * 2400,
    color: (r) => (r() < 0.5 ? [0.6, 0.72, 1.0] : [1.0, 0.85, 0.66]),
  },
  // Tiny unresolved galaxies — pale smudges far beyond the stars
  {
    count: 130, rMin: 80000, rMax: 106000, thetaMax: 1.2, clusterFrac: 0.5, wobble: 0, frag: hazeFrag,
    size: (r) => 280 + r() * 780,
    color: (r) => {
      const t = r();
      return t < 0.4 ? [0.12, 0.13, 0.19] : t < 0.7 ? [0.17, 0.13, 0.12] : [0.1, 0.13, 0.18];
    },
  },
  // Diffuse interstellar dust / nebula wisps — subtle color filling the void
  {
    count: 66, rMin: 34000, rMax: 82000, thetaMax: 1.12, clusterFrac: 0.4, wobble: 24, frag: hazeFrag,
    size: (r) => 6000 + r() * 11000,
    color: (r) => {
      const t = r();
      return t < 0.4 ? [0.03, 0.036, 0.052] : t < 0.72 ? [0.048, 0.03, 0.05] : [0.052, 0.04, 0.03];
    },
  },
];

function GalaxyDeepField() {
  const mats = useMemo(
    () =>
      DEEP_LAYERS.map(
        (s) =>
          new THREE.ShaderMaterial({
            vertexShader: starVert,
            fragmentShader: s.frag,
            uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: s.wobble } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [],
  );
  const geos = useMemo(() => DEEP_LAYERS.map((s, i) => buildDeepLayer(s, 8100 + i * 137)), []);

  useFrame((state) => {
    for (const m of mats) m.uniforms.uTime.value = state.clock.elapsedTime;
  });
  useRevealDriver((v) => {
    for (const m of mats) m.uniforms.uFormation.value = v;
  });

  return (
    <group name="galaxy-deep-field">
      {geos.map((g, i) => (
        <points key={i} geometry={g} frustumCulled={false}>
          <primitive object={mats[i]} attach="material" />
        </points>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- *
 * 8) Ambient life — the void is never fully still. A few faint meteors
 *    streak across at long random intervals (one every ~20-40s), so a
 *    patient viewer keeps catching new motion. Pooled line segments,
 *    additive, anchored to the view frame.
 * ---------------------------------------------------------------- */
function GalaxyMeteors() {
  const N = 3;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const state = useRef(
    Array.from({ length: N }, (_, i) => ({
      life: -1,
      dur: 0,
      cooldown: 6 + i * 9 + Math.random() * 14,
      head: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      tint: new THREE.Color(),
      trail: 5200,
    })),
  );

  const spawn = (m: (typeof state.current)[number]) => {
    const dir = coneDir(Math.random, 0.85, new THREE.Vector3());
    const depth = 28000 + Math.random() * 26000;
    m.head.copy(GALAXY_CAM_POS).addScaledVector(dir, depth);
    // a lateral heading across the view plane
    const a = Math.random() * Math.PI * 2;
    m.vel
      .copy(GALAXY_RIGHT)
      .multiplyScalar(Math.cos(a))
      .addScaledVector(GALAXY_UP, Math.sin(a))
      .normalize()
      .multiplyScalar(16000 + Math.random() * 16000);
    m.dur = 1.1 + Math.random() * 1.3;
    m.life = m.dur;
    m.trail = 4200 + Math.random() * 5200;
    m.tint.setHSL(0.55 + Math.random() * 0.08, 0.4, 0.8);
  };

  useFrame((state_, delta) => {
    const arr = state.current;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const reduced = useQualityStore.getState().reducedMotion;
    for (let i = 0; i < N; i++) {
      const m = arr[i];
      let a = 0;
      if (m.life <= 0) {
        m.cooldown -= delta;
        // Only streak while the galaxy is present; silent inside the solar system.
        if (m.cooldown <= 0 && !reduced && galaxyPresence.value > 0.6) {
          spawn(m);
          m.cooldown = 20 + Math.random() * 22;
        }
      } else {
        m.life -= delta;
        m.head.addScaledVector(m.vel, delta);
        // fade in over the first 25%, out over the last 45%
        const p = 1 - m.life / m.dur;
        a = Math.min(p / 0.25, 1) * Math.min((1 - p) / 0.45, 1) * galaxyPresence.value;
      }
      const dir = m.vel.clone().normalize();
      const hx = m.head.x, hy = m.head.y, hz = m.head.z;
      const tx = hx - dir.x * m.trail, ty = hy - dir.y * m.trail, tz = hz - dir.z * m.trail;
      posAttr.setXYZ(i * 2, hx, hy, hz);
      posAttr.setXYZ(i * 2 + 1, tx, ty, tz);
      colAttr.setXYZ(i * 2, m.tint.r * a, m.tint.g * a, m.tint.b * a); // bright head
      colAttr.setXYZ(i * 2 + 1, 0, 0, 0); // fades to nothing at the tail
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </lineSegments>
  );
}

/** Warm core light — the galactic core as the dominant light source, with a
 *  very slow luminosity breath so the core never sits perfectly static. */
function CoreLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((state, delta) => {
    const l = lightRef.current;
    if (!l) return;
    // The core light follows galaxyPresence: full while the galaxy is the hero,
    // faded to nothing inside the solar system so the Sun at the origin is the
    // only light source there. Comes up with the galaxy behind the preloader.
    const breath = 1 + 0.07 * Math.sin(state.clock.elapsedTime * 0.12);
    const target = loadSignals.galaxyReady ? 1.4 * breath * galaxyPresence.value : 0;
    l.intensity = THREE.MathUtils.damp(l.intensity, target, 1.4, delta);
  });
  return <pointLight ref={lightRef} position={GALAXY_CENTER} color="#ffdcab" intensity={0} decay={0.4} distance={0} />;
}

export function HeroGalaxy() {
  return (
    <group name="hero-galaxy">
      <GalaxyPresenceDriver />
      <GalaxyDisc />
      <GalaxyStars />
      <GalaxyHaze />
      <CoreGlow />
      <GalaxyForeground />
      <GalaxyEnvironment />
      <GalaxyDeepField />
      <GalaxyMeteors />
      <CoreLight />
    </group>
  );
}
