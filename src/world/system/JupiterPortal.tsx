'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * Jupiter = the Perico ERP portal. The Great Red Spot is the way in: hovering
 * Jupiter awakens a warm glow and an "Enter Perico ERP" prompt; clicking travels
 * through the portal — for now, opening the live app in a new tab. (The full
 * cinematic dive into the Perico Universe is a later build; this is the seam.)
 */

const PERICO_URL = 'https://perico-erp.vercel.app/';

/** 1 while parked at the Jupiter chapter, 0 elsewhere. */
function jupiterFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.jupiter), 0.02, 0.06);
}

export function JupiterPortal({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const [hovered, setHovered] = useState(false);
  const glowMat = useRef<THREE.SpriteMaterial | null>(null);
  const spriteRef = useRef<THREE.Sprite | null>(null);
  const glowTex = useMemo(
    () =>
      makeGlowTexture([
        [0, 'rgba(255, 226, 178, 0.9)'],
        [0.4, 'rgba(255, 168, 90, 0.35)'],
        [1, 'rgba(255, 120, 60, 0)'],
      ]),
    [],
  );

  useFrame((state, delta) => {
    const on = jupiterFocus() > 0.4;
    if (!on && hovered) setHovered(false);
    const target = hovered && on ? 0.55 : 0;
    if (glowMat.current) {
      glowMat.current.opacity = THREE.MathUtils.damp(glowMat.current.opacity, target, 6, delta);
    }
    if (spriteRef.current) {
      // gentle breathing so the awakened portal feels alive
      const b = 1 + 0.05 * Math.sin(state.clock.elapsedTime * 1.4);
      const s = radius * 3.1 * b;
      spriteRef.current.scale.set(s, s, 1);
      spriteRef.current.visible = (glowMat.current?.opacity ?? 0) > 0.01;
    }
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (jupiterFocus() < 0.4) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    setHovered(false);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (jupiterFocus() < 0.4) return;
    e.stopPropagation();
    window.open(PERICO_URL, '_blank', 'noopener');
  };

  return (
    <group position={center}>
      {/* soft portal glow, fades in on hover */}
      <sprite ref={spriteRef} visible={false}>
        <spriteMaterial ref={glowMat} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* click target covering the disc */}
      <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <sphereGeometry args={[radius * 1.02, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <Html center position={[0, radius * 1.2, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#ffdca6',
              padding: '7px 12px',
              border: '1px solid rgba(255, 200, 140, 0.35)',
              borderRadius: 6,
              background: 'rgba(20, 12, 6, 0.55)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 0 24px rgba(255, 150, 70, 0.25)',
            }}
          >
            Enter Perico ERP →
          </div>
        </Html>
      )}
    </group>
  );
}
