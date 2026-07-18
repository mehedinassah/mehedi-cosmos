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
 * Jupiter = the Perico ERP portal — and the planet itself opens. There is no
 * pasted-on vortex texture. Hovering wakes a warm glow over the Great Red Spot;
 * clicking begins the dive:
 *
 *   1) STORM   the eye darkens, cloud bands shear at different speeds, the
 *              atmosphere collapses inward (camera holds still, ~0.5s).
 *   2) OPEN    bands bend into the center, a dark throat opens and DEEPENS —
 *              not brighter, deeper — the opening widening like a tornado seen
 *              from above.
 *   3) FALL    gravity takes the camera; it accelerates down the throat.
 *   4) INSIDE  the frame fills with rushing orange cloud, lightning, fog.
 *   5) TUNNEL  a vertical hurricane — debris and gas streaming UP past the fall.
 *   6) DATA    the gas becomes glowing data, cloud becomes pixels, lightning
 *              becomes circuit traces.
 *   7) ARRIVE  the throat fills with light and the scene lands on the live app.
 *
 * The storm is a single camera-facing disc (a "windshield" during the fall,
 * always filling the frame) plus a stream of debris particles. CameraDirector
 * reads portalDive to do the freefall; this component drives the visuals and
 * the navigation.
 */

const PERICO_URL = 'https://perico-erp.vercel.app/';
const DIVE_DURATION = 5.5; // seconds from click to landing — room for all seven beats

function jupiterFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.jupiter), 0.02, 0.06);
}

const stormVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// The storm: banded jovian cloud in warped polar space that bends inward, opens
// a deepening black eye, then transforms into data. No arms, no drawn spiral —
// the darkness is depth, built from turbulent bands and receding parallax rings.
const stormFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uT;      // dive progress 0..1
uniform float uOpacity;
uniform float uFlash;  // lightning
uniform float uHover;  // 0 at rest hover, 1 during the dive (controls band contrast)
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);

  // inflow: bands bend inward and the swirl tightens toward the eye as it opens
  float inflow = smoothstep(0.04, 0.55, uT);
  float swirl = (0.5 + 2.4 * inflow) / (r + 0.16);
  float aw = ang + swirl - uTime * (0.35 + 1.7 * uT);
  float rw = mix(r, pow(r, 1.0 + 1.5 * inflow), 1.0);

  // banded, turbulent cloud (differential shear built into the angular term)
  float bands = fbm(vec2(aw * 1.3, rw * 3.4 - uTime * 0.12));
  bands += 0.5 * fbm(vec2(aw * 3.1 + 4.0, rw * 6.8 + uTime * 0.18));
  float cloud = smoothstep(0.15, 1.1, bands);

  // the throat — a dark eye that DEEPENS (nested receding rings), never brightens
  float coreR = 0.03 + smoothstep(0.0, 0.9, uT) * 0.95;
  float depth = smoothstep(coreR * 1.7, coreR * 0.15, r);
  float rings = 0.5 + 0.5 * sin(rw * 11.0 - uTime * 3.2 - uT * 7.0);
  float throat = depth * (1.0 - 0.4 * rings * (1.0 - depth));

  // color: jovian bands warming to the red-spot core, then flipping to data
  vec3 jov = mix(vec3(0.5, 0.33, 0.18), vec3(0.96, 0.82, 0.60), cloud);
  jov = mix(jov, vec3(0.78, 0.30, 0.14), smoothstep(0.55, 0.0, r) * 0.55);
  vec3 data = vec3(0.20, 0.92, 0.78);
  float toData = smoothstep(0.66, 0.9, uT);

  // pixelate the cloud into data cells as it transforms
  vec2 cell = floor(vUv * 60.0) / 60.0;
  float pix = fbm(cell * 8.0 + uTime * 0.4);
  vec3 col = mix(jov, data * (0.4 + 0.9 * pix), toData);

  // circuit traces come in with the data
  float circ = smoothstep(0.985, 1.0, sin(aw * 9.0) * sin(rw * 15.0));
  col += data * circ * toData * 1.4;

  float lum = 0.30 + 0.95 * cloud;
  col *= lum * (0.6 + 0.4 * uHover);
  col = mix(col, vec3(0.0), throat); // deep black eye

  // lightning: quick full-cloud flashes inside the atmosphere
  col += vec3(1.0, 0.96, 0.88) * uFlash * cloud * (1.0 - throat) * smoothstep(0.3, 0.6, uT);

  // arrival: the eye fills with light — the seam matches Perico's own warm
  // off-white first paint (rgb 250,249,247) so the cut into the app is seamless
  float arrive = smoothstep(0.9, 1.0, uT);
  col = mix(col, vec3(0.980, 0.976, 0.969), arrive);

  // soft round edge (invisible when the disc is oversized past the frame)
  float alpha = uOpacity * smoothstep(1.0, 0.72, r);
  alpha = max(alpha, throat * uOpacity);       // keep the black eye opaque
  alpha = max(alpha, arrive * uOpacity);       // and the final light
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

