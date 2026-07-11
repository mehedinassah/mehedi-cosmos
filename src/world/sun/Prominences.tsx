'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Animated plasma loops arcing off the limb — reads instantly as "active
 * star" vs "glowing ball". Cheap: a handful of thin curved tubes with
 * flickering emissive intensity, not a raymarched flare sim.
 */
function useLoopGeometry(radius: number, seed: number) {
  return useMemo(() => {
    const rng = mulberry32(seed);
    const baseAngle = rng() * Math.PI * 2;
    const height = radius * (0.35 + rng() * 0.55);
    const width = radius * (0.28 + rng() * 0.4);
    const tilt = (rng() - 0.5) * 0.6;

    const points: THREE.Vector3[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const arc = Math.sin(t * Math.PI); // 0 -> 1 -> 0
      const along = (t - 0.5) * width;
      const local = new THREE.Vector3(along, arc * height, 0);
      local.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), baseAngle);
      const surfacePoint = new THREE.Vector3(
        Math.cos(baseAngle) * radius,
        0,
        Math.sin(baseAngle) * radius,
      );
      points.push(local.add(surfacePoint.multiplyScalar(1 - arc * 0.15)));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 32, radius * 0.012, 6, false);
  }, [radius, seed]);
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Loop({ radius, seed }: { radius: number; seed: number }) {
  const geo = useLoopGeometry(radius, seed);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useMemo(() => seed * 3.7, [seed]);

  useFrame((state) => {
    if (matRef.current) {
      const flicker = 0.55 + 0.45 * Math.sin(state.clock.elapsedTime * 0.6 + phase);
      matRef.current.opacity = flicker;
    }
  });

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial
        ref={matRef}
        color="#ffb26b"
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function Prominences({ radius, ignite }: { radius: number; ignite: number }) {
  const seeds = useMemo(() => [3, 11, 19, 27, 41], []);
  return (
    <group visible={ignite > 0.05}>
      {seeds.map((s) => (
        <Loop key={s} radius={radius} seed={s} />
      ))}
    </group>
  );
}
