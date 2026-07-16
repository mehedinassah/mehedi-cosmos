'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CRAFT, orbitBridge, hoverBridge, useEarthUI, earthFocus } from '@/state/earthHoverStore';
import { Spacecraft } from '@/world/system/SpacecraftModels';
import { systemPose, CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * OrbitalEcosystem — Earth's living constellation as REAL objects in world space.
 *
 * Every craft is on a fixed circular orbit around Earth's actual position, so
 * nothing is glued to the camera: while parked it circles Earth in the open
 * area, and when you scroll toward Mars the camera simply flies past — the craft
 * recede and leave frame like real objects, and Earth's own sphere occludes any
 * that pass behind it. No camera-space tricks, no freezing.
 *
 * The orbit PLANE of each craft is oriented once against the (deterministic)
 * parked-camera view so the rings sit nicely around Earth in the open area — but
 * the orbit itself is then fixed in world space.
 */

const CARD_DUR = 2.0;
const _UP = new THREE.Vector3(0, 1, 0);

export function OrbitalEcosystem({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const pos = useRef<(THREE.Group | null)[]>([]);
  const models = useRef<(THREE.Group | null)[]>([]);
  const inds = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  // Per-craft orbit basis (u, v span the orbit plane) + radius, oriented once
  // against the (deterministic) parked-camera view. The whole family is also
  // shifted toward the open showcase area (Earth is framed hard-right), so while
  // parked the constellation reads richly in the gap — but the orbits stay fixed
  // in world space, so scrolling past is fully natural.
  const orbits = useMemo(() => {
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.earth, camPos, camQuat); // camera pose at the Earth stop
    const toCam = camPos.sub(center).normalize(); // Earth -> parked camera
    const right = new THREE.Vector3().crossVectors(toCam, _UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, toCam).normalize();
    // screen-left / screen-up from the parked camera's own basis
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
    const offset = camRight.multiplyScalar(-1.25 * radius).addScaledVector(camUp, 0.0 * radius);
    const list = CRAFT.map((c) => {
      const o = c.orbit;
      const n = toCam.clone().applyAxisAngle(up, o.tiltA).applyAxisAngle(right, o.tiltB).normalize();
      let u = new THREE.Vector3().crossVectors(_UP, n);
      if (u.lengthSq() < 1e-4) u.copy(right);
      u.normalize();
      const v = new THREE.Vector3().crossVectors(n, u).normalize();
      return { u, v, r: o.radius * radius, speed: o.speed, dir: o.dir };
    });
    return { list, offset };
  }, [center, radius]);

  const angles = useRef<number[]>(CRAFT.map((c) => c.orbit.phase));
  const hoverEase = useRef<number[]>(CRAFT.map(() => 0));
  const nextFire = useRef<number[]>(CRAFT.map((c, i) => (c.transmit ? 1.2 + i * 1.1 + Math.random() * 3 : Infinity)));
  const presentClock = useRef(0);
  const card = useRef({ index: -1, t: 0 });

  const _p = useMemo(() => new THREE.Vector3(), []);
  const _w = useMemo(() => new THREE.Vector3(), []);
  const _cam = useMemo(() => new THREE.Vector3(), []);
  const _toCam = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  const project = (world: THREE.Vector3) => {
    _ndc.copy(world).project(camera);
    return { x: (_ndc.x * 0.5 + 0.5) * size.width, y: (-_ndc.y * 0.5 + 0.5) * size.height };
  };

  useFrame((state, delta) => {
    const f = earthFocus();
    const visible = f > 0.02;
    const hovered = useEarthUI.getState().hovered;
    camera.getWorldPosition(_cam);
    _toCam.copy(_cam).sub(center);

    // --- real orbits around Earth (never stop) ---
    for (let i = 0; i < CRAFT.length; i++) {
      const g = pos.current[i];
      if (!g) continue;
      g.visible = visible;
      if (!visible) continue;
      const o = orbits.list[i];
      const he = (hoverEase.current[i] = THREE.MathUtils.damp(hoverEase.current[i], hovered === i ? 1 : 0, 8, delta));
      angles.current[i] += o.dir * o.speed * delta * (1 - 0.5 * he); // hover slows, never stops
      const a = angles.current[i];
      // position on the orbit, relative to Earth (the group sits at `center`),
      // plus the shared showcase offset
      g.position.copy(orbits.offset).addScaledVector(o.u, Math.cos(a) * o.r).addScaledVector(o.v, Math.sin(a) * o.r);
      const m = models.current[i];
      if (m) {
        m.rotation.y += delta * 0.1;
        m.scale.setScalar(CRAFT[i].scale * radius * (1 + 0.18 * he));
      }
      const ind = inds.current[i];
      if (ind) ind.opacity = (0.3 + 0.7 * he) * (0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 3 + i));
    }

    if (hovered != null && pos.current[hovered]) {
      _w.copy(center).add(pos.current[hovered]!.position);
      const s = project(_w);
      hoverBridge.px = s.x;
      hoverBridge.py = s.y;
    }

    // --- occasional transmissions (only while parked and on the near side) ---
    if (f < 0.4) {
      card.current.index = -1;
      orbitBridge.active = false;
      orbitBridge.env = 0;
      return;
    }
    presentClock.current += delta;
    const c = card.current;
    if (c.index >= 0) {
      c.t += delta;
      const env = THREE.MathUtils.smoothstep(c.t, 0.15, 0.5) * (1 - THREE.MathUtils.smoothstep(c.t, CARD_DUR - 0.55, CARD_DUR));
      const g = pos.current[c.index];
      if (g) {
        _w.copy(center).add(g.position);
        const s = project(_w);
        orbitBridge.px = s.x;
        orbitBridge.py = s.y;
      }
      orbitBridge.index = c.index;
      orbitBridge.color = CRAFT[c.index].color;
      orbitBridge.env = env;
      orbitBridge.active = env > 0.02;
      if (c.t >= CARD_DUR) {
        nextFire.current[c.index] = presentClock.current + 7 + Math.random() * 6;
        c.index = -1;
        orbitBridge.active = false;
        orbitBridge.env = 0;
      }
    } else {
      orbitBridge.active = false;
      orbitBridge.env = 0;
      for (let i = 0; i < CRAFT.length; i++) {
        if (!CRAFT[i].transmit || presentClock.current < nextFire.current[i]) continue;
        const g = pos.current[i];
        if (!g || g.position.dot(_toCam) <= 0) continue; // wait until on the near side
        c.index = i;
        c.t = 0;
        break;
      }
    }
  });

  const HIT = radius * 0.13;
  return (
    <group position={center}>
      {CRAFT.map((c, i) => (
        <group key={c.id} ref={(g) => { pos.current[i] = g; }} visible={false}>
          <group ref={(g) => { models.current[i] = g; }} scale={radius * c.scale}>
            <Spacecraft kind={c.kind} />
          </group>
          {/* generous invisible hit target (Earth occludes ones behind it) */}
          <mesh
            onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useEarthUI.getState().setHovered(i); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { if (useEarthUI.getState().hovered === i) useEarthUI.getState().setHovered(null); document.body.style.cursor = ''; }}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const cur = useEarthUI.getState().selected; useEarthUI.getState().setSelected(cur === i ? null : i); }}
          >
            <sphereGeometry args={[HIT, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* small cyan indicator light */}
          <mesh position={[0, radius * c.scale * 1.15, 0]}>
            <sphereGeometry args={[radius * 0.006, 8, 8]} />
            <meshBasicMaterial ref={(m) => { inds.current[i] = m; }} color="#5fe4ff" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
