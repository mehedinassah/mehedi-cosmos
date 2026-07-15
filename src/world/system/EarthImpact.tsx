'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { earthFocus } from '@/state/earthHoverStore';
import { EarthProbe } from '@/world/system/EarthProbe';

/**
 * EarthImpact — the living Earth's ambient layer plus its ONE touring probe.
 *
 * The story is told by a single small drone (EarthProbe) that visits each
 * region, faces the camera and projects a brief hologram. Everything here is
 * the quiet life around it: aurora, night-side lightning, a little debris.
 */

/* -------------------- night-side lightning (city blink) -------------------- */
const FLASHES = 4;
function Lightning({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const tex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(230,244,255,1)'],
      [0.4, 'rgba(150,200,255,0.5)'],
      [1, 'rgba(120,180,255,0)'],
    ]),
    [],
  );
  const mats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const nightDir = useMemo(() => center.clone().normalize(), [center]);
  const spots = useMemo(() => {
    const rng = mulberry(9137);
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < FLASHES; i++) {
      const n = new THREE.Vector3();
      for (let t = 0; t < 20; t++) {
        n.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
        if (n.dot(nightDir) > 0.35) break;
      }
      out.push(n.multiplyScalar(radius * 1.01));
    }
    return out;
  }, [nightDir, radius]);
  const st = useRef(spots.map((_, i) => ({ t: -1, next: 2 + i * 1.7 + Math.random() * 4 })));

  useFrame((_, delta) => {
    const f = earthFocus();
    for (let i = 0; i < FLASHES; i++) {
      const s = st.current[i];
      const m = mats.current[i];
      if (s.t < 0) {
        s.next -= delta;
        if (s.next <= 0 && f > 0.4) s.t = 0;
        if (m) m.opacity = 0;
      } else {
        s.t += delta;
        const a = s.t < 0.04 ? s.t / 0.04 : Math.max(0, 1 - (s.t - 0.04) / 0.16);
        if (m) m.opacity = a * 0.85 * f;
        if (s.t > 0.2) { s.t = -1; s.next = 3 + Math.random() * 7; }
      }
    }
  });

  return (
    <>
      {spots.map((p, i) => (
        <sprite key={i} position={p} scale={[radius * 0.45, radius * 0.45, 1]}>
          <spriteMaterial
            ref={(m) => { mats.current[i] = m; }}
            map={tex}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

/* -------------------- faint drifting debris + ISS -------------------- */
function SpaceDebris({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const bits = useMemo(() => {
    const rng = mulberry(5521);
    return Array.from({ length: 4 }, () => {
      const a = rng() * Math.PI * 2;
      const r = radius * (1.4 + rng() * 1.5);
      return new THREE.Vector3(Math.cos(a) * r, (rng() - 0.5) * radius * 0.9, Math.sin(a) * r);
    });
  }, [radius]);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.09;
  });
  return (
    <group ref={groupRef}>
      {bits.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[radius * 0.018, radius * 0.018, radius * 0.018]} />
          <meshBasicMaterial color="#59636f" transparent opacity={0.26} />
        </mesh>
      ))}
    </group>
  );
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function EarthImpact({ center, radius }: { center: THREE.Vector3; radius: number }) {
  return (
    <>
      <group position={center}>
        <Lightning center={center} radius={radius} />
        <SpaceDebris radius={radius} />
      </group>
      {/* The probe positions itself at `center`, so it lives outside the group. */}
      <EarthProbe center={center} radius={radius} />
    </>
  );
}
