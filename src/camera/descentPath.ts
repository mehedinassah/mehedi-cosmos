import * as THREE from 'three';
import {
  BEACON_THETA,
  GALAXY_CAM_POS,
  GALAXY_CENTER,
  GALAXY_LOOK,
  GALAXY_TILT,
  OUTER_RADIUS,
} from '@/world/galaxy/HeroGalaxy';

/**
 * The descent path — the journey's spine from the hero vantage down into
 * the beacon arm. The dive commits toward the brightened arm the shader has
 * been pointing at all along, skims the disc plane, then runs along the arm
 * to the destination star.
 *
 * Content (DescentField) is anchored to REFERENCE_CURVE, built from the
 * canonical vantage. The live camera curve is rebuilt from wherever the
 * camera actually is when the first scroll lands (idle drift moves it), so
 * the dive never starts with a pop; both curves converge from the arm
 * approach onward because every later control point is world-anchored.
 */

const tiltQ = new THREE.Quaternion().setFromEuler(GALAXY_TILT);

// Beacon point on the arm, disc-local -> world (matches the shader's cue
// at BEACON_THETA, rn = 0.52)
const localBeacon = new THREE.Vector3(
  Math.cos(BEACON_THETA),
  0,
  Math.sin(BEACON_THETA),
).multiplyScalar(OUTER_RADIUS * 0.52);
export const BEACON_WORLD = localBeacon.clone().applyQuaternion(tiltQ).add(GALAXY_CENTER);

// Disc frame at the beacon: N = plane normal (flipped toward the camera
// side so the dive approaches the visible face), R = radial outward,
// T = along-arm tangent pointing deeper into the spiral.
const N = new THREE.Vector3(0, 1, 0).applyQuaternion(tiltQ);
if (N.dot(GALAXY_CAM_POS.clone().sub(GALAXY_CENTER)) < 0) N.negate();
const R = localBeacon.clone().normalize().applyQuaternion(tiltQ);
const T = new THREE.Vector3(-Math.sin(BEACON_THETA), 0, Math.cos(BEACON_THETA)).applyQuaternion(
  tiltQ,
);

// Arm-run anchors — world-fixed so scenery and star sit on every curve
const armEntry = BEACON_WORLD.clone().addScaledVector(N, 3200).addScaledVector(R, 1200);
const armMid = BEACON_WORLD.clone()
  .addScaledVector(T, 5200)
  .addScaledVector(N, 700)
  .addScaledVector(R, -800);
const armDeep = BEACON_WORLD.clone()
  .addScaledVector(T, 10500)
  .addScaledVector(N, 150)
  .addScaledVector(R, -2200);

/** Where the journey ends: the star that becomes the portfolio's system. */
export const DESTINATION_STAR = armDeep
  .clone()
  .addScaledVector(T, 3300)
  .addScaledVector(R, -600);

export function buildDescentCurve(start: THREE.Vector3): THREE.CatmullRomCurve3 {
  const approach = start
    .clone()
    .lerp(BEACON_WORLD, 0.35)
    .addScaledVector(N, 7000);
  return new THREE.CatmullRomCurve3(
    [start.clone(), approach, armEntry, armMid, armDeep],
    false,
    'centripetal',
  );
}

/** Canonical curve for placing descent scenery (clusters, nebulae, lines). */
export const REFERENCE_CURVE = buildDescentCurve(GALAXY_CAM_POS.clone());

// Rest composition: the bright core sits near the vertical center of frame,
// majestic rather than sinking toward the bottom edge. A small aim BELOW the
// core lifts it just above center; a light horizontal offset keeps it off
// dead-center without dropping it low.
const axis = GALAXY_CENTER.clone().sub(GALAXY_CAM_POS).normalize();
const frameRight = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
const frameUp = new THREE.Vector3().crossVectors(frameRight, axis).normalize();
// Aim well below the core so the tilted disc rides UP into the frame — its
// lower/near edge no longer sinks off the bottom, and the whole disc is seen.
export const GALAXY_REST_LOOK = GALAXY_LOOK.clone()
  .addScaledVector(frameRight, 300)
  .addScaledVector(frameUp, -4200);
