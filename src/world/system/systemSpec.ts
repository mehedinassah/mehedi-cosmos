import * as THREE from 'three';

/**
 * The star system IS the portfolio — a cinematic universe where every
 * celestial body is one chapter of a career. One continuous drone flight,
 * no cuts, no diagrams: sun (introduction) → Mercury (about) → Venus
 * (skills) → Earth (projects) → the Moon (featured work) → Mars
 * (experience) → through the asteroid belt → Jupiter (stack) → Saturn
 * (open source) → Uranus (education) → Neptune (achievements) → Pluto
 * (contact), then the camera slowly flies away.
 *
 * Scroll is remapped so every chapter gets a similar share of the journey
 * even though the outer gaps are vast — emptiness reads in the motion, not
 * in the pacing.
 */

export interface MoonSpec {
  radius: number;
  dist: number;
  speed: number;
  incl: number;
  phase: number;
}

export interface HeroSpec {
  id: string;
  name: string;
  radius: number;
  position: THREE.Vector3;
  palette: { deep: string; mid: string; high: string; atmo: string; night: number; clouds: number };
  rings?: boolean;
  moons?: MoonSpec[];
}

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3(0, 0, 0);

const at = (az: number, r: number, y: number) =>
  new THREE.Vector3(Math.cos(az) * r, y, Math.sin(az) * r);

/* --------------------- the worlds --------------------- */

const MERCURY_POS = at(0.92, 900, 14);
const VENUS_POS = at(1.08, 1500, -26);
export const EARTH_POS = at(1.22, 2300, 0);
const MARS_POS = at(1.38, 3300, 22);
const JUPITER_POS = at(1.58, 6600, -40);
const SATURN_POS = at(1.76, 9200, 30);
const URANUS_POS = at(1.94, 12500, -24);
const NEPTUNE_POS = at(2.1, 15800, 18);
const PLUTO_POS = at(2.26, 19000, 210); // off-plane, the lonely outlier

export const HEROES: HeroSpec[] = [
  {
    id: 'mercury', name: 'Mercury', radius: 2.4, position: MERCURY_POS,
    palette: { deep: '#2e2a26', mid: '#5c554c', high: '#9a9188', atmo: '#6b655c', night: 0, clouds: 0 },
  },
  {
    id: 'venus', name: 'Venus', radius: 7.5, position: VENUS_POS,
    palette: { deep: '#6b5433', mid: '#a8874e', high: '#e0c890', atmo: '#d9b877', night: 0, clouds: 1.0 },
  },
  {
    id: 'earth', name: 'Earth', radius: 8, position: EARTH_POS,
    palette: { deep: '#0e3a66', mid: '#2f6152', high: '#d8d2c4', atmo: '#7db4e8', night: 0.35, clouds: 0.7 },
  },
  {
    id: 'mars', name: 'Mars', radius: 4.2, position: MARS_POS,
    palette: { deep: '#4a2a1c', mid: '#8a4f33', high: '#c88a62', atmo: '#b07a58', night: 0, clouds: 0.06 },
  },
  {
    id: 'jupiter', name: 'Jupiter', radius: 30, position: JUPITER_POS,
    palette: { deep: '#6e5238', mid: '#a8845e', high: '#d9c3a4', atmo: '#c0a480', night: 0, clouds: 0.32 },
    moons: [
      { radius: 1.1, dist: 48, speed: 0.02, incl: 0.03, phase: 0.4 },
      { radius: 1.0, dist: 62, speed: 0.016, incl: 0.05, phase: 2.5 },
      { radius: 1.7, dist: 82, speed: 0.012, incl: 0.02, phase: 4.4 },
      { radius: 1.5, dist: 108, speed: 0.009, incl: 0.06, phase: 5.6 },
    ],
  },
  {
    id: 'saturn', name: 'Saturn', radius: 25, position: SATURN_POS,
    palette: { deep: '#7a6543', mid: '#b09468', high: '#e2cfa4', atmo: '#cdb384', night: 0, clouds: 0.28 },
    rings: true,
    moons: [{ radius: 1.6, dist: 92, speed: 0.01, incl: 0.08, phase: 2.0 }],
  },
  {
    id: 'uranus', name: 'Uranus', radius: 13, position: URANUS_POS,
    palette: { deep: '#2b4b52', mid: '#4f7d86', high: '#a4ccd2', atmo: '#8fc4cc', night: 0, clouds: 0.3 },
  },
  {
    id: 'neptune', name: 'Neptune', radius: 12.5, position: NEPTUNE_POS,
    palette: { deep: '#16305c', mid: '#2f5590', high: '#7c9cd0', atmo: '#6a8fc8', night: 0, clouds: 0.4 },
  },
  {
    id: 'pluto', name: 'Pluto', radius: 1.9, position: PLUTO_POS,
    palette: { deep: '#5c5248', mid: '#8d8177', high: '#cfc6b8', atmo: '#9a9089', night: 0, clouds: 0 },
    moons: [{ radius: 0.95, dist: 6.5, speed: 0.03, incl: 0.12, phase: 2.2 }],
  },
];

