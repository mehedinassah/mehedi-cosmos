'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CRAFT, STORY_INDICES, orbitBridge, hoverBridge, useEarthUI, earthFocus } from '@/state/earthHoverStore';
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
    // parked camera's own basis (screen right / up / forward-into-scene)
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    // Tidy zone IN FRONT of Earth (toward the camera — closer to the eye, never
    // intersecting the planet), lifted into the open upper-center gap (never over
    // the left text or below the screen). World-fixed, so fly-past stays natural.
    const offset = new THREE.Vector3()
      .addScaledVector(camFwd, -0.9 * radius) // toward camera, in front of Earth
      .addScaledVector(camRight, -1.3 * radius) // screen-left into the gap
      .addScaledVector(camUp, 0.55 * radius); // upper area
    const SHRINK = 0.42; // keep the loops compact and organized in the upper band
    const list = CRAFT.map((c) => {
      const o = c.orbit;
      // FACE-ON to the viewer: loop in the screen plane (camRight/camUp), with a
      // small tilt toward the view axis for subtle depth.
      const u = camRight.clone().applyAxisAngle(camUp, o.tiltA).normalize();
      const v = camUp.clone().applyAxisAngle(camRight, o.tiltB).normalize();
      return { u, v, r: o.radius * radius * SHRINK, speed: o.speed, dir: o.dir };
    });
    return { list, offset };
  }, [radius]);

  const angles = useRef<number[]>(CRAFT.map((c) => c.orbit.phase));
  const hoverEase = useRef<number[]>(CRAFT.map(() => 0));
  const presentClock = useRef(0);

  const _w = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  const project = (world: THREE.Vector3) => {
    _ndc.copy(world).project(camera);
    return { x: (_ndc.x * 0.5 + 0.5) * size.width, y: (-_ndc.y * 0.5 + 0.5) * size.height };
  };

  useFrame((state, delta) => {
    const f = earthFocus();
    const visible = f > 0.02;
    const hovered = useEarthUI.getState().hovered;

    // --- real orbits, fixed in world space (never stop) ---
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

    // --- transmissions: a steady cycle so EVERY message shows within ~15s ---
    // Only while essentially parked, so a card never lingers over empty space as
    // the craft recede on scroll-away.
    if (f < 0.85) {
      orbitBridge.active = false;
      orbitBridge.env = 0;
      return;
    }
    presentClock.current += delta;
    const N = STORY_INDICES.length;
    const SLOT = 2.4; // seconds per craft -> N*SLOT (~14.4s) for a full round
    const slot = Math.floor(presentClock.current / SLOT) % N;
    const tin = presentClock.current % SLOT;
    const idx = STORY_INDICES[slot];
    const env = THREE.MathUtils.smoothstep(tin, 0.15, 0.5) * (1 - THREE.MathUtils.smoothstep(tin, 1.85, 2.15));
    const g = pos.current[idx];
    if (g) {
      _w.copy(center).add(g.position);
      const s = project(_w);
      orbitBridge.px = s.x;
      orbitBridge.py = s.y;
    }
    orbitBridge.index = idx;
    orbitBridge.color = CRAFT[idx].color;
    orbitBridge.env = env;
    orbitBridge.active = env > 0.02;
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
