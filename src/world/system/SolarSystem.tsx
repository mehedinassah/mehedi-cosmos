'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import atmoVert from '@/shaders/materials/atmosphere/atmo.vert';
import atmoFrag from '@/shaders/materials/atmosphere/atmo.frag';
import ringsVert from '@/shaders/materials/rings/rings.vert';
import ringsFrag from '@/shaders/materials/rings/rings.frag';
import starVert from '@/shaders/materials/starfield/star.vert';
import starFrag from '@/shaders/materials/starfield/star.frag';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { EarthImpact } from '@/world/system/EarthImpact';
import { SaturnKnowledge } from '@/world/system/SaturnKnowledge';
import { VenusConstellation } from '@/world/system/VenusConstellation';
import { UranusConstellation } from '@/world/system/UranusConstellation';
import { MarsMissionControl } from '@/world/system/MarsMissionControl';
import { JupiterPortal } from '@/world/system/JupiterPortal';
import { earthFocus, earthSpin } from '@/state/earthHoverStore';
import { useDescentStore } from '@/state/descentStore';
import { portalDive } from '@/state/portalDive';
import {
  HEROES,
  EARTH_POS,
  MOON_ANCHOR,
  MOON_RADIUS,
  CHAPTER_SP,
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

// Planet maps: solarsystemscope.com (CC BY 4.0). Real imagery carries each
// world's identity — no procedural blob may pretend to be Jupiter.
function loadMap(path: string): THREE.Texture {
  const t = new THREE.TextureLoader().load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Perico portal: Jupiter's OWN surface deforms — no overlay. Injected into the
// planet's MeshStandard shaders. The real cloud bands rotate around the storm,
// wind inward like a drain, and the surface sinks into a funnel with a black
// eye. uPortalT 0..1 drives it; uStormAxis is the storm centre in local space.
const JUP_DEFORM = /* glsl */ `
{
  float t = uPortalT;
  vec3 axis = normalize(uStormAxis);
  vec3 dir = normalize(transformed);
  float d = acos(clamp(dot(dir, axis), -1.0, 1.0));   // angular distance to storm
  float w = smoothstep(1.05, 0.0, d);                 // storm influence
  // swirl the real bands around the storm — differential (tighter toward centre)
  float phi = 9.0 * w * w * t;
  float c = cos(phi), s = sin(phi);
  transformed = transformed * c + cross(axis, transformed) * s + axis * dot(axis, transformed) * (1.0 - c);
  // wind the surface inward like water down a drain
  float len = length(transformed);
  vec3 nd = normalize(mix(normalize(transformed), axis, 0.42 * w * t));
  transformed = nd * len;
  // sink the funnel so the surface is no longer flat — real depth into the hole
  float wc = smoothstep(0.6, 0.0, d);
  transformed *= 1.0 - 0.66 * wc * t;
  vPortalW = w * t;
  vPortalEye = smoothstep(0.34, 0.04, d) * t;         // the black eye — the hole
  vPortalDark = smoothstep(0.85, 0.05, d) * t;        // inner vortex collapses to shadow
}
`;

const JUP_DARKEN = /* glsl */ `
  // the storm collapses into shadow: the deeper into the vortex, the darker,
  // going to a black eye at the centre (a hole, not a bright whirlpool)
  diffuseColor.rgb *= 1.0 - 0.82 * vPortalDark;                    // inner vortex -> shadow
  diffuseColor.rgb *= 1.0 - vPortalEye;                            // black eye
`;

const _toCam = new THREE.Vector3();
const _invQ = new THREE.Quaternion();

function useHeroMaterials(spec: HeroSpec) {
  return useMemo(() => {
    const surface = new THREE.MeshStandardMaterial({
      map: loadMap(spec.tex.map),
      roughness: 1,
      metalness: 0,
    });
    if (spec.tex.tint) surface.color.set(spec.tex.tint);
    if (spec.tex.night) {
      // City lights: emissive map glows independent of sunlight — invisible
      // against the lit day side, alive on the dark one
      surface.emissive = new THREE.Color('#ffdca6');
      surface.emissiveMap = loadMap(spec.tex.night);
      surface.emissiveIntensity = 0.92; // slightly richer night illumination
    }
    const clouds = spec.tex.clouds
      ? new THREE.MeshStandardMaterial({
          color: '#ffffff',
          alphaMap: loadMap(spec.tex.clouds),
          transparent: true,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        })
      : null;
    const atmosphere = new THREE.ShaderMaterial({
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      uniforms: {
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uCameraPos: { value: new THREE.Vector3() },
        uAtmo: { value: new THREE.Color(spec.palette.atmo) },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    if (spec.id === 'jupiter') {
      const pu = {
        uPortalT: { value: 0 },
        uStormAxis: { value: new THREE.Vector3(0, 0, 1) },
      };
      surface.onBeforeCompile = (shader) => {
        shader.uniforms.uPortalT = pu.uPortalT;
        shader.uniforms.uStormAxis = pu.uStormAxis;
        shader.vertexShader =
          'uniform float uPortalT;\nuniform vec3 uStormAxis;\nvarying float vPortalEye;\nvarying float vPortalW;\nvarying float vPortalDark;\n' +
          shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + JUP_DEFORM);
        shader.fragmentShader =
          'varying float vPortalEye;\nvarying float vPortalW;\nvarying float vPortalDark;\n' +
          shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + JUP_DARKEN);
      };
      surface.customProgramCacheKey = () => 'jupiter-portal-v1';
      surface.userData.portal = pu;
    }
    return { surface, atmosphere, clouds };
  }, [spec]);
}

const band = (p: number, a: number, b: number) => THREE.MathUtils.smoothstep(p, a, b);
const MOON_UP = new THREE.Vector3(0, 1, 0);

/** Generic moons (Jupiter's four, Titan, Charon) — slow pivot orbits. */
function Moons({ moons }: { moons: NonNullable<HeroSpec['moons']> }) {
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

function SaturnRings({ spec }: { spec: HeroSpec }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringsVert,
        fragmentShader: assembleShader(ringsFrag, { OCTAVES: 3 }),
        uniforms: {
          uSunPos: { value: new THREE.Vector3(0, 0, 0) },
          uPlanetPos: { value: spec.position.clone() },
          uPlanetR: { value: spec.radius },
          uInnerR: { value: spec.radius * 1.35 },
          uOuterR: { value: spec.radius * 2.4 },
          uSeed: { value: 7.31 },
          uMap: { value: loadMap('/textures/2k_saturn_ring_alpha.png') },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [spec],
  );
  // Tilted open toward the flight lane — edge-on rings vanish into a line
  return (
    <mesh rotation={[Math.PI / 2 + 0.5, 0, 0.24]}>
      <ringGeometry args={[spec.radius * 1.35, spec.radius * 2.4, 180, 4]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

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
  const moonMap = useMemo(() => loadMap('/textures/2k_moon.jpg'), []);
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[MOON_RADIUS, 48, 48]} />
      <meshStandardMaterial map={moonMap} roughness={1} metalness={0} />
    </mesh>
  );
}

function Hero({ spec }: { spec: HeroSpec }) {
  const { surface, atmosphere, clouds } = useHeroMaterials(spec);
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const atmoRef = useRef<THREE.Mesh>(null);
  const stormSet = useRef(false);

  const isEarth = spec.id === 'earth';
  const isJupiter = spec.id === 'jupiter';
  // Drag-to-spin (Earth only): pointer drag rotates the globe without moving
  // the camera. pendingDelta is applied on the next frame; inertia carries a
  // little spin after release.
  const dragging = useRef(false);
  const lastX = useRef(0);
  const pendingDelta = useRef(0);
  const inertia = useRef(0);

  useEffect(() => {
    if (!isEarth) return;
    const move = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      const d = dx * 0.006;
      pendingDelta.current += d;
      inertia.current = d;
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [isEarth]);

  useFrame((state, delta) => {
    // Visible rotation — nothing in space is a still image. Earth spins fast
    // enough that a lingering viewer notices, with clouds drifting faster than
    // the land under them (a living planet, not a globe), and it can be dragged.
    if (isEarth) {
      let surfInc: number;
      if (dragging.current) {
        surfInc = pendingDelta.current;
        pendingDelta.current = 0;
      } else {
        // Gentle spin — slow enough that the region satellites read as staying
        // over their homes, fast enough to feel alive.
        surfInc = delta * 0.022 + inertia.current;
        inertia.current *= Math.pow(0.9, delta * 60);
        if (Math.abs(inertia.current) < 1e-5) inertia.current = 0;
      }
      if (meshRef.current) {
        meshRef.current.rotation.y += surfInc;
        earthSpin.y = meshRef.current.rotation.y; // satellites orbit WITH the surface
      }
      if (cloudRef.current) cloudRef.current.rotation.y += surfInc + delta * 0.02;
    } else {
      // Jupiter freezes its spin during the portal dive so the storm the camera
      // is falling into stays put; every other giant keeps turning.
      const portaling = isJupiter && portalDive.active;
      const spin = spec.radius >= 20 ? 0.02 : 0.008;
      if (meshRef.current && !portaling) meshRef.current.rotation.y += delta * spin;
      if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.012;

      if (isJupiter) {
        const pu = surface.userData.portal as
          | { uPortalT: { value: number }; uStormAxis: { value: THREE.Vector3 } }
          | undefined;
        if (pu) {
          if (portalDive.active) {
            // capture the storm centre (the camera-facing point) once, in the
            // planet's LOCAL frame, so the funnel forms where we dive in
            if (!stormSet.current && meshRef.current) {
              _toCam.copy(state.camera.position).sub(spec.position).normalize();
              _invQ.copy(meshRef.current.quaternion).invert();
              pu.uStormAxis.value.copy(_toCam).applyQuaternion(_invQ);
              stormSet.current = true;
            }
            // deform grows in early (storm forms) and is full by the time the
            // camera reaches the surface
            pu.uPortalT.value = THREE.MathUtils.smoothstep(portalDive.t, 0.02, 0.5);
          } else {
            stormSet.current = false;
            pu.uPortalT.value = 0;
          }
        }
        // the round atmosphere shell would float over the funnel — hide it once
        // the surface starts collapsing
        if (atmoRef.current) atmoRef.current.visible = !(portalDive.active && portalDive.t > 0.04);
      }
    }
    atmosphere.uniforms.uCameraPos.value.copy(state.camera.position);
  });

  const onEarthDown = (e: ThreeEvent<PointerEvent>) => {
    if (earthFocus() < 0.4) return;
    e.stopPropagation();
    dragging.current = true;
    lastX.current = e.nativeEvent.clientX;
    inertia.current = 0;
    document.body.style.cursor = 'grabbing';
  };
  const onEarthOver = () => {
    if (earthFocus() > 0.4 && !dragging.current) document.body.style.cursor = 'grab';
  };
  const onEarthOut = () => {
    if (!dragging.current) document.body.style.cursor = '';
  };

  // The giants fill real screen space on their pass — they need the density.
  // Jupiter gets much finer tessellation so the portal funnel bends smoothly.
  const segs = isJupiter ? 220 : spec.radius >= 20 ? 96 : 64;
  return (
    <group position={spec.position}>
      <mesh
        ref={meshRef}
        onPointerDown={isEarth ? onEarthDown : undefined}
        onPointerOver={isEarth ? onEarthOver : undefined}
        onPointerOut={isEarth ? onEarthOut : undefined}
      >
        <sphereGeometry args={[spec.radius, segs, segs]} />
        <primitive object={surface} attach="material" />
      </mesh>
      {clouds && (
        <mesh ref={cloudRef} scale={1.012}>
          <sphereGeometry args={[spec.radius, Math.min(segs, 64), Math.min(segs, 64)]} />
          <primitive object={clouds} attach="material" />
        </mesh>
      )}
      <mesh ref={atmoRef} scale={1.07}>
        <sphereGeometry args={[spec.radius, 48, 48]} />
        <primitive object={atmosphere} attach="material" />
      </mesh>
      {spec.rings && <SaturnRings spec={spec} />}
      {spec.moons && <Moons moons={spec.moons} />}
    </group>
  );
}

/** Orbiting glints: Venus wears its skills as satellites; Earth carries a
 *  handful of fast, blinking spacecraft. Small lights, not labels. */
function OrbitGlints({
  center,
  count,
  radius,
  speed,
  size,
  color,
  seed,
}: {
  center: THREE.Vector3;
  count: number;
  radius: number;
  speed: number;
  size: number;
  color: [number, number, number];
  seed: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => makeStarMaterial(), []);
  const geometry = useMemo(() => {
    const rng = mulberry32(seed);
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tw = new Float32Array(count);
    const order = new Float32Array(count);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.5;
      const r = radius * (0.9 + rng() * 0.25);
      pos.set([Math.cos(a) * r, (rng() - 0.5) * radius * 0.35, Math.sin(a) * r], i * 3);
      sizes[i] = size * (0.7 + rng() * 0.6);
      tw[i] = rng();
      order[i] = rng() * 0.3;
      col.set(color, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(tw, 1));
    g.setAttribute('aIgniteOrder', new THREE.BufferAttribute(order, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [count, radius, size, color, seed]);

  useFrame((state, delta) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uFormation.value = 1;
    if (groupRef.current) groupRef.current.rotation.y += delta * speed;
  });

  return (
    <group position={center}>
      <group ref={groupRef}>
        <points geometry={geometry} frustumCulled={false}>
          <primitive object={mat} attach="material" />
        </points>
      </group>
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

/** The rubble between Mars and Jupiter — the flight passes THROUGH it. */
function AsteroidBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => makeStarMaterial(), []);
  const geometry = useMemo(
    () =>
      buildBeltGeometry(3200, 8117, 4200, 5500, 220, 18, 48, (rng) => {
        const v = 0.35 + rng() * 0.3;
        return [v * 0.62, v * 0.55, v * 0.47];
      }),
    [],
  );
  useFrame((state, delta) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const sp = useDescentStore.getState().sysSmoothed;
    mat.uniforms.uFormation.value = band(sp, CHAPTER_SP.mars - 0.04, CHAPTER_SP.mars + 0.04);
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0035;
  });
  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <primitive object={mat} attach="material" />
      </points>
    </group>
  );
}

/** The Kuiper fringe — Pluto's neighborhood, the frozen frontier. */
function KuiperBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => makeStarMaterial(), []);
  const geometry = useMemo(
    () =>
      buildBeltGeometry(2200, 4159, 17000, 22500, 1400, 45, 120, (rng) => {
        const v = 0.25 + rng() * 0.25;
        return [v * 0.55, v * 0.62, v * 0.72];
      }),
    [],
  );
  useFrame((state, delta) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const sp = useDescentStore.getState().sysSmoothed;
    mat.uniforms.uFormation.value = band(sp, CHAPTER_SP.neptune - 0.03, CHAPTER_SP.pluto - 0.02);
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0005;
  });
  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <primitive object={mat} attach="material" />
      </points>
    </group>
  );
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
    const sp = useDescentStore.getState().sysSmoothed;
    // An inner-sun phenomenon: gone before Earth, or grains passing the
    // lens render as giant capped blobs over the project chapters
    mat.uniforms.uFormation.value =
      band(sp, 0.01, 0.1) * (1 - band(sp, CHAPTER_SP.earth - 0.09, CHAPTER_SP.earth - 0.02));
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

/* ------------------------- shooting stars ------------------------- */

/** Rare, subtle meteor streaks near the camera — space rewarding attention.
 *  Three pooled streaks, each living ~1.2s with a long random cooldown. */
function ShootingStars() {
  const COUNT = 3;
  const lineRef = useRef<THREE.LineSegments>(null);
  const streaks = useRef(
    Array.from({ length: COUNT }, (_, i) => ({
      base: new THREE.Vector3(),
      dir: new THREE.Vector3(1, 0, 0),
      speed: 500,
      life: -(3 + i * 4), // negative life = waiting to spawn
      dur: 1.2,
    })),
  );
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3));
    return g;
  }, []);
  const rng = useMemo(() => mulberry32(1747), []);

  useFrame((state, delta) => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    streaks.current.forEach((s, i) => {
      s.life += delta;
      if (s.life > s.dur) s.life = -(4 + rng() * 8); // rest, then return
      if (s.life < 0) {
        pos.setXYZ(i * 2, 0, 0, 0);
        pos.setXYZ(i * 2 + 1, 0, 0, 0);
        col.setXYZ(i * 2, 0, 0, 0);
        col.setXYZ(i * 2 + 1, 0, 0, 0);
        if (s.life > -delta * 2) {
          // spawn ahead-ish of the camera, crossing the frame diagonally
          s.base
            .set(rng() * 2 - 1, rng() * 1.2 - 0.6, rng() * 2 - 1)
            .normalize()
            .multiplyScalar(700 + rng() * 1600)
            .add(state.camera.position);
          s.dir.set(rng() * 2 - 1, rng() * 0.8 - 0.4, rng() * 2 - 1).normalize();
          s.speed = 500 + rng() * 700;
          s.dur = 0.9 + rng() * 0.7;
        }
        return;
      }
      const head = s.base.clone().addScaledVector(s.dir, s.speed * s.life);
      const tail = head.clone().addScaledVector(s.dir, -s.speed * 0.12);
      pos.setXYZ(i * 2, tail.x, tail.y, tail.z);
      pos.setXYZ(i * 2 + 1, head.x, head.y, head.z);
      const a = Math.sin(Math.min(s.life / s.dur, 1) * Math.PI) * 0.55;
      col.setXYZ(i * 2, 0, 0, 0);
      col.setXYZ(i * 2 + 1, a, a * 0.95, a * 0.85);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/* ---------------------------- assembly ---------------------------- */

export function SolarSystem() {
  const venus = HEROES.find((h) => h.id === 'venus')!;
  const earth = HEROES.find((h) => h.id === 'earth')!;
  const mars = HEROES.find((h) => h.id === 'mars')!;
  const jupiter = HEROES.find((h) => h.id === 'jupiter')!;
  const saturn = HEROES.find((h) => h.id === 'saturn')!;
  const uranus = HEROES.find((h) => h.id === 'uranus')!;
  return (
    <group name="solar-system">
      {HEROES.map((h) => (
        <Hero key={h.id} spec={h} />
      ))}
      <EarthMoon />
      {/* Venus wears its skills as a living constellation — three orbital shells,
          connection lines, and travelling signals. Fades in at the Skills stop. */}
      <VenusConstellation center={venus.position} radius={venus.radius} />
      {/* Earth's spacecraft: two orbital shells — low fast traffic (ISS,
          station lights) and a slower, wider ring of satellites */}
      <OrbitGlints center={earth.position} count={5} radius={10.5} speed={0.34} size={0.9} color={[0.85, 0.8, 0.7]} seed={733} />
      <OrbitGlints center={earth.position} count={8} radius={14} speed={0.14} size={0.55} color={[0.6, 0.64, 0.72]} seed={947} />
      {/* Earth carries its real-world impact: labeled satellites, aurora,
          night-side lightning, drifting debris. Fades in at the Earth stop. */}
      <EarthImpact center={earth.position} radius={earth.radius} />
      {/* Mars becomes Mission Control: project drones orbit, landing sites
          light up, mission logs unfold. Fades in at the Projects stop. */}
      <MarsMissionControl center={mars.position} radius={mars.radius} />
      {/* Jupiter is the Perico ERP portal: hover awakens it, click opens the app */}
      <JupiterPortal center={jupiter.position} radius={jupiter.radius} />
      {/* Saturn's rings become knowledge streams at the Education stop */}
      <SaturnKnowledge center={saturn.position} radius={saturn.radius} />
      {/* Uranus is "Beyond Code": six interests drift as line-icon satellites in
          a soft aurora — the calm, humanising chapter. Fades in at the Uranus stop */}
      <UranusConstellation center={uranus.position} radius={uranus.radius} />
      <AsteroidBelt />
      <KuiperBelt />
      <ZodiacalDust />
      <SolarWind />
      <Comet />
      <ShootingStars />
    </group>
  );
}