/* --------------------- the flight path --------------------- */

function sideAt(p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().crossVectors(UP, p.clone().normalize()).normalize();
}

/** Flyby vantage: mostly BETWEEN the world and the sun, a little to the
 *  side — every world is met with its lit face toward the camera. A
 *  night-side or terminator pass reads as a black hole with a caption. */
function passPoint(p: THREE.Vector3, offset: number, ySign = 1): THREE.Vector3 {
  const sunward = p.clone().negate().normalize();
  return p
    .clone()
    .addScaledVector(sideAt(p), offset * 0.35)
    .addScaledVector(sunward, offset * 0.95)
    .setY(p.y + ySign * offset * 0.22);
}

// Named pass points: the flight's control points AND the chapter anchors —
// the scroll remap must anchor each chapter at the authored sunlit vantage,
// not at the curve's closest (often dark-side) approach to the planet.
// Standoff scales with planet size (~6 radii): the giants need room, or the
// flyby blows past in a sliver of scroll and the gaze catches the dark side
const MERCURY_PASS = passPoint(MERCURY_POS, 30);
const VENUS_PASS = passPoint(VENUS_POS, 52, -1);
const EARTH_PASS = passPoint(EARTH_POS, 48);
const MARS_PASS = passPoint(MARS_POS, 44);
const JUPITER_PASS = passPoint(JUPITER_POS, 185, -1);
const SATURN_PASS = passPoint(SATURN_POS, 160);
const URANUS_PASS = passPoint(URANUS_POS, 80, -1);
const NEPTUNE_PASS = passPoint(NEPTUNE_POS, 76);
const PLUTO_PASS = passPoint(PLUTO_POS, 11);

/** Departure waypoint: a sunward pass must leave around the planet's FLANK.
 *  Without it, the spline's chord to the next world can cut straight
 *  through the planet — the camera ends up inside the atmosphere shell. */
function departPoint(p: THREE.Vector3, offset: number, ySign = 1): THREE.Vector3 {
  const outward = p.clone().normalize();
  return p
    .clone()
    .addScaledVector(sideAt(p), offset * 1.35)
    .addScaledVector(outward, offset * 0.5)
    .setY(p.y + ySign * offset * 0.2);
}

const JUPITER_OUT = departPoint(JUPITER_POS, 185);
const SATURN_OUT = departPoint(SATURN_POS, 160, -1);
const URANUS_OUT = departPoint(URANUS_POS, 80);
const NEPTUNE_OUT = departPoint(NEPTUNE_POS, 76, -1);

const venusToEarth = EARTH_POS.clone().sub(VENUS_POS).normalize();
const earthToMars = MARS_POS.clone().sub(EARTH_POS).normalize();
const earthSide = sideAt(EARTH_POS);

/** The Moon holds the SUNWARD side of Earth: its featured-project beat must
 *  show a lit face, not a backlit silhouette. The flight brushes past it,
 *  then swings around Earth's flank toward Mars. */
export const MOON_RADIUS = 2.2;
const earthSunward = EARTH_POS.clone().negate().normalize();
export const MOON_ANCHOR = EARTH_POS.clone()
  .addScaledVector(earthSunward, 32)
  .addScaledVector(earthSide, 15)
  .setY(EARTH_POS.y + 5);
const MOON_PASS = MOON_ANCHOR.clone()
  .addScaledVector(earthSunward, 6)
  .addScaledVector(earthSide, 3);
const EARTH_OUT = departPoint(EARTH_POS, 48);

