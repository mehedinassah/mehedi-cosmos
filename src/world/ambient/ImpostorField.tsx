'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { universe, bodyById } from '@/content/universe';
import type { CelestialBody } from '@/content/schema';
import { useJourneyStore } from '@/state/journeyStore';
import { useUiStore } from '@/state/uiStore';

/**
 * COLD-state impostors — blueprint §3.2. Every body exists from frame one
 * as a cheap placeholder at its true position; full-fidelity region builds
 * replace these in the World Rendering phase.
 *
 * NOTE(foundation): orbital positions are frozen at `phase` (bodies self-rotate,
 * don't yet revolve). Live revolution requires travel targets that track moving
 * bodies — deferred to Camera System phase per plan.
 */

export function bodyWorldPosition(b: CelestialBody): THREE.Vector3 {
  if (!b.orbit) return new THREE.Vector3(0, 0, 0);
  const parent = b.parent ? bodyById.get(b.parent) : undefined;
  const origin = parent ? bodyWorldPosition(parent) : new THREE.Vector3();
  const angle = b.orbit.phase * Math.PI * 2;
  const inc = THREE.MathUtils.degToRad(b.orbit.inclinationDeg);
  const local = new THREE.Vector3(
    Math.cos(angle) * b.orbit.radiusU,
    Math.sin(inc) * b.orbit.radiusU * 0.25,
    Math.sin(angle) * b.orbit.radiusU,
  );
  return origin.add(local);
}

const KIND_TINT: Record<string, string> = {
  planet: '#8fa3b8',
  moon: '#9d93b5',
  constellation: '#cdd6ea',
  station: '#a8b0a6',
  observatory: '#7f8ea3',
  fleet: '#b0b6bd',
  nebula: '#b58fa6',
  blackhole: '#2a2a33',
};

function Impostor({ body }: { body: CelestialBody }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const position = useMemo(() => bodyWorldPosition(body), [body]);
  const requestTravel = useJourneyStore((s) => s.requestTravel);
  const setHoverTarget = useUiStore((s) => s.setHoverTarget);

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;
    m.rotation.y += delta * 0.05; // everything drifts, nothing is still
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, hovered ? 0.9 : 0.15, 8, delta);
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        userData={{ bodyId: body.id }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setHoverTarget(body.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setHoverTarget(null);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          e.stopPropagation();
          requestTravel(body.id);
        }}
      >
        <sphereGeometry args={[body.scaleU, 24, 24]} />
        <meshStandardMaterial
          color={KIND_TINT[body.kind] ?? '#888'}
          emissive={KIND_TINT[body.kind] ?? '#888'}
          emissiveIntensity={0.15}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      {hovered && (
        <Html center distanceFactor={body.scaleU * 12} style={{ pointerEvents: 'none' }}>
          <div className="holo-label">
            <span className="holo-label__name">{body.name}</span>
            <span className="holo-label__meaning">{body.meaning}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function ImpostorField() {
  const bodies = universe.bodies.filter((b) => b.id !== 'sun');
  return (
    <group name="impostors">
      {bodies.map((b) => (
        <Impostor key={b.id} body={b} />
      ))}
    </group>
  );
}
