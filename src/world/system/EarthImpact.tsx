'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { IMPACT_SATS, earthHover, earthFocus, earthSpin, latLonDir } from '@/state/earthHoverStore';

/**
 * EarthImpact — the living Earth's impact layer, rebuilt for RESTRAINT.
 *
 * No shouting labels. Five TINY satellites orbit their real-world regions
 * (they rotate with the globe), silent until you hover one. Each carries its
 * own reserved color. Aurora, night-side lightning and a little debris keep
 * the planet breathing. The achievement text lives only in the on-demand
 * hologram (EarthHologram) — never floating in space.
 */

/** A tiny glowing dot in the satellite's own color, white-hot at the core. */
function makeDotTexture(color: string): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(color);
  const r = Math.round(col.r * 255), g = Math.round(col.g * 255), b = Math.round(col.b * 255);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, `rgba(${r},${g},${b},0.92)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* -------------------- tiny geographic impact satellites -------------------- */
const REVEAL_STEP = 1.0; // one satellite reveals per second (hierarchy)
const ALT = 1.16; // altitude above the surface

function ImpactSatellites({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const spinGroup = useRef<THREE.Group>(null);
  const satRefs = useRef<(THREE.Group | null)[]>([]);
  const dotMats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const focus = useRef(0);
  const dwell = useRef(0);
  const reveal = useRef<number[]>(IMPACT_SATS.map(() => 0));
  const hoverAmt = useRef<number[]>(IMPACT_SATS.map(() => 0));
  const vis = useRef<number[]>(IMPACT_SATS.map(() => 0));
  const hovered = useRef(-1);

  const dotTexs = useMemo(() => IMPACT_SATS.map((s) => makeDotTexture(s.color)), []);
  const homes = useMemo(
    () => IMPACT_SATS.map((s) => latLonDir(s.lat, s.lon, new THREE.Vector3()).multiplyScalar(radius * ALT)),
    [radius],
  );
  const _wp = useMemo(() => new THREE.Vector3(), []);
  const _rel = useMemo(() => new THREE.Vector3(), []);
  const _camDir = useMemo(() => new THREE.Vector3(), []);
  const _cam = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const f0 = earthFocus();
    focus.current = THREE.MathUtils.damp(focus.current, f0, 3, delta);
    if (f0 > 0.6) dwell.current += delta;
    else if (f0 < 0.2) dwell.current = 0;
    if (spinGroup.current) spinGroup.current.rotation.y = earthSpin.y; // orbit WITH the regions

    camera.getWorldPosition(_cam);
    _camDir.copy(_cam).sub(center).normalize();
    const t = state.clock.elapsedTime;

    for (let i = 0; i < IMPACT_SATS.length; i++) {
      const rT = dwell.current > 0.6 + i * REVEAL_STEP ? 1 : 0;
      reveal.current[i] = THREE.MathUtils.damp(reveal.current[i], rT, 3, delta);
      const g = satRefs.current[i];
      if (!g) continue;
      // subtle wobble — real objects drift, never frozen
      const w = radius * 0.02;
      g.position.set(
        homes[i].x + Math.sin(t * 0.7 + i) * w,
        homes[i].y + Math.sin(t * 0.9 + i * 2) * w,
        homes[i].z + Math.cos(t * 0.6 + i) * w,
      );
      // fade out when the region rotates to the far side of the globe
      g.getWorldPosition(_wp);
      _rel.copy(_wp).sub(center).normalize();
      const vTarget = THREE.MathUtils.smoothstep(_rel.dot(_camDir), -0.12, 0.18);
      vis.current[i] = THREE.MathUtils.damp(vis.current[i], vTarget, 6, delta);
      const hv = hovered.current === i ? 1 : 0;
      hoverAmt.current[i] = THREE.MathUtils.damp(hoverAmt.current[i], hv, 9, delta);
      g.scale.setScalar(1 + hoverAmt.current[i] * 0.8);
      const twinkle = 0.82 + 0.18 * Math.sin(t * 1.7 + i * 3);
      const shown = focus.current * reveal.current[i] * vis.current[i];
      const dm = dotMats.current[i];
      if (dm) dm.opacity = shown * twinkle * (1 + hoverAmt.current[i] * 0.9);
    }

    const h = hovered.current;
    if (h >= 0 && reveal.current[h] > 0.4 && vis.current[h] > 0.3) {
      const g = satRefs.current[h];
      if (g) {
        g.getWorldPosition(_wp);
        _wp.project(camera);
        earthHover.index = h;
        earthHover.x = (_wp.x * 0.5 + 0.5) * size.width;
        earthHover.y = (-_wp.y * 0.5 + 0.5) * size.height;
        earthHover.color = IMPACT_SATS[h].color;
      }
    } else {
      if (h >= 0 && vis.current[h] <= 0.3) hovered.current = -1; // rotated away
      if (earthHover.index !== -1 && hovered.current < 0) earthHover.index = -1;
    }
  });

  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (reveal.current[i] < 0.5 || vis.current[i] < 0.3) return;
    e.stopPropagation();
    hovered.current = i;
    document.body.style.cursor = 'pointer';
  };
  const onOut = (i: number) => () => {
    if (hovered.current === i) {
      hovered.current = -1;
      earthHover.index = -1;
      document.body.style.cursor = '';
    }
  };

  return (
    <group ref={spinGroup}>
      {IMPACT_SATS.map((s, i) => (
        <group key={s.key} ref={(g) => { satRefs.current[i] = g; }}>
          {/* invisible hit target — a bit larger than the dot for easy hover */}
          <mesh onPointerOver={onOver(i)} onPointerOut={onOut(i)}>
            <sphereGeometry args={[radius * 0.38, 10, 10]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <sprite scale={[radius * 0.1, radius * 0.1, 1]}>
            <spriteMaterial
              ref={(m) => { dotMats.current[i] = m; }}
              map={dotTexs[i]}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/* -------------------- aurora at the poles -------------------- */
function Aurora({ radius }: { radius: number }) {
  const geo = useMemo(() => {
    const g = new THREE.TorusGeometry(radius * 0.42, radius * 0.04, 12, 64);
    g.rotateX(Math.PI / 2);
    return g;
  }, [radius]);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#3affd0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  useFrame((state, delta) => {
    const f = earthFocus();
    const breath = 0.09 + 0.05 * Math.sin(state.clock.elapsedTime * 0.7);
    mat.opacity = THREE.MathUtils.damp(mat.opacity, f * breath, 3, delta);
  });
  return (
    <>
      <mesh geometry={geo} material={mat} position={[0, radius * 0.92, 0]} />
      <mesh geometry={geo} material={mat} position={[0, -radius * 0.92, 0]} />
    </>
  );
}

/* -------------------- night-side lightning (city blink) -------------------- */
const FLASHES = 4;
function Lightning({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const tex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(230,244,255,1)'],
      [0.4, 'rgba(150,200,255,0.5)'],
      [1, 'rgba(120,180,255,0)'],
    ]),
    [],
  );
  const mats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const nightDir = useMemo(() => center.clone().normalize(), [center]);
  const spots = useMemo(() => {
    const rng = mulberry(9137);
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < FLASHES; i++) {
      const n = new THREE.Vector3();
      for (let t = 0; t < 20; t++) {
        n.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
        if (n.dot(nightDir) > 0.35) break;
      }
      out.push(n.multiplyScalar(radius * 1.01));
    }
    return out;
  }, [nightDir, radius]);
  const st = useRef(spots.map((_, i) => ({ t: -1, next: 2 + i * 1.7 + Math.random() * 4 })));

  useFrame((_, delta) => {
    const f = earthFocus();
    for (let i = 0; i < FLASHES; i++) {
      const s = st.current[i];
      const m = mats.current[i];
      if (s.t < 0) {
        s.next -= delta;
        if (s.next <= 0 && f > 0.4) s.t = 0;
        if (m) m.opacity = 0;
      } else {
        s.t += delta;
        const a = s.t < 0.04 ? s.t / 0.04 : Math.max(0, 1 - (s.t - 0.04) / 0.16);
        if (m) m.opacity = a * 0.85 * f;
        if (s.t > 0.2) { s.t = -1; s.next = 3 + Math.random() * 7; }
      }
    }
  });

  return (
    <>
      {spots.map((p, i) => (
        <sprite key={i} position={p} scale={[radius * 0.45, radius * 0.45, 1]}>
          <spriteMaterial
            ref={(m) => { mats.current[i] = m; }}
            map={tex}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

/* -------------------- faint drifting debris + ISS -------------------- */
function SpaceDebris({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const iss = useRef<THREE.Group>(null);
  const bits = useMemo(() => {
    const rng = mulberry(5521);
    return Array.from({ length: 4 }, () => {
      const a = rng() * Math.PI * 2;
      const r = radius * (1.4 + rng() * 1.5);
      return new THREE.Vector3(Math.cos(a) * r, (rng() - 0.5) * radius * 0.9, Math.sin(a) * r);
    });
  }, [radius]);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.09;
    if (iss.current) iss.current.rotation.y += delta * 0.16;
  });
  return (
    <>
      <group ref={groupRef}>
        {bits.map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[radius * 0.018, radius * 0.018, radius * 0.018]} />
            <meshBasicMaterial color="#59636f" transparent opacity={0.26} />
          </mesh>
        ))}
      </group>
      <group ref={iss}>
        <group position={[radius * 2.3, radius * 0.35, 0]}>
          <mesh>
            <boxGeometry args={[radius * 0.09, radius * 0.022, radius * 0.022]} />
            <meshBasicMaterial color="#7c8794" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 0, radius * 0.07]}>
            <boxGeometry args={[radius * 0.028, radius * 0.004, radius * 0.08]} />
            <meshBasicMaterial color="#38455e" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0, -radius * 0.07]}>
            <boxGeometry args={[radius * 0.028, radius * 0.004, radius * 0.08]} />
            <meshBasicMaterial color="#38455e" transparent opacity={0.55} />
          </mesh>
        </group>
      </group>
    </>
  );
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function EarthImpact({ center, radius }: { center: THREE.Vector3; radius: number }) {
  return (
    <group position={center}>
      <Aurora radius={radius} />
      <Lightning center={center} radius={radius} />
      <SpaceDebris radius={radius} />
      <ImpactSatellites center={center} radius={radius} />
    </group>
  );
}
