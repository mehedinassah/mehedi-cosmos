'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { K_ITEMS, saturnBridge, saturnFocus } from '@/state/saturnStore';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * SaturnKnowledge — the rings as knowledge streams.
 *
 * Three particle streams ride inside Saturn's visible ring band (same tilted
 * plane), each with its own rhythm: inner fastest (foundations), outer slowest
 * (specializations). Every ~6.5s ONE particle brightens, drifts a short way out
 * of its stream and unfolds into a compact card (DOM, via saturnBridge), then
 * folds back. Larger milestone objects (two metallic capsules and a gold
 * diploma cylinder for the university) orbit farther out and light the timeline
 * when they present. Dust drifts between the layers. Calm, warm, organized.
 */

const RING_TILT: [number, number, number] = [Math.PI / 2 + 0.5, 0, 0.24];
const STREAM_R = [1.5, 1.85, 2.2]; // x planet radius, inside the 1.35–2.4 band
const STREAM_SPEED = [0.02, 0.012, 0.007]; // inner fastest
const STREAM_N = [260, 300, 240];
const MILE_R = [2.75, 2.95, 3.2]; // milestone orbit radii (SSC, HSC, University)
const MILE_SPEED = [0.009, 0.007, 0.005];
const SLOT = 6.5; // seconds per activation
const GOLDEN = 2.399963;

const PALETTE = ['#efe9dc', '#cdb384', '#d8b26a', '#e8dcc8'];

