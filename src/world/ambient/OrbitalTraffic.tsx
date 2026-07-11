'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { universe, bodyById } from '@/content/universe';
import { bodyWorldPosition } from './ImpostorField';

/**
 * Orbital traffic + blinking satellites — small moving lights that sell
 * scale and "the universe is alive" without new interactive features.
 * Purely cosmetic, non-interactive, GPU-instanced.
 */
const TRAFFIC_HOSTS = ['planet.perico', 'planet.topline', 'station.ubicomply', 'fleet.github', 'planet.about'];
const COUNT_PER_HOST = 5;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function OrbitalTraffic() {
  const groupRef = useRef<THREE.Group>(null);
  const craft = useMemo(() => {
    const rng = mulberry32(99);
    return TRAFFIC_HOSTS.flatMap((hostId) => {
      const host = bodyById.get(hostId);
      if (!host) return [];
      const center = bodyWorldPosition(host);
      return Array.from({ length: COUNT_PER_HOST }, () => ({
        center,
        dist: host.scaleU * (2.0 + rng() * 2.5),
        speed: 0.06 + rng() * 0.18,
        incl: (rng() - 0.5) * 1.4,
        phase: rng() * Math.PI * 2,
        blinkSeed: rng() * 10,
      }));
    });
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightMeshRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = meshRef.current;
    const lights = lightMeshRef.current;
    if (!mesh || !lights) return;
    craft.forEach((c, i) => {
      const angle = c.phase + t * c.speed;
      const x = Math.cos(angle) * c.dist;
      const z = Math.sin(angle) * c.dist;
      const y = Math.sin(c.incl) * c.dist * 0.3;
      const pos = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), c.incl).add(c.center);
      dummy.position.copy(pos);
      dummy.lookAt(c.center);
      dummy.scale.setScalar(c.dist * 0.012);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const blink = Math.pow(Math.max(0, Math.sin(t * 3.2 + c.blinkSeed)), 8.0);
      dummy.scale.setScalar(c.dist * 0.018 * (0.3 + blink));
      dummy.updateMatrix();
      lights.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, craft.length]} frustumCulled={false}>
        <boxGeometry args={[1, 0.4, 1.8]} />
        <meshStandardMaterial color="#8a8f98" roughness={0.4} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={lightMeshRef} args={[undefined, undefined, craft.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#ff5544" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
