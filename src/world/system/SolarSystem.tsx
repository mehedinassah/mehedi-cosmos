'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import planetVert from '@/shaders/materials/planet_standard/planet.vert';
import planetFrag from '@/shaders/materials/planet_standard/planet.frag';
import atmoVert from '@/shaders/materials/atmosphere/atmo.vert';
import atmoFrag from '@/shaders/materials/atmosphere/atmo.frag';
import cloudsVert from '@/shaders/materials/clouds/clouds.vert';
import cloudsFrag from '@/shaders/materials/clouds/clouds.frag';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { useQualityStore } from '@/state/qualityStore';
import { useDescentStore } from '@/state/descentStore';
import {
  HEROES,
  EARTH_POS,
  MOON_ANCHOR,
  MOON_RADIUS,
  type HeroSpec,
} from '@/world/system/systemSpec';

/**
 * The star-system flight scenery. Three worlds, one moon, and the living
 * medium around the flight line: solar wind, sunlit dust, one wandering
 * comet. NOTHING here is a diagram — no orbit lines, no belts, no layout
 * that reads as an astronomy model. Worlds sit where the flight path meets
 * them and are met the way a traveler meets them: briefly, then gone.
 */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------- worlds ---------------------------- */

function useHeroMaterials(spec: HeroSpec) {
  const tier = useQualityStore((s) => s.tier);
  return useMemo(() => {
    const p = spec.palette;
    const octaves = tier >= 3 ? 5 : tier === 2 ? 4 : 3;
    const seed = spec.position.length() * 0.013;
    const surface = new THREE.ShaderMaterial({
      vertexShader: assembleShader(planetVert, { OCTAVES: Math.min(octaves, 4) }),
      fragmentShader: assembleShader(planetFrag, { OCTAVES: octaves }),
      uniforms: {
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uSeed: { value: seed },
        uDeep: { value: new THREE.Color(p.deep) },
        uMid: { value: new THREE.Color(p.mid) },
        uHigh: { value: new THREE.Color(p.high) },
        uAtmo: { value: new THREE.Color(p.atmo) },
        uNight: { value: p.night },
        uCloudCover: { value: p.clouds },
      },
    });
    const atmosphere = new THREE.ShaderMaterial({
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      uniforms: {
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uCameraPos: { value: new THREE.Vector3() },
        uAtmo: { value: new THREE.Color(p.atmo) },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const clouds = new THREE.ShaderMaterial({
      vertexShader: cloudsVert,
      fragmentShader: assembleShader(cloudsFrag, { OCTAVES: Math.min(octaves, 4) }),
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: seed },
        uCloudCover: { value: p.clouds },
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uCameraPos: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: false,
    });
    return { surface, atmosphere, clouds };
  }, [spec, tier]);
}

const MOON_UP = new THREE.Vector3(0, 1, 0);

/** The Moon starts exactly at the flight path's gaze anchor and drifts
 *  around Earth imperceptibly — the sweep-past must land where the camera
 *  and the caption say it is. */
function EarthMoon() {
  const meshRef = useRef<THREE.Mesh>(null);
  const local = useMemo(() => MOON_ANCHOR.clone().sub(EARTH_POS), []);
  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    m.position
      .copy(local)
      .applyAxisAngle(MOON_UP, state.clock.elapsedTime * 0.001)
      .add(EARTH_POS);
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
      <meshStandardMaterial color="#b8b3aa" roughness={0.95} metalness={0.02} />
    </mesh>
  );
}

function Hero({ spec }: { spec: HeroSpec }) {
  const { surface, atmosphere, clouds } = useHeroMaterials(spec);
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.03;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.012;
    surface.uniforms.uTime.value = t;
    clouds.uniforms.uTime.value = t;
    surface.uniforms.uCameraPos.value.copy(state.camera.position);
    atmosphere.uniforms.uCameraPos.value.copy(state.camera.position);
    clouds.uniforms.uCameraPos.value.copy(state.camera.position);
  });

  return (
    <group position={spec.position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[spec.radius, 64, 64]} />
        <primitive object={surface} attach="material" />
      </mesh>
      {spec.palette.clouds > 0.05 && (
        <mesh ref={cloudRef} scale={1.02}>
          <sphereGeometry args={[spec.radius, 48, 48]} />
          <primitive object={clouds} attach="material" />
        </mesh>
      )}
      <mesh scale={1.07}>
        <sphereGeometry args={[spec.radius, 32, 32]} />
        <primitive object={atmosphere} attach="material" />
      </mesh>
    </group>
  );
}

/* ------------------------ the living medium ------------------------ */

