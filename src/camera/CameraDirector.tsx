'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourneyStore } from '@/state/journeyStore';
import { useQualityStore } from '@/state/qualityStore';
import { bodyById, universe } from '@/content/universe';
import { bodyWorldPosition } from '@/world/ambient/ImpostorField';
import { GALAXY_CAM_POS, GALAXY_LOOK } from '@/world/galaxy/HeroGalaxy';


/**
 * CameraDirector — blueprint §5. Foundation build.
 * - Travel: straight-line path with authored accel/cruise/decel easing profile
 *   (authored Catmull-Rom splines replace the path in Camera System phase;
 *   the easing profile, FSM plumbing, and ownership model are final).
 * - Orbit: damped slow orbit at the body's revealFraming distance.
 * - BreathingIdle: additive Perlin-ish drift, amplitude ≤ 0.3% focal distance,
 *   zeroed under prefers-reduced-motion.
 * There is NO other writer of camera transforms in the app.
 */

function hashOffset(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const ux = ((h >>> 0) % 100) / 100; // 0..1
  const uy = ((h >>> 8) % 100) / 100;
  // Map to rule-of-thirds quadrants, biased away from dead center, never 0.5/0.5
  const qx = ux < 0.5 ? 0.30 + ux * 0.16 : 0.70 - (ux - 0.5) * 0.16; // ~left or right third
  const qy = uy < 0.5 ? 0.32 + uy * 0.12 : 0.68 - (uy - 0.5) * 0.12; // ~upper or lower third
  return [qx, qy];
}

const ACCEL_END = 0.2;
const DECEL_START = 0.8;

/** Piecewise easing: power3-in accel → linear cruise → expo-out decel. Never linear overall. */
function travelEase(t: number): number {
  // Distance fractions allotted to each phase (accel covers 10%, cruise 70%, decel 20% of path)
  const A = 0.1, C = 0.8;
  if (t < ACCEL_END) {
    const k = t / ACCEL_END;
    return A * k * k * k;
  }
  if (t < DECEL_START) {
    const k = (t - ACCEL_END) / (DECEL_START - ACCEL_END);
    return A + C * k;
  }
  const k = (t - DECEL_START) / (1 - DECEL_START);
  return A + C + (1 - A - C) * (1 - Math.pow(2, -8 * k) * (1 - k));
}

function edgeDuration(from: string, to: string): number {
  const e = universe.edges.find(
    (ed) => (ed.from === from && ed.to === to) || (ed.bidirectional && ed.from === to && ed.to === from),
  );
  return e?.durationS ?? 4;
}

