'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { universe, bodyById } from '@/content/universe';
import type { CelestialBody } from '@/content/schema';
import { useJourneyStore } from '@/state/journeyStore';
import { useUiStore } from '@/state/uiStore';
import { useQualityStore } from '@/state/qualityStore';
import { assembleShader } from '@/shaders/assemble';
import planetVert from '@/shaders/materials/planet_standard/planet.vert';
import planetFrag from '@/shaders/materials/planet_standard/planet.frag';
import atmoVert from '@/shaders/materials/atmosphere/atmo.vert';
import atmoFrag from '@/shaders/materials/atmosphere/atmo.frag';
import cloudsVert from '@/shaders/materials/clouds/clouds.vert';
import cloudsFrag from '@/shaders/materials/clouds/clouds.frag';

/**
 * WARM-state bodies — cinematic upgrade of the COLD impostors.
 * Sun-lit surfaces with real terminators, atmospheric rim scattering,
 * scale satellites, per-kind identity. Full per-planet worlds still
 * arrive in the World Rendering phase; this is the believable baseline.
 */

export function bodyWorldPosition(b: CelestialBody): THREE.Vector3 {
  if (!b.orbit) return new THREE.Vector3(0, 0, 0);
  const parent = b.parent ? bodyById.get(b.parent) : undefined;
  const origin = parent ? bodyWorldPosition(parent) : new THREE.Vector3();
  const angle = b.orbit.phase * Math.PI * 2;
  const inc = THREE.MathUtils.degToRad(b.orbit.inclinationDeg);
  const local = new THREE.Vector3(
    Math.cos(angle) * b.orbit.radiusU,
    Math.sin(inc) * b.orbit.radiusU * 0.25,
    Math.sin(angle) * b.orbit.radiusU,
  );
  return origin.add(local);
}

/** Muted palettes per visual.paletteRef — scientific realism, never neon. */
const PALETTES: Record<
  string,
  { deep: string; mid: string; high: string; atmo: string; night: number; clouds: number }
> = {
  'terrestrial-warm': { deep: '#1b3a52', mid: '#5d6b46', high: '#c9c4b4', atmo: '#6fa8dc', clouds: 0.85, night: 0.25 },
  'industrial-steel': { deep: '#2a2d33', mid: '#565b63', high: '#9aa0a8', atmo: '#8fa5c0', clouds: 0.35, night: 1.0 },
  'commercial-glass': { deep: '#24384a', mid: '#5f7285', high: '#b9c4cf', atmo: '#a7c4e2', clouds: 0.6, night: 0.8 },
  'fog-violet': { deep: '#241f30', mid: '#453c58', high: '#8d84a3', atmo: '#9b8fc0', clouds: 1.0, night: 0.1 },
  'lab-cyan-muted': { deep: '#16303a', mid: '#3d6570', high: '#a4c3c9', atmo: '#7fc0cc', clouds: 0.5, night: 0.6 },
  'satellite-white': { deep: '#3a3d42', mid: '#7d8188', high: '#d5d8dc', atmo: '#b9c2cf', clouds: 0.0, night: 0.3 },
  'station-steel': { deep: '#32302c', mid: '#6b665c', high: '#b3ab9c', atmo: '#c0b49a', clouds: 0.15, night: 0.9 },
  'observatory-dark': { deep: '#1d2733', mid: '#41566b', high: '#9db4c9', atmo: '#7d9cc0', clouds: 0.45, night: 0.4 },
  'fleet-graphite': { deep: '#26282c', mid: '#54585f', high: '#a2a7ae', atmo: '#8f99a8', clouds: 0.2, night: 0.5 },
  starlight: { deep: '#2c3444', mid: '#6a7690', high: '#cdd6ea', atmo: '#aebadb', clouds: 0.0, night: 0 },
  'nebula-rose-teal': { deep: '#2c2030', mid: '#5c4258', high: '#a98ca0', atmo: '#b58fa6', clouds: 0.0, night: 0 },
  void: { deep: '#050507', mid: '#0a0a0f', high: '#131318', atmo: '#c98a4f', clouds: 0.0, night: 0 },
};

