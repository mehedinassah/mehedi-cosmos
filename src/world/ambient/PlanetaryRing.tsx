'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';

/**
 * A single dominant ring system — composition anchor, not decoration.
 * Banded, semi-transparent, catches sun light at grazing angles.
 */
const ringVert = `
varying vec2 vUv;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const ringFrag = `
uniform float uInner;
uniform float uOuter;
uniform vec3 uSunPos;
uniform vec3 uTint;
varying vec2 vUv;
varying vec3 vPosW;

#include "chunks/noise3d.glsl"

void main() {
  float r = length(vUv - 0.5) * 2.0; // 0 at inner ring edge .. 1 at outer (plane UV based)
  float bandNoise = fbm(vec3(r * 26.0, 0.0, 0.0));
  float bands = smoothstep(0.2, 0.9, bandNoise) * 0.7 + 0.3;
  float gap = smoothstep(0.42, 0.46, bandNoise) * smoothstep(0.5, 0.46, bandNoise);
  float edgeFade = smoothstep(0.0, 0.06, r) * smoothstep(1.0, 0.9, r);

  vec3 L = normalize(uSunPos - vPosW);
  float lit = 0.4 + 0.6 * clamp(dot(vec3(0.0, 1.0, 0.0), L), 0.0, 1.0);

  vec3 col = uTint * bands * lit;
  float alpha = bands * edgeFade * (1.0 - gap * 0.8) * 0.55;
  gl_FragColor = vec4(col, alpha);
}`;

export function PlanetaryRing({
  center,
  radius,
  tiltDeg = 22,
  tint = '#c9b48f',
}: {
  center: THREE.Vector3;
  radius: number;
  tiltDeg?: number;
  tint?: string;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: assembleShader(ringVert, { OCTAVES: 4 }),
        fragmentShader: assembleShader(ringFrag, { OCTAVES: 4 }),
        uniforms: {
          uInner: { value: radius * 1.5 },
          uOuter: { value: radius * 2.6 },
          uSunPos: { value: new THREE.Vector3(0, 0, 0) },
          uTint: { value: new THREE.Color(tint) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [radius, tint],
  );

  return (
    <mesh position={center} rotation={[THREE.MathUtils.degToRad(90 - tiltDeg), 0, 0.35]}>
      <ringGeometry args={[radius * 1.5, radius * 2.6, 128, 1]} />
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}
