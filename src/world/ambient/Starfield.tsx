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
const BASE_COUNT = 14000;

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
      size[i] = 8 + rng() * 26;
      seed[i] = rng();
      order[i] = rng();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
    return g;
  }, [particleScale]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: { uTime: { value: 0 }, uFormation: { value: 0 } },
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
