import * as THREE from 'three';

/**
 * The star-system chapter — a CINEMATIC FLIGHT, not a simulation.
 *
 * The solar system is a transitional chapter in the narrative, never a
 * destination or a diagram. No orbital paths, no educational layouts, no
 * frame that shows "the solar system". The camera flies one continuous
 * line: swings past the sun, Mercury flashes by almost unnoticed, Venus
 * rushes past, Earth appears ahead and grows, the Moon sweeps past the
 * camera, and the journey ends holding Earth — the portfolio's doorstep.
 * Every beat introduces one hero; astronomy only supports the story.
 */

export interface HeroSpec {
  id: string;
  name: string;
  radius: number;
  /** World position — static: the flight path is authored around these. */
  position: THREE.Vector3;
  palette: { deep: string; mid: string; high: string; atmo: string; night: number; clouds: number };
}

const UP = new THREE.Vector3(0, 1, 0);

/* --------------------- the heroes of the flight --------------------- */

const MERCURY_POS = new THREE.Vector3(Math.cos(0.92) * 900, 14, Math.sin(0.92) * 900);
const VENUS_POS = new THREE.Vector3(Math.cos(1.08) * 1500, -26, Math.sin(1.08) * 1500);
export const EARTH_POS = new THREE.Vector3(Math.cos(1.22) * 2300, 0, Math.sin(1.22) * 2300);

export const HEROES: HeroSpec[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    radius: 2.4,
    position: MERCURY_POS,
    palette: { deep: '#2e2a26', mid: '#5c554c', high: '#9a9188', atmo: '#6b655c', night: 0, clouds: 0 },
  },
  {
    id: 'venus',
    name: 'Venus',
    radius: 7.5,
    position: VENUS_POS,
    palette: { deep: '#6b5433', mid: '#a8874e', high: '#e0c890', atmo: '#d9b877', night: 0, clouds: 1.0 },
  },
  {
    id: 'earth',
    name: 'Earth',
    radius: 8,
    position: EARTH_POS,
    // Ocean-forward: Earth must read as the pale BLUE dot, not a jungle world
    palette: { deep: '#0e3a66', mid: '#2f6152', high: '#d8d2c4', atmo: '#7db4e8', night: 0.35, clouds: 0.7 },
  },
];

/* --------------------- the flight path --------------------- */

// Lane geometry: side = perpendicular to the sun->planet line at each pass,
// so flybys happen at small offsets (small offset = high angular sweep =
// the "rushes past" feeling; the scroll speed itself never changes)
function sideAt(p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().crossVectors(UP, p.clone().normalize()).normalize();
}

const approachDir = EARTH_POS.clone().sub(VENUS_POS).normalize();
const earthSide = sideAt(EARTH_POS);

// Final hold: on the sunlit side so Earth faces the camera lit, slightly
// raised — the portfolio's establishing shot
const holdDir = EARTH_POS.clone()
  .negate()
  .normalize()
  .addScaledVector(earthSide, 0.55)
  .addScaledVector(UP, 0.22)
  .normalize();
export const EARTH_HOLD = EARTH_POS.clone().addScaledVector(holdDir, 30);

/** Moon placed just off the approach lane — it sweeps past the camera in
 *  the last moments before the hold. The RENDERED moon (SolarSystem's
 *  EarthMoon) starts exactly here and drifts imperceptibly, so the gaze
 *  anchor and the world stay in agreement. */
export const MOON_RADIUS = 2.2;
export const MOON_ANCHOR = EARTH_POS.clone()
  .addScaledVector(approachDir, -26)
  .addScaledVector(earthSide, 9)
  .setY(EARTH_POS.y + 5);

