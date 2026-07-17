'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunActivity } from './sunActivity';

/**
 * Coronal loops — the fine magnetic field lines of the corona, the way SDO 171A
 * sees them: not a handful of thick ropes but HUNDREDS of thin, translucent
 * plasma filaments, bundled over a few active regions in the sunspot belts.
 *
 * Each loop is a thin additive arc rooted at two nearby footpoints, arching to
 * its own height along a curved field line, with its own life: it fades in,
 * burns, sometimes flares briefly brighter, then fades and re-seeds elsewhere
 * in its region with a new shape. The whole bundle drifts slowly with rotation,
 * so loops rotate to the limb and over the far side (occluded by the opaque
 * photosphere via depth test) and back. No loop stays identical for long.
 *
 * Cheap by construction: one LineSegments draw call. Positions are only rewritten
 * when a loop re-seeds (rare); every frame only the per-vertex brightness (color)
 * buffer is touched.
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

const N_REGIONS = 6;
const LOOPS_PER = 42; // ~252 loops total
const N_LOOPS = N_REGIONS * LOOPS_PER;
const SEG = 14; // points along a loop
const SEGV = (SEG - 1) * 2; // line-segment endpoint vertices per loop

type Region = { c: THREE.Vector3; T: THREE.Vector3; B: THREE.Vector3; axis: number };
type Loop = {
  region: Region;
  rng: () => number;
  born: number;
  dur: number;
  base: THREE.Color;
  baseBright: number;
  brightenAt: number;
  brightenAmp: number;
  pts: THREE.Vector3[];
};

const _tmp = new THREE.Vector3();
const _tang = new THREE.Vector3();
const _kink = new THREE.Vector3();
const _f1 = new THREE.Vector3();
const _f2 = new THREE.Vector3();

/** (Re)compute a loop's shape: new footpoints, height, curve, colour. */
function shapeLoop(lp: Loop, R: number) {
  const rng = lp.rng;
  const reg = lp.region;
  // Loops in an active region are a roughly PARALLEL arcade straddling the
  // magnetic neutral line, not a starburst — jitter the footpoint axis only a
  // little around the region's preferred axis.
  const phi = reg.axis + (rng() - 0.5) * 0.85;
  // footpoint axis (a tangent direction) and the perpendicular kink axis
  _tang.copy(reg.T).multiplyScalar(Math.cos(phi)).addScaledVector(reg.B, Math.sin(phi));
  _kink.copy(reg.T).multiplyScalar(-Math.sin(phi)).addScaledVector(reg.B, Math.cos(phi));
  const fsep = 0.025 + rng() * 0.085; // angular footpoint half-separation (rad)
  const height = R * (0.03 + rng() * rng() * 0.34); // apex height — mostly low, a few tall
  const kinkAmp = (rng() - 0.5) * 0.06; // gentle sideways lean of the arch
  _f1.copy(reg.c).addScaledVector(_tang, -fsep).normalize();
  _f2.copy(reg.c).addScaledVector(_tang, fsep).normalize();
  for (let s = 0; s < SEG; s++) {
    const t = s / (SEG - 1);
    const arch = Math.sin(Math.PI * t);
    _tmp.copy(_f1).multiplyScalar(1 - t).addScaledVector(_f2, t).normalize();
    const radial = R * 1.004 + height * arch;
    lp.pts[s].copy(_tmp).multiplyScalar(radial).addScaledVector(_kink, kinkAmp * R * arch);
  }
  // colour: gold at the cool end, near-white for the hot loops
  const hot = rng();
  lp.base.setRGB(1.0, 0.6 + hot * 0.3, 0.3 + hot * 0.42);
  lp.baseBright = 0.3 + rng() * 0.55;
  lp.dur = 8 + rng() * 18;
  lp.brightenAt = 0.28 + rng() * 0.4;
  lp.brightenAmp = rng() < 0.4 ? 0.5 + rng() * 0.9 : 0; // ~40% flare briefly
}

