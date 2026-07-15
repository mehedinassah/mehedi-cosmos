'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MISSIONS, earthHover, earthFocus } from '@/state/earthHoverStore';

/**
 * EarthProbe — ONE small autonomous drone that tours Earth's near side.
 *
 * It orbits, arrives at a station on the camera-facing LEFT of the globe (so
 * it stays visible and its hologram lands in open space, never on Earth), fires
 * braking thrusters, turns to face the camera, and a signal rises from the
 * surface to meet it — then it projects a brief story and moves on to the next.
 * Matte white, minimal, almost no glow: a real object lit by the Sun with two
 * tiny LEDs. The orbit is never drawn; the motion IS the orbit.
 */

const HOLD_R = 1.5; // probe altitude, x earth radius
const HOLD_TIME = 5.0;
const BRAKE_TIME = 0.6;
const DEPART_TIME = 0.5;
const TRAVEL_SPEED = 0.7; // rad/s along the great circle to the next station
const PROBE_SCALE = 0.05; // x earth radius (small — reads ~45px)
const CYAN = new THREE.Color('#3fd8ff');
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
  const ringMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const navMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const thrustMatRef = useRef<THREE.SpriteMaterial>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#3fd8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const beamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius * 0.004, radius * 0.013, 1, 10, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, [radius]);
  const thrustTex = useMemo(() => makeSoft('#bfe6ff'), []);

  const focus = useRef(0);
  const hovered = useRef(false);
  const st = useRef({
    mission: 0,
    phase: 'travel' as 'travel' | 'brake' | 'hold' | 'depart',
    phaseT: 0,
    dir: new THREE.Vector3(-0.7, 0.25, -0.3).normalize(),
    started: false,
    thrust: 0,
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

  useFrame((state, delta) => {
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
    s.thrust = Math.max(0, s.thrust - delta * 3);
    switch (s.phase) {
      case 'travel':
        slerpDir(s.dir, _target, Math.min((TRAVEL_SPEED * delta) / Math.max(ang, 1e-3), 1));
        if (ang < 0.05) { s.phase = 'brake'; s.phaseT = 0; s.thrust = 1; }
        break;
      case 'brake':
        s.phaseT += delta;
        slerpDir(s.dir, _target, Math.min((TRAVEL_SPEED * 0.35 * delta) / Math.max(ang, 1e-3), 1));
        if (s.phaseT > BRAKE_TIME) { s.phase = 'hold'; s.phaseT = 0; }
        break;
      case 'hold':
        slerpDir(s.dir, _target, 1 - Math.exp(-6 * delta));
        if (!hovered.current) s.phaseT += delta;
        holdEnv = THREE.MathUtils.smoothstep(s.phaseT, 0.25, 0.9) * (1 - THREE.MathUtils.smoothstep(s.phaseT, HOLD_TIME - 0.7, HOLD_TIME));
        if (s.phaseT > HOLD_TIME && !hovered.current) { s.phase = 'depart'; s.phaseT = 0; s.thrust = 1; }
        break;
      case 'depart':
        s.phaseT += delta;
        if (s.phaseT > DEPART_TIME) { s.mission = (s.mission + 1) % MISSIONS.length; s.phase = 'travel'; s.phaseT = 0; }
        break;
    }

    // transform
    probe.position.copy(s.dir).multiplyScalar(radius * HOLD_R);
    probe.scale.setScalar(radius * PROBE_SCALE * focus.current * (1 + holdEnv * 0.18));
    _wp.copy(center).add(probe.position);
    if (s.phase === 'hold' || s.phase === 'brake') {
      probe.lookAt(_cam); // face the camera to present
    } else {
      _look.copy(_wp).add(_target).sub(s.dir); // look along heading
      probe.lookAt(_look);
    }

    // ring color + LEDs
    if (ringMatRef.current) {
      ringMatRef.current.emissive.lerp(holdEnv > 0.1 ? _col.set(m.color) : CYAN, 1 - Math.exp(-4 * delta));
      ringMatRef.current.emissiveIntensity = 0.7 + 0.6 * holdEnv;
    }
    if (navMatRef.current) navMatRef.current.opacity = 0.45 + 0.55 * Math.abs(Math.sin(state.clock.elapsedTime * 2.3));
    if (thrustMatRef.current) thrustMatRef.current.opacity = s.thrust * 0.85;

    // signal beam (surface -> probe)
    if (beamRef.current) {
      const b = beamRef.current;
      b.position.copy(s.dir).multiplyScalar(radius);
      b.quaternion.setFromUnitVectors(_YAXIS, s.dir);
      b.scale.set(1, radius * (HOLD_R - 1.0), 1);
      beamMat.color.lerp(_col.set(m.color), 1 - Math.exp(-5 * delta));
      beamMat.opacity = holdEnv * 0.32;
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
          <sphereGeometry args={[1.5, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.5, 24, 18]} />
          <meshStandardMaterial color="#e9edf3" roughness={0.5} metalness={0.15} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.505, 20, 4]} />
          <meshStandardMaterial color="#181c22" roughness={0.7} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.86, 0.045, 10, 56]} />
          <meshStandardMaterial ref={ringMatRef} color="#090d12" emissive="#3fd8ff" emissiveIntensity={0.8} roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial ref={navMatRef} color="#ffffff" transparent opacity={1} />
        </mesh>
        <mesh position={[0.34, -0.06, 0.36]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#4fe0ff" />
        </mesh>
        <sprite position={[0, 0, 0.7]} scale={[0.8, 0.8, 1]}>
          <spriteMaterial ref={thrustMatRef} map={thrustTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
  );
}

function makeSoft(color: string): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(color);
  const r = Math.round(col.r * 255), g = Math.round(col.g * 255), b = Math.round(col.b * 255);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
