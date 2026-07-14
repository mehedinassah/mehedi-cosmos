'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { hazeFrag, makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { REFERENCE_CURVE, DESTINATION_STAR } from '@/camera/descentPath';
import { useDescentStore } from '@/state/descentStore';

/**
 * Descent scenery — the payoff of the scroll journey. The approach must not
 * simply scale the galaxy up: it reveals detail that was not there before.
 * Each layer ignites inside its own progress band, and within a layer the
 * stars ignite along the path (aIgniteOrder tracks curve position), so the
 * reveal sweeps forward with the camera:
 *   0.30–0.60  arm nebulae surface out of the haze
 *   0.42–0.85  a star cluster tube resolves around the flight path
 *   0.72–0.88  constellation figures connect near the arm's heart
 *   0.50–1.00  the destination star grows, then flares into the arrival
 */

const band = (p: number, a: number, b: number) => THREE.MathUtils.smoothstep(p, a, b);

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePointsGeometry(
  count: number,
  fill: (
    i: number,
    pos: Float32Array,
    size: Float32Array,
    col: Float32Array,
    order: Float32Array,
    seed: Float32Array,
  ) => void,
) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const order = new Float32Array(count);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) fill(i, pos, size, col, order, seed);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  return g;
}

function makePointsMaterial(fragment: string) {
  return new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Curve frame helper: gaussian offset perpendicular-ish to the path
function gauss(rng: () => number) {
  return (rng() + rng() + rng() - 1.5) / 1.5;
}

/* ---------------- Arm nebulae — colored gas fields near the path -------- */
function ArmNebulae() {
  const mat = useMemo(() => makePointsMaterial(hazeFrag), []);
  const geometry = useMemo(() => {
    const rng = mulberry32(9241);
    const p = new THREE.Vector3();
    return makePointsGeometry(30, (i, pos, size, col, order, seed) => {
      const u = 0.5 + rng() * 0.45;
      REFERENCE_CURVE.getPoint(u, p);
      p.x += gauss(rng) * 2600;
      p.y += gauss(rng) * 2000;
      p.z += gauss(rng) * 2600;
      pos.set([p.x, p.y, p.z], i * 3);
      size[i] = 3200 + rng() * 6500;
      order[i] = (u - 0.5) / 0.45 * 0.6 + rng() * 0.25;
      seed[i] = rng();
      const t = rng();
      if (t < 0.4) col.set([0.085, 0.04, 0.05], i * 3); // pink emission
      else if (t < 0.75) col.set([0.03, 0.05, 0.09], i * 3); // blue reflection
      else col.set([0.05, 0.032, 0.07], i * 3); // violet molecular
    });
  }, []);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const p = useDescentStore.getState().smoothed;
    mat.uniforms.uFormation.value = band(p, 0.3, 0.6);
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </points>
  );
}

/* ---------------- Cluster tube — stars resolving around the flight path - */
function ClusterStars() {
  const mat = useMemo(() => makePointsMaterial(starFrag), []);
  const geometry = useMemo(() => {
    const rng = mulberry32(6733);
    const p = new THREE.Vector3();
    return makePointsGeometry(6500, (i, pos, size, col, order, seed) => {
      const u = 0.42 + rng() * 0.58;
      REFERENCE_CURVE.getPoint(u, p);
      const radius = 400 + (1 - u) * 3800; // tube tightens toward the star
      p.x += gauss(rng) * radius;
      p.y += gauss(rng) * radius * 0.8;
      p.z += gauss(rng) * radius;
      pos.set([p.x, p.y, p.z], i * 3);
      size[i] = 20 + rng() * rng() * 80;
      // Ignition sweeps along the path so stars resolve AHEAD of the camera
      order[i] = ((u - 0.42) / 0.58) * 0.7 + rng() * 0.2;
      seed[i] = rng();
      const t = rng();
      if (t < 0.4) col.set([1.0, 0.92, 0.78], i * 3);
      else if (t < 0.78) col.set([0.62, 0.75, 1.0], i * 3);
      else if (t < 0.92) col.set([1.0, 0.66, 0.44], i * 3);
      else col.set([1.0, 0.58, 0.7], i * 3);
    });
  }, []);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const p = useDescentStore.getState().smoothed;
    mat.uniforms.uFormation.value = band(p, 0.42, 0.85);
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </points>
  );
}

// NOTE: the constellation figures (star points joined by additive lines)
// were removed — the connecting lines read as a star-map overlay flashing in
// for a fraction of a second, which broke the immersion of a continuous dive.
// The cluster tube and nebulae already carry the "detail resolves ahead"
// reveal; nothing here draws literal figures anymore.

/* ---------------- Destination star — grows, then flares into arrival ---- */
function DestinationStar() {
  const coreRef = useRef<THREE.Sprite>(null);
  const flareRef = useRef<THREE.Sprite>(null);

  const [coreTex, flareTex] = useMemo(
    () => [
      makeGlowTexture([
        [0, 'rgba(255,252,240,1)'],
        [0.2, 'rgba(255,232,190,0.5)'],
        [0.55, 'rgba(255,205,150,0.12)'],
        [1, 'rgba(255,190,130,0)'],
      ]),
      makeGlowTexture([
        [0, 'rgba(255,250,236,1)'],
        [0.4, 'rgba(255,240,215,0.55)'],
        [1, 'rgba(255,235,205,0)'],
      ]),
    ],
    [],
  );

  useFrame(() => {
    const p = useDescentStore.getState().smoothed;
    const grow = band(p, 0.5, 0.92);
    const flare = Math.pow(band(p, 0.94, 1.0), 2);

    const core = coreRef.current;
    if (core) {
      const s = 500 + grow * 2600;
      core.scale.set(s, s, 1);
      (core.material as THREE.SpriteMaterial).opacity = grow * 0.95;
    }
    const fl = flareRef.current;
    if (fl) {
      // A soft warm bloom around the arriving star — NOT a frame-washing white
      // flash. The galaxy has already faded (galaxyPresence) and origin is the
      // dive's destination, so there is no scene swap left to mask; this just
      // blooms the Sun in gently as the eye adapts to it.
      const s = 2000 + flare * 13000;
      fl.scale.set(s, s, 1);
      (fl.material as THREE.SpriteMaterial).opacity = flare * 0.42;
    }
  });

  return (
    <group position={DESTINATION_STAR}>
      <sprite ref={coreRef}>
        <spriteMaterial
          map={coreTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>
      <sprite ref={flareRef}>
        <spriteMaterial
          map={flareTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>
    </group>
  );
}

export function DescentField() {
  return (
    <group name="descent-field">
      <ArmNebulae />
      <ClusterStars />
      <DestinationStar />
    </group>
  );
}