/** Write a loop's SEG points into the segment-pair position buffer. */
function writePositions(lp: Loop, pos: Float32Array, base: number) {
  for (let j = 0; j < SEG - 1; j++) {
    const a = lp.pts[j], b = lp.pts[j + 1];
    let o = base + j * 6;
    pos[o] = a.x; pos[o + 1] = a.y; pos[o + 2] = a.z;
    pos[o + 3] = b.x; pos[o + 4] = b.y; pos[o + 5] = b.z;
  }
}

const smooth = THREE.MathUtils.smoothstep;

export function CoronalLoops({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const posDirty = useRef(true);

  const { loops, geometry, material } = useMemo(() => {
    const rng = mulberry32(20260718);
    const regions: Region[] = [];
    for (let r = 0; r < N_REGIONS; r++) {
      // active regions in the sunspot belts: +-10..35 deg latitude
      const lat = (0.17 + rng() * 0.44) * (rng() < 0.5 ? -1 : 1);
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
      regions.push({ c, T, B, axis: rng() * Math.PI * 2 });
    }
    const loops: Loop[] = [];
    for (let i = 0; i < N_LOOPS; i++) {
      const lp: Loop = {
        region: regions[i % N_REGIONS],
        rng: mulberry32(101 + i * 9301),
        born: 0,
        dur: 0,
        base: new THREE.Color(),
        baseBright: 1,
        brightenAt: 0.4,
        brightenAmp: 0,
        pts: Array.from({ length: SEG }, () => new THREE.Vector3()),
      };
      shapeLoop(lp, radius);
      lp.born = -lp.rng() * lp.dur; // stagger the first generation across their lives
      loops.push(lp);
    }
    const positions = new Float32Array(N_LOOPS * SEGV * 3);
    const colors = new Float32Array(N_LOOPS * SEGV * 3);
    for (let i = 0; i < N_LOOPS; i++) writePositions(loops[i], positions, i * SEGV * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true, // the opaque photosphere occludes far-side loops for free
      blending: THREE.AdditiveBlending,
    });
    return { loops, geometry, material };
  }, [radius]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const ign = sunActivity.ignite;
    g.visible = ign > 0.03;
    if (!g.visible) return;
    g.rotation.y += delta * 0.012; // drift the bundle with rotation

    const t = state.clock.elapsedTime;
    const flare = sunActivity.flare;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    const pArr = pos.array as Float32Array;
    const cArr = col.array as Float32Array;

    for (let i = 0; i < N_LOOPS; i++) {
      const lp = loops[i];
      let life = (t - lp.born) / lp.dur;
      if (life >= 1) {
        shapeLoop(lp, radius);
        lp.born = t;
        writePositions(lp, pArr, i * SEGV * 3);
        posDirty.current = true;
        life = 0;
      }
      // fade in, burn, fade out
      let b = smooth(life, 0.0, 0.12) * (1 - smooth(life, 0.82, 1.0)) * lp.baseBright;
      // occasional brief flare-up partway through the life
      if (lp.brightenAmp > 0) {
        const d = (life - lp.brightenAt) / 0.07;
        b += lp.brightenAmp * Math.exp(-d * d) * lp.baseBright;
      }
      // region-wide sympathetic brightening while a real flare is erupting
      b *= 1 + flare * 0.5;
      // fine plasma flicker
      b *= 0.82 + 0.18 * Math.sin(t * 2.7 + i * 1.3);
      b *= ign;

      const r = lp.base.r * b, gg = lp.base.g * b, bb = lp.base.b * b;
      const off = i * SEGV * 3;
      for (let v = 0; v < SEGV; v++) {
        const o = off + v * 3;
        cArr[o] = r; cArr[o + 1] = gg; cArr[o + 2] = bb;
      }
    }
    col.needsUpdate = true;
    if (posDirty.current) { pos.needsUpdate = true; posDirty.current = false; }
  });

  return (
    <group ref={groupRef} visible={false}>
      <lineSegments geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
