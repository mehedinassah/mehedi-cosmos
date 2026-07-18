'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunActivity } from './sunActivity';
import { sunCursor } from './sunCursor';

/**
 * Prominences + ionized gas — restrained, photoreal. NOT a constant storm: a
 * director keeps at most TWO active regions lit at a time, so only one or two
 * subtle magnetic loops exist at once. Each emerges from an active region,
 * arcs along its field line, holds for a few seconds, then fades — and a
 * DIFFERENT region lights up next, so loops disappear and reappear elsewhere.
 * Alongside them a faint, very slow drift of ionized-gas particles leaves the
 * limb and dissolves into space (glowing gas, never sparks).
 *
 * Everything is GPU-animated: static per-particle attributes + time in the
 * vertex shader, so the CPU only updates N_REG activity floats per frame. The
 * cursor perturbs the field — loops bend toward it and gas drifts toward it —
 * then settles back when it leaves.
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

const N_REG = 12; // candidate active regions (8-15); at most 2 lit at once
const N = 16000; // light particle budget
const GAS_FRAC = 0.45; // rest are prominence-arch particles
const MAX_ACTIVE = 2;

const vert = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uR;
uniform float uScale;
uniform float uIgnite;
uniform float uRegAct[${N_REG}];
uniform vec3 uCursorDir;
uniform float uCursorStr;

attribute vec3 aT;
attribute vec3 aB;
attribute float aRegion;
attribute vec4 aArc;   // phi, sep, height, phase
attribute vec4 aVar;   // along0, branch, seed, kind (0 arch, 1 gas)
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
  float phi = aArc.x, sep = aArc.y, height = aArc.z, phase = aArc.w;
  float along0 = aVar.x, branch = aVar.y, seed = aVar.z, kind = aVar.w;
  vec3 pos; float alpha; float size;

  if (kind < 0.5) {
    // ---- prominence arch (only visible while its region is lit) ----
    int ri = int(aRegion + 0.5);
    float act = uRegAct[ri];
    if (act < 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vColor = vec3(0.0); return; }
    vec3 c = normalize(position);
    vec3 tang = aT * cos(phi) + aB * sin(phi);
    vec3 kink = -aT * sin(phi) + aB * cos(phi);
    vec3 f1 = normalize(c - tang * sep);
    vec3 f2 = normalize(c + tang * sep);
    float s = along0;
    float arch = sin(3.14159265 * s);
    vec3 dir = normalize(mix(f1, f2, s));
    float h = height * uR * (0.35 + 0.65 * act);
    float radial = uR * 1.004 + h * arch;
    pos = dir * radial;
    // gentle field-line writhe, stronger toward the tip (no perfect curve)
    float tw = 0.2 + 1.1 * arch;
    pos += vnoise3(pos * 0.045 + uTime * 0.14 + seed) * uR * 0.03 * tw;
    pos += kink * branch * uR * (0.15 + 0.8 * s);
    // cursor bends the loop a few degrees toward the perturbation
    float near = smoothstep(0.4, 0.98, dot(normalize(pos), uCursorDir));
    pos += (uCursorDir - dir * dot(uCursorDir, dir)) * uCursorStr * near * arch * uR * 0.09;
    // bright dense base, dim wispy tip that dissolves into corona
    float fb = mix(1.25, 0.2, arch);
    float stream = 0.55 + 0.45 * sin((s * 5.0 - uTime * 1.0) * 6.2831 + seed * 10.0);
    float flick = 0.7 + 0.3 * vnoise(pos * 0.16 + uTime * 1.6);
    alpha = act * uIgnite * fb * stream * flick * 0.55; // subtle
    size = aSize * mix(1.4, 0.45, arch);
  } else {
    // ---- ionized gas: faint, very slow outward drift, dissolves into space ----
    vec3 dir = normalize(position);
    float sp = 0.02 + 0.03 * fract(seed * 3.0);
    float life = fract(uTime * sp + phase);
    float r = uR * 1.02 + life * uR * 1.15;
    // drift toward the cursor perturbation near it
    float near = smoothstep(0.2, 1.0, dot(dir, uCursorDir));
    dir = normalize(dir + uCursorDir * uCursorStr * near * 0.18);
    pos = dir * r + vnoise3(dir * 3.0 + uTime * 0.05 + seed) * uR * 0.04;
    float fade = sin(life * 3.14159265);
    alpha = fade * fade * uIgnite * 0.12; // faint glowing gas, not sparks
    size = aSize * (0.7 + 0.5 * life);
  }

  vColor = color * max(alpha, 0.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 40.0);
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
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

type Slot = { region: number; t: number; dur: number };

export function Prominences({ radius, ignite }: { radius: number; ignite: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, material, sched } = useMemo(() => {
    const rng = mulberry32(4472);
    const dirs: THREE.Vector3[] = [];
    const Ts: THREE.Vector3[] = [];
    const Bs: THREE.Vector3[] = [];
    const promPhi: number[] = [];
    const promSep: number[] = [];
    const promH: number[] = [];
    const promBranch: number[] = [];
    for (let r = 0; r < N_REG; r++) {
      const lat = (0.14 + Math.pow(rng(), 0.7) * 0.5) * (rng() < 0.5 ? -1 : 1);
      const lon = rng() * Math.PI * 2;
      const c = new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon),
      );
      const T = new THREE.Vector3().crossVectors(c, new THREE.Vector3(0, 1, 0));
      if (T.lengthSq() < 1e-4) T.set(1, 0, 0);
      T.normalize();
      const B = new THREE.Vector3().crossVectors(c, T).normalize();
      dirs.push(c); Ts.push(T); Bs.push(B);
      promPhi.push(rng() * Math.PI * 2);
      promSep.push(0.05 + rng() * 0.14);
      promH.push(0.22 + rng() * 0.42);
      promBranch.push(0.05 + rng() * 0.1);
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
      const seed = rng() * 100;
      const isGas = rng() < GAS_FRAC;
      if (!isGas) {
        const r = i % N_REG;
        aRegion[i] = r;
        position[i * 3] = dirs[r].x; position[i * 3 + 1] = dirs[r].y; position[i * 3 + 2] = dirs[r].z;
        aT[i * 3] = Ts[r].x; aT[i * 3 + 1] = Ts[r].y; aT[i * 3 + 2] = Ts[r].z;
        aB[i * 3] = Bs[r].x; aB[i * 3 + 1] = Bs[r].y; aB[i * 3 + 2] = Bs[r].z;
        const along0 = (1 - Math.cos(Math.PI * rng())) * 0.5; // dense at feet
        aArc[i * 4] = promPhi[r] + (rng() - 0.5) * 0.16;
        aArc[i * 4 + 1] = promSep[r];
        aArc[i * 4 + 2] = promH[r] * (0.85 + rng() * 0.3);
        aArc[i * 4 + 3] = 0;
        aVar[i * 4] = along0;
        aVar[i * 4 + 1] = (rng() - 0.5) * promBranch[r] * 2;
        aVar[i * 4 + 2] = seed;
        aVar[i * 4 + 3] = 0;
        aSize[i] = radius * (0.012 + rng() * 0.018);
        const hot = rng();
        color[i * 3] = 1.0; color[i * 3 + 1] = 0.62 + hot * 0.24; color[i * 3 + 2] = 0.34 + hot * 0.2;
      } else {
        // gas: random outward direction anywhere on the star
        const u = rng() * 2 - 1, a = rng() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
        aRegion[i] = 0;
        position[i * 3] = rr * Math.cos(a); position[i * 3 + 1] = u; position[i * 3 + 2] = rr * Math.sin(a);
        aArc[i * 4 + 3] = rng(); // phase
        aVar[i * 4 + 2] = seed;
        aVar[i * 4 + 3] = 1; // gas
        aSize[i] = radius * (0.02 + rng() * 0.03);
        color[i * 3] = 1.0; color[i * 3 + 1] = 0.66 + rng() * 0.16; color[i * 3 + 2] = 0.42 + rng() * 0.16;
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
        uCursorDir: { value: new THREE.Vector3(1, 0, 0) },
        uCursorStr: { value: 0 },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    const sched = {
      slots: [] as Slot[],
      nextSpawn: 3,
      rng,
    };
    return { geometry, material, sched };
  }, [radius]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const ign = sunActivity.ignite || ignite;
    g.visible = ign > 0.03;
    if (!g.visible) { sunActivity.storm = 0; return; }

    const t = state.clock.elapsedTime;
    const u = material.uniforms;
    u.uTime.value = t;
    u.uIgnite.value = ign;
    u.uCursorDir.value.copy(sunCursor.dir);
    u.uCursorStr.value = sunCursor.str;

    // director: keep at most MAX_ACTIVE prominences lit; spawn on a new region
    sched.nextSpawn -= delta;
    if (sched.nextSpawn <= 0 && sched.slots.length < MAX_ACTIVE) {
      const used = new Set(sched.slots.map((s) => s.region));
      let r = Math.floor(sched.rng() * N_REG);
      for (let k = 0; k < N_REG && used.has(r); k++) r = (r + 1) % N_REG;
      sched.slots.push({ region: r, t: 0, dur: 6 + sched.rng() * 7 }); // lives 6-13s
      sched.nextSpawn = 4 + sched.rng() * 7;
    }

    const arr = u.uRegAct.value as number[];
    for (let r = 0; r < N_REG; r++) arr[r] = 0;
    for (let i = sched.slots.length - 1; i >= 0; i--) {
      const s = sched.slots[i];
      s.t += delta;
      const life = s.t / s.dur;
      if (life >= 1) { sched.slots.splice(i, 1); continue; }
      // emerge, hold, fade — subtle
      const env = THREE.MathUtils.smoothstep(life, 0, 0.22)
        * (1 - THREE.MathUtils.smoothstep(life, 0.68, 1.0));
      arr[s.region] = Math.max(arr[s.region], env);
    }
    sunActivity.storm = 0; // storms retired: the star stays restrained
  });

  return (
    <group ref={groupRef} visible={false}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
