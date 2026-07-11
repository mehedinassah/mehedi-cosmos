'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import sunVert from '@/shaders/materials/sun_plasma/sun.vert';
import sunFrag from '@/shaders/materials/sun_plasma/sun.frag';
import { useQualityStore } from '@/state/qualityStore';
import { useUiStore } from '@/state/uiStore';
import { bodyById } from '@/content/universe';

/**
 * The Sun — Mehedi Hassan. Always visible (blueprint §3.1).
 * Foundation build: plasma sphere + fresnel limb. Corona shell,
 * flare system, and identity emergence arrive in World Rendering phase.
 */
export function CentralStar() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const tier = useQualityStore((s) => s.tier);
  const body = bodyById.get('sun')!;

  const material = useMemo(() => {
    const octaves = tier >= 3 ? 5 : tier === 2 ? 4 : 3;
    return new THREE.ShaderMaterial({
      vertexShader: sunVert,
      fragmentShader: assembleShader(sunFrag, { OCTAVES: octaves }),
      uniforms: {
        uTime: { value: 0 },
        uIgnite: { value: 0 },
      },
    });
  }, [tier]);

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    // Identity emerges as the intro reaches IDENTITY/HANDOFF
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' || phase === 'PARTICLE' ? 0 : phase === 'FORMATION' ? 0.35 : 1;
    m.uniforms.uIgnite.value = THREE.MathUtils.damp(m.uniforms.uIgnite.value, target, 1.2, state.clock.getDelta() + 1 / 60);
  });

  return (
    <mesh name="sun" userData={{ bodyId: 'sun' }}>
      <sphereGeometry args={[body.scaleU, 96, 96]} />
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}
