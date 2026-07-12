'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { useQualityStore } from '@/state/qualityStore';
import { useUiStore } from '@/state/uiStore';

/**
 * Deep-space depth layers — foreground dust, midground stars (Starfield.tsx),
 * background Milky Way band + nebula haze. The viewer should constantly feel
 * depth; the void is never just black with dots.
 */

type CloudSpec = {
  count: number;
  wobble: number;
  place: (rng: () => number, i: number) => [number, number, number];
  size: (rng: () => number) => number;
  color: (rng: () => number) => [number, number, number];
};

function buildCloud(spec: CloudSpec, seed: number) {
  const { count } = spec;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tw = new Float32Array(count);
  const order = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = spec.place(rng, i);
    pos.set([x, y, z], i * 3);
    size[i] = spec.size(rng);
    tw[i] = rng();
    order[i] = rng();
    col.set(spec.color(rng), i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(tw, 1));
  g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  return g;
}

function useCloudMaterial(wobble: number) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: {
          uTime: { value: 0 },
          uFormation: { value: 0 },
          uWobble: { value: wobble },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [wobble],
  );
}

const MILKY_TILT = new THREE.Euler(THREE.MathUtils.degToRad(62), 0, THREE.MathUtils.degToRad(18));

export function DeepSpace() {
  const particleScale = useQualityStore((s) => s.particleScale);
  const mats = useRef<THREE.ShaderMaterial[]>([]);

  // Milky Way: dense tilted band of small warm/cool stars
  const milkyGeo = useMemo(() => {
    const q = new THREE.Quaternion().setFromEuler(MILKY_TILT);
    return buildCloud(
      {
        count: Math.floor(13000 * particleScale) || 600,
        wobble: 0,
        place: (rng) => {
          const r = 30000 + rng() * 28000;
          const a = rng() * Math.PI * 2;
          const thick = (rng() + rng() + rng() + rng() - 2) * 2600; // gaussian-ish
          const v = new THREE.Vector3(Math.cos(a) * r, thick, Math.sin(a) * r).applyQuaternion(q);
          return [v.x, v.y, v.z];
        },
        size: (rng) => 8 + rng() * 22,
        color: (rng) => {
          const t = rng();
          return t < 0.6 ? [1.0, 0.95, 0.86] : t < 0.85 ? [0.8, 0.86, 1.0] : [1.0, 0.8, 0.66];
        },
      },
      7,
    );
  }, [particleScale]);

  // Galactic haze: sparse, enormous, faint sprites tracing the same band
  const hazeGeo = useMemo(() => {
    const q = new THREE.Quaternion().setFromEuler(MILKY_TILT);
    return buildCloud(
      {
        count: 90,
        wobble: 0,
        place: (rng) => {
          const r = 32000 + rng() * 22000;
          const a = rng() * Math.PI * 2;
          const v = new THREE.Vector3(Math.cos(a) * r, (rng() - 0.5) * 3400, Math.sin(a) * r).applyQuaternion(q);
          return [v.x, v.y, v.z];
        },
        size: (rng) => 2600 + rng() * 4200,
        color: (rng) => {
          const t = rng();
          // muted dust tints — never neon
          return t < 0.5 ? [0.09, 0.085, 0.11] : t < 0.8 ? [0.11, 0.08, 0.07] : [0.06, 0.08, 0.11];
        },
      },
      11,
    );
  }, []);

  // Distant nebulae: a few soft color fields far off-band
  const nebulaGeo = useMemo(
    () =>
      buildCloud(
        {
          count: 38,
          wobble: 0,
          place: (rng) => {
            const r = 18000 + rng() * 26000; // pulled closer — some now read as frame-filling
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            return [
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.cos(phi) * 0.7,
              r * Math.sin(phi) * Math.sin(theta),
            ];
          },
          size: (rng) => 3800 + rng() * 9500, // hero nebulae, up from 3200-8400
          color: (rng) => {
            const t = rng();
            // kept faint — at full strength these read as bokeh blobs, not nebulae
            return t < 0.4 ? [0.13, 0.05, 0.1] : t < 0.7 ? [0.045, 0.08, 0.13] : [0.13, 0.075, 0.04];
          },
        },
        23,
      ),
    [],
  );

  // Tiny distant galaxies: pale smudges beyond the stars — the deepest layer
  const galaxiesGeo = useMemo(
    () =>
      buildCloud(
        {
          count: 70,
          wobble: 0,
          place: (rng) => {
            const r = 52000 + rng() * 9000;
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            return [
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.cos(phi) * 0.85,
              r * Math.sin(phi) * Math.sin(theta),
            ];
          },
          size: (rng) => 90 + rng() * 260,
          color: (rng) => {
            const t = rng();
            return t < 0.5 ? [0.16, 0.17, 0.22] : t < 0.8 ? [0.2, 0.16, 0.15] : [0.14, 0.17, 0.21];
          },
        },
        41,
      ),
    [],
  );

  // Foreground dust: near-field motes that drift — depth cue during travel
  const dustGeo = useMemo(
    () =>
      buildCloud(
        {
          count: Math.floor(3400 * particleScale) || 150,
          wobble: 55,
          place: (rng) => {
            const r = 250 + rng() * 5200; // closer-biased — stronger foreground depth cue
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            return [
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.cos(phi) * 0.6,
              r * Math.sin(phi) * Math.sin(theta),
            ];
          },
          size: (rng) => 2 + rng() * 6,
          color: () => [0.5, 0.52, 0.58],
        },
        31,
      ),
    [particleScale],
  );

  const milkyMat = useCloudMaterial(0);
  const hazeMat = useCloudMaterial(0);
  const nebulaMat = useCloudMaterial(0);
  const galaxiesMat = useCloudMaterial(0);
  const dustMat = useCloudMaterial(40);
  mats.current = [milkyMat, hazeMat, nebulaMat, galaxiesMat, dustMat];

  useFrame((state, delta) => {
    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' ? 0 : phase === 'PARTICLE' ? 0.02 : phase === 'FORMATION' ? 0.75 : 1;
    for (const m of mats.current) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uFormation.value = THREE.MathUtils.damp(m.uniforms.uFormation.value, target, 0.7, delta);
    }
  });

  return (
    <group name="deep-space">
      <points frustumCulled={false} geometry={milkyGeo}>
        <primitive object={milkyMat} attach="material" />
      </points>
      <points frustumCulled={false} geometry={hazeGeo}>
        <primitive object={hazeMat} attach="material" />
      </points>
      <points frustumCulled={false} geometry={nebulaGeo}>
        <primitive object={nebulaMat} attach="material" />
      </points>
      <points frustumCulled={false} geometry={galaxiesGeo}>
        <primitive object={galaxiesMat} attach="material" />
      </points>
      <points frustumCulled={false} geometry={dustGeo}>
        <primitive object={dustMat} attach="material" />
      </points>
    </group>
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
