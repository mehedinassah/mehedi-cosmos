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
  /** Every world must be INSTANTLY recognizable as the real object — real
   *  imagery carries identity (maps: solarsystemscope.com, CC BY 4.0). */
  tex: { map: string; night?: string; clouds?: string; tint?: string };
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
    tex: { map: '/textures/2k_mercury.jpg' },
    palette: { deep: '#2e2a26', mid: '#5c554c', high: '#9a9188', atmo: '#6b655c', night: 0, clouds: 0 },
  },
  {
    id: 'venus', name: 'Venus', radius: 7.5, position: VENUS_POS,
    tex: { map: '/textures/2k_venus_atmosphere.jpg' },
    palette: { deep: '#6b5433', mid: '#a8874e', high: '#e0c890', atmo: '#d9b877', night: 0, clouds: 1.0 },
  },
  {
    id: 'earth', name: 'Earth', radius: 8, position: EARTH_POS,
    tex: { map: '/textures/2k_earth_daymap.jpg', night: '/textures/2k_earth_nightmap.jpg', clouds: '/textures/2k_earth_clouds.jpg' },
    palette: { deep: '#0e3a66', mid: '#2f6152', high: '#d8d2c4', atmo: '#7db4e8', night: 0.35, clouds: 0.7 },
  },
  {
    id: 'mars', name: 'Mars', radius: 4.2, position: MARS_POS,
    tex: { map: '/textures/2k_mars.jpg' },
    palette: { deep: '#4a2a1c', mid: '#8a4f33', high: '#c88a62', atmo: '#b07a58', night: 0, clouds: 0.06 },
  },
  {
    id: 'jupiter', name: 'Jupiter', radius: 30, position: JUPITER_POS,
    tex: { map: '/textures/2k_jupiter.jpg' },
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
    tex: { map: '/textures/2k_saturn.jpg' },
    palette: { deep: '#7a6543', mid: '#b09468', high: '#e2cfa4', atmo: '#cdb384', night: 0, clouds: 0.28 },
    rings: true,
    moons: [{ radius: 1.6, dist: 92, speed: 0.01, incl: 0.08, phase: 2.0 }],
  },
  {
    id: 'uranus', name: 'Uranus', radius: 13, position: URANUS_POS,
    tex: { map: '/textures/2k_uranus.jpg' },
    palette: { deep: '#2b4b52', mid: '#4f7d86', high: '#a4ccd2', atmo: '#8fc4cc', night: 0, clouds: 0.3 },
  },
  {
    id: 'neptune', name: 'Neptune', radius: 12.5, position: NEPTUNE_POS,
    tex: { map: '/textures/2k_neptune.jpg' },
    palette: { deep: '#16305c', mid: '#2f5590', high: '#7c9cd0', atmo: '#6a8fc8', night: 0, clouds: 0.4 },
  },
  {
    id: 'pluto', name: 'Pluto', radius: 1.9, position: PLUTO_POS,
    tex: { map: '/textures/2k_moon.jpg', tint: '#c9b49a' },
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
 *  night-side or terminator pass reads as a black hole with a caption.
 *  The Y lift is uniform: ONE consistent viewing angle slightly above the
 *  ecliptic for the whole journey — the viewer always knows where up is. */
function arcPoint(p: THREE.Vector3, offset: number, angle: number): THREE.Vector3 {
  const sunward = p.clone().negate().normalize();
  const dir = sideAt(p)
    .multiplyScalar(0.35)
    .addScaledVector(sunward, 0.95)
    .normalize()
    .applyAxisAngle(UP, angle);
  return p.clone().addScaledVector(dir, offset).setY(p.y + offset * 0.22);
}

/** Arrival grammar, identical at every world: approach (pre) -> hero shot
 *  (whole planet framed, lit) -> slow ~30 degree micro-orbit -> depart
 *  (post). The spline wraps partially AROUND each planet instead of
 *  streaking past it; the scroll remap below stretches time across the arc
 *  so every destination gets a moment to breathe. */
function passArc(p: THREE.Vector3, offset: number) {
  return {
    pre: arcPoint(p, offset, -0.26),
    hero: arcPoint(p, offset, 0),
    post: arcPoint(p, offset, 0.28),
  };
}

// Standoff scales with planet size (~6 radii): the hero shot frames the
// whole world at roughly 40% of the viewport, never cropped
export const CHAPTER_ARCS: Record<string, { pre: THREE.Vector3; hero: THREE.Vector3; post: THREE.Vector3 }> = {
  mercury: passArc(MERCURY_POS, 30),
  venus: passArc(VENUS_POS, 52),
  earth: passArc(EARTH_POS, 48),
  mars: passArc(MARS_POS, 44),
  jupiter: passArc(JUPITER_POS, 185),
  saturn: passArc(SATURN_POS, 160),
  uranus: passArc(URANUS_POS, 80),
  neptune: passArc(NEPTUNE_POS, 76),
  pluto: passArc(PLUTO_POS, 11),
};

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
const SATURN_OUT = departPoint(SATURN_POS, 160);
const URANUS_OUT = departPoint(URANUS_POS, 80);
const NEPTUNE_OUT = departPoint(NEPTUNE_POS, 76);

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

const A = CHAPTER_ARCS;
const FLIGHT_POINTS: THREE.Vector3[] = [
  // Arrival: close on the photosphere (matches the descent handoff)
  at(0.6, 438, 46),
  // Swing past the sun — it slides out of frame
  at(0.95, 560, 70),
  A.mercury.pre, A.mercury.hero, A.mercury.post,
  A.venus.pre, A.venus.hero, A.venus.post,
  // The long Earth approach, then the sunlit arc
  EARTH_POS.clone().addScaledVector(venusToEarth, -470).addScaledVector(earthSide, 34).setY(-8),
  A.earth.pre, A.earth.hero, A.earth.post,
  // Brush past the Moon, then swing around Earth's flank outward
  MOON_PASS,
  EARTH_OUT,
  A.mars.pre, A.mars.hero, A.mars.post,
  // Through the rubble between Mars and Jupiter
  at(1.48, 4800, 20),
  A.jupiter.pre, A.jupiter.hero, A.jupiter.post,
  JUPITER_OUT,
  A.saturn.pre, A.saturn.hero, A.saturn.post,
  SATURN_OUT,
  A.uranus.pre, A.uranus.hero, A.uranus.post,
  URANUS_OUT,
  A.neptune.pre, A.neptune.hero, A.neptune.post,
  NEPTUNE_OUT,
  A.pluto.pre, A.pluto.hero, A.pluto.post,
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
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
    ],
  },
  {
    id: 'mercury', planet: 'Mercury', title: 'About', sp: 0.1, target: MERCURY_POS, anchor: CHAPTER_ARCS.mercury.hero,
    body: [
      'Full stack developer from Dhaka, Bangladesh.',
      'BSc in Computer Science, BRAC University, 2022 to 2026.',
      'Available now, onsite Dhaka or remote.',
    ],
  },
  {
    id: 'venus', planet: 'Venus', title: 'Skills', sp: 0.2, target: VENUS_POS, anchor: CHAPTER_ARCS.venus.hero,
    body: [
      'Languages: Java, Kotlin, TypeScript, Python',
      'Frontend: React, Next.js, Flutter',
      'Backend: Spring Boot, Node',
      'Data: PostgreSQL, Prisma, Supabase',
      'Mobile: Android, Kotlin MVVM',
      'AI: OpenCV, PyTorch',
      'Tools: Docker, Git',
    ],
  },
  {
    id: 'earth', planet: 'Earth', title: 'Experience', sp: 0.3, target: EARTH_POS, anchor: CHAPTER_ARCS.earth.hero,
    body: [
      'Community Lead for a 90k+ member community',
      'Events with 500+ attendees',
      'Verified Upwork freelancer',
      'BRAC University',
    ],
  },
  {
    id: 'mars', planet: 'Mars', title: 'Projects', sp: 0.42, target: MARS_POS, anchor: CHAPTER_ARCS.mars.hero,
    body: ['Perico ERP', 'Top-Line', 'Whispers', 'banauAI', 'Smart Geo Landmarks'],
  },
  {
    id: 'jupiter', planet: 'Jupiter', title: 'Featured: Perico ERP', sp: 0.55, target: JUPITER_POS, anchor: CHAPTER_ARCS.jupiter.hero,
    body: [
      'The flagship build: a complete business ERP.',
      'Inventory, orders, and operations in one system.',
      'Java, Spring Boot, React, PostgreSQL.',
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'saturn', planet: 'Saturn', title: 'Open Source', sp: 0.67, target: SATURN_POS, anchor: CHAPTER_ARCS.saturn.hero,
    body: ['Repositories, commits, and stars', 'Perico ERP, Whispers, Top-Line, banauAI'],
    links: [{ label: 'github.com/mehedinassah', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'uranus', planet: 'Uranus', title: 'Off the Clock', sp: 0.78, target: URANUS_POS, anchor: CHAPTER_ARCS.uranus.hero,
    body: ['Movies and games', 'Football', 'Music and tea', 'A late night builder'],
  },
  {
    id: 'neptune', planet: 'Neptune', title: 'Contact', sp: 0.88, target: NEPTUNE_POS, anchor: CHAPTER_ARCS.neptune.hero,
    body: ['Dhaka, Bangladesh', '+880 1919 234860'],
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mehedinas' },
    ],
  },
  {
    // sp stops at 0.95 so the last stretch of scroll belongs to the
    // departure: the camera pulls away from Pluto, gaze locked back
    id: 'pluto', planet: 'Pluto', title: 'The edge of the map.', sp: 0.95, target: PLUTO_POS, anchor: CHAPTER_ARCS.pluto.hero,
    body: ['Thanks for flying this far.'],
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

// Three time anchors per chapter (arc entry, hero, arc exit): the camera
// spends a wide slice of scroll on a short stretch of curve — the slow
// lingering micro-orbit — then covers the empty gaps quickly. Cinematic
// time is spent where the wonder is.
const REMAP: [number, number][] = [
  [0, 0],
  ...CHAPTERS.filter((c) => c.id !== 'sun').flatMap((c) => {
    const arc = CHAPTER_ARCS[c.id];
    if (!arc) return [[c.sp, nearestU(c.anchor ?? c.target)] as [number, number]];
    return [
      [c.sp - 0.03, nearestU(arc.pre)],
      [c.sp, nearestU(arc.hero)],
      [c.sp + 0.035, nearestU(arc.post)],
    ] as [number, number][];
  }),
  // The Moon has no chapter panel but still deserves its share of the ride:
  // without this anchor the Earth->Mars leg swallows the sweep in an instant
  [0.36, nearestU(MOON_PASS)],
  [1, 1],
].sort((a, b) => a[0] - b[0]) as [number, number][];

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
    // Wide hold: the gaze stays with the world through the whole micro-orbit
    pull(vDir, outPos, c.target, windowW(sp, c.sp - 0.052, c.sp - 0.026, c.sp + 0.032, c.sp + 0.062) * 0.85);
  }
  // The Moon's silent beat: no panel, just the sweep past a lit face
  pull(vDir, outPos, MOON_ANCHOR, windowW(sp, 0.328, 0.345, 0.372, 0.392) * 0.85);

  outLook.copy(outPos).addScaledVector(vDir, 2000);
  void t;
}