const FLIGHT_POINTS: THREE.Vector3[] = [
  // Arrival: close on the photosphere (matches the descent handoff)
  at(0.6, 438, 46),
  // Swing past the sun — it slides out of frame
  at(0.95, 560, 70),
  MERCURY_PASS,
  VENUS_PASS,
  // The long Earth approach, then the sunlit pass
  EARTH_POS.clone().addScaledVector(venusToEarth, -470).addScaledVector(earthSide, 34).setY(-8),
  EARTH_PASS,
  // Brush past the Moon, then swing around Earth's flank outward
  MOON_PASS,
  EARTH_OUT,
  MARS_PASS,
  // Through the rubble between Mars and Jupiter
  at(1.48, 4800, 20),
  JUPITER_PASS,
  JUPITER_OUT,
  SATURN_PASS,
  SATURN_OUT,
  URANUS_PASS,
  URANUS_OUT,
  NEPTUNE_PASS,
  NEPTUNE_OUT,
  PLUTO_PASS,
  // The quiet ending: the camera keeps drifting away, gaze locked on Pluto
  PLUTO_POS.clone()
    .add(PLUTO_POS.clone().sub(NEPTUNE_POS).normalize().multiplyScalar(300))
    .add(new THREE.Vector3(0, 90, 0)),
];

export const FLIGHT_CURVE = new THREE.CatmullRomCurve3(FLIGHT_POINTS, false, 'centripetal');
FLIGHT_CURVE.arcLengthDivisions = 1200;

// Pre-sampled curve for nearest-point queries (arc-length parameterized)
const SAMPLES = 800;
const sampled: THREE.Vector3[] = [];
for (let i = 0; i <= SAMPLES; i++) {
  sampled.push(FLIGHT_CURVE.getPointAt(i / SAMPLES, new THREE.Vector3()));
}
function nearestU(target: THREE.Vector3): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i <= SAMPLES; i++) {
    const d = sampled[i].distanceToSquared(target);
    if (d < bd) {
      bd = d;
      best = i / SAMPLES;
    }
  }
  return best;
}

/* --------------------- chapters: the career --------------------- */

export interface Chapter {
  id: string;
  planet: string;
  title: string;
  body: string[];
  links?: { label: string; href: string }[];
  /** Designed scroll anchor — every chapter gets a fair share of the ride. */
  sp: number;
  /** World point the gaze frames (the world itself). */
  target: THREE.Vector3;
  /** Camera vantage the scroll anchor maps to (the authored pass point). */
  anchor?: THREE.Vector3;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'sun', planet: 'the Sun', title: 'Mehedi Hassan', sp: 0.015, target: ORIGIN,
    body: ['Full Stack Developer', 'Building software, games, AI tools, and interactive experiences.'],
  },
  {
    id: 'mercury', planet: 'Mercury', title: 'About', sp: 0.09, target: MERCURY_POS, anchor: MERCURY_PASS,
    body: [
      'Dhaka, Bangladesh',
      'Computer Science graduate, BRAC University',
      'Curious builder. I enjoy creating software, games, and digital experiences that feel alive.',
    ],
  },
  {
    id: 'venus', planet: 'Venus', title: 'Skills', sp: 0.18, target: VENUS_POS, anchor: VENUS_PASS,
    body: [
      'React and Next.js', 'TypeScript', 'Java and Spring Boot', 'Node and PostgreSQL',
      'Kotlin and Android', 'Flutter', 'OpenCV and PyTorch', 'Docker and Git',
    ],
  },
  {
    id: 'earth', planet: 'Earth', title: 'Projects', sp: 0.28, target: EARTH_POS, anchor: EARTH_PASS,
    body: ['Perico ERP', 'TopLine', 'Whispers', 'banauAI', 'eSIM', 'Geo Landmarks'],
  },
  {
    id: 'moon', planet: 'the Moon', title: 'Featured: Perico ERP', sp: 0.37, target: MOON_ANCHOR, anchor: MOON_PASS,
    body: ['The flagship build: a complete business ERP.', 'Java, Spring Boot, React, PostgreSQL.'],
  },
  {
    id: 'mars', planet: 'Mars', title: 'Experience', sp: 0.46, target: MARS_POS, anchor: MARS_PASS,
    body: [
      'BRAC University',
      'Community Lead for a 90k+ member community',
      'Events with 500+ attendees',
      'Verified Upwork freelancer',
    ],
  },
  {
    id: 'jupiter', planet: 'Jupiter', title: 'Technical Stack', sp: 0.57, target: JUPITER_POS, anchor: JUPITER_PASS,
    body: [
      'Io: languages. Java, Kotlin, TypeScript, Python.',
      'Europa: frontend. React, Next.js, Flutter.',
      'Ganymede: backend. Spring Boot, Node.',
      'Callisto: data. PostgreSQL, Prisma, Supabase.',
    ],
  },
  {
    id: 'saturn', planet: 'Saturn', title: 'Open Source', sp: 0.67, target: SATURN_POS, anchor: SATURN_PASS,
    body: ['Perico ERP, Whispers, TopLine, banauAI'],
    links: [{ label: 'github.com/mehedinassah', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'uranus', planet: 'Uranus', title: 'Education', sp: 0.76, target: URANUS_POS, anchor: URANUS_PASS,
    body: ['BRAC University', 'BSc in Computer Science', '2022 to 2026'],
  },
  {
    id: 'neptune', planet: 'Neptune', title: 'Achievements', sp: 0.85, target: NEPTUNE_POS, anchor: NEPTUNE_PASS,
    body: ['Verified Upwork freelancer', 'A 90k+ member community, led', 'Events with 500+ attendees'],
  },
  {
    id: 'pluto', planet: 'Pluto', title: "Let's build something.", sp: 0.95, target: PLUTO_POS, anchor: PLUTO_PASS,
    body: ['Dhaka, Bangladesh'],
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mehedinas' },
    ],
  },
];