// Debris / gas streaming UP past the falling camera — the vertical-hurricane feel.
const debrisVert = /* glsl */ `
attribute float aSeed;
attribute float aAng;
attribute float aRad;
uniform float uTime;
uniform float uT;
uniform vec3 uCamPos;
uniform vec3 uFwd;    // fall direction (into the throat)
uniform vec3 uRight;
uniform vec3 uUp;
varying float vA;
void main(){
  float life = fract(aSeed + uTime * 0.5);
  // starts far ahead down the throat, rushes toward and past the camera
  float z = mix(320.0, -70.0, life);
  float rad = aRad * (0.7 + life * 0.7);
  vec3 wp = uCamPos + uFwd * z + uRight * cos(aAng) * rad + uUp * sin(aAng) * rad;
  vA = sin(life * 3.14159) * smoothstep(0.28, 0.5, uT);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  gl_PointSize = clamp((7.0 + aRad * 0.5) * (170.0 / -mv.z), 1.0, 30.0);
  gl_Position = projectionMatrix * mv;
}
`;

const debrisFrag = /* glsl */ `
precision highp float;
uniform float uT;
varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float m = smoothstep(0.5, 0.0, length(d));
  if (m * vA < 0.01) discard;
  vec3 warm = vec3(1.0, 0.62, 0.26);
  vec3 data = vec3(0.30, 0.95, 0.80);
  vec3 col = mix(warm, data, smoothstep(0.66, 0.9, uT));
  gl_FragColor = vec4(col, m * vA * 0.9);
}
`;

