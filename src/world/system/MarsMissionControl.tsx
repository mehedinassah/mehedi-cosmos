'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  MISSIONS, CLASS_ORBIT, colorOfMission, marsBridge, marsFocus, useMarsUI,
} from '@/state/marsStore';
import { CHAPTER_SP, systemPose } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * MarsMissionControl — projects as autonomous drones orbiting Mars.
 *
 * Each mission is a drone on a tilted orbit (grouped by class), with a lit
 * landing site on the surface below. Hover a drone: it slows almost to a stop,
 * its thrusters glow, a beam rises from its landing site, and the classified
 * mission log unfolds (DOM). Leave and it accelerates back into orbit. Comm
 * blips drift down from the drones to their sites. Drones that swing behind
 * Mars are occluded; the whole thing fades in only at the Mars stop.
 */

const CYAN = new THREE.Color('#8fe6ee');
const THRUST = new THREE.Color('#6fb4ff');
const N_COMM = 6;

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

  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(220,220,230,0.5)'], [1, 'rgba(200,200,220,0)']]),
    [],
  );
  const beamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius * 0.02, radius * 0.05, 1, 12, 1, true);
    g.translate(0, 0.5, 0); // base at origin, grows outward along +Y
    return g;
  }, [radius]);

  // Parked camera basis + per-class orbit plane; landing dirs on the near face.
  const basis = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.mars, pos, quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const toCam = fwd.clone().multiplyScalar(-1);
    const planes: Record<string, { u: THREE.Vector3; v: THREE.Vector3; b: number }> = {};
    (Object.keys(CLASS_ORBIT) as (keyof typeof CLASS_ORBIT)[]).forEach((c) => {
      const o = CLASS_ORBIT[c];
      const u = right.clone().applyAxisAngle(toCam, o.roll);
      const v = up.clone().multiplyScalar(Math.cos(o.incl)).addScaledVector(fwd, Math.sin(o.incl)).applyAxisAngle(toCam, o.roll);
      planes[c] = { u, v, b: 1 - o.ecc };
    });
    // landing sites: on the camera-facing hemisphere from each mission's (ax,ay)
    const landing = MISSIONS.map((m) => {
      const zz = Math.sqrt(Math.max(0.04, 1 - m.ax * m.ax - m.ay * m.ay));
      const dir = right.clone().multiplyScalar(m.ax).addScaledVector(up, m.ay).addScaledVector(toCam, zz).normalize();
      const pos2 = center.clone().addScaledVector(dir, radius * 1.02);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      return { dir, pos: pos2, quat: q };
    });
    return { right, up, toCam, planes, landing };
  }, [center, radius]);

  const dpos = useRef<THREE.Vector3[]>(MISSIONS.map(() => new THREE.Vector3()));
  const dvis = useRef<boolean[]>(MISSIONS.map(() => true));
  const spin = useRef<number[]>(MISSIONS.map((m) => m.phase));
  const slow = useRef<number[]>(MISSIONS.map(() => 1));
  const beamGrow = useRef<number[]>(MISSIONS.map(() => 0));
  const appear = useRef(0);
  const commGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_COMM * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_COMM * 3), 3));
    return g;
  }, []);
  const commMat = useMemo(
    () => new THREE.PointsMaterial({ size: radius * 0.05, vertexColors: true, map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [radius, glowTex],
  );
  const comms = useMemo(() => Array.from({ length: N_COMM }, (_, i) => ({ m: (i * 3) % MISSIONS.length, t: Math.random() })), []);
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _perp = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _c = useMemo(() => new THREE.Color(), []);

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
    if (!visible) {
      for (const h of hits.current) if (h) h.visible = false;
      marsBridge.active = false; marsBridge.env = 0; appear.current = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    appear.current = Math.min(1, appear.current + delta * 0.8);
    const app = THREE.MathUtils.smoothstep(appear.current, 0, 1);
    const hovered = useMarsUI.getState().hovered;

    for (let i = 0; i < MISSIONS.length; i++) {
      const m = MISSIONS[i];
      const o = CLASS_ORBIT[m.cls];
      const isHover = i === hovered;
      // slow almost to a stop while inspected
      slow.current[i] += ((isHover ? 0.12 : 1) - slow.current[i]) * Math.min(1, delta * 5);
      spin.current[i] += delta * o.speed * o.dir * slow.current[i];
      const pl = basis.planes[m.cls];
      const R = o.radius * radius;
      const a = spin.current[i];
      const p = dpos.current[i];
      p.copy(center).addScaledVector(pl.u, Math.cos(a) * R).addScaledVector(pl.v, Math.sin(a) * R * pl.b);
      const vis = occ(p);
      dvis.current[i] = vis;

      const g = droneGrp.current[i];
      if (g) {
        g.position.copy(p);
        // face the camera when inspected, otherwise glide along the orbit tangent
        _p.copy(pl.u).multiplyScalar(-Math.sin(a)).addScaledVector(pl.v, Math.cos(a) * pl.b);
        if (isHover) _p.copy(camera.position).sub(p);
        g.lookAt(_p.add(p));
        g.rotation.z += delta * (isHover ? 0.2 : 0.5);
        const sc = (isHover ? 1.35 : 1) * app;
        g.scale.setScalar(sc);
        g.visible = visible && vis;
      }
      const gm = glowMat.current[i];
      if (gm) gm.opacity = (isHover ? 0.9 : 0.45 + 0.12 * Math.sin(t * 1.6 + i)) * app * (vis ? 1 : 0);
      const tm = thrustMat.current[i];
      if (tm) tm.opacity = isHover ? (0.6 + 0.4 * Math.sin(t * 22)) * app : 0;

      // landing site + beam
      const land = basis.landing[i];
      const lvis = occ(land.pos);
      const ls = landSp.current[i];
      const lm = landMat.current[i];
      if (ls) { ls.position.copy(land.pos); ls.visible = visible && lvis; }
      if (lm) lm.opacity = (isHover ? 0.95 : 0.32 + 0.14 * Math.sin(t * 2 + i * 1.7)) * app * (lvis ? 1 : 0);
      beamGrow.current[i] += ((isHover ? 1 : 0) - beamGrow.current[i]) * Math.min(1, delta * 5);
      const bg = beamGrow.current[i];
      const bm = beamMesh.current[i];
      const bmt = beamMat.current[i];
      if (bm) {
        bm.position.copy(land.pos);
        bm.quaternion.copy(land.quat);
        bm.scale.set(1, Math.max(0.001, radius * 1.7 * bg), 1);
        bm.visible = visible && lvis && bg > 0.02;
      }
      if (bmt) bmt.opacity = bg * 0.42 * app;

      const hit = hits.current[i];
      if (hit) { hit.position.copy(p); hit.visible = visible && vis && app > 0.6; }
    }

    // comm blips drift from each drone down to its landing site
    const cp = commGeo.attributes.position.array as Float32Array;
    const cc = commGeo.attributes.color.array as Float32Array;
    for (let k = 0; k < N_COMM; k++) {
      const cm = comms[k];
      cm.t += delta * 0.4;
      if (cm.t >= 1) { cm.t = 0; cm.m = (cm.m + 1) % MISSIONS.length; }
      const d = dpos.current[cm.m];
      const land = basis.landing[cm.m].pos;
      _p.copy(d).lerp(land, cm.t);
      cp[k * 3] = _p.x; cp[k * 3 + 1] = _p.y; cp[k * 3 + 2] = _p.z;
      const gl = occ(_p) ? Math.sin(cm.t * Math.PI) * app : 0;
      cc[k * 3] = CYAN.r * gl; cc[k * 3 + 1] = CYAN.g * gl; cc[k * 3 + 2] = CYAN.b * gl;
    }
    commGeo.attributes.position.needsUpdate = true;
    commGeo.attributes.color.needsUpdate = true;

    // card bridge
    if (hovered != null && dvis.current[hovered]) {
      _ndc.copy(dpos.current[hovered]).project(camera);
      marsBridge.index = hovered;
      marsBridge.color = colorOfMission(MISSIONS[hovered]);
      marsBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
      marsBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
      marsBridge.env += ((_ndc.z < 1 ? 1 : 0) - marsBridge.env) * Math.min(1, delta * 8);
      marsBridge.active = _ndc.z < 1;
    } else {
      marsBridge.env += (0 - marsBridge.env) * Math.min(1, delta * 8);
      marsBridge.active = hovered != null;
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
    window.open(MISSIONS[i].href, '_blank', 'noopener');
  };
  const hitR = radius * 0.22;
  const S = radius * 0.06;

  return (
    <group>
      <points ref={(el) => { commRef.current = el; }} geometry={commGeo} material={commMat} visible={false} frustumCulled={false} />

      {MISSIONS.map((m, i) => {
        const col = colorOfMission(m);
        const s = S * CLASS_ORBIT[m.cls].size;
        return (
          <group key={m.id}>
            {/* the drone */}
            <group ref={(el) => { droneGrp.current[i] = el; }} visible={false}>
              <mesh>
                <boxGeometry args={[s * 1.1, s * 0.7, s * 1.7]} />
                <meshStandardMaterial color="#c2c7cf" metalness={0.7} roughness={0.4} />
              </mesh>
              {/* solar wings — class colour, unlit so identity survives the sun */}
              <mesh position={[s * 1.5, 0, 0]}>
                <boxGeometry args={[s * 1.8, s * 0.08, s * 0.9]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
              <mesh position={[-s * 1.5, 0, 0]}>
                <boxGeometry args={[s * 1.8, s * 0.08, s * 0.9]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
              {/* nose sensor */}
              <mesh position={[0, s * 0.2, s * 1.0]}>
                <sphereGeometry args={[s * 0.32, 12, 12]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
              {/* glow */}
              <sprite scale={[s * 5, s * 5, 1]}>
                <spriteMaterial ref={(mm) => { glowMat.current[i] = mm; if (mm) mm.color.set(col); }} map={glowTex} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
              </sprite>
              {/* thruster — ignites on hover */}
              <sprite position={[0, 0, -s * 1.5]} scale={[s * 2.4, s * 2.4, 1]}>
                <spriteMaterial ref={(mm) => { thrustMat.current[i] = mm; if (mm) mm.color.copy(THRUST); }} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
              </sprite>
            </group>

            {/* hit target on the orbit */}
            <mesh ref={(el) => { hits.current[i] = el; }} visible={false} onPointerOver={onOver(i)} onPointerOut={onOut(i)} onClick={onClick(i)}>
              <sphereGeometry args={[hitR, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* landing site + beam */}
            <sprite ref={(el) => { landSp.current[i] = el; }} visible={false} scale={[radius * 0.12, radius * 0.12, 1]}>
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
