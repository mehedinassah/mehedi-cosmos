'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import galaxyVert from '@/shaders/materials/galaxy_disc/galaxy.vert';
import galaxyFrag from '@/shaders/materials/galaxy_disc/galaxy.frag';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { useUiStore } from '@/state/uiStore';

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

const OUTER_RADIUS = 24000;
// ARMS must be an integer: the spiral pattern wraps across the atan() angle
// seam at the -x axis, and only an integer arm count stays continuous there.
const ARMS = 2.0;
const TWIST = 2.6;
// Disc-local angle of the destination-arm cue (shader beacon + star boost).
const BEACON_THETA = 2.2;

export const GALAXY_CENTER = new THREE.Vector3(9000, 3800, -46000);
export const GALAXY_TILT = new THREE.Euler(
  THREE.MathUtils.degToRad(38),
  THREE.MathUtils.degToRad(22),
  THREE.MathUtils.degToRad(-14),
);

const GALAXY_VIEW_DIR = new THREE.Vector3(0.06, 0.2, 1).normalize();
export const GALAXY_CAM_POS = GALAXY_CENTER.clone().addScaledVector(
  GALAXY_VIEW_DIR,
  OUTER_RADIUS * 2.5,
);
export const GALAXY_LOOK = GALAXY_CENTER.clone();

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
  let arms = Math.pow(smoothstep(0.22, 0.9, armWave), 1.3);
  const spurWave = Math.sin(ARMS * 2 * phase + 2.3) * 0.5 + 0.5;
  arms = Math.max(arms, Math.pow(smoothstep(0.7, 0.98, spurWave), 2) * 0.4);

  const lop = 0.72 + 0.28 * Math.sin(theta + rn * 1.2 + 0.9);
  const knots = smoothstep(0.34, 0.8, fbm(x * 0.00105 + 7, 41, z * 0.00105 + 7));
  const breaks = smoothstep(0.18, 0.44, fbm(x * 0.00034 + 31, 97, z * 0.00034 + 31));
  const armLight = arms * (0.3 + 0.95 * knots) * breaks * lop;

  const radialFalloff = smoothstep(1, 0.32, rn) * (0.32 + 0.68 * smoothstep(0.015, 0.16, rn));
  const coreBulge = smoothstep(0.16, 0, rn);
  return armLight * radialFalloff + coreBulge;
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
  speed = 0.6,
  particleValue = 0.15,
) {
  const v = useRef(0);
  useFrame((_, delta) => {
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' ? 0 : phase === 'PARTICLE' ? particleValue : 1;
    v.current = THREE.MathUtils.damp(v.current, target, speed, delta);
    apply(v.current);
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
 *    resolve as soft glows at the hero camera distance (~72k units), not
 *    1-px dots: that hard-particle look is what read as "procedural".
 * ---------------------------------------------------------------- */
function GalaxyStars() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const targetCount = 24000;
    const pos = new Float32Array(targetCount * 3);
    const size = new Float32Array(targetCount);
    const seed = new Float32Array(targetCount);
    const order = new Float32Array(targetCount);
    const color = new Float32Array(targetCount * 3);
    const rng = mulberry32(777);

    let i = 0;
    let attempts = 0;
    while (i < targetCount && attempts < targetCount * 40) {
      attempts++;
      const r = Math.pow(rng(), 0.55) * OUTER_RADIUS;
      const theta = rng() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const rn = r / OUTER_RADIUS;

      let density = armDensity(x, z);
      density *= 1 + beaconBoost(x, z) * 1.1; // richer stellar neighborhood on the destination arm
      if (rng() > density * 0.9 + 0.03) continue;

      // Gaussian-ish vertical spread, flaring thicker toward the core
      const thickness = (1 - rn) * 1100 + 80;
      const y = ((rng() + rng() + rng() - 1.5) / 1.5) * thickness * 0.5;
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
  }, 0.6, 0.2);

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
const hazeFrag = /* glsl */ `
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
  }, 0.5, 0.05);

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
function makeGlowTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function CoreGlow() {
  const coreRef = useRef<THREE.SpriteMaterial>(null);
  const haloRef = useRef<THREE.SpriteMaterial>(null);

  const [coreTex, haloTex] = useMemo(
    () => [
      makeGlowTexture([
        [0, 'rgba(255,244,214,1)'],
        [0.25, 'rgba(255,214,150,0.55)'],
        [0.6, 'rgba(255,180,110,0.14)'],
        [1, 'rgba(255,170,100,0)'],
      ]),
      makeGlowTexture([
        [0, 'rgba(255,220,170,0.5)'],
        [0.5, 'rgba(200,170,255,0.08)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    ],
    [],
  );

  useRevealDriver((v) => {
    if (coreRef.current) coreRef.current.opacity = v * 0.95;
    if (haloRef.current) haloRef.current.opacity = v * 0.4;
  }, 0.5, 0.05);

  return (
    <group position={GALAXY_CENTER}>
      <sprite scale={[6500, 6500, 1]}>
        <spriteMaterial
          ref={coreRef}
          map={coreTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>
      <sprite scale={[18000, 18000, 1]}>
        <spriteMaterial
          ref={haloRef}
          map={haloTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>
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
  }, 0.7, 0.02);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}

/** Warm core light — the galactic core as the dominant light source. */
function CoreLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((_, delta) => {
    const l = lightRef.current;
    if (!l) return;
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' || phase === 'PARTICLE' ? 0 : 1.4;
    l.intensity = THREE.MathUtils.damp(l.intensity, target, 0.8, delta);
  });
  return <pointLight ref={lightRef} position={GALAXY_CENTER} color="#ffd9a8" intensity={0} decay={0.4} distance={0} />;
}

export function HeroGalaxy() {
  return (
    <group name="hero-galaxy">
      <GalaxyDisc />
      <GalaxyStars />
      <GalaxyHaze />
      <CoreGlow />
      <GalaxyForeground />
      <CoreLight />
    </group>
  );
}