export function JupiterPortal({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const [hovered, setHovered] = useState(false);
  const [diving, setDiving] = useState(false);
  const glowMat = useRef<THREE.SpriteMaterial | null>(null);
  const glowSprite = useRef<THREE.Sprite | null>(null);
  const storm = useRef<THREE.Mesh | null>(null);
  const stormMat = useRef<THREE.ShaderMaterial | null>(null);
  const debrisMat = useRef<THREE.ShaderMaterial | null>(null);
  const navigated = useRef(false);
  const opacity = useRef(0);
  const flash = useRef(0);
  const nextFlash = useRef(0);

  const glowTex = useMemo(
    () =>
      makeGlowTexture([
        [0, 'rgba(255, 226, 178, 0.9)'],
        [0.4, 'rgba(255, 168, 90, 0.35)'],
        [1, 'rgba(255, 120, 60, 0)'],
      ]),
    [],
  );

  // Basis toward the camera at the Jupiter chapter: the storm sits on the near
  // (Great-Red-Spot) face; the fall target is deep on the far interior so the
  // camera truly plunges THROUGH the planet, not just up to its skin.
  const restPoint = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.jupiter, pos, quat);
    const toCam = pos.clone().sub(center).normalize();
    portalDive.target.copy(center).addScaledVector(toCam, -radius * 1.6);
    return center.clone().addScaledVector(toCam, radius * 1.0);
  }, [center, radius]);

  // debris cloud: random ring position + lifetime phase around the fall axis
  const debrisGeo = useMemo(() => {
    const n = 1400;
    const seed = new Float32Array(n);
    const ang = new Float32Array(n);
    const rad = new Float32Array(n);
    let s = 20789;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < n; i++) {
      seed[i] = rnd();
      ang[i] = rnd() * Math.PI * 2;
      rad[i] = 6 + rnd() * radius * 0.9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    return g;
  }, [radius]);

  // scratch vectors reused each frame (no per-frame allocation)
  const _fwd = useRef(new THREE.Vector3());
  const _right = useRef(new THREE.Vector3());
  const _up = useRef(new THREE.Vector3());
  const _pos = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const on = jupiterFocus() > 0.4;
    if (!on && hovered) setHovered(false);
    const t = portalDive.active ? portalDive.t : 0;

    // drive the dive clock + navigate on landing. Clamp delta so a single slow
    // frame (shader compile, GC hitch) can never teleport the dive past its
    // beats — the cinematic must always play through, not skip to the landing.
    if (portalDive.active) {
      portalDive.t = Math.min(1, portalDive.t + Math.min(delta, 0.05) / DIVE_DURATION);
      if (portalDive.t >= 0.985 && !navigated.current) {
        navigated.current = true;
        // __PORTAL_NO_NAV__ lets a headless capture hold the final beats instead
        // of leaving the page; never set in production.
        if (!(typeof window !== 'undefined' && (window as { __PORTAL_NO_NAV__?: boolean }).__PORTAL_NO_NAV__)) {
          window.location.href = PERICO_URL;
        }
      }
      // lightning: random flashes once we're inside the atmosphere
      nextFlash.current -= delta;
      if (t > 0.32 && t < 0.9 && nextFlash.current <= 0) {
        flash.current = 1;
        nextFlash.current = 0.18 + Math.random() * 0.5;
      }
      flash.current = THREE.MathUtils.damp(flash.current, 0, 9, delta);
    }

    // hover glow around the planet (also lit during the dive)
    const glowTarget = (hovered && on) || portalDive.active ? 0.55 : 0;
    if (glowMat.current) glowMat.current.opacity = THREE.MathUtils.damp(glowMat.current.opacity, glowTarget, 6, delta);
    if (glowSprite.current) {
      const b = 1 + 0.05 * Math.sin(state.clock.elapsedTime * 1.4);
      const s = radius * 3.1 * b;
      glowSprite.current.scale.set(s, s, 1);
      glowSprite.current.visible = (glowMat.current?.opacity ?? 0) > 0.01;
    }

    // camera basis for the windshield disc + debris stream
    const cam = camera as THREE.PerspectiveCamera;
    _fwd.current.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    _right.current.set(1, 0, 0).applyQuaternion(cam.quaternion).normalize();
    _up.current.set(0, 1, 0).applyQuaternion(cam.quaternion).normalize();

    // the storm disc: a small round spot on the planet's face at rest, and a
    // frame-filling windshield during the fall so the whole view IS the storm.
    const vopTarget = portalDive.active ? 1 : hovered && on ? 0.4 : 0;
    opacity.current = THREE.MathUtils.damp(opacity.current, vopTarget, 8, delta);
    const sm = storm.current, smat = stormMat.current;
    if (sm && smat) {
      sm.visible = opacity.current > 0.01;
      if (portalDive.active) {
        // ride in front of the camera, sized to overfill the frame
        const D = radius * 1.5;
        _pos.current.copy(cam.position).addScaledVector(_fwd.current, D);
        sm.position.copy(_pos.current);
        const vfov = (cam.fov * Math.PI) / 180;
        const scale = (D * Math.tan(vfov / 2)) / 0.42; // vertical half maps to r=0.42 → corners covered
        sm.scale.set(scale, scale, 1);
      } else {
        sm.position.copy(restPoint);
        sm.scale.setScalar(radius * 1.3);
      }
      sm.quaternion.copy(cam.quaternion); // billboard
      smat.uniforms.uTime.value = state.clock.elapsedTime;
      smat.uniforms.uT.value = t;
      smat.uniforms.uOpacity.value = opacity.current;
      smat.uniforms.uFlash.value = flash.current;
      smat.uniforms.uHover.value = portalDive.active ? 1 : 0.35;
    }

    // debris stream (only meaningful during the dive)
    if (debrisMat.current) {
      const u = debrisMat.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uT.value = t;
      u.uCamPos.value.copy(cam.position);
      u.uFwd.value.copy(_fwd.current);
      u.uRight.value.copy(_right.current);
      u.uUp.value.copy(_up.current);
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

      {/* the storm — a camera-facing disc: a spot on Jupiter at rest, the whole
          world during the dive. depthTest off so it reads over everything once
          the fall begins. */}
      <mesh ref={storm} visible={false} frustumCulled={false} renderOrder={20}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={stormMat}
          vertexShader={stormVert}
          fragmentShader={stormFrag}
          uniforms={{
            uTime: { value: 0 },
            uT: { value: 0 },
            uOpacity: { value: 0 },
            uFlash: { value: 0 },
            uHover: { value: 0.35 },
          }}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* debris / gas streaming up past the fall */}
      <points geometry={debrisGeo} frustumCulled={false} renderOrder={21}>
        <shaderMaterial
          ref={debrisMat}
          vertexShader={debrisVert}
          fragmentShader={debrisFrag}
          uniforms={{
            uTime: { value: 0 },
            uT: { value: 0 },
            uCamPos: { value: new THREE.Vector3() },
            uFwd: { value: new THREE.Vector3() },
            uRight: { value: new THREE.Vector3() },
            uUp: { value: new THREE.Vector3() },
          }}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
