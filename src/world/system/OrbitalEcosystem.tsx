'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CRAFT, orbitBridge, hoverBridge, useEarthUI, earthFocus } from '@/state/earthHoverStore';
import { Spacecraft } from '@/world/system/SpacecraftModels';

/**
 * OrbitalEcosystem — Earth's living constellation, with a perfectly still camera.
 *
 * To keep every craft ON-SCREEN (true 3D orbits around an edge-framed Earth
 * swing off-frame or behind the planet), each craft loops on a small ellipse
 * placed in CAMERA space — in the open area of the frustum, just in front of
 * Earth. It reads as near-Earth traffic and never leaves view or hides behind
 * the globe. Craft occasionally transmit a brief card while still moving; the
 * viewer hovers to brighten/slow/label and clicks to open a side panel. No
 * camera automation.
 */

const CARD_DUR = 2.0;

export function OrbitalEcosystem({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const pos = useRef<(THREE.Group | null)[]>([]);
  const models = useRef<(THREE.Group | null)[]>([]);
  const inds = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const angles = useRef<number[]>(CRAFT.map((c) => c.orbit.phase));
  const hoverEase = useRef<number[]>(CRAFT.map(() => 0));
  const nextFire = useRef<number[]>(CRAFT.map((c, i) => (c.transmit ? 1.2 + i * 1.1 + Math.random() * 3 : Infinity)));
  const presentClock = useRef(0);
  const card = useRef({ index: -1, t: 0 });
  const frozen = useRef({ halfH: 1, halfW: 1, valid: false });

  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(), []);
  const _fwd = useMemo(() => new THREE.Vector3(), []);
  const _cam = useMemo(() => new THREE.Vector3(), []);
  const _fc = useMemo(() => new THREE.Vector3(), []);
  const _w = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  const project = (world: THREE.Vector3) => {
    _ndc.copy(world).project(camera);
    return { x: (_ndc.x * 0.5 + 0.5) * size.width, y: (-_ndc.y * 0.5 + 0.5) * size.height };
  };

  useFrame((state, delta) => {
    const f = earthFocus();
    const visible = f > 0.08;
    const hovered = useEarthUI.getState().hovered;

    // Recompute the camera/screen frame ONLY while parked at Earth. When the
    // viewer scrolls away we FREEZE it, so the craft stay put in world space and
    // recede naturally with the flight instead of swimming/rescaling in the
    // moving frustum (that was the artificial enlarge/shrink on Earth->Mars).
    if (f > 0.6 || !frozen.current.valid) {
      camera.getWorldPosition(_cam);
      _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      _fwd.setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();
      const camDist = _cam.distanceTo(center);
      const dist = Math.max(radius, camDist - radius * 0.7); // in front of Earth's near face
      const cam2 = camera as THREE.PerspectiveCamera;
      frozen.current.halfH = Math.tan(THREE.MathUtils.degToRad((cam2.fov || 50) * 0.5)) * dist;
      frozen.current.halfW = frozen.current.halfH * (size.width / Math.max(1, size.height));
      _fc.copy(_cam).addScaledVector(_fwd, dist);
      frozen.current.valid = true;
    }
    const halfH = frozen.current.halfH;
    const halfW = frozen.current.halfW;

    for (let i = 0; i < CRAFT.length; i++) {
      const g = pos.current[i];
      if (!g) continue;
      g.visible = visible;
      if (!visible) continue;
      const o = CRAFT[i].orbit;
      const he = (hoverEase.current[i] = THREE.MathUtils.damp(hoverEase.current[i], hovered === i ? 1 : 0, 8, delta));
      angles.current[i] += o.dir * o.speed * delta * (1 - 0.5 * he); // hover slows, never stops
      const a = angles.current[i];
      const ex = o.fx * halfW + Math.cos(a) * o.rx * halfH;
      const ey = o.fy * halfH + Math.sin(a) * o.ry * halfH;
      const dz = o.tilt * halfH * 0.08 * Math.sin(a * 2);
      _w.copy(_fc).addScaledVector(_right, ex).addScaledVector(_up, ey).addScaledVector(_fwd, dz);
      g.position.copy(_w).sub(center); // group sits at `center`
      const m = models.current[i];
      if (m) {
        m.rotation.y += delta * 0.1; // gentle self-spin
        m.scale.setScalar(CRAFT[i].scale * radius * (1 + 0.18 * he)); // hover swells
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

    // --- occasional transmissions (brief; the craft keeps moving) ---
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
          {/* generous invisible hit target so every craft is easy to hover */}
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
