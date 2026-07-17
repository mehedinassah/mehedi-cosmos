'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  K_ITEMS, CYCLE_INDICES, CYCLE_ORDER, MILE_INDICES, colorOf, saturnBridge, saturnFocus, useSaturnUI,
} from '@/state/saturnStore';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * SaturnKnowledge — the rings ARE the knowledge.
 *
 * Three dim particle streams (foundations / core / specializations) ride inside
 * the visible ring band, each with its own rhythm; ice glints and dust give the
 * band depth. Named course particles sit in the streams, colour-coded by
 * category. Every ~6s one lights up, drifts a few px OUT of the ring and unfolds
 * into a card (DOM), tracing a faint constellation to its category siblings —
 * then folds back. Milestones (SSC / HSC / BRAC) are clickable gold beacons on
 * their own orbit, BRAC the largest.
 */

const RING_TILT: [number, number, number] = [Math.PI / 2 + 0.5, 0, 0.24];
const EULER_TILT = new THREE.Euler(...RING_TILT);
const STREAM_R = [1.5, 1.85, 2.2];
const STREAM_SPEED = [0.02, 0.012, 0.007];
const STREAM_N = [300, 340, 260];
const SLOT = 6.0;
const GOLDEN = 2.399963;
const PALETTE = ['#efe9dc', '#cdb384', '#d8b26a', '#e8dcc8'];

function makeCloud(n: number, r: number, radius: number, seed: number, spread: number) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const rr = (r + (rng() - 0.5) * spread) * radius;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(a) * rr;
    pos[i * 3 + 2] = (rng() - 0.5) * radius * 0.02;
    c.set(PALETTE[Math.floor(rng() * PALETTE.length)]);
    const dim = 0.4 + rng() * 0.4;
    col[i * 3] = c.r * dim;
    col[i * 3 + 1] = c.g * dim;
    col[i * 3 + 2] = c.b * dim;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const MAX_LINKS = 14;

