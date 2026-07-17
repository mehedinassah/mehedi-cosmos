'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunActivity } from './sunActivity';

/**
 * Solar prominences — turbulent plasma, not glowing splines. Each prominence is
 * a STREAM of soft additive plasma particles flowing along a magnetic field line
 * that arcs between two footpoints rooted in the sunspot belts. There is no clean
 * tube: the particles are pushed around by evolving turbulence, vary in size so
 * the arc is thick in clumps and thin between them, and stream footpoint-to-
 * footpoint so the plasma visibly flows. Each prominence emerges, writhes, and
 * collapses on its own clock, then re-seeds at a new active region — so the limb
 * is always changing and no arc is ever a perfect curve.
 *
 * One Points draw call; the opaque photosphere occludes far-side prominences via
 * the depth test. Colours are baked per-particle (additive => colour == bright).
 */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N_PROM = 11; // prominences (roughly half are on the far side at any time)
const PARTS = 130; // plasma particles per prominence — dense enough to read as continuous
const N = N_PROM * PARTS;

const promVert = /* glsl */ `
attribute float aSize;
uniform float uScale;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
}
`;

const promFrag = /* glsl */ `
varying vec3 vColor;
void main() {
  // soft round plasma blob
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = smoothstep(0.5, 0.0, r);
  a *= a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

type Region = { c: THREE.Vector3; T: THREE.Vector3; B: THREE.Vector3 };
type Prom = {
  rng: () => number;
  f1: THREE.Vector3; // footpoint direction 1
  f2: THREE.Vector3; // footpoint direction 2
  kink: THREE.Vector3; // lean axis
  height: number;
  thick: number;
  born: number;
  dur: number;
  flow: number; // particle stream speed
  seed: number;
  base: THREE.Color; // orange core end
  tip: THREE.Color; // cooler reddish end
  thickK: Float32Array; // per-particle thickness variation
};

const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();
const _turb = new THREE.Vector3();

function beltRegion(rng: () => number): Region {
  const lat = (0.16 + rng() * 0.46) * (rng() < 0.5 ? -1 : 1); // +-9..36 deg
  const lon = rng() * Math.PI * 2;
  const c = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  );
  const T = new THREE.Vector3().crossVectors(c, new THREE.Vector3(0, 1, 0));
  if (T.lengthSq() < 1e-4) T.set(1, 0, 0);
  T.normalize();
  const B = new THREE.Vector3().crossVectors(c, T).normalize();
  return { c, T, B };
}

/** (Re)seed a prominence: new active region, arc shape, size, colour, life. */
function shapeProm(pr: Prom, R: number) {
  const rng = pr.rng;
  const reg = beltRegion(rng);
  const phi = rng() * Math.PI * 2;
  const tang = reg.T.clone().multiplyScalar(Math.cos(phi)).addScaledVector(reg.B, Math.sin(phi));
  pr.kink.copy(reg.T).multiplyScalar(-Math.sin(phi)).addScaledVector(reg.B, Math.cos(phi));
  const fsep = 0.05 + rng() * 0.16;
  pr.f1.copy(reg.c).addScaledVector(tang, -fsep).normalize();
  pr.f2.copy(reg.c).addScaledVector(tang, fsep).normalize();
  const big = rng() < 0.4;
  pr.height = R * (big ? 0.28 + rng() * 0.42 : 0.06 + rng() * 0.16);
  pr.thick = R * (big ? 0.06 + rng() * 0.05 : 0.038 + rng() * 0.03);
  pr.dur = big ? 22 + rng() * 30 : 8 + rng() * 12; // big ones live longer
  pr.flow = (0.03 + rng() * 0.06) * (rng() < 0.5 ? 1 : -1);
  pr.seed = rng() * 100;
  const hot = rng();
  pr.base.setRGB(1.0, 0.42 + hot * 0.16, 0.2 + hot * 0.12); // bright orange core
  pr.tip.setRGB(1.0, 0.34 + hot * 0.14, 0.26 + hot * 0.1); // slightly reddish
  for (let k = 0; k < PARTS; k++) pr.thickK[k] = 0.35 + pr.rng() * pr.rng() * 1.5; // clumpy
}

/** Evolving turbulence: smooth layered sines, cheap, reads as writhing plasma. */
function turb(p: THREE.Vector3, t: number, seed: number): THREE.Vector3 {
  const x = p.x, y = p.y, z = p.z;
  _turb.set(
    Math.sin(x * 0.055 + t * 0.5 + seed) + 0.5 * Math.sin(z * 0.11 - t * 0.4 + seed),
    Math.sin(y * 0.06 + t * 0.6 + seed * 1.3) + 0.5 * Math.sin(x * 0.05 + t * 0.32),
    Math.sin(z * 0.05 - t * 0.45 + seed) + 0.5 * Math.sin(y * 0.09 + t * 0.55),
  );
  return _turb;
}

const smooth = THREE.MathUtils.smoothstep;

export function Prominences({ radius, ignite }: { radius: number; ignite: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const { proms, geometry, material } = useMemo(() => {
    const proms: Prom[] = [];
    for (let i = 0; i < N_PROM; i++) {
      const pr: Prom = {
        rng: mulberry32(9173 + i * 2749),
        f1: new THREE.Vector3(), f2: new THREE.Vector3(), kink: new THREE.Vector3(),
        height: 0, thick: 0, born: 0, dur: 0, flow: 0, seed: 0,
        base: new THREE.Color(), tip: new THREE.Color(), thickK: new Float32Array(PARTS),
      };
      shapeProm(pr, radius);
      pr.born = -pr.rng() * pr.dur; // stagger first generation across their lives
      proms.push(pr);
    }
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: promVert,
      fragmentShader: promFrag,
      uniforms: { uScale: { value: 900 } },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true, // far-side prominences occluded by the opaque photosphere
      blending: THREE.AdditiveBlending,
    });
    return { proms, geometry, material };
  }, [radius]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const ign = sunActivity.ignite || ignite;
    g.visible = ign > 0.03;
    if (!g.visible) return;
    g.rotation.y += delta * 0.012; // drift with rotation

    const t = state.clock.elapsedTime;
    const flare = sunActivity.flare;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    const siz = geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const pArr = pos.array as Float32Array;
    const cArr = col.array as Float32Array;
    const sArr = siz.array as Float32Array;

    for (let i = 0; i < N_PROM; i++) {
      const pr = proms[i];
      let life = (t - pr.born) / pr.dur;
      if (life >= 1) { shapeProm(pr, radius); pr.born = t; life = 0; }
      // emerge -> hold -> collapse
      const env = smooth(life, 0.0, 0.16) * (1 - smooth(life, 0.7, 1.0));
      const promBright = env * ign * (1 + flare * 0.4);

      for (let k = 0; k < PARTS; k++) {
        const idx = i * PARTS + k;
        // stream along the arc: even base spacing + flow, wrapped
        let s = (k / PARTS + t * pr.flow + pr.seed) % 1;
        if (s < 0) s += 1;
        const arch = Math.sin(Math.PI * s);
        _dir.copy(pr.f1).multiplyScalar(1 - s).addScaledVector(pr.f2, s).normalize();
        const radial = radius * 1.005 + pr.height * arch;
        _p.copy(_dir).multiplyScalar(radial);
        // turbulence: strongest at the apex, pinned at the footpoints
        const amp = pr.thick * (0.6 + 2.2 * arch);
        const tb = turb(_p, t, pr.seed);
        _p.addScaledVector(pr.kink, tb.x * amp)
          .addScaledVector(pr.f1, tb.y * amp * 0.35)
          .addScaledVector(pr.f2, tb.z * amp * 0.35);
        pArr[idx * 3] = _p.x; pArr[idx * 3 + 1] = _p.y; pArr[idx * 3 + 2] = _p.z;

        // size varies per particle and along the arc -> uneven thickness, but a
        // raised floor keeps the dense stream reading as continuous plasma, not beads
        sArr[idx] = pr.thick * (0.55 + pr.thickK[k]) * (0.6 + 0.6 * arch);

        // brighter, hotter core at the feet; cooler thinning toward the apex.
        // per-particle flicker so the plasma shimmers.
        const feet = 0.75 + 0.5 * (1 - arch);
        const flick = 0.7 + 0.3 * Math.sin(t * 3.3 + idx * 0.7);
        const b = promBright * feet * flick * (0.5 + 0.9 * pr.thickK[k]);
        const c = arch > 0.5 ? pr.tip : pr.base;
        cArr[idx * 3] = c.r * b;
        cArr[idx * 3 + 1] = c.g * b;
        cArr[idx * 3 + 2] = c.b * b;
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    siz.needsUpdate = true;
  });

  return (
    <group ref={groupRef} visible={false}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
