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
 * Jupiter = the Perico ERP portal. The vortex is NOT drawn on top of Jupiter —
 * Jupiter's own surface does the work (see SolarSystem's JUP_DEFORM: the real
 * cloud bands swirl, wind inward and sink into a funnel). This component adds
 * only the things the deforming surface can't be: the accretion rim of plasma
 * around the black eye, gas + debris getting sucked INTO the hole, and the
 * throat the camera falls down. Everything here is world-anchored to the storm,
 * never a camera-facing billboard over the whole planet.
 *
 * Beats (one dive clock, portalDive.t): storm winds up → funnel opens and
 * DEEPENS → freefall down the throat → gas rushes past → data → light seam.
 */

const PERICO_URL = 'https://perico-erp.vercel.app/';
// Kept under the browser's ~5s user-activation window so the new tab opens at
// the end of the dive without being popup-blocked.
const DIVE_DURATION = 4.5;

function jupiterFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.jupiter), 0.02, 0.06);
}

/* ---- accretion rim: a glowing ring of plasma + arcs around the black eye ---- */
const rimVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const rimFrag = /* glsl */ `
precision highp float;
uniform float uTime, uT, uOpacity;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  // a SOFT ring hugging the eye — transparent centre so the black eye shows,
  // and a smooth fade to nothing by the plane edge (NO radial spikes, which is
  // what used to fling a ray halo across the whole frame)
  float ring = smoothstep(0.30, 0.52, r) * smoothstep(0.92, 0.58, r);
  // gentle plasma flicker around the ring — angular ripple, never radial arcs
  float flick = 0.72 + 0.28 * sin(a * 9.0 + uTime * 2.0) * sin(a * 3.0 - uTime * 1.3);
  ring *= flick;
  vec3 warm = vec3(1.0, 0.5, 0.18);
  vec3 data = vec3(0.3, 0.95, 0.8);
  vec3 col = mix(warm, data, smoothstep(0.66, 0.9, uT)) * ring * 0.85;
  float alpha = ring * uOpacity * 0.8;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

/* ---- gas + debris spiralling INTO the eye (sells the gravity) ---- */
const inflowVert = /* glsl */ `
attribute float aSeed;
attribute float aAng;
attribute float aRad;   // 0.3..1.7 (fraction of planet radius)
uniform float uTime, uT, uRadius;
uniform vec3 uEye, uAxis, uRight, uUp;  // axis points INTO the planet
varying float vA;
void main(){
  float life = fract(aSeed + uTime * 0.32);
  float rad = mix(aRad, 0.02, life) * uRadius;      // pulled in toward the eye
  float ang = aAng + life * 7.0;                     // winds as it falls (spiral)
  float depthIn = life * life * uRadius * 1.6;        // sinks into the hole, accelerating
  vec3 wp = uEye + (cos(ang) * uRight + sin(ang) * uUp) * rad + uAxis * depthIn;
  vA = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.72, 1.0, life)) * smoothstep(0.12, 0.4, uT);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  gl_PointSize = clamp((5.0 + aRad * 6.0) * (170.0 / -mv.z), 1.0, 26.0);
  gl_Position = projectionMatrix * mv;
}
`;
const inflowFrag = /* glsl */ `
precision highp float;
uniform float uT;
varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float m = smoothstep(0.5, 0.0, length(d));
  if (m * vA < 0.01) discard;
  vec3 warm = vec3(1.0, 0.62, 0.28);
  vec3 data = vec3(0.32, 0.95, 0.82);
  gl_FragColor = vec4(mix(warm, data, smoothstep(0.66, 0.9, uT)), m * vA * 0.34);
}
`;

/* ---- the throat: an inward tube the camera falls down (interior depth + data) ---- */
const throatVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const throatFrag = /* glsl */ `
precision highp float;
uniform float uTime, uT, uOpacity;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
void main(){
  // vUv.y runs down the tube; scroll it toward the camera (gas rushing past)
  float y = vUv.y;
  float fog = noise(vec2(vUv.x * 8.0, y * 6.0 - uTime * 1.4));
  fog += 0.5 * noise(vec2(vUv.x * 16.0 + 3.0, y * 12.0 - uTime * 2.2));
  fog = smoothstep(0.4, 1.2, fog);
  // deeper down the tube is darker (kilometres of throat receding to black)
  float depth = smoothstep(1.0, 0.1, y);
  vec3 warm = vec3(0.9, 0.42, 0.16);
  vec3 data = vec3(0.22, 0.9, 0.75);
  vec3 col = mix(warm, data, smoothstep(0.66, 0.9, uT)) * fog * depth * 0.6;
  float alpha = fog * depth * uOpacity * 0.8;
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
  const rim = useRef<THREE.Mesh | null>(null);
  const rimMat = useRef<THREE.ShaderMaterial | null>(null);
  const throat = useRef<THREE.Mesh | null>(null);
  const throatMat = useRef<THREE.ShaderMaterial | null>(null);
  const inflowMat = useRef<THREE.ShaderMaterial | null>(null);
  const navigated = useRef(false);
  const rimOp = useRef(0);

  const glowTex = useMemo(
    () =>
      makeGlowTexture([
        [0, 'rgba(255, 226, 178, 0.9)'],
        [0.4, 'rgba(255, 168, 90, 0.35)'],
        [1, 'rgba(255, 120, 60, 0)'],
      ]),
    [],
  );

  // Deterministic storm geometry: the eye faces the parked camera; the axis
  // runs INTO the planet (the way the camera falls); a fixed screen basis keeps
  // the rim + gas anchored to the storm (no swim as the camera rotates).
  const geo = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.jupiter, pos, quat);
    const toCam = pos.clone().sub(center).normalize();
    const eye = center.clone().addScaledVector(toCam, radius);
    const axisIn = toCam.clone().negate(); // into the planet
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCam).normalize();
    const up = new THREE.Vector3().crossVectors(toCam, right).normalize();
    // fall TO the eye (just above the sunk surface) — not through into a weak
    // interior. The spiralling planet + black eye fill the frame, then the seam.
    portalDive.target.copy(center).addScaledVector(toCam, radius * 0.85);
    // orient the rim plane to face the camera, and the throat tube down the axis
    const rimQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), toCam);
    const tubeQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisIn);
    const throatPos = eye.clone().addScaledVector(axisIn, radius * 1.1);
    return { toCam, eye, axisIn, right, up, rimQuat, tubeQuat, throatPos };
  }, [center, radius]);

  const inflowGeo = useMemo(() => {
    const n = 900;
    const seed = new Float32Array(n), ang = new Float32Array(n), rad = new Float32Array(n);
    let s = 20789;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    // keep the gas hugging the eye (<= planet radius) so bloom can't smear it
    // into a halo of rays around the whole planet
    for (let i = 0; i < n; i++) { seed[i] = rnd(); ang[i] = rnd() * Math.PI * 2; rad[i] = 0.12 + rnd() * 0.8; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    return g;
  }, []);

  useFrame((state, delta) => {
    const on = jupiterFocus() > 0.4;
    if (!on && hovered) setHovered(false);
    const t = portalDive.active ? portalDive.t : 0;

    if (portalDive.active) {
      // clamp so one slow frame can't teleport the dive past its beats
      portalDive.t = Math.min(1, portalDive.t + Math.min(delta, 0.05) / DIVE_DURATION);
      if (portalDive.t >= 0.985 && !navigated.current) {
        navigated.current = true;
        // __PORTAL_NO_NAV__ lets a headless capture hold the final beats.
        const noNav = typeof window !== 'undefined' && (window as { __PORTAL_NO_NAV__?: boolean }).__PORTAL_NO_NAV__;
        if (!noNav) {
          // Open Perico in a NEW tab, then close the portal so THIS tab snaps
          // back to the parked Jupiter view — returning to it looks like nothing
          // happened. NOTE: do NOT pass 'noopener' here — that makes window.open
          // always return null, which used to trip the "blocked" fallback and
          // navigate THIS tab too. Instead sever the opener reference manually
          // (same security, but a real return value to detect a popup block).
          const w = window.open(PERICO_URL, '_blank');
          if (w) {
            try { w.opener = null; } catch {}
            portalDive.active = false;
            portalDive.t = 0;
            navigated.current = false;
            setDiving(false);
            setHovered(false);
          } else {
            // truly popup-blocked → same-tab navigation so the app still opens
            window.location.href = PERICO_URL;
            return;
          }
        }
      }
    }

    // hover glow around the planet — bright on hover, but OFF during the dive:
    // a big additive sprite behind Jupiter blooms into a sun-like ray halo, and
    // the deforming planet + rim already carry the warmth
    if (glowMat.current) {
      const glowTarget = hovered && on && !portalDive.active ? 0.5 : 0;
      glowMat.current.opacity = portalDive.active
        ? 0
        : THREE.MathUtils.damp(glowMat.current.opacity, glowTarget, 6, delta);
    }
    if (glowSprite.current) {
      const b = 1 + 0.05 * Math.sin(state.clock.elapsedTime * 1.4);
      const s = radius * 3.1 * b;
      glowSprite.current.scale.set(s, s, 1);
      glowSprite.current.visible = (glowMat.current?.opacity ?? 0) > 0.01;
    }

    // accretion rim: fades in as the eye opens, grows a little as the funnel deepens
    const rimTarget = portalDive.active ? THREE.MathUtils.smoothstep(t, 0.15, 0.45) : 0;
    rimOp.current = THREE.MathUtils.damp(rimOp.current, rimTarget, 8, delta);
    if (rim.current && rimMat.current) {
      rim.current.visible = rimOp.current > 0.01;
      rim.current.position.copy(geo.eye).addScaledVector(geo.toCam, radius * 0.02);
      rim.current.quaternion.copy(geo.rimQuat);
      // tight on the eye (the spiral centre), never a big plane that can spike out
      const s = radius * (0.38 + 0.16 * t);
      rim.current.scale.set(s, s, 1);
      rimMat.current.uniforms.uTime.value = state.clock.elapsedTime;
      rimMat.current.uniforms.uT.value = t;
      rimMat.current.uniforms.uOpacity.value = rimOp.current;
    }

    // gas spiralling into the eye
    if (inflowMat.current) {
      const u = inflowMat.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uT.value = t;
      u.uRadius.value = radius;
      u.uEye.value.copy(geo.eye);
      u.uAxis.value.copy(geo.axisIn);
      u.uRight.value.copy(geo.right);
      u.uUp.value.copy(geo.up);
    }

    // the throat the camera falls down — fades in as we reach the surface
    if (throat.current && throatMat.current) {
      const to = portalDive.active ? THREE.MathUtils.smoothstep(t, 0.35, 0.6) : 0;
      throat.current.visible = to > 0.01;
      throatMat.current.uniforms.uTime.value = state.clock.elapsedTime;
      throatMat.current.uniforms.uT.value = t;
      throatMat.current.uniforms.uOpacity.value = to;
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
        <sprite ref={glowSprite} visible={false}>
          <spriteMaterial ref={glowMat} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
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

      {/* accretion rim of plasma hugging the black eye */}
      <mesh ref={rim} visible={false} frustumCulled={false} renderOrder={19}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={rimMat}
          vertexShader={rimVert}
          fragmentShader={rimFrag}
          uniforms={{ uTime: { value: 0 }, uT: { value: 0 }, uOpacity: { value: 0 } }}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* gas + debris being pulled into the hole */}
      <points geometry={inflowGeo} frustumCulled={false} renderOrder={18}>
        <shaderMaterial
          ref={inflowMat}
          vertexShader={inflowVert}
          fragmentShader={inflowFrag}
          uniforms={{
            uTime: { value: 0 }, uT: { value: 0 }, uRadius: { value: radius },
            uEye: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3() },
            uRight: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() },
          }}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* the throat the camera falls down (interior depth + the data walls) */}
      <mesh ref={throat} visible={false} frustumCulled={false} position={geo.throatPos} quaternion={geo.tubeQuat} renderOrder={17}>
        <cylinderGeometry args={[radius * 0.5, radius * 0.1, radius * 2.2, 40, 1, true]} />
        <shaderMaterial
          ref={throatMat}
          vertexShader={throatVert}
          fragmentShader={throatFrag}
          uniforms={{ uTime: { value: 0 }, uT: { value: 0 }, uOpacity: { value: 0 } }}
          transparent
          depthWrite={false}
          depthTest
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