export function CameraDirector() {
  const camera = useThree((s) => s.camera);
  const elapsed = useRef(0);
  const duration = useRef(4);
  const fromPos = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const orbitAngle = useRef(0);
  const lookTarget = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3());
  const lastPhase = useRef('');
  const baseFov = useRef(50);
  const pointerSmooth = useRef(new THREE.Vector2());
  const parallaxApplied = useRef(new THREE.Vector3());
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  useFrame((state, delta) => {
    const j = useJourneyStore.getState();
    const reducedMotion = useQualityStore.getState().reducedMotion;
    const t = state.clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;

    // Parallax is a per-frame overlay, never part of the base camera path:
    // remove last frame's offset before any phase logic reads the position.
    cam.position.sub(parallaxApplied.current);
    parallaxApplied.current.set(0, 0, 0);

    // Phase entry setup
    if (j.phase !== lastPhase.current) {
      if (j.phase === 'ACCEL' && j.destination) {
        elapsed.current = 0;
        duration.current = reducedMotion ? 0.4 : edgeDuration(j.location, j.destination);
        fromPos.current.copy(cam.position);
        const dest = bodyById.get(j.destination)!;
        const destCenter = bodyWorldPosition(dest);
        // Arrive at revealFraming distance, offset toward approach direction
        const approach = fromPos.current.clone().sub(destCenter).normalize();
        toPos.current.copy(destCenter).addScaledVector(approach, dest.camera.revealFraming.distanceU);
        toPos.current.y += dest.camera.revealFraming.distanceU * Math.tan(THREE.MathUtils.degToRad(dest.camera.revealFraming.elevationDeg));
      }
      if (j.phase === 'ORBIT') {
        const body = bodyById.get(j.location)!;
        const center = bodyWorldPosition(body);
        const rel = cam.position.clone().sub(center);
        orbitAngle.current = Math.atan2(rel.z, rel.x);
      }
      lastPhase.current = j.phase;
    }

    switch (j.phase) {
      case 'INTRO': {
        // Cinematic push into the galaxy hero pose while the disc forms.
        // Starts farther out and slightly off-axis, eases to the resting vantage.
        const p = Math.min(t / 12, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        const startPos = GALAXY_CAM_POS.clone().add(new THREE.Vector3(-7000, -2400, 16000));
        cam.position.lerpVectors(startPos, GALAXY_CAM_POS, ease);
        lookTarget.current.copy(GALAXY_LOOK);
        break;
      }
      case 'ACCEL':
      case 'CRUISE':
      case 'DECEL': {
        elapsed.current += delta;
        const raw = Math.min(elapsed.current / duration.current, 1);
        j.setTravelProgress(raw);
        // FSM checkpoints — legal transitions only
        if (raw >= ACCEL_END && j.phase === 'ACCEL') j.transition('CRUISE');
        if (raw >= DECEL_START && j.phase === 'CRUISE') j.transition('DECEL');

        const s = travelEase(raw);
        cam.position.lerpVectors(fromPos.current, toPos.current, s);

        // FOV widening during accel/cruise — speed sensation (§5.2), off under reduced motion
        if (!reducedMotion) {
          const fovBoost = Math.sin(Math.min(raw / DECEL_START, 1) * Math.PI) * 3.5;
          cam.fov = baseFov.current + fovBoost;
          cam.updateProjectionMatrix();
        }

        if (j.destination) lookTarget.current.copy(bodyWorldPosition(bodyById.get(j.destination)!));
        if (raw >= 1) {
          cam.fov = baseFov.current;
          cam.updateProjectionMatrix();
          j.arrive();
        }
        break;
      }
      case 'IDLE': {
        // Galaxy hero rest — hold the vantage with a very slow orbital drift so
        // the disc feels alive without the camera ever wandering off-frame.
        const center = GALAXY_LOOK;
        if (!reducedMotion) orbitAngle.current += delta * 0.008;
        const offset = GALAXY_CAM_POS.clone()
          .sub(center)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitAngle.current);
        const target = center.clone().add(offset);
        cam.position.lerp(target, 1 - Math.exp(-1.5 * delta));
        lookTarget.current.copy(center);
        break;
      }
      case 'ORBIT':
      case 'FOCUS':
      case 'REVEAL': {
        const body = bodyById.get(j.location)!;
        const center = bodyWorldPosition(body);
        const dist = body.camera.revealFraming.distanceU;
        if (!reducedMotion) orbitAngle.current += delta * 0.03; // slow drift orbit
        const elev = THREE.MathUtils.degToRad(body.camera.revealFraming.elevationDeg);
        const target = new THREE.Vector3(
          center.x + Math.cos(orbitAngle.current) * dist * Math.cos(elev),
          center.y + dist * Math.sin(elev),
          center.z + Math.sin(orbitAngle.current) * dist * Math.cos(elev),
        );
        cam.position.lerp(target, 1 - Math.exp(-2.5 * delta)); // damped follow
        // Rule-of-thirds framing: shift the gaze so the body sits off-center
        const fwd = center.clone().sub(cam.position).normalize();
        const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
        lookTarget.current.copy(center).addScaledVector(right, dist * 0.14).addScaledVector(cam.up, dist * 0.05);
        break;
      }
    }

    // Mouse parallax — small real camera translation toward the pointer while
    // resting on the galaxy hero. Because it's true translation, every depth
    // layer (foreground motes / disc slices / deep space) shifts at its own
    // rate — that differential motion is what sells the scale.
    if (!reducedMotion && (j.phase === 'INTRO' || j.phase === 'IDLE')) {
      pointerSmooth.current.lerp(state.pointer, 1 - Math.exp(-2.2 * delta));
      const fwd = lookTarget.current.clone().sub(cam.position).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
      const upv = new THREE.Vector3().crossVectors(right, fwd);
      parallaxApplied.current
        .set(0, 0, 0)
        .addScaledVector(right, pointerSmooth.current.x * 1400)
        .addScaledVector(upv, pointerSmooth.current.y * 700);
      cam.position.add(parallaxApplied.current);
    }

    // BreathingIdle — additive, always-on layer (§5.1); zero under reduced motion
    if (!reducedMotion && j.phase !== 'INTRO') {
      const focal = cam.position.distanceTo(lookTarget.current);
      const amp = focal * 0.003;
      cam.position.x += Math.sin(t * 0.31) * amp * delta * 3;
      cam.position.y += Math.sin(t * 0.23 + 1.7) * amp * delta * 3;
    }

    // Look-lag: the gaze trails the intent — drone weight, never a rigid rig
    currentLook.current.lerp(lookTarget.current, 1 - Math.exp(-3.2 * delta));
    cam.lookAt(currentLook.current);

    // Rule of thirds: shift the frustum so the subject composes off-center
    // (setViewOffset — the subject stays correctly tracked/lit, only the
    // framing shifts). Never dead-center on arrival. Cleared mid-travel.
    const w = size.width || gl.domElement.width || 1920;
    const h = size.height || gl.domElement.height || 1080;
    if ((j.phase === 'ORBIT' || j.phase === 'FOCUS' || j.phase === 'REVEAL') && j.location !== 'sun') {
      const [qx, qy] = hashOffset(j.location);
      // setViewOffset(fullW, fullH, offsetX, offsetY, windowW, windowH):
      // shifting the window off the full-frame center pushes the subject
      // toward the opposite third.
      const shiftX = (qx - 0.5) * w * 0.5;
      const shiftY = (qy - 0.5) * h * 0.5;
      cam.setViewOffset(w, h, shiftX, shiftY, w, h);
    } else {
      cam.clearViewOffset();
    }
  });

  return null;
}
