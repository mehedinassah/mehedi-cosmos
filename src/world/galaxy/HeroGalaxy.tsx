'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import galaxyVert from '@/shaders/materials/galaxy_disc/galaxy.vert';
import galaxyFrag from '@/shaders/materials/galaxy_disc/galaxy.frag';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { useUiStore } from '@/state/uiStore';

/**
 * The opening scene's centerpiece — a full galaxy, not a flat texture.
 * Two coupled layers share the same log-spiral density function so the
 * point-star layer actually concentrates along the shader's arms instead
 * of scattering independently:
 *   1) GalaxyDisc  — shader: arms, dust lanes, core bulge, pink/blue regions
 *   2) GalaxyStars — ~22k points, rejection-sampled against the identical
 *      spiral field, so individual bright stars sit ON the visible arms
 * Placed far along a fixed direction from the origin — the sun/planet
 * system never enters the intro frame; this is a clean visual replacement,
 * not a deletion of later-phase content.
 */

const OUTER_RADIUS = 24000;
const ARMS = 2.2;
const TWIST = 0.62;

// Galaxy world placement — tilted ~28° like the reference, positioned so
// it dominates frame per the intro camera's fixed approach vector, and
// off-center per rule of thirds (never perfectly centered on the origin axis).
export const GALAXY_CENTER = new THREE.Vector3(9000, 3800, -46000);
export const GALAXY_TILT = new THREE.Euler(
  THREE.MathUtils.degToRad(58),
  THREE.MathUtils.degToRad(18),
  THREE.MathUtils.degToRad(-12),
);

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same log-spiral density the shader uses — CPU-side, for star placement. */
function spiralDensity(r: number, theta: number): number {
  const rn = r / OUTER_RADIUS;
  const logSpiral = theta - TWIST * Math.log(Math.max(r, 1));
  const armWave = Math.sin(ARMS * logSpiral) * 0.5 + 0.5;
  const radial = Math.max(0, 1 - rn) * (0.4 + 0.6 * Math.min(1, rn / 0.15));
  return armWave * radial;
}

function GalaxyDisc() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: assembleShader(galaxyVert, { OCTAVES: 5 }),
        fragmentShader: assembleShader(galaxyFrag, { OCTAVES: 5 }),
        uniforms: {
          uTime: { value: 0 },
          uOuterRadius: { value: OUTER_RADIUS },
          uArms: { value: ARMS },
          uTwist: { value: TWIST },
          uReveal: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((state, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' ? 0 : phase === 'PARTICLE' ? 0.15 : 1;
    m.uniforms.uReveal.value = THREE.MathUtils.damp(m.uniforms.uReveal.value, target, 0.6, delta);
  });

  return (
    <mesh position={GALAXY_CENTER} rotation={GALAXY_TILT}>
      <circleGeometry args={[OUTER_RADIUS, 128]} />
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}

function GalaxyStars() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const targetCount = 22000;
    const pos = new Float32Array(targetCount * 3);
    const size = new Float32Array(targetCount);
    const seed = new Float32Array(targetCount);
    const order = new Float32Array(targetCount);
    const color = new Float32Array(targetCount * 3);
    const rng = mulberry32(777);

    let i = 0;
    let attempts = 0;
    while (i < targetCount && attempts < targetCount * 40) {
      attempts++;
      const r = Math.pow(rng(), 0.55) * OUTER_RADIUS;
      const theta = rng() * Math.PI * 2;
      const density = spiralDensity(r, theta);
      if (rng() > density * 0.95 + 0.05) continue; // rejection sample -> stars cluster on arms

      const thickness = (1 - r / OUTER_RADIUS) * 900 + 60;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = (rng() - 0.5) * thickness;
      pos.set([x, y, z], i * 3);
      size[i] = 3 + rng() * 14 + (r < OUTER_RADIUS * 0.12 ? rng() * 10 : 0);
      seed[i] = rng();
      order[i] = rng() * 0.4; // stars ignite fast, near-simultaneous with disc reveal
      const t = rng();
      const warmBias = 1 - r / OUTER_RADIUS;
      if (t < 0.5 + warmBias * 0.3) color.set([1.0, 0.92, 0.8], i * 3);
      else if (t < 0.82) color.set([0.7, 0.8, 1.0], i * 3);
      else color.set([1.0, 0.72, 0.82], i * 3);
      i++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, i * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size.subarray(0, i), 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed.subarray(0, i), 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order.subarray(0, i), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color.subarray(0, i * 3), 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' ? 0 : phase === 'PARTICLE' ? 0.2 : 1;
    m.uniforms.uFormation.value = THREE.MathUtils.damp(m.uniforms.uFormation.value, target, 0.6, delta);
  });

  return (
    <points position={GALAXY_CENTER} rotation={GALAXY_TILT} geometry={geometry} frustumCulled={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}

/** Warm core light — the galactic core as the dominant light source per brief. */
function CoreLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((state, delta) => {
    const l = lightRef.current;
    if (!l) return;
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' || phase === 'PARTICLE' ? 0 : 1.4;
    l.intensity = THREE.MathUtils.damp(l.intensity, target, 0.8, delta);
  });
  return <pointLight ref={lightRef} position={GALAXY_CENTER} color="#ffd9a8" intensity={0} decay={0.4} distance={0} />;
}

export function HeroGalaxy() {
  return (
    <group name="hero-galaxy">
      <GalaxyDisc />
      <GalaxyStars />
      <CoreLight />
    </group>
  );
}
