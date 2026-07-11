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

function coronaTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.0, 'rgba(255, 226, 180, 0.85)');
  g.addColorStop(0.25, 'rgba(255, 190, 120, 0.35)');
  g.addColorStop(0.55, 'rgba(255, 150, 80, 0.10)');
  g.addColorStop(1.0, 'rgba(255, 130, 60, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

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

  const corona = useMemo(() => coronaTexture(), []);
  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame((state) => {
    const sp = spriteRef.current;
    if (!sp) return;
    const ignite = matRef.current?.uniforms.uIgnite.value ?? 0;
    const breathe = 1 + 0.03 * Math.sin(state.clock.elapsedTime * 0.5);
    const sc = body.scaleU * 7 * breathe * ignite;
    sp.scale.set(sc, sc, 1);
    (sp.material as THREE.SpriteMaterial).opacity = 0.9 * ignite;
  });

  return (
    <group name="sun" userData={{ bodyId: 'sun' }}>
      <mesh>
        <sphereGeometry args={[body.scaleU, 96, 96]} />
        <primitive object={material} ref={matRef} attach="material" />
      </mesh>
      <sprite ref={spriteRef}>
        <spriteMaterial
          map={corona}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>
    </group>
  );
}
