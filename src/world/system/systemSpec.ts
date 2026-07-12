import * as THREE from 'three';

/**
 * The solar-system chapter spec — a physically plausible star system, not a
 * decorative composition. One shared source of truth for:
 *   - planet scales / orbit radii / inclinations / Kepler-scaled speeds
 *   - the outbound camera dolly (exponential radius, slow azimuth sweep)
 *   - reveal bands: where along the scroll each world enters the story
 *
 * Scale philosophy: relative planet sizes stay plausible (Mercury a speck,
 * Earth small, the giants clearly larger but still distant); absolute sizes
 * are compressed against the sun (r=120) so worlds remain visible at all.
 * Distances keep real pacing: vast emptiness between orbits.
 */

export interface MoonSpec {
  radius: number;
  dist: number;
  speed: number; // rad/s around the parent
  incl: number; // radians
  phase: number;
}

export interface PlanetSpec {
  id: string;
  name: string;
  radius: number;
  orbitRadius: number;
  inclinationDeg: number;
  /** Radians at t=0 — aligned so the planet is near the camera's azimuth
   *  when the dolly crosses its orbit. */
  phase0: number;
  /** Kepler-scaled angular speed, rad/s. */
  omega: number;
  /** Scroll position where the camera crosses this orbit. */
  sp: number;
  palette: { deep: string; mid: string; high: string; atmo: string; night: number; clouds: number };
  rings?: boolean;
  moons?: MoonSpec[];
}

/* ------------------------- camera dolly ------------------------- */

export const CAM_R0 = 440; // sun fills the frame
export const CAM_R1 = 20500; // just inside Neptune's orbit
const CAM_LN = Math.log(CAM_R1 / CAM_R0);
const CAM_THETA0 = 0.6;
const CAM_SWEEP = Math.PI * 1.15; // ~207 degrees of azimuth over the journey

export function cameraRadiusAt(sp: number): number {
  return CAM_R0 * Math.exp(CAM_LN * sp);
}
function spAtRadius(r: number): number {
  return Math.log(r / CAM_R0) / CAM_LN;
}

/** Kepler scaling: omega = K * r^-1.5. K chosen so Mercury laps in ~12min —
 *  motion is perceptible on a pass, but slow enough that the phase-aligned
 *  compositions below survive however long the viewer lingers. */
const KEPLER_K = 0.0088 * Math.pow(900, 1.5);
const omegaAt = (r: number) => KEPLER_K * Math.pow(r, -1.5);

/** Planet sits slightly ahead of the camera azimuth at its reveal, offset
 *  scaled so every world subtends a similar comfortable angle on the pass. */
function alignedPhase(orbitRadius: number, radius: number): number {
  const sp = spAtRadius(orbitRadius);
  const offset = THREE.MathUtils.clamp((radius * 16) / orbitRadius, 0.04, 0.3);
  return CAM_THETA0 + CAM_SWEEP * sp + offset;
}

function planet(
  id: string,
  name: string,
  radius: number,
  orbitRadius: number,
  inclinationDeg: number,
  palette: PlanetSpec['palette'],
  extra?: Partial<Pick<PlanetSpec, 'rings' | 'moons'>>,
): PlanetSpec {
  return {
    id,
    name,
    radius,
    orbitRadius,
    inclinationDeg,
    phase0: alignedPhase(orbitRadius, radius),
    omega: omegaAt(orbitRadius),
    sp: spAtRadius(orbitRadius),
    palette,
    ...extra,
  };
}

export const PLANETS: PlanetSpec[] = [
  planet('mercury', 'Mercury', 2.2, 900, 7.0, {
    deep: '#2e2a26', mid: '#5c554c', high: '#9a9188', atmo: '#6b655c', night: 0, clouds: 0,
  }),
  planet('venus', 'Venus', 5.4, 1500, 3.4, {
    deep: '#6b5433', mid: '#a8874e', high: '#e0c890', atmo: '#d9b877', night: 0, clouds: 1.0,
  }),
  planet('earth', 'Earth', 5.7, 2300, 0.0, {
    deep: '#0d2b4d', mid: '#2e5d3a', high: '#c9c4b4', atmo: '#6fa8dc', night: 0.35, clouds: 0.75,
  }, {
    moons: [{ radius: 1.55, dist: 16, speed: 0.28, incl: 0.09, phase: 1.2 }],
  }),
  planet('mars', 'Mars', 3.0, 3400, 1.9, {
    deep: '#4a2a1c', mid: '#8a4f33', high: '#c88a62', atmo: '#b07a58', night: 0, clouds: 0.06,
  }),
  planet('jupiter', 'Jupiter', 30, 7000, 1.3, {
    deep: '#6e5238', mid: '#a8845e', high: '#d9c3a4', atmo: '#c0a480', night: 0, clouds: 0.55,
  }, {
    moons: [
      { radius: 1.1, dist: 48, speed: 0.2, incl: 0.03, phase: 0.4 },
      { radius: 1.0, dist: 62, speed: 0.15, incl: 0.05, phase: 2.5 },
      { radius: 1.7, dist: 82, speed: 0.11, incl: 0.02, phase: 4.4 },
      { radius: 1.5, dist: 108, speed: 0.08, incl: 0.06, phase: 5.6 },
    ],
  }),
  planet('saturn', 'Saturn', 26, 10200, 2.5, {
    deep: '#7a6543', mid: '#b09468', high: '#e2cfa4', atmo: '#cdb384', night: 0, clouds: 0.45,
  }, {
    rings: true,
    moons: [{ radius: 1.6, dist: 96, speed: 0.09, incl: 0.08, phase: 2.0 }],
  }),
  planet('uranus', 'Uranus', 13, 14500, 0.8, {
    deep: '#2b4b52', mid: '#4f7d86', high: '#a4ccd2', atmo: '#8fc4cc', night: 0, clouds: 0.3,
  }),
  planet('neptune', 'Neptune', 12.5, 18500, 1.8, {
    deep: '#16305c', mid: '#2f5590', high: '#7c9cd0', atmo: '#6a8fc8', night: 0, clouds: 0.4,
  }),
];

