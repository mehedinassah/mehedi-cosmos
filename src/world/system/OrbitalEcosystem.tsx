'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CRAFT, orbitBridge, hoverBridge, useEarthUI, earthFocus } from '@/state/earthHoverStore';
import { Spacecraft } from '@/world/system/SpacecraftModels';

/**
 * OrbitalEcosystem — Earth's living constellation, with a perfectly still camera.
 *
 * Every craft orbits continuously (unique radius, speed, inclination, direction)
 * and never stops. Craft occasionally TRANSMIT a brief holographic card while
 * they keep moving (pulse -> card -> fade, ~2s, only when on the visible side).
 * The viewer drives discovery: hover any object to brighten it, slow it a hair
 * and label it; click to open a side panel while it keeps orbiting. No camera
 * automation — the movement is the objects.
 */

const CARD_DUR = 2.0;

export function OrbitalEcosystem({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const pos = useRef<(THREE.Group | null)[]>([]);
  const models = useRef<(THREE.Group | null)[]>([]);
  const inds = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const pathsGroup = useRef<THREE.Group>(null);

  const orbits = useMemo(
    () =>
      CRAFT.map((c) => ({
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(c.orbit.incl, c.orbit.raan, 0, 'YXZ')),
        r: c.orbit.radius * radius,
        speed: c.orbit.speed,
        dir: c.orbit.dir,
        base: c.scale * radius,
        transmit: c.transmit,
      })),
    [radius],
  );

  // faint orbit-path rings (only for the named craft)
  const paths = useMemo(
    () =>
      CRAFT.filter((c) => c.path).map((c) => {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.orbit.incl, c.orbit.raan, 0, 'YXZ'));
        const r = c.orbit.radius * radius;
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 96; k++) {
          const a = (k / 96) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyQuaternion(q));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: '#5f7690', transparent: true, opacity: 0.07, depthWrite: false });
        return new THREE.LineLoop(geo, mat);
      }),
    [radius],
  );

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
    return { x: (_ndc.x * 0.5 + 0.5) * size.width, y: (-_ndc.y * 0.5 + 0.5) * size.height, front: _ndc.z < 1 };
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const f = earthFocus();
    const visible = f > 0.02;
    if (pathsGroup.current) pathsGroup.current.visible = visible;
    const hovered = useEarthUI.getState().hovered;
    camera.getWorldPosition(_cam);
    _toCam.copy(_cam).sub(center); // earth -> camera

    // --- move & light every craft (always, never stops) ---
    for (let i = 0; i < CRAFT.length; i++) {
      const g = pos.current[i];
      if (!g) continue;
      g.visible = visible;
      if (!visible) continue;
      const o = orbits[i];
      const he = (hoverEase.current[i] = THREE.MathUtils.damp(hoverEase.current[i], hovered === i ? 1 : 0, 8, delta));
      // advance the orbit; hovering slows it a hair (never stops)
      angles.current[i] += o.dir * o.speed * delta * (1 - 0.45 * he);
      const ang = angles.current[i];
      _p.set(Math.cos(ang) * o.r, 0, Math.sin(ang) * o.r).applyQuaternion(o.q);
      g.position.copy(_p);
      const m = models.current[i];
      if (m) {
        m.rotation.y += delta * 0.12; // gentle self-spin
        m.scale.setScalar(o.base * (1 + 0.2 * he)); // hover swells slightly
      }
      const ind = inds.current[i];
      if (ind) ind.opacity = (0.28 + 0.7 * he) * (0.7 + 0.3 * Math.sin(t * 3 + i)); // cyan indicator, brightens on hover
    }

    // hovered craft screen position for the DOM label
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
      // pick a due transmitter that is on the camera-facing side of Earth
      for (let i = 0; i < CRAFT.length; i++) {
        if (!orbits[i].transmit || presentClock.current < nextFire.current[i]) continue;
        const g = pos.current[i];
        if (!g) continue;
        if (g.position.dot(_toCam) <= 0) continue; // behind Earth -> wait for the near side
        c.index = i;
        c.t = 0;
        break;
      }
    }
  });

  const HIT = radius * 0.1;
  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useEarthUI.getState().setHovered(i);
    document.body.style.cursor = 'pointer';
  };
  const onOut = (i: number) => () => {
    if (useEarthUI.getState().hovered === i) useEarthUI.getState().setHovered(null);
    document.body.style.cursor = '';
  };
  const onClick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const cur = useEarthUI.getState().selected;
    useEarthUI.getState().setSelected(cur === i ? null : i);
  };

  return (
    <group position={center}>
      <group ref={pathsGroup} visible={false}>
        {paths.map((p, i) => (
          <primitive key={i} object={p} />
        ))}
      </group>

      {CRAFT.map((c, i) => (
        <group key={c.id} ref={(g) => { pos.current[i] = g; }} visible={false}>
          <group ref={(g) => { models.current[i] = g; }} scale={radius * c.scale}>
            <Spacecraft kind={c.kind} />
          </group>
          {/* generous invisible hit target so even tiny craft are hoverable */}
          <mesh onPointerOver={onOver(i)} onPointerOut={onOut(i)} onClick={onClick(i)}>
            <sphereGeometry args={[HIT, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* small cyan indicator light */}
          <mesh position={[0, radius * c.scale * 0.9 + HIT * 0.15, 0]}>
            <sphereGeometry args={[radius * 0.006, 8, 8]} />
            <meshBasicMaterial ref={(m) => { inds.current[i] = m; }} color="#5fe4ff" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
