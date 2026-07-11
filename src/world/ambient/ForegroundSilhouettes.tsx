'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Dark near-camera rock silhouettes — cinematography, not decoration.
 * Unlit, low-poly, edge-lit only by rim light from the sun direction.
 * These frame shots (foreground framing / leading lines) and sell depth
 * layering that a clean starfield alone can never provide.
 */
const rimVert = `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const rimFrag = `
uniform vec3 uSunPos;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 L = normalize(uSunPos - vPosW);
  float rim = pow(max(dot(n, L), 0.0), 2.2);
  vec3 col = vec3(0.03, 0.03, 0.04) + vec3(0.9, 0.6, 0.35) * rim * 0.8;
  gl_FragColor = vec4(col, 1.0);
}`;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ForegroundSilhouettes() {
  const groupRef = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        uniforms: { uSunPos: { value: new THREE.Vector3(0, 0, 0) } },
      }),
    [],
  );

  const rocks = useMemo(() => {
    const rng = mulberry32(505);
    return Array.from({ length: 6 }, () => ({
      // Placed close to origin-relative camera drift path — near-field only
      pos: new THREE.Vector3(
        (rng() - 0.5) * 900 - 300,
        (rng() - 0.5) * 260 - 80,
        900 + rng() * 500,
      ),
      scale: 18 + rng() * 46,
      rot: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI] as [number, number, number],
      driftSeed: rng() * 10,
    }));
  }, []);

  useFrame((_, delta) => {
    groupRef.current?.children.forEach((c, i) => {
      c.rotation.y += delta * 0.01 * (i % 2 === 0 ? 1 : -1);
    });
  });

  return (
    <group ref={groupRef} name="foreground-silhouettes">
      {rocks.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={r.rot} scale={r.scale}>
          <icosahedronGeometry args={[1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
