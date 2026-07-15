'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MISSIONS, earthHover, earthFocus } from '@/state/earthHoverStore';
import { ISSModel } from '@/world/system/ISSModel';

/**
 * EarthProbe — ONE International Space Station touring Earth's near side.
 *
 * It orbits smoothly and, at a station on the camera-facing LEFT of the globe
 * (so it stays visible and its hologram lands in open space, never on Earth),
 * eases to a stop, turns broadside to the camera, and a signal rises from the
 * surface to meet it — then it projects a brief story and glides on to the
 * next. Weightless motion (damped, no hard braking); the orbit is never drawn,
 * the motion IS the orbit. The station itself is ISSModel.
 */

const HOLD_R = 1.5; // orbit altitude, x earth radius
const HOLD_TIME = 5.0;
const BRAKE_TIME = 0.9;
const DEPART_TIME = 0.6;
const TRAVEL_SPEED = 0.5; // rad/s along the great circle to the next station
const PROBE_SCALE = 0.16; // x earth radius — small vs Earth, still reads as ISS
const _YAXIS = new THREE.Vector3(0, 1, 0);

const _slerpTmp = new THREE.Vector3();
function slerpDir(cur: THREE.Vector3, target: THREE.Vector3, t: number) {
  const dot = THREE.MathUtils.clamp(cur.dot(target), -1, 1);
  const theta = Math.acos(dot) * t;
  if (theta < 1e-5) { cur.copy(target); return; }
  _slerpTmp.copy(target).addScaledVector(cur, -dot);
  if (_slerpTmp.lengthSq() < 1e-9) return;
  _slerpTmp.normalize();
  cur.multiplyScalar(Math.cos(theta)).addScaledVector(_slerpTmp, Math.sin(theta)).normalize();
}

