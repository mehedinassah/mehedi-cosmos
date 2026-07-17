'use client';

import { useMemo, useRef, type ReactElement } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  MISSIONS, CLASS_ORBIT, colorOfMission, marsBridge, marsFocus, useMarsUI,
  type MissionClass,
} from '@/state/marsStore';
import { CHAPTER_SP, systemPose } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * MarsMissionControl — projects as distinct spacecraft orbiting Mars.
 *
 * Every mission is its OWN craft (industrial cargo, research probe, explorer
 * drone, cubesat, telescope) on its own tilted, eccentric orbit with breathing
 * room from the planet. Each owns a lit colony on the surface; drones
 * periodically descend to dock, transmit, and climb back. Hover: the craft
 * slows, thrusters glow, a soft laser links it to its colony, and the mission
 * log unfolds. Scanners spin, comms blip — the whole planet feels alive.
 */

const CYAN = new THREE.Color('#8fe6ee');
const THRUST = new THREE.Color('#6fb4ff');
const N_COMM = 6;
const N_COLONY = 16;

/* ---- one distinct spacecraft per mission class ---- */
function Craft({ cls, s, col, glowRef, thrustRef }: {
  cls: MissionClass; s: number; col: string;
  glowRef: (m: THREE.SpriteMaterial | null) => void;
  thrustRef: (m: THREE.SpriteMaterial | null) => void;
}) {
  const scan = useRef<THREE.Object3D>(null);
  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(220,220,230,0.5)'], [1, 'rgba(200,200,220,0)']]),
    [],
  );
  useFrame((_, dt) => {
    if (scan.current) scan.current.rotation.z += dt * (cls === 'ai' ? 1.3 : cls === 'research' ? 0.9 : 0.5);
  });
  const metalProps = { color: '#c3c8d0', metalness: 0.72, roughness: 0.38 } as const;
  const accent = (
    <meshBasicMaterial color={col} toneMapped={false} />
  );

  let body: ReactElement;
  if (cls === 'enterprise') {
    // large industrial cargo satellite: chunky body + stacked panel arrays + dish
    body = (
      <>
        <mesh><boxGeometry args={[s * 1.4, s * 0.95, s * 2.3]} /><meshStandardMaterial {...metalProps} /></mesh>
        <mesh position={[0, s * 0.62, 0]}><boxGeometry args={[s * 1.0, s * 0.3, s * 1.4]} /><meshStandardMaterial {...metalProps} /></mesh>
        {[-1, 1].map((sx) => [-0.6, 0.6].map((py) => (
          <mesh key={`${sx}${py}`} position={[sx * s * 1.7, py * s * 0.6, 0]}><boxGeometry args={[s * 1.7, s * 0.06, s * 1.0]} />{accent}</mesh>
        )))}
        <mesh position={[0, s * 0.95, s * 0.6]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[s * 0.02, s * 0.02, s * 0.9, 6]} /><meshStandardMaterial {...metalProps} /></mesh>
      </>
    );
  } else if (cls === 'ai') {
    // research probe: slim body, long antenna boom + sensor, rotating scanner ring
    body = (
      <>
        <mesh><boxGeometry args={[s * 0.7, s * 0.7, s * 1.1]} /><meshStandardMaterial {...metalProps} /></mesh>
        <mesh position={[0, 0, s * 1.6]}><cylinderGeometry args={[s * 0.04, s * 0.04, s * 2.4, 6]} /><meshStandardMaterial {...metalProps} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, s * 2.9]}><sphereGeometry args={[s * 0.32, 12, 12]} />{accent}</mesh>
        <mesh ref={scan as never}><torusGeometry args={[s * 1.15, s * 0.05, 8, 28]} />{accent}</mesh>
        {[-1, 1].map((sx) => (<mesh key={sx} position={[sx * s * 1.1, 0, 0]}><boxGeometry args={[s * 1.1, s * 0.05, s * 0.7]} />{accent}</mesh>))}
      </>
    );
  } else if (cls === 'web') {
    // explorer drone: body + camera lens + LIDAR dome + solar panels
    body = (
      <>
        <mesh><boxGeometry args={[s * 0.9, s * 0.6, s * 1.2]} /><meshStandardMaterial {...metalProps} /></mesh>
        <mesh position={[0, 0, s * 0.75]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[s * 0.3, s * 0.34, s * 0.35, 16]} />{accent}</mesh>
        <mesh position={[0, s * 0.4, 0]}><sphereGeometry args={[s * 0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{accent}</mesh>
        {[-1, 1].map((sx) => (<mesh key={sx} position={[sx * s * 1.35, 0, 0]}><boxGeometry args={[s * 1.6, s * 0.05, s * 0.85]} />{accent}</mesh>))}
      </>
    );
  } else if (cls === 'mobile') {
    // cubesat: compact cube + tiny panels
    body = (
      <>
        <mesh><boxGeometry args={[s * 0.7, s * 0.7, s * 0.7]} /><meshStandardMaterial {...metalProps} /></mesh>
        {[-1, 1].map((sx) => (<mesh key={sx} position={[sx * s * 0.85, 0, 0]}><boxGeometry args={[s * 0.9, s * 0.04, s * 0.6]} />{accent}</mesh>))}
        <mesh position={[0, s * 0.5, 0]}><cylinderGeometry args={[s * 0.015, s * 0.015, s * 0.5, 5]} /><meshStandardMaterial {...metalProps} /></mesh>
      </>
    );
  } else {
    // research telescope: optical tube + lens + dish + scanning ring
    body = (
      <>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[s * 0.36, s * 0.36, s * 2.2, 16]} /><meshStandardMaterial {...metalProps} /></mesh>
        <mesh position={[0, 0, s * 1.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[s * 0.4, s * 0.4, s * 0.1, 20]} />{accent}</mesh>
        <mesh ref={scan as never} position={[0, 0, -s * 0.4]}><torusGeometry args={[s * 0.7, s * 0.04, 8, 24]} />{accent}</mesh>
        <mesh position={[s * 0.6, 0, -s * 0.8]} rotation={[0, 0.6, 0]}><sphereGeometry args={[s * 0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{accent}</mesh>
      </>
    );
  }

  const g = s * 3.6;
  return (
    <>
      {body}
      <sprite scale={[g, g, 1]}>
        <spriteMaterial ref={glowRef} map={glowTex} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[0, 0, -s * 1.7]} scale={[s * 2.2, s * 2.2, 1]}>
        <spriteMaterial ref={thrustRef} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

export function MarsMissionControl({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const droneGrp = useRef<(THREE.Group | null)[]>([]);
  const glowMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const thrustMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const landSp = useRef<(THREE.Sprite | null)[]>([]);
  const landMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const beamMesh = useRef<(THREE.Mesh | null)[]>([]);
  const beamMat = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const commRef = useRef<THREE.Object3D | null>(null);
  const colonyRef = useRef<THREE.Object3D | null>(null);
  const colonyMat = useRef<THREE.PointsMaterial | null>(null);

  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(220,220,230,0.5)'], [1, 'rgba(200,200,220,0)']]),
    [],
  );
  const beamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius * 0.006, radius * 0.02, 1, 10, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, [radius]);

  // Parked basis + per-class orbit plane + landing sites + ambient colonies.
  const basis = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.mars, pos, quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const toCam = fwd.clone().multiplyScalar(-1);
    // Each class travels a DIFFERENT screen direction where it lingers. The
    // long (cos) axis u is PERPENDICULAR to moveDir (so the drone dwells at the
    // ends of u while moving along moveDir); the short (sin) axis v is along
    // moveDir plus depth (so the far half swings behind Mars). Magnitudes are
    // baked in. Pos = hub + u cos a + v sin a.
    const planes: Record<string, { u: THREE.Vector3; v: THREE.Vector3; hub: THREE.Vector3 }> = {};
    (Object.keys(CLASS_ORBIT) as MissionClass[]).forEach((c) => {
      const o = CLASS_ORBIT[c];
      const qDir = right.clone().multiplyScalar(Math.cos(o.moveDir)).addScaledVector(up, Math.sin(o.moveDir)); // motion
      const pDir = right.clone().multiplyScalar(-Math.sin(o.moveDir)).addScaledVector(up, Math.cos(o.moveDir)); // major, perp
      const maj = o.radius * radius;
      const u = pDir.multiplyScalar(maj);
      const v = qDir.multiplyScalar(o.minRatio * maj).addScaledVector(toCam, o.depth * radius);
      const hub = center.clone().addScaledVector(up, o.up * radius);
      planes[c] = { u, v, hub };
    });
    const landing = MISSIONS.map((m) => {
      const zz = Math.sqrt(Math.max(0.04, 1 - m.ax * m.ax - m.ay * m.ay));
      const dir = right.clone().multiplyScalar(m.ax).addScaledVector(up, m.ay).addScaledVector(toCam, zz).normalize();
      return { dir, pos: center.clone().addScaledVector(dir, radius * 1.02), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) };
    });
    // ambient colonies scattered across the near hemisphere
    let seed = 9157;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const colony = new Float32Array(N_COLONY * 3);
    for (let i = 0; i < N_COLONY; i++) {
      const ax = (rng() - 0.5) * 1.7, ay = (rng() - 0.5) * 1.7;
      const zz = Math.sqrt(Math.max(0.03, 1 - Math.min(0.95, ax * ax + ay * ay)));
      const dir = right.clone().multiplyScalar(ax).addScaledVector(up, ay).addScaledVector(toCam, zz).normalize();
      const p = center.clone().addScaledVector(dir, radius * 1.02);
      colony[i * 3] = p.x; colony[i * 3 + 1] = p.y; colony[i * 3 + 2] = p.z;
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(colony, 3));
    return { right, up, toCam, planes, landing, colonyGeo: cg };
  }, [center, radius]);

  const dpos = useRef<THREE.Vector3[]>(MISSIONS.map(() => new THREE.Vector3()));
  const dvis = useRef<boolean[]>(MISSIONS.map(() => true));
  const spin = useRef<number[]>(MISSIONS.map((m) => m.phase));
  const slow = useRef<number[]>(MISSIONS.map(() => 1));
  const beamGrow = useRef<number[]>(MISSIONS.map(() => 0));
  const started = useRef(false);
  const appear = useRef(0);
  const commGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_COMM * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_COMM * 3), 3));
    return g;
  }, []);
  const commMat = useMemo(
    () => new THREE.PointsMaterial({ size: radius * 0.045, vertexColors: true, map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [radius, glowTex],
  );
  const comms = useMemo(() => Array.from({ length: N_COMM }, (_, i) => ({ m: (i * 3) % MISSIONS.length, t: i / N_COMM })), []);
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _perp = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  const occ = (p: THREE.Vector3) => {
    _perp.copy(p).sub(center);
    const along = _perp.dot(basis.toCam);
    return !(along < 0 && _perp.addScaledVector(basis.toCam, -along).length() < radius * 1.02);
  };

  useFrame((state, delta) => {
    const f = marsFocus();
    marsBridge.focus = f;
    const visible = f > 0.02;
    for (const g of droneGrp.current) if (g) g.visible = visible;
    for (const s of landSp.current) if (s) s.visible = visible;
    for (const bm of beamMesh.current) if (bm) bm.visible = visible;
    if (commRef.current) commRef.current.visible = visible;
    if (colonyRef.current) colonyRef.current.visible = visible;
    if (!visible) {
      for (const h of hits.current) if (h) h.visible = false;
      marsBridge.active = false; marsBridge.env = 0; appear.current = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    appear.current = Math.min(1, appear.current + delta * 0.8);
    const app = THREE.MathUtils.smoothstep(appear.current, 0, 1);
    const ui = useMarsUI.getState();
    const focusIdx = ui.hovered != null ? ui.hovered : ui.selected;

    // On arrival, seed every drone at ITS orbit's most camera-facing point (all
    // visible / closest to the viewer first); varied planes then carry some
    // behind Mars over the next ~15s, each moving in its own direction.
    if (f < 0.1) started.current = false;
    if (!started.current && f > 0.5) {
      const N = MISSIONS.length;
      for (let i = 0; i < N; i++) {
        const pl = basis.planes[MISSIONS[i].cls];
        // seed at the angle that sits most in the open area (leftward, visible)
        let bestA = Math.PI, best = -Infinity;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          _p.copy(pl.hub).addScaledVector(pl.u, Math.cos(a)).addScaledVector(pl.v, Math.sin(a));
          if (!occ(_p)) continue;
          _ndc.copy(_p).project(camera);
          if (_ndc.z >= 1) continue;
          const score = -_ndc.x - 0.3 * Math.max(0, -_ndc.y); // favour left, avoid low
          if (score > best) { best = score; bestA = a; }
        }
        spin.current[i] = bestA + (i - (N - 1) / 2) * 0.28; // stagger so same-class craft separate
      }
      started.current = true;
    }

    for (let i = 0; i < MISSIONS.length; i++) {
      const m = MISSIONS[i];
      const o = CLASS_ORBIT[m.cls];
      const isHover = i === focusIdx;
      slow.current[i] += ((isHover ? 0.12 : 1) - slow.current[i]) * Math.min(1, delta * 5);
      spin.current[i] += delta * o.speed * o.dir * slow.current[i];
      const pl = basis.planes[m.cls];
      const a = spin.current[i];
      const p = dpos.current[i];
      p.copy(pl.hub).addScaledVector(pl.u, Math.cos(a)).addScaledVector(pl.v, Math.sin(a));
      const vis = occ(p);
      dvis.current[i] = vis;

      const g = droneGrp.current[i];
      if (g) {
        g.position.copy(p);
        _p.copy(pl.u).multiplyScalar(-Math.sin(a)).addScaledVector(pl.v, Math.cos(a));
        if (isHover) _p.copy(camera.position).sub(p);
        g.lookAt(_p.add(p));
        g.scale.setScalar((isHover ? 1.32 : 1) * app);
        g.visible = visible && vis;
      }
      const gm = glowMat.current[i];
      if (gm) gm.opacity = (isHover ? 0.85 : 0.4 + 0.12 * Math.sin(t * 1.6 + i)) * app * (vis ? 1 : 0);
      const tm = thrustMat.current[i];
      if (tm) tm.opacity = (isHover ? (0.55 + 0.35 * Math.sin(t * 22)) : 0) * app;

      // colony + soft laser
      const land = basis.landing[i];
      const lvis = occ(land.pos);
      const ls = landSp.current[i];
      const lm = landMat.current[i];
      if (ls) { ls.position.copy(land.pos); ls.visible = visible && lvis; ls.scale.setScalar(radius * (isHover ? 0.14 : 0.1)); }
      if (lm) lm.opacity = (isHover ? 0.9 : 0.28 + 0.12 * Math.sin(t * 2 + i * 1.7)) * app * (lvis ? 1 : 0);
      beamGrow.current[i] += ((isHover ? 1 : 0) - beamGrow.current[i]) * Math.min(1, delta * 5);
      const bg = beamGrow.current[i];
      const bm = beamMesh.current[i];
      const bmt = beamMat.current[i];
      if (bm) { bm.position.copy(land.pos); bm.quaternion.copy(land.quat); bm.scale.set(1, Math.max(0.001, radius * 1.5 * bg), 1); bm.visible = visible && lvis && bg > 0.02; }
      if (bmt) bmt.opacity = bg * (0.055 + 0.02 * Math.sin(t * 5)) * app; // very faint marker laser

      const hit = hits.current[i];
      if (hit) { hit.position.copy(p); hit.visible = visible && vis && app > 0.6; }
    }

    // comm blips drift from each drone down to its colony
    const cp = commGeo.attributes.position.array as Float32Array;
    const cc = commGeo.attributes.color.array as Float32Array;
    for (let k = 0; k < N_COMM; k++) {
      const cm = comms[k];
      cm.t += delta * 0.4;
      if (cm.t >= 1) { cm.t = 0; cm.m = (cm.m + 1) % MISSIONS.length; }
      _p.copy(dpos.current[cm.m]).lerp(basis.landing[cm.m].pos, cm.t);
      cp[k * 3] = _p.x; cp[k * 3 + 1] = _p.y; cp[k * 3 + 2] = _p.z;
      const gl = occ(_p) ? Math.sin(cm.t * Math.PI) * app : 0;
      cc[k * 3] = CYAN.r * gl; cc[k * 3 + 1] = CYAN.g * gl; cc[k * 3 + 2] = CYAN.b * gl;
    }
    commGeo.attributes.position.needsUpdate = true;
    commGeo.attributes.color.needsUpdate = true;
    if (colonyMat.current) colonyMat.current.opacity = (0.14 + 0.05 * Math.sin(t * 0.7)) * app;

    // card bridge — the mission log is CLICK-driven (a pinned selection that
    // self-closes in 3s); hover only highlights the drone, it doesn't pop a card
    const cardIdx = ui.selected;
    if (cardIdx != null && dvis.current[cardIdx]) {
      _ndc.copy(dpos.current[cardIdx]).project(camera);
      marsBridge.index = cardIdx;
      marsBridge.color = colorOfMission(MISSIONS[cardIdx]);
      marsBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
      marsBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
      marsBridge.env += ((_ndc.z < 1 ? 1 : 0) - marsBridge.env) * Math.min(1, delta * 8);
      marsBridge.active = _ndc.z < 1;
    } else {
      marsBridge.env += (0 - marsBridge.env) * Math.min(1, delta * 8);
      marsBridge.active = cardIdx != null;
    }
  });

  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (marsFocus() < 0.4) return;
    e.stopPropagation();
    useMarsUI.getState().setHovered(i);
    document.body.style.cursor = 'pointer';
  };
  const onOut = (i: number) => () => {
    if (useMarsUI.getState().hovered === i) useMarsUI.getState().setHovered(null);
    document.body.style.cursor = '';
  };
  const onClick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    if (marsFocus() < 0.4) return;
    e.stopPropagation();
    useMarsUI.getState().setSelected(i); // pin the mission log (auto-closes in 3s)
  };
  const hitR = radius * 0.24;
  const S = radius * 0.055;

  return (
    <group>
      <points ref={(el) => { commRef.current = el; }} geometry={commGeo} material={commMat} visible={false} frustumCulled={false} />
      {/* ambient colonies scattered on the surface */}
      <points ref={(el) => { colonyRef.current = el; }} geometry={basis.colonyGeo} visible={false} frustumCulled={false}>
        <pointsMaterial ref={(m) => { colonyMat.current = m; }} size={radius * 0.05} color="#ffb27a" map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {MISSIONS.map((m, i) => {
        const col = colorOfMission(m);
        const s = S * CLASS_ORBIT[m.cls].size;
        return (
          <group key={m.id}>
            <group ref={(el) => { droneGrp.current[i] = el; }} visible={false}>
              <Craft cls={m.cls} s={s} col={col} glowRef={(mm) => { glowMat.current[i] = mm; }} thrustRef={(mm) => { thrustMat.current[i] = mm; }} />
            </group>
            <mesh ref={(el) => { hits.current[i] = el; }} visible={false} onPointerOver={onOver(i)} onPointerOut={onOut(i)} onClick={onClick(i)}>
              <sphereGeometry args={[hitR, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <sprite ref={(el) => { landSp.current[i] = el; }} visible={false} scale={[radius * 0.1, radius * 0.1, 1]}>
              <spriteMaterial ref={(mm) => { landMat.current[i] = mm; if (mm) mm.color.set(col); }} map={glowTex} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
            <mesh ref={(el) => { beamMesh.current[i] = el; }} geometry={beamGeo} visible={false}>
              <meshBasicMaterial ref={(mm) => { beamMat.current[i] = mm; if (mm) mm.color.set(col); }} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
