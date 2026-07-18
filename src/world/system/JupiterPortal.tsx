'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP, systemPose } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { portalDive } from '@/state/portalDive';

/**
 * Jupiter = the Perico ERP portal. Hovering Jupiter awakens a warm glow and a
 * swirling vortex begins to form over the Great Red Spot with an "Enter Perico
 * ERP" prompt. Clicking OPENS the portal: the black-hole vortex spins up and its
 * dark eye widens, the camera falls through it (CameraDirector reads portalDive),
 * the frame fills, and the scene lands on the live Perico app.
 */

const PERICO_URL = 'https://perico-erp.vercel.app/';
const DIVE_DURATION = 2.4; // seconds from click to landing

function jupiterFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.jupiter), 0.02, 0.06);
}

const vortexVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const vortexFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uT;       // dive progress 0..1
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  // logarithmic swirl arms spinning inward
  float spiral = sin(a * 3.0 + log(r + 0.05) * 7.0 - uTime * 5.0);
  float glow = smoothstep(0.15, 1.0, spiral) * smoothstep(1.05, 0.12, r);
  glow += 0.4 * smoothstep(0.5, 1.0, sin(a * 6.0 + log(r + 0.05) * 11.0 + uTime * 3.0)) * smoothstep(1.0, 0.2, r);
  // the dark eye stays tight while the swirl spins up, then widens late to
  // swallow the frame right before the landing
  float coreR = 0.06 + smoothstep(0.42, 1.0, uT) * 1.7;
  float coreMask = smoothstep(coreR, coreR - 0.18, r);
  float rim = smoothstep(0.06, 0.0, abs(r - coreR)) * (1.0 - coreMask);
  vec3 col = uColor * glow * 1.5 + vec3(1.0, 0.82, 0.55) * rim * 1.2;
  col = mix(col, vec3(0.0), coreMask); // opaque black core
  float alpha = max(coreMask, glow + rim) * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export function JupiterPortal({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const [hovered, setHovered] = useState(false);
  const [diving, setDiving] = useState(false);
  const glowMat = useRef<THREE.SpriteMaterial | null>(null);
  const glowSprite = useRef<THREE.Sprite | null>(null);
  const vortex = useRef<THREE.Mesh | null>(null);
  const vortexMat = useRef<THREE.ShaderMaterial | null>(null);
  const navigated = useRef(false);
  const opacity = useRef(0);

  const glowTex = useMemo(
    () =>
      makeGlowTexture([
        [0, 'rgba(255, 226, 178, 0.9)'],
        [0.4, 'rgba(255, 168, 90, 0.35)'],
        [1, 'rgba(255, 120, 60, 0)'],
      ]),
    [],
  );

  // Vortex sits on the Great-Red-Spot face (toward the camera); the camera
  // falls to a point just INSIDE the planet so it flies through the vortex.
  const vortexPoint = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.jupiter, pos, quat);
    const toCam = pos.clone().sub(center).normalize();
    portalDive.target.copy(center).addScaledVector(toCam, radius * 0.3);
    return center.clone().addScaledVector(toCam, radius * 1.0);
  }, [center, radius]);

  useFrame((state, delta) => {
    const on = jupiterFocus() > 0.4;
    if (!on && hovered) setHovered(false);

    // drive the dive
    if (portalDive.active) {
      portalDive.t = Math.min(1, portalDive.t + delta / DIVE_DURATION);
      if (portalDive.t >= 0.995 && !navigated.current) {
        navigated.current = true;
        window.location.href = PERICO_URL; // land in the live app
      }
    }

    // hover glow around the planet
    const glowTarget = (hovered && on) || portalDive.active ? 0.55 : 0;
    if (glowMat.current) glowMat.current.opacity = THREE.MathUtils.damp(glowMat.current.opacity, glowTarget, 6, delta);
    if (glowSprite.current) {
      const b = 1 + 0.05 * Math.sin(state.clock.elapsedTime * 1.4);
      const s = radius * 3.1 * b;
      glowSprite.current.scale.set(s, s, 1);
      glowSprite.current.visible = (glowMat.current?.opacity ?? 0) > 0.01;
    }

    // the vortex: faint forming swirl on hover, full black-hole on the dive
    const vopTarget = portalDive.active ? 1 : hovered && on ? 0.45 : 0;
    opacity.current = THREE.MathUtils.damp(opacity.current, vopTarget, 8, delta);
    const vm = vortex.current, vmat = vortexMat.current;
    if (vm && vmat) {
      const t = portalDive.active ? portalDive.t : 0;
      vm.visible = opacity.current > 0.01;
      vm.position.copy(vortexPoint);
      vm.quaternion.copy(camera.quaternion); // billboard
      const s = radius * (1.4 + (portalDive.active ? portalDive.t * 5.0 : 0.1 * Math.sin(state.clock.elapsedTime)));
      vm.scale.set(s, s, 1);
      vmat.uniforms.uTime.value = state.clock.elapsedTime;
      vmat.uniforms.uT.value = t;
      vmat.uniforms.uOpacity.value = opacity.current;
    }
  });

  const startDive = () => {
    if (portalDive.active) return;
    portalDive.t = 0;
    portalDive.active = true;
    navigated.current = false;
    setDiving(true);
    document.body.style.cursor = '';
  };

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (jupiterFocus() < 0.4 || portalDive.active) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    setHovered(false);
    if (!portalDive.active) document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (jupiterFocus() < 0.4 || portalDive.active) return;
    e.stopPropagation();
    startDive();
  };

  return (
    <group>
      <group position={center}>
        {/* soft portal glow, fades in on hover / dive */}
        <sprite ref={glowSprite} visible={false}>
          <spriteMaterial ref={glowMat} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        {/* click target covering the disc */}
        <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <sphereGeometry args={[radius * 1.02, 24, 24]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {hovered && !diving && (
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
      {/* the vortex portal — a billboarded swirl over the Great Red Spot */}
      <mesh ref={vortex} visible={false} frustumCulled={false} renderOrder={20}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={vortexMat}
          vertexShader={vortexVert}
          fragmentShader={vortexFrag}
          uniforms={{
            uTime: { value: 0 },
            uT: { value: 0 },
            uOpacity: { value: 0 },
            uColor: { value: new THREE.Color('#ffb060') },
          }}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
