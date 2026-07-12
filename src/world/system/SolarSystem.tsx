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
import ringsVert from '@/shaders/materials/rings/rings.vert';
import ringsFrag from '@/shaders/materials/rings/rings.frag';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { useQualityStore } from '@/state/qualityStore';
import { useDescentStore } from '@/state/descentStore';
import { PLANETS, planetPosition, type PlanetSpec } from '@/world/system/systemSpec';

/**
 * The solar system as a place, not an illustration: worlds in continuous
 * inclined orbits with moons, a rubble belt, the Kuiper fringe, comets,
 * solar wind and sunlit dust. Everything reveals progressively as the
 * scroll dolly travels outward (bands keyed to each planet's sp) — the
 * frame never holds the whole system at once.
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

const sysProgress = () => useDescentStore.getState().sysSmoothed;

/* ---------------------------- planets ---------------------------- */

function usePlanetMaterials(spec: PlanetSpec) {
  const tier = useQualityStore((s) => s.tier);
  return useMemo(() => {
    const p = spec.palette;
    const octaves = tier >= 3 ? 5 : tier === 2 ? 4 : 3;
    const seed = spec.orbitRadius * 0.013;
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

function SaturnRings({ spec }: { spec: PlanetSpec }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringsVert,
        fragmentShader: assembleShader(ringsFrag, { OCTAVES: 3 }),
        uniforms: {
          uSunPos: { value: new THREE.Vector3(0, 0, 0) },
          uPlanetPos: { value: new THREE.Vector3() },
          uPlanetR: { value: spec.radius },
          uInnerR: { value: spec.radius * 1.35 },
          uOuterR: { value: spec.radius * 2.4 },
          uSeed: { value: 7.31 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [spec],
  );
  // uPlanetPos follows the moving planet (parent group carries the position)
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = meshRef.current;
    if (m) material.uniforms.uPlanetPos.value.setFromMatrixPosition(m.matrixWorld);
  });
  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2 + 0.32, 0, 0.2]}>
      <ringGeometry args={[spec.radius * 1.35, spec.radius * 2.4, 180, 4]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Moons({ moons }: { moons: NonNullable<PlanetSpec['moons']> }) {
  const pivots = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, delta) => {
    pivots.current.forEach((p, i) => {
      if (p) p.rotation.y += delta * moons[i].speed;
    });
  });
  return (
    <>
      {moons.map((m, i) => (
        <group
          key={i}
          ref={(el) => {
            pivots.current[i] = el;
          }}
          rotation={[m.incl, m.phase, 0]}
        >
          <mesh position={[m.dist, 0, 0]}>
            <sphereGeometry args={[m.radius, 24, 24]} />
            <meshStandardMaterial color="#b8b3aa" roughness={0.95} metalness={0.02} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Planet({ spec }: { spec: PlanetSpec }) {
  const { surface, atmosphere, clouds } = usePlanetMaterials(spec);
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) planetPosition(spec, t, groupRef.current.position);
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.03;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.012;
    surface.uniforms.uTime.value = t;
    clouds.uniforms.uTime.value = t;
    surface.uniforms.uCameraPos.value.copy(state.camera.position);
    atmosphere.uniforms.uCameraPos.value.copy(state.camera.position);
    clouds.uniforms.uCameraPos.value.copy(state.camera.position);
  });

  return (
    <group ref={groupRef}>
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
      {spec.rings && <SaturnRings spec={spec} />}
      {spec.moons && <Moons moons={spec.moons} />}
    </group>
  );
}

/* ---------------------------- orbit paths ---------------------------- */

function OrbitPath({ spec }: { spec: PlanetSpec }) {
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#9db4d8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const inc = THREE.MathUtils.degToRad(spec.inclinationDeg);
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(a) * spec.orbitRadius,
          Math.sin(a + 1.0) * Math.sin(inc) * spec.orbitRadius,
          Math.sin(a) * spec.orbitRadius,
        ),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [spec]);

  useFrame(() => {
    // The path is the herald: it fades in just before its planet is reached,
    // then dims once passed so the frame never turns into an orbit diagram
    const sp = sysProgress();
    const dimPassed = 1 - 0.65 * band(sp, spec.sp + 0.12, spec.sp + 0.3);
    material.opacity = band(sp, spec.sp - 0.07, spec.sp - 0.02) * 0.16 * dimPassed;
  });

  return <lineLoop geometry={geometry} frustumCulled={false} material={material} />;
}

/* ---------------------------- belts & dust ---------------------------- */

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

function buildBeltGeometry(
  count: number,
  seed: number,
  rMin: number,
  rMax: number,
  thickness: number,
  sizeMin: number,
  sizeMax: number,
  color: (rng: () => number) => [number, number, number],
) {
  const rng = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tw = new Float32Array(count);
  const order = new Float32Array(count);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.pow(rng(), 0.8) * (rMax - rMin);
    const a = rng() * Math.PI * 2;
    const y = ((rng() + rng() + rng() - 1.5) / 1.5) * thickness * (r / rMax);
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    size[i] = sizeMin + rng() * (sizeMax - sizeMin);
    tw[i] = rng();
    order[i] = rng() * 0.7;
    col.set(color(rng), i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(tw, 1));
  g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  return g;
}

function AsteroidBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => makeStarMaterial(), []);
  const geometry = useMemo(
    () =>
      buildBeltGeometry(3200, 8117, 4300, 5600, 220, 18, 48, (rng) => {
        const v = 0.35 + rng() * 0.3;
        return [v * 0.62, v * 0.55, v * 0.47]; // sunlit rock, never sparkle
      }),
    [],
  );
  useFrame((state, delta) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uFormation.value = band(sysProgress(), 0.56, 0.68);
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0045; // averaged Kepler drift
  });
  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <primitive object={mat} attach="material" />
      </points>
    </group>
  );
}

function KuiperBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => makeStarMaterial(), []);
  const geometry = useMemo(
    () =>
      buildBeltGeometry(2200, 4159, 21500, 27500, 1600, 45, 120, (rng) => {
        const v = 0.25 + rng() * 0.25;
        return [v * 0.55, v * 0.62, v * 0.72]; // dim ice
      }),
    [],
  );
  useFrame((state, delta) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uFormation.value = band(sysProgress(), 0.88, 0.98);
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0006;
  });
  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <primitive object={mat} attach="material" />
      </points>
    </group>
  );
}

/** Zodiacal dust — the ecliptic plane made faintly visible by sunlight.
 *  Brightness falls with distance from the sun (baked into vertex color). */
function ZodiacalDust() {
  const mat = useMemo(() => makeStarMaterial(12), []);
  const geometry = useMemo(() => {
    const count = 1500;
    const rng = mulberry32(2953);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const tw = new Float32Array(count);
    const order = new Float32Array(count);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 700 + Math.pow(rng(), 1.6) * 15000;
      const a = rng() * Math.PI * 2;
      const y = ((rng() + rng() + rng() - 1.5) / 1.5) * (120 + r * 0.045);
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
      size[i] = 2 + rng() * 3;
      tw[i] = rng();
      order[i] = rng() * 0.5;
      const lit = Math.min(1, 900 / r) * 0.6; // sun-illuminated falloff, kept faint
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
    mat.uniforms.uFormation.value = band(sysProgress(), 0.02, 0.12);
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </points>
  );
}

/* ---------------------------- solar wind ---------------------------- */

const windVert = /* glsl */ `
attribute vec3 aDir;
attribute float aSeed;
attribute float aSize;
uniform float uTime;
varying float vAlpha;
varying vec3 vColor;
const float R0 = 260.0;
const float SPAN = 15000.0;
void main() {
  float r = R0 + mod(aSeed * SPAN + uTime * (260.0 + aSeed * 420.0), SPAN);
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
    const count = 800;
    const rng = mulberry32(6089);
    const pos = new Float32Array(count * 3); // unused by the shader, required attr
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

/* ---------------------------- comets ---------------------------- */

const COMET_SPECS = [
  { perihelion: 700, aphelion: 15000, incl: 0.42, node: 1.1, theta0: 0.4, k: 90000 },
  { perihelion: 1100, aphelion: 22000, incl: -0.3, node: 3.9, theta0: 2.6, k: 110000 },
];

function Comet({ spec }: { spec: (typeof COMET_SPECS)[number] }) {
  const TAIL = 90;
  const theta = useRef(spec.theta0);
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
    const rng = mulberry32(Math.floor(spec.k));
    return Array.from({ length: TAIL }, () => [
      (rng() - 0.5) * 2,
      (rng() - 0.5) * 2,
      (rng() - 0.5) * 2,
    ]);
  }, [spec]);
  const glowTex = useMemo(
    () =>
      makeGlowTexture([
        [0, 'rgba(230,240,255,0.9)'],
        [0.4, 'rgba(180,210,240,0.3)'],
        [1, 'rgba(150,190,230,0)'],
      ]),
    [],
  );

  const e = (spec.aphelion - spec.perihelion) / (spec.aphelion + spec.perihelion);
  const p = spec.perihelion * (1 + e);
  const plane = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(new THREE.Euler(spec.incl, spec.node, 0)),
    [spec],
  );

  useFrame((_, delta) => {
    // Angular-momentum pacing: fast at perihelion, glacial far out
    const r0 = p / (1 + e * Math.cos(theta.current));
    theta.current += (spec.k / (r0 * r0)) * delta;
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

    // Tail streams anti-sunward, longer the closer the comet swings
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
        {/* map gives each particle a soft round falloff — an unmapped
            PointsMaterial rasterizes square points */}
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
      {PLANETS.map((p) => (
        <Planet key={p.id} spec={p} />
      ))}
      {PLANETS.map((p) => (
        <OrbitPath key={`${p.id}-orbit`} spec={p} />
      ))}
      <AsteroidBelt />
      <KuiperBelt />
      <ZodiacalDust />
      <SolarWind />
      {COMET_SPECS.map((c, i) => (
        <Comet key={i} spec={c} />
      ))}
    </group>
  );
}