export function SaturnKnowledge({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const fillers = useRef<(THREE.Object3D | null)[]>([]);
  const dust = useRef<THREE.Object3D | null>(null);
  const ice = useRef<THREE.Object3D | null>(null);
  const markerSp = useRef<(THREE.Sprite | null)[]>([]);
  const markerMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const lineRef = useRef<THREE.Object3D | null>(null);
  const miles = useRef<(THREE.Group | null)[]>([]);
  const mileGlow = useRef<(THREE.SpriteMaterial | null)[]>([]);

  const fillerGeo = useMemo(() => STREAM_R.map((r, i) => makeCloud(STREAM_N[i], r, radius, 1013 + i * 77, 0.14)), [radius]);
  const dustGeo = useMemo(() => makeCloud(420, 1.85, radius, 5501, 0.5), [radius]);
  const iceGeo = useMemo(() => makeCloud(90, 1.8, radius, 8821, 0.55), [radius]);
  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,250,238,1)'], [0.4, 'rgba(230,208,160,0.5)'], [1, 'rgba(210,180,120,0)']]),
    [],
  );

  // named particles = the cycle items, in cycle order (marker j <-> CYCLE_INDICES[j])
  const markers = useMemo(
    () => CYCLE_INDICES.map((ki, j) => {
      const it = K_ITEMS[ki];
      return { ki, ring: it.ring as 0 | 1 | 2, base: j * GOLDEN, color: colorOf(it), group: it.group };
    }),
    [],
  );
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3));
    return g;
  }, []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  const streamRot = useRef([0, 0, 0]);
  const clock = useRef(0);
  const mpos = useRef<THREE.Vector3[]>(markers.map(() => new THREE.Vector3()));
  const presGlow = useRef<THREE.Sprite | null>(null);
  const presGlowMat = useRef<THREE.SpriteMaterial | null>(null);
  const presAngles = useRef<number[]>([]);
  const presReady = useRef(false);
  const _w = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _col = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const f = saturnFocus();
    saturnBridge.focus = f;
    const visible = f > 0.02;
    for (const p of fillers.current) if (p) p.visible = visible;
    if (dust.current) dust.current.visible = visible;
    if (ice.current) ice.current.visible = visible;
    for (const m of miles.current) if (m) m.visible = visible;
    for (const sp of markerSp.current) if (sp) sp.visible = visible;
    if (presGlow.current) presGlow.current.visible = visible;
    if (lineRef.current) lineRef.current.visible = visible;
    if (!visible) {
      saturnBridge.active = false;
      saturnBridge.env = 0;
      return;
    }

    // layered ring motion — each its own rhythm
    for (let i = 0; i < 3; i++) {
      streamRot.current[i] += delta * STREAM_SPEED[i];
      const p = fillers.current[i];
      if (p) p.rotation.z = streamRot.current[i];
    }
    if (dust.current) dust.current.rotation.z -= delta * 0.004;
    if (ice.current) ice.current.rotation.z += delta * 0.016;

    if (f < 0.4) { clock.current = 0; presReady.current = false; } // reset each visit

    // Compute the presentation spots once we are (near-)parked: the ring points
    // that sit HIGHEST on screen. Cards always surface there — in the viewer's
    // sightline, above the planet, never at the lower/occluded end.
    if (!presReady.current && f > 0.9) {
      const found: { a: number; sy: number }[] = [];
      for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2;
        _w.set(Math.cos(a) * 1.9 * radius, Math.sin(a) * 1.9 * radius, 0).applyEuler(EULER_TILT).add(center);
        _ndc.copy(_w).project(camera);
        if (_ndc.z >= 1) continue;
        const sx = (_ndc.x * 0.5 + 0.5) * size.width;
        if (sx < 0 || sx > size.width) continue;
        found.push({ a, sy: (-_ndc.y * 0.5 + 0.5) * size.height });
      }
      found.sort((x, y) => x.sy - y.sy); // highest on screen first
      const top = found.slice(0, Math.min(found.length, 14)).sort((x, y) => x.a - y.a);
      const picks: number[] = [];
      if (top.length) {
        const step = Math.max(1, Math.floor(top.length / 4));
        for (let i = 0; i < top.length && picks.length < 4; i += step) picks.push(top[i].a);
      }
      if (picks.length) { presAngles.current = picks; presReady.current = true; }
    }

    // activation cycle — important first (BSc / HSC / SSC / thesis), then the
    // rest. Paused while reading an expanded record.
    if (!saturnBridge.paused && f > 0.85) clock.current += delta;
    const activation = Math.floor(clock.current / SLOT);
    const itemIdx = CYCLE_ORDER[activation % CYCLE_ORDER.length];
    const item = K_ITEMS[itemIdx];
    const tin = clock.current % SLOT;
    const env = THREE.MathUtils.smoothstep(tin, 0.6, 1.2) * (1 - THREE.MathUtils.smoothstep(tin, 4.6, 5.4));
    const t = state.clock.elapsedTime;

    // ambient course particles (dim, carried by their streams). The active
    // subject's home particle brightens so you see where the card came from.
    for (let j = 0; j < markers.length; j++) {
      const mk = markers[j];
      const ang = mk.base + streamRot.current[mk.ring];
      const rr = STREAM_R[mk.ring] * radius;
      const p = mpos.current[j];
      p.set(Math.cos(ang) * rr, Math.sin(ang) * rr, radius * 0.012);
      const sp = markerSp.current[j];
      if (sp) { sp.position.copy(p); sp.scale.setScalar(radius * (mk.ki === itemIdx ? 0.038 + env * 0.03 : 0.028)); }
      const mat = markerMat.current[j];
      if (mat) mat.opacity = mk.ki === itemIdx ? 0.4 + env * 0.5 : 0.28 + 0.12 * Math.sin(t * 1.6 + j);
    }

    // the presentation particle sits on the upper arc and drifts OUT while it
    // presents; colour = the subject's category.
    const pa = presAngles.current.length ? presAngles.current[activation % presAngles.current.length] : Math.PI * 0.7;
    const pr = (1.95 + env * 0.18) * radius; // fixed band so every card is upper & in view
    const gx = Math.cos(pa) * pr, gy = Math.sin(pa) * pr, gz = radius * 0.02;
    const pg = presGlow.current;
    if (pg) { pg.position.set(gx, gy, gz); pg.scale.setScalar(radius * (0.03 + env * 0.1)); }
    const pgm = presGlowMat.current;
    if (pgm) { pgm.color.copy(_col.set(colorOf(item))); pgm.opacity = env * 0.92; }

    // constellation: link the presentation to the subject's category siblings
    // (courses/achievements). Milestones stand alone.
    const posAttr = lineGeo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    let seg = 0;
    for (let j = 0; j < markers.length && seg < MAX_LINKS; j++) {
      if (markers[j].group !== item.group) continue;
      const b = mpos.current[j];
      arr[seg * 6] = gx; arr[seg * 6 + 1] = gy; arr[seg * 6 + 2] = gz;
      arr[seg * 6 + 3] = b.x; arr[seg * 6 + 4] = b.y; arr[seg * 6 + 5] = b.z;
      seg++;
    }
    for (let k = seg; k < MAX_LINKS; k++) for (let q = 0; q < 6; q++) arr[k * 6 + q] = 0;
    posAttr.needsUpdate = true;
    lineGeo.setDrawRange(0, seg * 2);
    lineMat.color.copy(_col.set(colorOf(item)));
    lineMat.opacity = env * 0.4;

    // milestones orbit slowly; gentle beacon pulse
    const MILE_R = [2.7, 2.95, 2.35]; // SSC, HSC, BRAC(largest, innermost = prominent)
    for (let i = 0; i < 3; i++) {
      const m = miles.current[i];
      if (!m) continue;
      const a = 1.0 + i * 2.1 + t * (0.006 - i * 0.001);
      m.position.set(Math.cos(a) * MILE_R[i] * radius, Math.sin(a) * MILE_R[i] * radius, radius * 0.05);
      m.rotation.z += delta * 0.15;
      const gm = mileGlow.current[i];
      if (gm) gm.opacity = 0.22 + 0.1 * Math.sin(t * 1.3 + i * 1.7);
    }

    // present the card at the presentation particle's screen position
    _w.set(gx, gy, gz).applyEuler(EULER_TILT).add(center);
    _ndc.copy(_w).project(camera);
    saturnBridge.index = itemIdx;
    saturnBridge.color = colorOf(item);
    saturnBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
    saturnBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
    saturnBridge.env = env;
    saturnBridge.active = env > 0.02 && f > 0.6;
  });

  const onMileClick = (ki: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useSaturnUI.getState().setSelected(ki);
  };
  const hit = radius * 0.22;

  return (
    <group position={center} rotation={RING_TILT}>
      {/* depth: dim filler streams + drifting dust + ice glints */}
      {fillerGeo.map((g, i) => (
        <points key={i} ref={(el) => { fillers.current[i] = el; }} geometry={g} visible={false}>
          <pointsMaterial size={radius * 0.012} vertexColors transparent opacity={0.55} depthWrite={false} sizeAttenuation />
        </points>
      ))}
      <points ref={(el) => { dust.current = el; }} geometry={dustGeo} visible={false}>
        <pointsMaterial size={radius * 0.006} color="#cdbf9f" transparent opacity={0.3} depthWrite={false} sizeAttenuation />
      </points>
      <points ref={(el) => { ice.current = el; }} geometry={iceGeo} visible={false}>
        <pointsMaterial size={radius * 0.01} color="#fbf4e2" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* named course particles (colour = category) */}
      {markers.map((mk, j) => (
        <sprite key={mk.ki} ref={(el) => { markerSp.current[j] = el; }} visible={false} scale={[radius * 0.028, radius * 0.028, 1]}>
          <spriteMaterial
            ref={(m) => { markerMat.current[j] = m; if (m) m.color.set(mk.color); }}
            map={glowTex}
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}

      {/* the presentation particle — the one that surfaces a card, on the upper arc */}
      <sprite ref={(el) => { presGlow.current = el; }} visible={false} scale={[radius * 0.05, radius * 0.05, 1]}>
        <spriteMaterial ref={(m) => { presGlowMat.current = m; }} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* constellation lines between related subjects */}
      <lineSegments ref={(el) => { lineRef.current = el; }} geometry={lineGeo} material={lineMat} visible={false} />

      {/* milestone gold beacons: SSC, HSC, and BRAC (the largest) */}
      <group ref={(el) => { miles.current[0] = el; }} visible={false}>
        <MileBeacon radius={radius} scale={0.9} />
        <mesh onClick={onMileClick(MILE_INDICES[0])} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
          <sphereGeometry args={[hit, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <sprite scale={[radius * 0.2, radius * 0.2, 1]}>
          <spriteMaterial ref={(m) => { mileGlow.current[0] = m; }} map={glowTex} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      <group ref={(el) => { miles.current[1] = el; }} visible={false}>
        <MileBeacon radius={radius} scale={1.0} />
        <mesh onClick={onMileClick(MILE_INDICES[1])} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
          <sphereGeometry args={[hit, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <sprite scale={[radius * 0.22, radius * 0.22, 1]}>
          <spriteMaterial ref={(m) => { mileGlow.current[1] = m; }} map={glowTex} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {/* BRAC — the largest: a gold graduation cap, the centre of it all */}
      <group ref={(el) => { miles.current[2] = el; }} visible={false}>
        <GradCap radius={radius} />
        <mesh onClick={onMileClick(MILE_INDICES[2])} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
          <sphereGeometry args={[hit * 1.3, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <sprite scale={[radius * 0.34, radius * 0.34, 1]}>
          <spriteMaterial ref={(m) => { mileGlow.current[2] = m; }} map={glowTex} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
  );
}

/** A small gold beacon: an octahedron core with a bright emissive centre. */
function MileBeacon({ radius, scale }: { radius: number; scale: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8b26a', metalness: 0.7, roughness: 0.32, emissive: '#8a6a2a', emissiveIntensity: 0.5 }), []);
  return (
    <mesh material={mat} scale={scale}>
      <octahedronGeometry args={[radius * 0.05, 0]} />
    </mesh>
  );
}

/** BRAC — a gold graduation cap (mortarboard + tassel). */
function GradCap({ radius }: { radius: number }) {
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e0b662', metalness: 0.72, roughness: 0.3 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a2f18', metalness: 0.5, roughness: 0.5 }), []);
  const R = radius;
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {/* cap base */}
      <mesh material={dark} position={[0, -R * 0.035, 0]}>
        <cylinderGeometry args={[R * 0.06, R * 0.07, R * 0.06, 20]} />
      </mesh>
      {/* mortarboard */}
      <mesh material={gold} position={[0, R * 0.01, 0]}>
        <boxGeometry args={[R * 0.2, R * 0.014, R * 0.2]} />
      </mesh>
      {/* button */}
      <mesh material={gold} position={[0, R * 0.025, 0]}>
        <sphereGeometry args={[R * 0.014, 10, 8]} />
      </mesh>
      {/* tassel */}
      <mesh material={gold} position={[R * 0.09, R * 0.0, R * 0.09]} rotation={[0.2, 0, 0.2]}>
        <cylinderGeometry args={[R * 0.004, R * 0.004, R * 0.09, 6]} />
      </mesh>
    </group>
  );
}