/* ------------------------- live orbital state ------------------------- */

export function planetPosition(spec: PlanetSpec, t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = spec.phase0 + spec.omega * t;
  const inc = THREE.MathUtils.degToRad(spec.inclinationDeg);
  out.set(
    Math.cos(a) * spec.orbitRadius,
    Math.sin(a + 1.0) * Math.sin(inc) * spec.orbitRadius,
    Math.sin(a) * spec.orbitRadius,
  );
  return out;
}

/* ------------------------- camera pose ------------------------- */

const vPlanet = new THREE.Vector3();
const vDirSun = new THREE.Vector3();
const vDirPlanet = new THREE.Vector3();

/** Gaze window: how strongly the camera looks at a planet around its pass. */
function lookWeight(sp: number, planetSp: number): number {
  const rampIn = THREE.MathUtils.smoothstep(sp, planetSp - 0.055, planetSp - 0.015);
  const rampOut = 1 - THREE.MathUtils.smoothstep(sp, planetSp + 0.04, planetSp + 0.1);
  return rampIn * rampOut * 0.85;
}

/**
 * The outbound dolly: exponential pull-away from the photosphere, slow
 * azimuth sweep, gentle elevation S-curve. Gaze rests on the sun and hands
 * over to each world for the stretch of its pass, so the frame never shows
 * the whole system at once — worlds are met one at a time.
 *
 * The gaze blend works in DIRECTION space, not position space: a nearby
 * planet can be 60+ degrees away from the sun line, so lerping world points
 * would leave it out of frame while the caption names it.
 */
export function systemPose(
  sp: number,
  t: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
): void {
  const r = cameraRadiusAt(sp);
  const theta = CAM_THETA0 + CAM_SWEEP * sp;
  // Kept shallow so planet passes stay close to the ecliptic (a steep
  // camera turns every pass into a distant top-down look)
  const elev = THREE.MathUtils.degToRad(6 - 16 * sp + 18 * sp * sp);
  outPos.set(
    Math.cos(theta) * r * Math.cos(elev),
    Math.sin(elev) * r,
    Math.sin(theta) * r * Math.cos(elev),
  );

  // Strongest active pass wins the gaze (windows are spaced, never overlap)
  let bestW = 0;
  let best: PlanetSpec | null = null;
  for (const p of PLANETS) {
    const w = lookWeight(sp, p.sp);
    if (w > bestW) {
      bestW = w;
      best = p;
    }
  }

  vDirSun.copy(outPos).negate().normalize(); // the sun anchors the gaze
  if (best && bestW > 0.001) {
    planetPosition(best, t, vPlanet);
    vDirPlanet.copy(vPlanet).sub(outPos).normalize();
    vDirSun.lerp(vDirPlanet, bestW).normalize();
  }
  outLook.copy(outPos).addScaledVector(vDirSun, 4000);
}

/* ------------------------- captions ------------------------- */

export const SYSTEM_CAPTIONS: { at: number; primary: string; secondary: string }[] = [
  { at: 0.02, primary: 'the Sun', secondary: 'a G-type star, four billion years in' },
  { at: 0.17, primary: 'Mercury', secondary: 'a scorched stone, easy to miss' },
  { at: 0.3, primary: 'Venus', secondary: 'wrapped in acid cloud' },
  { at: 0.42, primary: 'Earth', secondary: 'the pale blue dot' },
  { at: 0.51, primary: 'Mars', secondary: 'rust and thin wind' },
  { at: 0.6, primary: 'the Asteroid Belt', secondary: 'rubble that never became a world' },
  { at: 0.7, primary: 'Jupiter', secondary: 'guardian of the inner worlds' },
  { at: 0.8, primary: 'Saturn', secondary: 'rings of ice, a hundred meters thin' },
  { at: 0.89, primary: 'Uranus', secondary: 'rolling on its side' },
  { at: 0.95, primary: 'Neptune', secondary: 'the last giant' },
  { at: 0.985, primary: 'the Kuiper Belt', secondary: 'the frozen frontier' },
];