const FLIGHT_POINTS: THREE.Vector3[] = [
  // Arrival pose: matches the descent handoff (close on the photosphere)
  new THREE.Vector3(Math.cos(0.6) * 438, 46, Math.sin(0.6) * 438),
  // Swing past the sun — it slides across and out of the frame
  new THREE.Vector3(Math.cos(0.95) * 560, 70, Math.sin(0.95) * 560),
  // Mercury flyby: 30 units off the stone
  MERCURY_POS.clone().addScaledVector(sideAt(MERCURY_POS), 30).setY(MERCURY_POS.y + 9),
  // Venus flyby: 52 units off the cloud deck
  VENUS_POS.clone().addScaledVector(sideAt(VENUS_POS), 52).setY(VENUS_POS.y - 12),
  // The long Earth approach begins
  EARTH_POS.clone().addScaledVector(approachDir, -470).addScaledVector(earthSide, 34).setY(-8),
  // Past the Moon, easing into the hold
  EARTH_HOLD,
];

export const FLIGHT_CURVE = new THREE.CatmullRomCurve3(FLIGHT_POINTS, false, 'centripetal');
FLIGHT_CURVE.arcLengthDivisions = 600;

/* --------------------- camera pose --------------------- */

const vAhead = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vTo = new THREE.Vector3();

function windowW(sp: number, a: number, b: number, c: number, d: number): number {
  return (
    THREE.MathUtils.smoothstep(sp, a, b) * (1 - THREE.MathUtils.smoothstep(sp, c, d))
  );
}

/** nlerp the gaze toward a world point by weight w. */
function pull(dir: THREE.Vector3, from: THREE.Vector3, target: THREE.Vector3, w: number) {
  if (w <= 0.001) return;
  vTo.copy(target).sub(from).normalize();
  dir.lerp(vTo, w).normalize();
}

/**
 * One continuous flight. The gaze rides the path direction; each hero pulls
 * the eye for the seconds of its pass, and Earth takes the frame for good
 * at the end. Weights blend in DIRECTION space (world-point lerps leave
 * close flybys outside the frustum).
 */
export function systemPose(
  sp: number,
  t: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
): void {
  const u = THREE.MathUtils.clamp(sp, 0, 1);
  FLIGHT_CURVE.getPointAt(u, outPos);

  // Base gaze: down the flight line
  FLIGHT_CURVE.getPointAt(Math.min(u + 0.05, 1), vAhead);
  vDir.copy(vAhead).sub(outPos);
  if (vDir.lengthSq() < 1) vDir.copy(EARTH_POS).sub(outPos); // at rest: Earth
  vDir.normalize();

  // The sun holds the eye while we swing past it, then lets go
  pull(vDir, outPos, ORIGIN, (1 - THREE.MathUtils.smoothstep(sp, 0.08, 0.2)) * 0.8);
  // Heroes take the frame one at a time — nothing else is on stage
  pull(vDir, outPos, MERCURY_POS, windowW(sp, 0.2, 0.26, 0.33, 0.4) * 0.85);
  pull(vDir, outPos, VENUS_POS, windowW(sp, 0.47, 0.53, 0.6, 0.68) * 0.85);
  pull(vDir, outPos, EARTH_POS, THREE.MathUtils.smoothstep(sp, 0.68, 0.8) * 0.5);
  // The Moon flashes past only in the last stretch, when the camera is
  // actually near it — then Earth takes the frame for good
  pull(vDir, outPos, MOON_ANCHOR, windowW(sp, 0.895, 0.925, 0.95, 0.97) * 0.85);
  pull(vDir, outPos, EARTH_POS, THREE.MathUtils.smoothstep(sp, 0.955, 0.985));

  outLook.copy(outPos).addScaledVector(vDir, 2000);
  void t;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);

/* --------------------- captions --------------------- */

export const SYSTEM_CAPTIONS: { at: number; primary: string; secondary: string }[] = [
  { at: 0.02, primary: 'the Sun', secondary: 'a G-type star, four billion years in' },
  { at: 0.24, primary: 'Mercury', secondary: 'a scorched stone, gone in a blink' },
  { at: 0.5, primary: 'Venus', secondary: 'wrapped in acid cloud' },
  { at: 0.7, primary: 'Earth', secondary: 'the pale blue dot' },
  { at: 0.89, primary: 'the Moon', secondary: 'a quarter million miles out' },
  { at: 0.96, primary: 'Earth', secondary: 'home' },
];
