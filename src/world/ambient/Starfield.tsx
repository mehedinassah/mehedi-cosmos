'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { useQualityStore } from '@/state/qualityStore';
import { useUiStore } from '@/state/uiStore';

/**
 * Procedural instanced starfield — blueprint §7.1 (procedural-first).
 * Stars ignite progressively during formation (loading-paced intro, §13 L1).
 */
const BASE_COUNT = 24000;

export function Starfield() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const formationRef = useRef(0);
  const particleScale = useQualityStore((s) => s.particleScale);

  const geometry = useMemo(() => {
    const count = Math.floor(BASE_COUNT * particleScale) || 500;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const order = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const rng = mulberry32(42);
    for (let i = 0; i < count; i++) {
      // Shell distribution: distant sphere with mild galactic-plane bias
      const r = 20000 + rng() * 40000;
      const theta = rng() * Math.PI * 2;
      const bias = (rng() + rng() + rng()) / 3; // central-limit → plane clustering
      const phi = Math.acos(2 * bias - 1);
      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.55;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      // Magnitude range (gl_PointSize = aSize * 300 / dist, so at 20-60k these
      // are the on-screen classes): a faint sharp majority, a scattering of
      // brighter stars, and rare luminous giants the bloom catches.
      let s = 14 + rng() * rng() * 90; // faint pinpoints
      if (rng() < 0.1) s = 170 + rng() * 280; // brighter stars
      if (rng() < 0.022) s = 520 + rng() * 760; // rare giants (bloom)
      size[i] = s;
      seed[i] = rng();
      order[i] = rng();
      // Full stellar palette: white/yellow dwarfs, hot blue-white, blue
      // giants, orange, red giants, and faint distant blue-gray.
      const t = rng();
      if (t < 0.46) color.set([1.0, 0.97, 0.9], i * 3); // white / warm white
      else if (t < 0.64) color.set([0.74, 0.82, 1.0], i * 3); // blue-white
      else if (t < 0.75) color.set([0.55, 0.68, 1.0], i * 3); // blue giant
      else if (t < 0.86) color.set([1.0, 0.82, 0.55], i * 3); // orange
      else if (t < 0.94) color.set([1.0, 0.58, 0.42], i * 3); // red giant
      else color.set([0.66, 0.73, 0.86], i * 3); // faint distant
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    return g;
  }, [particleScale]);

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
    const target =
      phase === 'DARKNESS' ? 0 : phase === 'PARTICLE' ? 0.04 : phase === 'FORMATION' ? 0.8 : 1;
    formationRef.current = THREE.MathUtils.damp(formationRef.current, target, 0.8, delta);
    m.uniforms.uFormation.value = formationRef.current;
  });

  return (
    <points frustumCulled={false} geometry={geometry}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