function usePlanetMaterials(body: CelestialBody, seed: number) {
  const tier = useQualityStore((s) => s.tier);
  return useMemo(() => {
    const p = PALETTES[body.visual.paletteRef] ?? PALETTES['fleet-graphite'];
    const octaves = tier >= 3 ? 5 : tier === 2 ? 4 : 3;
    const shared = {
      uSunPos: { value: new THREE.Vector3(0, 0, 0) },
      uCameraPos: { value: new THREE.Vector3() },
    };
    const surface = new THREE.ShaderMaterial({
      vertexShader: assembleShader(planetVert, { OCTAVES: Math.min(octaves, 4) }),
      fragmentShader: assembleShader(planetFrag, { OCTAVES: octaves }),
      uniforms: {
        ...shared,
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
  }, [body.visual.paletteRef, seed, tier]);
}

/** Interaction wrapper: hover glow ring → holo label → click → travel. */
function Interactive({
  body,
  radius,
  children,
}: {
  body: CelestialBody;
  radius: number;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const requestTravel = useJourneyStore((s) => s.requestTravel);
  const setHoverTarget = useUiStore((s) => s.setHoverTarget);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const r = ringRef.current;
    if (!r) return;
    const mat = r.material as THREE.MeshBasicMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, hovered ? 0.35 : 0, 8, delta);
    r.visible = mat.opacity > 0.01;
    r.lookAt(state.camera.position);
  });

  return (
    <group>
      {/* invisible raycast proxy, oversized for reachability */}
      <mesh
        userData={{ bodyId: body.id }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setHoverTarget(body.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setHoverTarget(null);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          e.stopPropagation();
          requestTravel(body.id);
        }}
      >
        <sphereGeometry args={[radius * 1.25, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* orbit-reticle hover ring */}
      <mesh ref={ringRef} visible={false}>
        <ringGeometry args={[radius * 1.45, radius * 1.5, 64]} />
        <meshBasicMaterial color="#cdd6ea" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {hovered && (
        <Html center distanceFactor={radius * 14} style={{ pointerEvents: 'none' }}>
          <div className="holo-label">
            <span className="holo-label__name">{body.name}</span>
            <span className="holo-label__meaning">{body.meaning}</span>
          </div>
        </Html>
      )}
      {children}
    </group>
  );
}

/** Tiny satellites — the scale cue. A world is big because small things orbit it. */
function ScaleSatellites({ radius, count, seed }: { radius: number; count: number; seed: number }) {
  const pivots = useRef<THREE.Group[]>([]);
  const specs = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      dist: radius * (1.6 + rng() * 1.2),
      speed: 0.05 + rng() * 0.12,
      incl: (rng() - 0.5) * 0.9,
      phase: rng() * Math.PI * 2,
      size: radius * (0.012 + rng() * 0.02),
    }));
  }, [radius, count, seed]);

  useFrame((_, delta) => {
    pivots.current.forEach((p, i) => {
      if (p) p.rotation.y += delta * specs[i].speed;
    });
  });

  return (
    <>
      {specs.map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) pivots.current[i] = el;
          }}
          rotation={[s.incl, s.phase, 0]}
        >
          <mesh position={[s.dist, 0, 0]}>
            <sphereGeometry args={[s.size, 8, 8]} />
            <meshStandardMaterial color="#c8ccd2" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function PlanetBody({ body, seed }: { body: CelestialBody; seed: number }) {
  const { surface, atmosphere, clouds } = usePlanetMaterials(body, seed);
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.02;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.008; // clouds lag the surface
    const t = state.clock.elapsedTime;
    surface.uniforms.uTime.value = t;
    clouds.uniforms.uTime.value = t;
    surface.uniforms.uCameraPos.value.copy(state.camera.position);
    atmosphere.uniforms.uCameraPos.value.copy(state.camera.position);
    clouds.uniforms.uCameraPos.value.copy(state.camera.position);
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[body.scaleU, 128, 128]} />
        <primitive object={surface} attach="material" />
      </mesh>
      <mesh ref={cloudRef} scale={1.018}>
        <sphereGeometry args={[body.scaleU, 64, 64]} />
        <primitive object={clouds} attach="material" />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[body.scaleU, 48, 48]} />
        <primitive object={atmosphere} attach="material" />
      </mesh>
      <ScaleSatellites radius={body.scaleU} count={body.kind === 'planet' ? 3 : 1} seed={seed * 3 + 1} />
    </>
  );
}

/** Black hole placeholder: pure void + warm accretion rim. Lensing shader in World Rendering. */
function VoidBody({ body }: { body: CelestialBody }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.05;
      ringRef.current.lookAt(state.camera.position);
    }
  });
  return (
    <>
      <mesh>
        <sphereGeometry args={[body.scaleU, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[body.scaleU * 1.15, body.scaleU * 1.9, 96]} />
        <meshBasicMaterial
          color="#c98a4f"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/** Constellations / fleets / nebulae render as luminous point clusters, not spheres. */
function ClusterBody({ body, seed }: { body: CelestialBody; seed: number }) {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const geometry = useMemo(() => {
    const rng = mulberry32(seed);
    const count = body.kind === 'nebula' ? 42 : body.kind === 'constellation' ? 26 : 14;
    const spread = body.scaleU * (body.kind === 'nebula' ? 0.9 : 0.55);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos.set(
        [(rng() - 0.5) * 2 * spread, (rng() - 0.5) * 1.1 * spread, (rng() - 0.5) * 2 * spread],
        i * 3,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [body, seed]);

  const color =
    body.kind === 'nebula' ? '#b58fa6' : body.kind === 'constellation' ? '#dfe6f5' : '#c2c8d0';
  const size = body.kind === 'nebula' ? body.scaleU * 0.4 : body.scaleU * 0.06;

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.opacity = 0.55 + 0.2 * Math.sin(state.clock.elapsedTime * 0.4 + seed);
    }
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Body({ body, seed }: { body: CelestialBody; seed: number }) {
  const position = useMemo(() => bodyWorldPosition(body), [body]);
  const isCluster = body.kind === 'constellation' || body.kind === 'fleet' || body.kind === 'nebula';
  return (
    <group position={position}>
      <Interactive body={body} radius={body.scaleU}>
        {body.kind === 'blackhole' ? (
          <VoidBody body={body} />
        ) : isCluster ? (
          <ClusterBody body={body} seed={seed} />
        ) : (
          <PlanetBody body={body} seed={seed} />
        )}
      </Interactive>
    </group>
  );
}

export function ImpostorField() {
  const bodies = universe.bodies.filter((b) => b.id !== 'sun');
  return (
    <group name="bodies">
      {bodies.map((b, i) => (
        <Body key={b.id} body={b} seed={i + 1} />
      ))}
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
