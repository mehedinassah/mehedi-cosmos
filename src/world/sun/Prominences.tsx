'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import loopVert from '@/shaders/materials/prominence/loop.vert';
import loopFrag from '@/shaders/materials/prominence/loop.frag';

/**
 * Solar prominences — magnetic ropes, not orange noodles. Each loop is a
 * tube SCAFFOLD whose vertices writhe under per-frame noise (twist, kink,
 * branch impression), whose plasma streams along it in strands, and which
 * lives a full life: grow out of the limb, burn, collapse, then be reborn
 * somewhere else on the star. No two loops, and no two lifetimes, match.
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

function buildLoopGeometry(radius: number, rng: () => number): THREE.TubeGeometry {
  const baseAngle = rng() * Math.PI * 2;
  const baseLat = (rng() - 0.5) * 1.1; // stay near the activity belts
  const height = radius * (0.3 + rng() * 0.6);
  const width = radius * (0.24 + rng() * 0.45);
  const tilt = (rng() - 0.5) * 0.8;

  const points: THREE.Vector3[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const arc = Math.sin(t * Math.PI);
    const along = (t - 0.5) * width;
    const local = new THREE.Vector3(along, arc * height, 0);
    local.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), baseAngle);
    const surfacePoint = new THREE.Vector3(
      Math.cos(baseAngle) * Math.cos(baseLat) * radius,
      Math.sin(baseLat) * radius,
      Math.sin(baseAngle) * Math.cos(baseLat) * radius,
    );
    points.push(local.add(surfacePoint.multiplyScalar(1 - arc * 0.12)));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 40, radius * 0.011, 6, false);
}

const LOOP_COUNT = 5;

function Loop({ radius, seed }: { radius: number; seed: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const state = useRef({
    rng: mulberry32(seed),
    born: -seed * 3.1, // stagger first generation
    duration: 0,
    seedU: seed * 0.73,
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: assembleShader(loopVert, { OCTAVES: 3 }),
        fragmentShader: assembleShader(loopFrag, { OCTAVES: 3 }),
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed * 0.73 },
          uLife: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [seed],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => buildLoopGeometry(radius, state.current.rng), [radius]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const s = state.current;
    if (s.duration === 0) s.duration = 22 + s.rng() * 26; // 22-48s per life
    let life = (t - s.born) / s.duration;
    if (life >= 1) {
      // Reborn: new place on the star, new shape, new pace
      s.born = t;
      s.duration = 22 + s.rng() * 26;
      s.seedU = s.rng() * 100;
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        meshRef.current.geometry = buildLoopGeometry(radius, s.rng);
      }
      life = 0;
    }
    material.uniforms.uTime.value = t;
    material.uniforms.uLife.value = Math.max(0, life);
    material.uniforms.uSeed.value = s.seedU;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}

export function Prominences({ radius, ignite }: { radius: number; ignite: number }) {
  const seeds = useMemo(() => Array.from({ length: LOOP_COUNT }, (_, i) => 3 + i * 8), []);
  return (
    <group visible={ignite > 0.05}>
      {seeds.map((s) => (
        <Loop key={s} radius={radius} seed={s} />
      ))}
    </group>
  );
}