export function EarthProbe({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const probeRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#3fd8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const beamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius * 0.003, radius * 0.01, 1, 10, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, [radius]);

  const focus = useRef(0);
  const hovered = useRef(false);
  const st = useRef({
    mission: 0,
    phase: 'travel' as 'travel' | 'brake' | 'hold' | 'depart',
    phaseT: 0,
    dir: new THREE.Vector3(-0.7, 0.25, -0.3).normalize(),
    started: false,
  });

  const _target = useMemo(() => new THREE.Vector3(), []);
  const _cam = useMemo(() => new THREE.Vector3(), []);
  const _toE = useMemo(() => new THREE.Vector3(), []);
  const _cr = useMemo(() => new THREE.Vector3(), []);
  const _cu = useMemo(() => new THREE.Vector3(), []);
  const _wp = useMemo(() => new THREE.Vector3(), []);
  const _look = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _col = useMemo(() => new THREE.Color(), []);
  const _fwd = useMemo(() => new THREE.Vector3(), []);
  const _rt = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(), []);
  const _basis = useMemo(() => new THREE.Matrix4(), []);
  const _UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_state, delta) => {
    const f0 = earthFocus();
    focus.current = THREE.MathUtils.damp(focus.current, f0, 3, delta);
    const s = st.current;
    const probe = probeRef.current;
    if (!probe) return;

    if (f0 < 0.3) {
      probe.visible = false;
      earthHover.active = false;
      beamMat.opacity = 0;
      if (s.started) { s.mission = 0; s.phase = 'travel'; s.phaseT = 0; s.started = false; }
      return;
    }
    probe.visible = true;
    s.started = true;

    const m = MISSIONS[s.mission];
    // station on the camera-facing LEFT face, spread top-to-bottom by mission
    camera.getWorldPosition(_cam);
    _toE.copy(center).sub(_cam).normalize();
    _cr.crossVectors(_toE, _YAXIS).normalize();
    _cu.crossVectors(_cr, _toE).normalize();
    const vy = 0.5 - (s.mission / (MISSIONS.length - 1)) * 1.0;
    _target.copy(_cr).multiplyScalar(-0.72).addScaledVector(_cu, vy * 0.82).addScaledVector(_toE, -0.28).normalize();
    const ang = s.dir.angleTo(_target);

    let holdEnv = 0;
    switch (s.phase) {
      case 'travel':
        // ease along the great circle, decelerating as the station nears its berth
        slerpDir(s.dir, _target, Math.min((TRAVEL_SPEED * delta) / Math.max(ang, 1e-3), 1 - Math.exp(-2.2 * delta)));
        if (ang < 0.04) { s.phase = 'brake'; s.phaseT = 0; }
        break;
      case 'brake':
        s.phaseT += delta;
        slerpDir(s.dir, _target, 1 - Math.exp(-4 * delta)); // glide to rest, no thrust
        if (s.phaseT > BRAKE_TIME) { s.phase = 'hold'; s.phaseT = 0; }
        break;
      case 'hold':
        slerpDir(s.dir, _target, 1 - Math.exp(-6 * delta));
        if (!hovered.current) s.phaseT += delta;
        holdEnv = THREE.MathUtils.smoothstep(s.phaseT, 0.25, 0.9) * (1 - THREE.MathUtils.smoothstep(s.phaseT, HOLD_TIME - 0.7, HOLD_TIME));
        if (s.phaseT > HOLD_TIME && !hovered.current) { s.phase = 'depart'; s.phaseT = 0; }
        break;
      case 'depart':
        s.phaseT += delta;
        if (s.phaseT > DEPART_TIME) { s.mission = (s.mission + 1) % MISSIONS.length; s.phase = 'travel'; s.phaseT = 0; }
        break;
    }

    // transform
    probe.position.copy(s.dir).multiplyScalar(radius * HOLD_R);
    probe.scale.setScalar(radius * PROBE_SCALE * focus.current);
    _wp.copy(center).add(probe.position);
    if (s.phase === 'hold' || s.phase === 'brake') {
      // Explicit camera-facing basis: +Z -> camera, +X horizontal, +Y up. This
      // presents the full wingspan flat every time (lookAt's roll drifts and
      // foreshortens the arrays).
      _fwd.copy(_cam).sub(_wp).normalize();
      _rt.crossVectors(_UP, _fwd).normalize();
      _up.crossVectors(_fwd, _rt).normalize();
      _basis.makeBasis(_rt, _up, _fwd);
      probe.quaternion.setFromRotationMatrix(_basis);
    } else {
      _look.copy(_wp).add(_target).sub(s.dir); // fly along heading
      probe.lookAt(_look);
    }

    // signal beam (surface -> station)
    if (beamRef.current) {
      const b = beamRef.current;
      b.position.copy(s.dir).multiplyScalar(radius);
      b.quaternion.setFromUnitVectors(_YAXIS, s.dir);
      b.scale.set(1, radius * (HOLD_R - 1.0), 1);
      beamMat.color.lerp(_col.set(m.color), 1 - Math.exp(-5 * delta));
      beamMat.opacity = holdEnv * 0.24;
    }

    // hologram projection
    if (holdEnv > 0.04) {
      _ndc.copy(_wp).project(camera);
      earthHover.active = true;
      earthHover.px = (_ndc.x * 0.5 + 0.5) * size.width;
      earthHover.py = (-_ndc.y * 0.5 + 0.5) * size.height;
      earthHover.color = m.color;
      earthHover.index = s.mission;
    } else {
      earthHover.active = false;
    }
  });

  return (
    <group position={center}>
      <mesh ref={beamRef} geometry={beamGeo}>
        <primitive object={beamMat} attach="material" />
      </mesh>

      <group ref={probeRef} scale={0}>
        <mesh
          onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hovered.current = true; document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { hovered.current = false; document.body.style.cursor = ''; }}
        >
          <sphereGeometry args={[2.2, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <ISSModel />
      </group>
    </group>
  );
}
