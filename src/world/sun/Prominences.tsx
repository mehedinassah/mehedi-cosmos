'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunActivity } from './sunActivity';

/**
 * Magnetic activity — not "draw some loops" but "simulate an active star". The
 * surface carries N_REG active regions scattered around the belts; each region
 * owns a bundle of prominences and a fountain of micro-jets. Everything is one
 * GPU particle system: ~40k tiny plasma points whose motion is computed entirely
 * in the vertex shader from static per-particle attributes + time, so the CPU
 * only updates N_REG activity floats per frame (cheap) while the GPU animates
 * every particle.
 *
 * Each prominence is a VOLUME of particles, dense and bright at the footpoints,
 * thinning to a wispy dim tip that dissolves into the corona; magnetic
 * turbulence (3D noise, stronger toward the tip and late in life) makes it
 * writhe and branch instead of tracing a clean arc. Prominences emerge, grow,
 * twist, break apart and fade on staggered clocks, then their region re-seeds.
 * Micro-jets flicker out of the limb constantly; rarely a whole region STORMS —
 * a huge eruption that also brightens the corona and warms the scene light.
 * The opaque photosphere occludes the far side via the depth test.
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

const N_REG = 32; // active regions
const PROMS_PER = 3; // prominences per region — fewer + denser reads as real arches
const N = 60000; // plasma particles (GPU-animated)
const JET_FRAC = 0.18; // share that are micro-jets/sparks

const vert = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uR;
uniform float uScale;
uniform float uIgnite;
uniform float uRegAct[${N_REG}];

attribute vec3 aT;
attribute vec3 aB;
attribute float aRegion;
attribute vec4 aArc;   // phi, sep, height, phase
attribute vec4 aVar;   // along0, branch, seed, kind
attribute float aSize;

varying vec3 vColor;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 vnoise3(vec3 p){ return vec3(vnoise(p), vnoise(p + 31.4), vnoise(p + 57.1)) * 2.0 - 1.0; }

void main() {
  int ri = int(aRegion + 0.5);
  float act = uRegAct[ri];
  vec3 c = normalize(position);
  float phi = aArc.x, sep = aArc.y, height = aArc.z, phase = aArc.w;
  float along0 = aVar.x, branch = aVar.y, seed = aVar.z, kind = aVar.w;

  vec3 tang = aT * cos(phi) + aB * sin(phi);
  vec3 kink = -aT * sin(phi) + aB * cos(phi);

  vec3 pos; float alpha; float size;

  if (kind < 0.5) {
    // ---- prominence arch: a volume of plasma along a writhing field line ----
    float lifeRate = 0.026 + 0.02 * fract(seed * 7.0);
    float life = fract(uTime * lifeRate + phase);
    float grow = smoothstep(0.0, 0.16, life);
    float collapse = 1.0 - smoothstep(0.62, 1.0, life);
    float env = grow * collapse;

    vec3 f1 = normalize(c - tang * sep);
    vec3 f2 = normalize(c + tang * sep);
    float s = along0;                       // fixed -> stable base-dense/tip-thin gradient
    float arch = sin(3.14159265 * s);
    vec3 dir = normalize(mix(f1, f2, s));
    float h = height * uR * mix(0.18, 1.0, grow) * (0.75 + 0.7 * act); // grows w/ life + activity
    float radial = uR * 1.004 + h * arch;
    pos = dir * radial;
    // twist/turbulence: gentle at the feet, wilder at the tip; the arch holds
    // its writhing shape through growth, then breaks apart late in life
    float breakUp = 1.0 + 2.6 * smoothstep(0.6, 1.0, life);
    float tw = 0.22 + 1.3 * arch;
    pos += vnoise3(pos * 0.045 + uTime * 0.18 + seed) * uR * 0.042 * tw * breakUp;
    pos += kink * branch * uR * (0.15 + 0.95 * s);   // branching lateral spread
    // brightness: bright dense base, dim wispy tip that dissolves as it collapses
    float fb = mix(1.35, 0.22, arch);
    float wisp = 1.0 - smoothstep(0.6, 1.0, s) * smoothstep(0.5, 1.0, life);
    float stream = 0.5 + 0.5 * sin((s * 6.0 - uTime * 1.2) * 6.2831 + seed * 10.0);
    float flick = 0.65 + 0.35 * vnoise(pos * 0.18 + uTime * 2.0);
    alpha = env * act * uIgnite * fb * wisp * stream * flick;
    size = aSize * mix(1.5, 0.4, arch);
  } else {
    // ---- micro-jet / spark: shoots out of the limb, brief, fades ----
    float jr = 0.5 + fract(seed * 13.0) * 1.4;
    float jl = fract(uTime * jr + phase);
    vec3 dir = normalize(c + tang * sep * 0.5 + kink * branch * 0.5);
    float r = uR * 1.01 + jl * uR * (0.12 + 0.5 * fract(seed * 5.0)) * (0.5 + act);
    pos = dir * r + vnoise3(pos * 0.06 + uTime * 0.4 + seed) * uR * 0.02;
    float flick = 0.6 + 0.4 * vnoise(pos * 0.3 + uTime * 3.0);
    alpha = (1.0 - jl) * (1.0 - jl) * act * uIgnite * flick;
    size = aSize * (0.5 + 0.6 * (1.0 - jl));
  }

  vColor = color * max(alpha, 0.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 42.0);
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d));
  a *= a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a); // additive (SrcAlpha,One) -> adds vColor*a
}
`;

type RegionState = { base: number; pulse: number; storm: number; stormPeak: number; stormEnv: number };

export function Prominences({ radius, ignite }: { radius: number; ignite: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, material, regions, sched } = useMemo(() => {
    const rng = mulberry32(4472);
    // active regions scattered around the belts (a few stray higher-latitude)
    const dirs: THREE.Vector3[] = [];
    const Ts: THREE.Vector3[] = [];
    const Bs: THREE.Vector3[] = [];
    // per-region prominence params
    const promPhi: number[][] = [];
    const promSep: number[][] = [];
    const promH: number[][] = [];
    const promPhase: number[][] = [];
    const promBranch: number[][] = [];
    for (let r = 0; r < N_REG; r++) {
      const belt = rng() < 0.82;
      const lat = (belt ? 0.12 + Math.pow(rng(), 0.7) * 0.55 : rng() * 1.15) * (rng() < 0.5 ? -1 : 1);
      const lon = rng() * Math.PI * 2;
      const c = new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon),
      );
      const T = new THREE.Vector3().crossVectors(c, new THREE.Vector3(0, 1, 0));
      if (T.lengthSq() < 1e-4) T.set(1, 0, 0);
      T.normalize();
      const B = new THREE.Vector3().crossVectors(c, T).normalize();
      dirs.push(c); Ts.push(T); Bs.push(B);
      const axis = rng() * Math.PI * 2;
      const phis: number[] = [], seps: number[] = [], hs: number[] = [], phs: number[] = [], brs: number[] = [];
      for (let p = 0; p < PROMS_PER; p++) {
        phis.push(axis + (rng() - 0.5) * 1.1);
        seps.push(0.04 + rng() * 0.16);
        const big = rng() < 0.42;
        hs.push(big ? 0.38 + rng() * 0.6 : 0.07 + rng() * 0.2);
        phs.push(rng());
        brs.push(0.04 + rng() * 0.12);
      }
      promPhi.push(phis); promSep.push(seps); promH.push(hs); promPhase.push(phs); promBranch.push(brs);
    }

    const position = new Float32Array(N * 3);
    const aT = new Float32Array(N * 3);
    const aB = new Float32Array(N * 3);
    const aRegion = new Float32Array(N);
    const aArc = new Float32Array(N * 4);
    const aVar = new Float32Array(N * 4);
    const aSize = new Float32Array(N);
    const color = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      const r = i % N_REG;
      aRegion[i] = r;
      position[i * 3] = dirs[r].x; position[i * 3 + 1] = dirs[r].y; position[i * 3 + 2] = dirs[r].z;
      aT[i * 3] = Ts[r].x; aT[i * 3 + 1] = Ts[r].y; aT[i * 3 + 2] = Ts[r].z;
      aB[i * 3] = Bs[r].x; aB[i * 3 + 1] = Bs[r].y; aB[i * 3 + 2] = Bs[r].z;
      const isJet = rng() < JET_FRAC;
      const seed = rng() * 100;
      if (!isJet) {
        const p = Math.floor(rng() * PROMS_PER);
        // cosine spacing -> particles cluster at the FEET (dense base), thin at apex
        const along0 = (1 - Math.cos(Math.PI * rng())) * 0.5;
        aArc[i * 4] = promPhi[r][p] + (rng() - 0.5) * 0.14; // a few braided strands
        aArc[i * 4 + 1] = promSep[r][p];
        aArc[i * 4 + 2] = promH[r][p] * (0.8 + rng() * 0.35);
        aArc[i * 4 + 3] = promPhase[r][p]; // shared -> the prominence lives as one
        aVar[i * 4] = along0;
        aVar[i * 4 + 1] = (rng() - 0.5) * promBranch[r][p] * 2;
        aVar[i * 4 + 2] = seed;
        aVar[i * 4 + 3] = 0; // arch
        aSize[i] = radius * (0.012 + rng() * 0.02);
        const hot = rng();
        color[i * 3] = 1.0;
        color[i * 3 + 1] = 0.4 + hot * 0.22;
        color[i * 3 + 2] = 0.18 + hot * 0.16;
      } else {
        aArc[i * 4] = rng() * Math.PI * 2;
        aArc[i * 4 + 1] = 0.02 + rng() * 0.1;
        aArc[i * 4 + 2] = 0;
        aArc[i * 4 + 3] = rng();
        aVar[i * 4] = 0;
        aVar[i * 4 + 1] = (rng() - 0.5) * 0.6;
        aVar[i * 4 + 2] = seed;
        aVar[i * 4 + 3] = 1; // jet
        aSize[i] = radius * (0.008 + rng() * 0.014);
        color[i * 3] = 1.0;
        color[i * 3 + 1] = 0.6 + rng() * 0.25;
        color[i * 3 + 2] = 0.32 + rng() * 0.22;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 3));
    geometry.setAttribute('aB', new THREE.BufferAttribute(aB, 3));
    geometry.setAttribute('aRegion', new THREE.BufferAttribute(aRegion, 1));
    geometry.setAttribute('aArc', new THREE.BufferAttribute(aArc, 4));
    geometry.setAttribute('aVar', new THREE.BufferAttribute(aVar, 4));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 4);

    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uR: { value: radius },
        uScale: { value: 640 },
        uIgnite: { value: 0 },
        uRegAct: { value: new Array(N_REG).fill(0) },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    // per-region activity state + a scheduler for micro-eruptions and storms
    const regions: RegionState[] = Array.from({ length: N_REG }, () => ({
      base: 0.22 + rng() * 0.33,
      pulse: 0,
      storm: 0,
      stormPeak: 0,
      stormEnv: 0,
    }));
    const sched = { nextMicro: 0.6, nextStorm: 40 + rng() * 30, stormRegion: -1, rng };
    return { geometry, material, regions, sched };
  }, [radius]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const ign = sunActivity.ignite || ignite;
    g.visible = ign > 0.03;
    if (!g.visible) { sunActivity.storm = 0; return; }
    g.rotation.y += delta * 0.011; // whole activity field drifts with rotation

    const t = state.clock.elapsedTime;
    const u = material.uniforms;
    u.uTime.value = t;
    u.uIgnite.value = ign;

    // ---- scheduler: frequent micro-eruptions, rare full storms ----
    sched.nextMicro -= delta;
    if (sched.nextMicro <= 0) {
      // a few regions flicker up at once (dozens of tiny events over time)
      const bumps = 1 + Math.floor(sched.rng() * 3);
      for (let k = 0; k < bumps; k++) {
        const r = Math.floor(sched.rng() * N_REG);
        regions[r].pulse = Math.min(1.2, regions[r].pulse + 0.5 + sched.rng() * 0.7);
      }
      sched.nextMicro = 0.4 + sched.rng() * 1.3;
    }
    sched.nextStorm -= delta;
    if (sched.nextStorm <= 0 && sched.stormRegion < 0) {
      sched.stormRegion = Math.floor(sched.rng() * N_REG);
      regions[sched.stormRegion].stormPeak = 2.2 + sched.rng() * 0.8;
      regions[sched.stormRegion].storm = 0.0001;
      sched.nextStorm = 45 + sched.rng() * 45; // one every ~45-90s
    }

    const arr = u.uRegAct.value as number[];
    let globalStorm = 0;
    for (let r = 0; r < N_REG; r++) {
      const R = regions[r];
      R.pulse = Math.max(0, R.pulse - delta * 0.8); // micro pulses decay
      // storm envelope: rise fast, hold, decay slowly over ~14s
      if (R.storm > 0) {
        R.storm += delta;
        const st = R.storm;
        const env = Math.min(st / 1.5, 1) * (1 - THREE.MathUtils.smoothstep(st, 5, 14));
        R.stormEnv = env * R.stormPeak;
        if (st > 14) { R.storm = 0; R.stormEnv = 0; if (sched.stormRegion === r) sched.stormRegion = -1; }
        globalStorm = Math.max(globalStorm, env);
      } else {
        R.stormEnv = 0;
      }
      // slow breathing baseline so even quiet regions shimmer
      const breath = 1 + 0.35 * Math.sin(t * 0.3 + r * 1.7);
      arr[r] = R.base * breath + R.pulse + (R.stormEnv || 0);
    }
    sunActivity.storm = globalStorm; // corona + light react to the storm
  });

  return (
    <group ref={groupRef} visible={false}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