function makeStarMaterial(wobble = 0) {
  return new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: starFrag,
    uniforms: { uTime: { value: 0 }, uFormation: { value: 0 }, uWobble: { value: wobble } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Zodiacal dust — the inner system shimmers faintly in sunlight. */
function ZodiacalDust() {
  const mat = useMemo(() => makeStarMaterial(12), []);
  const geometry = useMemo(() => {
    const count = 900;
    const rng = mulberry32(2953);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const tw = new Float32Array(count);
    const order = new Float32Array(count);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 600 + Math.pow(rng(), 1.4) * 2800;
      const a = rng() * Math.PI * 2;
      const y = ((rng() + rng() + rng() - 1.5) / 1.5) * (90 + r * 0.05);
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
      size[i] = 2 + rng() * 3;
      tw[i] = rng();
      order[i] = rng() * 0.5;
      const lit = Math.min(1, 900 / r) * 0.6;
      col.set([0.55 * lit, 0.45 * lit, 0.34 * lit], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(tw, 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uFormation.value = THREE.MathUtils.smoothstep(
      useDescentStore.getState().sysSmoothed,
      0.01,
      0.1,
    );
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </points>
  );
}

/* Solar wind — charged streams leaving the star, felt while passing it */
const windVert = /* glsl */ `
attribute vec3 aDir;
attribute float aSeed;
attribute float aSize;
uniform float uTime;
varying float vAlpha;
varying vec3 vColor;
const float R0 = 240.0;
const float SPAN = 3200.0;
void main() {
  float r = R0 + mod(aSeed * SPAN + uTime * (200.0 + aSeed * 340.0), SPAN);
  vec3 p = aDir * r;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float fade = 1.0 - (r - R0) / SPAN;
  vAlpha = fade * fade * 0.4;
  vColor = vec3(1.0, 0.86, 0.7);
  gl_PointSize = min((5.0 + aSeed * 8.0) * (300.0 / -mv.z), 42.0);
  gl_Position = projectionMatrix * mv;
}
`;

function SolarWind() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: windVert,
        fragmentShader: starFrag,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const geometry = useMemo(() => {
    const count = 700;
    const rng = mulberry32(6089);
    const pos = new Float32Array(count * 3);
    const dir = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(rng() * 2 - 1, (rng() * 2 - 1) * 0.5, rng() * 2 - 1).normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      pos.set([v.x, v.y, v.z], i * 3);
      seed[i] = rng();
      size[i] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    return g;
  }, []);
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </points>
  );
}

/* One wandering comet — distant flavor, never a labeled exhibit */
const COMET = { perihelion: 760, aphelion: 15000, incl: 0.42, node: 1.1, theta0: 0.9, k: 90000 };

function Comet() {
  const TAIL = 90;
  const theta = useRef(COMET.theta0);
  const nucleusRef = useRef<THREE.Sprite>(null);
  const tailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL * 3), 3));
    const col = new Float32Array(TAIL * 3);
    for (let i = 0; i < TAIL; i++) {
      const f = Math.pow(1 - i / TAIL, 3) * 0.55;
      col.set([0.55 * f, 0.66 * f, 0.8 * f], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const jitter = useMemo(() => {
    const rng = mulberry32(90210);
    return Array.from({ length: TAIL }, () => [
      (rng() - 0.5) * 2,
      (rng() - 0.5) * 2,
      (rng() - 0.5) * 2,
    ]);
  }, []);
  const glowTex = useMemo(
    () =>
      makeGlowTexture([
        [0, 'rgba(230,240,255,0.9)'],
        [0.4, 'rgba(180,210,240,0.3)'],
        [1, 'rgba(150,190,230,0)'],
      ]),
    [],
  );

  const e = (COMET.aphelion - COMET.perihelion) / (COMET.aphelion + COMET.perihelion);
  const p = COMET.perihelion * (1 + e);
  const plane = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(COMET.incl, COMET.node, 0)),
    [],
  );

  useFrame((_, delta) => {
    const r0 = p / (1 + e * Math.cos(theta.current));
    theta.current += (COMET.k / (r0 * r0)) * delta;
    const r = p / (1 + e * Math.cos(theta.current));
    const nucleus = new THREE.Vector3(
      Math.cos(theta.current) * r,
      0,
      Math.sin(theta.current) * r,
    ).applyQuaternion(plane);

    if (nucleusRef.current) {
      nucleusRef.current.position.copy(nucleus);
      const s = 14 + 1100 / Math.max(1, r / 90);
      nucleusRef.current.scale.set(s, s, 1);
    }

    const tailDir = nucleus.clone().normalize();
    const len = THREE.MathUtils.clamp(900 * (2000 / r), 90, 2600);
    const posAttr = tailGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < TAIL; i++) {
      const f = i / TAIL;
      const along = f * f * len;
      const spread = f * len * 0.14;
      posAttr.setXYZ(
        i,
        nucleus.x + tailDir.x * along + jitter[i][0] * spread,
        nucleus.y + tailDir.y * along + jitter[i][1] * spread,
        nucleus.z + tailDir.z * along + jitter[i][2] * spread,
      );
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      <sprite ref={nucleusRef}>
        <spriteMaterial
          map={glowTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.85}
        />
      </sprite>
      <points geometry={tailGeo} frustumCulled={false}>
        <pointsMaterial
          size={26}
          sizeAttenuation
          vertexColors
          map={glowTex}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* ---------------------------- assembly ---------------------------- */

export function SolarSystem() {
  return (
    <group name="solar-system">
      {HEROES.map((h) => (
        <Hero key={h.id} spec={h} />
      ))}
      <EarthMoon />
      <ZodiacalDust />
      <SolarWind />
      <Comet />
    </group>
  );
}
