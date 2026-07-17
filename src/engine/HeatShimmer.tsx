'use client';

import { forwardRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Effect } from 'postprocessing';
import { useDescentStore } from '@/state/descentStore';

/**
 * Heat shimmer — the star radiates so much energy the space just outside its
 * limb ripples like hot air over asphalt. A screen-space UV distortion
 * confined to a thin annulus around the sun's projected disc: the interior
 * stays crisp, and because the panel/nav are DOM (not in the WebGL canvas)
 * the text is never touched. Amplitude is tiny — felt, not noticed.
 */

const SUN_RADIUS_U = 120; // matches body.scaleU for 'sun'

const fragment = /* glsl */ `
uniform vec2 uSun;
uniform float uRadius;
uniform float uAspect;
uniform float uStrength;
uniform float uTime;

void mainUv(inout vec2 uv) {
  if (uStrength <= 0.00005) return;
  vec2 d = uv - uSun;
  d.x *= uAspect;
  float dist = length(d);
  // A band hugging the limb: zero inside the disc, peaks just outside, gone
  // by ~1.6 radii. The crisp photosphere interior is never disturbed.
  float band = smoothstep(uRadius * 1.6, uRadius * 1.02, dist)
             * smoothstep(uRadius * 0.9, uRadius * 1.03, dist);
  if (band <= 0.0) return;
  float ang = atan(d.y, d.x);
  // Rising, travelling ripples along and outward from the rim
  float ripple = sin(dist * 90.0 - uTime * 2.1) * 0.6
               + sin(ang * 24.0 + uTime * 0.8) * 0.4;
  vec2 dir = d / max(dist, 1e-4);
  dir.x /= uAspect;
  uv += dir * ripple * band * uStrength;
}
`;

class HeatShimmerEffect extends Effect {
  constructor() {
    super('HeatShimmerEffect', fragment, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uSun', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ['uRadius', new THREE.Uniform(0)],
        ['uAspect', new THREE.Uniform(1)],
        ['uStrength', new THREE.Uniform(0)],
        ['uTime', new THREE.Uniform(0)],
      ]),
    });
  }
}

const _v = new THREE.Vector3();

export const HeatShimmer = forwardRef<HeatShimmerEffect>(function HeatShimmer(_props, ref) {
  const effect = useMemo(() => new HeatShimmerEffect(), []);
  const size = useThree((s) => s.size);

  useFrame((state) => {
    const u = effect.uniforms;
    const cam = state.camera as THREE.PerspectiveCamera;
    // The sun sits at the world origin during the system chapter
    _v.set(0, 0, 0).project(cam);
    const uvx = _v.x * 0.5 + 0.5;
    const uvy = _v.y * 0.5 + 0.5;
    const dist = cam.position.length();
    const rNdc = SUN_RADIUS_U / dist / Math.tan((cam.fov * Math.PI) / 360);
    const rUv = rNdc * 0.5; // NDC (-1..1, height 2) -> uv (0..1)

    u.get('uSun')!.value.set(uvx, uvy);
    u.get('uRadius')!.value = rUv;
    u.get('uAspect')!.value = size.width / Math.max(1, size.height);
    u.get('uTime')!.value = state.clock.elapsedTime;

    const arrived = useDescentStore.getState().stage === 'ARRIVED';
    const onScreen = _v.z < 1 && uvx > -0.4 && uvx < 1.4 && uvy > -0.4 && uvy < 1.4;
    // Grows with approach: the more of the frame the star fills, the more its
    // heat warps the space at the limb (still tiny — felt, not noticed).
    const near = THREE.MathUtils.smoothstep(rUv, 0.08, 0.55);
    const target = arrived && onScreen ? 0.0006 + near * 0.0024 : 0.0;
    const cur = u.get('uStrength')!.value as number;
    u.get('uStrength')!.value = cur + (target - cur) * 0.08;
  });

  return <primitive ref={ref} object={effect} dispose={null} />;
});