function makeStream(n: number, r: number, radius: number, seed: number) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const rr = (r + (rng() - 0.5) * 0.14) * radius;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(a) * rr;
    pos[i * 3 + 2] = (rng() - 0.5) * radius * 0.02;
    c.set(PALETTE[Math.floor(rng() * PALETTE.length)]);
    const dim = 0.5 + rng() * 0.5;
    col[i * 3] = c.r * dim;
    col[i * 3 + 1] = c.g * dim;
    col[i * 3 + 2] = c.b * dim;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function SaturnKnowledge({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const streams = useRef<(THREE.Group | null)[]>([]);
  const dust = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const miles = useRef<(THREE.Group | null)[]>([]);
  const mileGlow = useRef<(THREE.SpriteMaterial | null)[]>([]);

  const geos = useMemo(
    () => STREAM_R.map((r, i) => makeStream(STREAM_N[i], r, radius, 1013 + i * 77)),
    [radius],
  );
  const dustGeo = useMemo(() => makeStream(420, 1.9, radius, 5501), [radius]);
  const glowTex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(255,244,220,1)'],
      [0.4, 'rgba(226,196,140,0.55)'],
      [1, 'rgba(210,180,120,0)'],
    ]),
    [],
  );

  // fixed in-stream angle per item (golden-angle spread keeps them apart)
  const itemAngles = useMemo(() => K_ITEMS.map((_, i) => i * GOLDEN), []);
  const mileIndex = useMemo(() => {
    const map: Record<string, number> = { '2018': 0, '2020': 1, '2022': 2 };
    return K_ITEMS.map((it) => (it.kind === 'milestone' && it.year ? map[it.year] : -1));
  }, []);

  const clock = useRef(0);
  const _w = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const f = saturnFocus();
    saturnBridge.focus = f;
    const visible = f > 0.02;
    for (const g of streams.current) if (g) g.visible = visible;
    if (dust.current) dust.current.visible = visible;
    for (const m of miles.current) if (m) m.visible = visible;
    if (glowRef.current) glowRef.current.visible = visible;
    if (!visible) {
      saturnBridge.active = false;
      saturnBridge.env = 0;
      saturnBridge.milestone = '';
      return;
    }

    // layered motion — each stream its own rhythm; dust drifts independently
    for (let i = 0; i < 3; i++) {
      const g = streams.current[i];
      if (g) g.rotation.z += delta * STREAM_SPEED[i];
    }
    if (dust.current) dust.current.rotation.z -= delta * 0.004;

    // milestones orbit slowly, farther out
    const t = state.clock.elapsedTime;
    for (let i = 0; i < 3; i++) {
      const m = miles.current[i];
      if (!m) continue;
      const a = 1.2 + i * 2.0 + t * MILE_SPEED[i];
      m.position.set(Math.cos(a) * MILE_R[i] * radius, Math.sin(a) * MILE_R[i] * radius, 0);
      m.rotation.z = a + Math.PI / 2; // lie along the orbit
    }

    // --- activation cycle: one particle at a time, every SLOT seconds ---
    if (!saturnBridge.paused && f > 0.85) clock.current += delta;
    const idx = Math.floor(clock.current / SLOT) % K_ITEMS.length;
    const tin = clock.current % SLOT;
    const env = THREE.MathUtils.smoothstep(tin, 0.6, 1.2) * (1 - THREE.MathUtils.smoothstep(tin, 4.6, 5.4));
    const item = K_ITEMS[idx];

    if (item.ring < 3) {
      // particle in a stream: fixed base angle, carried by the stream rotation,
      // drifting a short way OUT of the ring while presenting
      const g = streams.current[item.ring];
      const r = (STREAM_R[item.ring] + env * 0.16) * radius;
      const a = itemAngles[idx];
      if (g && glowRef.current) {
        glowRef.current.position.set(Math.cos(a) * r, Math.sin(a) * r, radius * 0.015);
        // ride the stream: sprite is a child of the rotating group
        if (glowRef.current.parent !== g) g.add(glowRef.current);
        glowRef.current.getWorldPosition(_w);
      }
      saturnBridge.milestone = '';
    } else {
      // milestone: the object itself presents; glow rides it
      const mi = mileIndex[idx];
      const m = miles.current[mi];
      if (m && glowRef.current) {
        if (glowRef.current.parent !== m.parent) m.parent?.add(glowRef.current);
        glowRef.current.position.copy(m.position);
        glowRef.current.position.z += radius * 0.02;
        glowRef.current.getWorldPosition(_w);
      }
      saturnBridge.milestone = env > 0.25 && item.year ? item.year : '';
    }
    if (glowMat.current) glowMat.current.opacity = 0.15 + env * 0.85;
    if (glowRef.current) glowRef.current.scale.setScalar(radius * (0.1 + env * 0.1));
    for (let i = 0; i < 3; i++) {
      const gm = mileGlow.current[i];
      if (gm) gm.opacity = 0.22 + (item.ring === 3 && mileIndex[idx] === i ? env * 0.6 : 0.08 * Math.sin(t * 1.4 + i));
    }

    _ndc.copy(_w).project(camera);
    saturnBridge.index = idx;
    saturnBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
    saturnBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
    saturnBridge.env = env;
    saturnBridge.active = env > 0.02 && f > 0.6;
  });

  return (
    <group position={center} rotation={RING_TILT}>
      {/* knowledge streams */}
      {geos.map((g, i) => (
        <group key={i} ref={(el) => { streams.current[i] = el; }} visible={false}>
          <points geometry={g}>
            <pointsMaterial
              size={radius * 0.014}
              vertexColors
              transparent
              opacity={0.85}
              depthWrite={false}
              sizeAttenuation
            />
          </points>
        </group>
      ))}
      {/* drifting dust between the layers */}
      <points ref={dust} geometry={dustGeo} visible={false}>
        <pointsMaterial size={radius * 0.006} color="#cdbf9f" transparent opacity={0.35} depthWrite={false} sizeAttenuation />
      </points>

      {/* the active particle's glow */}
      <sprite ref={glowRef} visible={false} scale={[radius * 0.12, radius * 0.12, 1]}>
        <spriteMaterial ref={glowMat} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* milestone objects: SSC capsule, HSC capsule, University diploma */}
      <group ref={(el) => { miles.current[0] = el; }} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[radius * 0.035, radius * 0.08, 6, 14]} />
          <meshStandardMaterial color="#cfd4da" metalness={0.75} roughness={0.35} />
        </mesh>
        <sprite scale={[radius * 0.16, radius * 0.16, 1]}>
          <spriteMaterial ref={(m) => { mileGlow.current[0] = m; }} map={glowTex} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      <group ref={(el) => { miles.current[1] = el; }} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[radius * 0.04, radius * 0.09, 6, 14]} />
          <meshStandardMaterial color="#d8cdb4" metalness={0.7} roughness={0.38} />
        </mesh>
        <sprite scale={[radius * 0.17, radius * 0.17, 1]}>
          <spriteMaterial ref={(m) => { mileGlow.current[1] = m; }} map={glowTex} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {/* university — the destination the knowledge revolves around */}
      <group ref={(el) => { miles.current[2] = el; }} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.045, radius * 0.045, radius * 0.2, 18]} />
          <meshStandardMaterial color="#d8b26a" metalness={0.65} roughness={0.32} />
        </mesh>
        {/* diploma ribbon band */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.05, radius * 0.05, radius * 0.03, 18]} />
          <meshStandardMaterial color="#8fd8c8" metalness={0.4} roughness={0.4} emissive="#2a6b60" emissiveIntensity={0.5} />
        </mesh>
        <sprite scale={[radius * 0.24, radius * 0.24, 1]}>
          <spriteMaterial ref={(m) => { mileGlow.current[2] = m; }} map={glowTex} transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
  );
}