/** Chapter reveal window in scroll space (the last chapter never closes). */
export function chapterIndexAt(sp: number): number {
  let idx = -1;
  for (let k = 0; k < CHAPTERS.length; k++) {
    const c = CHAPTERS[k];
    const tail = k === CHAPTERS.length - 1 ? 1.1 : 0.055;
    if (sp >= c.sp - 0.028 && sp <= c.sp + tail) idx = k;
  }
  return idx;
}

/* ------------- scroll remap: fair pacing over unfair distances ------------- */

const REMAP: [number, number][] = [
  [0, 0],
  ...CHAPTERS.filter((c) => c.id !== 'sun').map(
    (c) => [c.sp, nearestU(c.anchor ?? c.target)] as [number, number],
  ),
  [1, 1],
];

function remapU(sp: number): number {
  for (let i = 1; i < REMAP.length; i++) {
    if (sp <= REMAP[i][0]) {
      const [s0, u0] = REMAP[i - 1];
      const [s1, u1] = REMAP[i];
      return THREE.MathUtils.lerp(u0, u1, (sp - s0) / Math.max(1e-6, s1 - s0));
    }
  }
  return 1;
}

/** Belt reveal anchors for the scenery (SolarSystem.tsx). */
export const CHAPTER_SP: Record<string, number> = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c.sp]),
);

/* --------------------- camera pose --------------------- */

const vAhead = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vTo = new THREE.Vector3();

function windowW(sp: number, a: number, b: number, c: number, d: number): number {
  return THREE.MathUtils.smoothstep(sp, a, b) * (1 - THREE.MathUtils.smoothstep(sp, c, d));
}

function pull(dir: THREE.Vector3, from: THREE.Vector3, target: THREE.Vector3, w: number) {
  if (w <= 0.001) return;
  vTo.copy(target).sub(from).normalize();
  dir.lerp(vTo, w).normalize();
}

/**
 * One continuous flight, no cuts. Gaze rides the flight line and hands over
 * to each chapter's world for the stretch of its pass (direction-space
 * blending). Pluto keeps the gaze to the end — the camera flies away still
 * looking back.
 */
export function systemPose(
  sp: number,
  t: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
): void {
  const u = remapU(THREE.MathUtils.clamp(sp, 0, 1));
  FLIGHT_CURVE.getPointAt(u, outPos);

  FLIGHT_CURVE.getPointAt(Math.min(u + 0.035, 1), vAhead);
  vDir.copy(vAhead).sub(outPos);
  if (vDir.lengthSq() < 1) vDir.copy(PLUTO_POS).sub(outPos);
  vDir.normalize();

  // The sun holds the eye while we swing past it, then lets go
  pull(vDir, outPos, ORIGIN, (1 - THREE.MathUtils.smoothstep(sp, 0.045, 0.09)) * 0.8);
  for (const c of CHAPTERS) {
    if (c.id === 'sun') continue;
    if (c.id === 'pluto') {
      pull(vDir, outPos, c.target, THREE.MathUtils.smoothstep(sp, c.sp - 0.04, c.sp - 0.01));
      continue;
    }
    pull(vDir, outPos, c.target, windowW(sp, c.sp - 0.045, c.sp - 0.018, c.sp + 0.025, c.sp + 0.052) * 0.85);
  }

  outLook.copy(outPos).addScaledVector(vDir, 2000);
  void t;
}
