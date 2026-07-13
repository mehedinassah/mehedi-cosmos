import * as THREE from 'three';

/**
 * The system chapter — a guided fly-through of a real solar system.
 *
 * NOT a straight highway (that killed the wonder) and NOT a director doing
 * pans and spins (that was a rail shooter). Instead: ONE graceful spline
 * arcs outward from the sun and threads past every world. The planets are
 * NOT beads on a string — they lie roughly on the ecliptic but each sits at
 * its own bearing around the sun and a slightly different height, so the eye
 * reads "yes, this is a solar system," not a queue.
 *
 * The camera is a probe on that rail. It never thinks. Its ORIENTATION is
 * simply the tangent of the path — as the spline curves, the view curves
 * with it, so gently the viewer barely notices the heading change. There is
 * no lookAt on a subject, no roll, no banking, no independent rotation. Each
 * world is placed a fixed standoff ahead-and-to-the-right of its berth, so
 * the framing is identical every time: world on the right, content on the
 * left, met briefly, then gone.
 *
 * Scroll moves a target along the rail; a monotone-cubic (PCHIP) remap
 * dwells near each world and glides across the gaps.
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
const SUN_RADIUS = 120;

/* --------------------- the worlds (data) --------------------- */

interface BodyDef {
  id: string;
  name: string;
  radius: number;
  /** Orbital radius from the sun (sun-centered belts/dust stay physical). */
  orbit: number;
  /** Slight lift/dip off the ecliptic so worlds sit above/below one another. */
  yOff: number;
  tex: HeroSpec['tex'];
  palette: HeroSpec['palette'];
  rings?: boolean;
  moons?: MoonSpec[];
}

const DEFS: BodyDef[] = [
  {
    id: 'mercury', name: 'Mercury', radius: 2.4, orbit: 900, yOff: 34,
    tex: { map: '/textures/2k_mercury.jpg' },
    palette: { deep: '#2e2a26', mid: '#5c554c', high: '#9a9188', atmo: '#6b655c', night: 0, clouds: 0 },
  },
  {
    id: 'venus', name: 'Venus', radius: 7.5, orbit: 1500, yOff: -46,
    tex: { map: '/textures/2k_venus_atmosphere.jpg' },
    palette: { deep: '#6b5433', mid: '#a8874e', high: '#e0c890', atmo: '#d9b877', night: 0, clouds: 1.0 },
  },
  {
    id: 'earth', name: 'Earth', radius: 8, orbit: 2300, yOff: 40,
    tex: { map: '/textures/2k_earth_daymap.jpg', night: '/textures/2k_earth_nightmap.jpg', clouds: '/textures/2k_earth_clouds.jpg' },
    palette: { deep: '#0e3a66', mid: '#2f6152', high: '#d8d2c4', atmo: '#7db4e8', night: 0.35, clouds: 0.7 },
  },
  {
    id: 'mars', name: 'Mars', radius: 4.2, orbit: 3300, yOff: -52,
    tex: { map: '/textures/2k_mars.jpg' },
    palette: { deep: '#4a2a1c', mid: '#8a4f33', high: '#c88a62', atmo: '#b07a58', night: 0, clouds: 0.06 },
  },
  {
    id: 'jupiter', name: 'Jupiter', radius: 30, orbit: 6600, yOff: 120,
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
    id: 'saturn', name: 'Saturn', radius: 25, orbit: 9200, yOff: 190,
    tex: { map: '/textures/2k_saturn.jpg' },
    palette: { deep: '#7a6543', mid: '#b09468', high: '#e2cfa4', atmo: '#cdb384', night: 0, clouds: 0.28 },
    rings: true,
    moons: [{ radius: 1.6, dist: 92, speed: 0.01, incl: 0.08, phase: 2.0 }],
  },
  {
    id: 'uranus', name: 'Uranus', radius: 13, orbit: 12500, yOff: -160,
    tex: { map: '/textures/2k_uranus.jpg' },
    palette: { deep: '#2b4b52', mid: '#4f7d86', high: '#a4ccd2', atmo: '#8fc4cc', night: 0, clouds: 0.3 },
  },
  {
    id: 'neptune', name: 'Neptune', radius: 12.5, orbit: 15800, yOff: 150,
    tex: { map: '/textures/2k_neptune.jpg' },
    palette: { deep: '#16305c', mid: '#2f5590', high: '#7c9cd0', atmo: '#6a8fc8', night: 0, clouds: 0.4 },
  },
  {
    id: 'pluto', name: 'Pluto', radius: 1.9, orbit: 19000, yOff: -90,
    tex: { map: '/textures/2k_moon.jpg', tint: '#c9b49a' },
    palette: { deep: '#5c5248', mid: '#8d8177', high: '#cfc6b8', atmo: '#9a9089', night: 0, clouds: 0 },
    moons: [{ radius: 0.95, dist: 6.5, speed: 0.03, incl: 0.12, phase: 2.2 }],
  },
];

/* --------------------- the rail (one graceful spline) --------------------- */

// The arc sweeps through this much bearing across the whole system — a broad,
// monotone curve, never a corner. Mercury starts near A0; Pluto ends near
// A0 + ARC_SWEEP. Because the worlds fan out in bearing, they never stack up
// behind one another like beads on a string.
const A0 = 0.5;
const ARC_SWEEP = 0.92;
const M = new THREE.Vector3(Math.cos(A0), 0, Math.sin(A0)); // toward Mercury's bearing
const PERP = new THREE.Vector3(-Math.sin(A0), 0, Math.cos(A0)); // left of that

/** Bearing for a world at fractional position f in [0,1] along the sequence. */
function bearing(f: number): number {
  return A0 + ARC_SWEEP * f;
}

/** A berth on the rail: on the world's own bearing, at its orbital radius.
 *  Height is only the small ± undulation (worlds sitting above/below one
 *  another) — the standoff, not a big lift, is what frames the world, so the
 *  two must stay comparable or the world falls out of the bottom of frame. */
function berthAt(orbit: number, f: number, yOff: number): THREE.Vector3 {
  const a = bearing(f);
  return new THREE.Vector3(Math.cos(a) * orbit, yOff, Math.sin(a) * orbit);
}

// Control knots, in travel order:
//   [0] start  — far out on the FAR side of the sun, so the ship flies IN
//                toward the star (the opening: a G-type sun grows dead ahead)
//   [1] sun    — a berth beside the star; the rail swings past it, not through
//   [2..10]    — the nine worlds, each on its own bearing
//   [11] end   — the ship keeps cruising past Pluto into the dark
// The whole approach is PRE-OFFSET onto the passing side and tapers outward,
// so the ship slides past the star on one smooth line and makes ONE gentle
// bend out to Mercury. (A straight-in approach followed by a sideways swing
// at the sun read as a drift-left-then-whip-right correction — the camera
// must never look like it is fixing its own path.)
const START_KNOT = M.clone().multiplyScalar(-1600).addScaledVector(PERP, -60).addScaledVector(UP, 130);
// The hero stop: the star is OVERWHELMING (~75% viewport; apparent fraction
// ~ 2.29/(dist/radius)) and frames ahead-right, panel left.
const SUN_APPROACH = M.clone().multiplyScalar(-355).addScaledVector(PERP, -110).addScaledVector(UP, 55);
// Passing abeam the star: lateral clearance stays outside the corona shells
// (2.1 x 120 = 252) so the camera never dips inside the plasma.
const SUN_KNOT = M.clone().multiplyScalar(180).addScaledVector(PERP, -300).addScaledVector(UP, 45);
const BERTHS: THREE.Vector3[] = [
  START_KNOT,
  SUN_APPROACH,
  SUN_KNOT,
  ...DEFS.map((d, i) => berthAt(d.orbit, i / (DEFS.length - 1), d.yOff)),
];
{
  const last = DEFS[DEFS.length - 1];
  BERTHS.push(
    new THREE.Vector3(
      Math.cos(bearing(1.14)) * (last.orbit + 3400),
      360,
      Math.sin(bearing(1.14)) * (last.orbit + 3400),
    ),
  );
}

// One graceful curve through them all. Centripetal Catmull-Rom does not
// overshoot or kink when knot spacing is very uneven (900 → 19000).
export const RAIL = new THREE.CatmullRomCurve3(BERTHS, false, 'centripetal', 0.5);

const N_KNOTS = BERTHS.length;
/** getPoint(t) places control knot j at exactly t = j/(N-1). */
const knotU = (j: number) => j / (N_KNOTS - 1);

const _ta = new THREE.Vector3();
const _tb = new THREE.Vector3();
/** Unit tangent of the rail at u (finite difference — stable near the ends). */
function railTangent(u: number, out: THREE.Vector3): THREE.Vector3 {
  const du = 0.0009;
  RAIL.getPoint(Math.min(1, u + du), _ta);
  RAIL.getPoint(Math.max(0, u - du), _tb);
  out.copy(_ta).sub(_tb);
  if (out.lengthSq() < 1e-9) out.copy(M);
  return out.normalize();
}

/* --------------------- worlds placed against the rail --------------------- */

// Framing: each world sits a fixed standoff AHEAD of its berth, yawed toward
// the right so it composes on the right third with the panel on the left.
// Standoff in planet radii sets how large it looks; the yaw keeps the rail
// clearing the surface as it slides past.
// Per-world standoff in planet radii — smaller = the world fills more of the
// frame at its hero stop. Tuned so each world hits its target apparent size
// (giants dominate). Saturn's factor is large because its rings extend the
// silhouette ~2.3x, and the rail has to clear them as it slides past.
// Apparent height fraction at the stop ≈ 2.29 / K. Clearance rule: the rail
// slides past at ~0.35*K radii lateral, so K must keep that above the
// silhouette (rings extend Saturn's to ~2.3 radii).
const VIEW_K: Record<string, number> = {
  mercury: 5.0, venus: 5.2, earth: 4.8, mars: 5.2,
  jupiter: 4.2, saturn: 7.0, uranus: 4.7, neptune: 4.7, pluto: 5.8,
};
const STANDOFF = 6.0; // fallback planet radii
const FRAME_YAW = 0.36; // rad, toward the right of travel

const _tan = new THREE.Vector3();
const _fdir = new THREE.Vector3();

function placeWorld(def: BodyDef, knotIndex: number): THREE.Vector3 {
  const u = knotU(knotIndex);
  const berth = BERTHS[knotIndex];
  railTangent(u, _tan);
  // Yaw the tangent about world-up to get the framing direction, then flatten
  // to the ecliptic so the world sits near the plane (its yOff does the rest).
  _fdir.copy(_tan).applyAxisAngle(UP, -FRAME_YAW);
  _fdir.y = 0;
  _fdir.normalize();
  const d = def.radius * (VIEW_K[def.id] ?? STANDOFF);
  // A gentle downward gaze: drop the world a little below the berth so the
  // level (tangent-following) view looks slightly down onto it, ~above the
  // ecliptic. The drop scales with the standoff, so the framing is identical
  // for a pebble and a gas giant.
  return new THREE.Vector3(
    berth.x + _fdir.x * d,
    berth.y - d * 0.12,
    berth.z + _fdir.z * d,
  );
}

export const HEROES: HeroSpec[] = DEFS.map((d, i) => ({
  id: d.id,
  name: d.name,
  radius: d.radius,
  tex: d.tex,
  palette: d.palette,
  rings: d.rings,
  moons: d.moons,
  position: placeWorld(d, i + 3),
}));

export const EARTH_POS = HEROES.find((h) => h.id === 'earth')!.position;

/** The Moon is the one variation: a silent pass close on the sunward side of
 *  Earth, no panel — it drifts through frame as the ship coasts toward Mars. */
export const MOON_RADIUS = 2.2;
export const MOON_ANCHOR = (() => {
  const earthU = knotU(3 + DEFS.findIndex((d) => d.id === 'earth'));
  railTangent(earthU, _tan);
  const toward = _tan.clone();
  toward.y = 0;
  toward.normalize();
  // A little short of Earth, lifted, nudged to the near side of the rail.
  return EARTH_POS.clone()
    .addScaledVector(toward, -70)
    .addScaledVector(UP, 22)
    .addScaledVector(PERP, 30);
})();

/* --------------------- chapters: the career --------------------- */

export interface Chapter {
  id: string;
  planet: string;
  title: string;
  body: string[];
  links?: { label: string; href: string }[];
  /** Designed scroll anchor — every chapter gets the same share of the ride. */
  sp: number;
  /** Signature color — pips, labels, and accents pick it up per world. */
  accent: string;
  /** Distance from the sun, for the navigation rail. */
  au: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'sun', planet: 'the Sun', title: 'Mehedi Hassan', sp: 0.02, accent: '#ffce73', au: '0 AU',
    body: ['Full Stack Developer', 'Building software, games, AI tools, and interactive experiences.'],
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
    ],
  },
  {
    id: 'mercury', planet: 'Mercury', title: 'About', sp: 0.1, accent: '#E8927C', au: '0.39 AU',
    body: [
      'Full stack developer from Dhaka, Bangladesh.',
      'I build end to end: backend, frontend, mobile, and the pixels in between.',
      'Curious by default, calm under deadline.',
      'Available now, onsite Dhaka or remote.',
    ],
  },
  {
    id: 'venus', planet: 'Venus', title: 'Skills', sp: 0.2, accent: '#e99046', au: '0.72 AU',
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
    id: 'earth', planet: 'Earth', title: 'Experience', sp: 0.3, accent: '#26daaa', au: '1 AU',
    body: [
      'Community Lead for a 90k+ member community',
      'Events with 500+ attendees',
      'Verified Upwork freelancer',
      'BRAC University',
    ],
  },
  {
    id: 'mars', planet: 'Mars', title: 'Projects', sp: 0.42, accent: '#e55f45', au: '1.52 AU',
    body: ['Perico ERP', 'Top-Line', 'Whispers', 'banauAI', 'Smart Geo Landmarks', 'Android apps'],
    links: [{ label: 'GitHub', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'jupiter', planet: 'Jupiter', title: 'Featured: Perico ERP', sp: 0.55, accent: '#ffa64d', au: '5.20 AU',
    body: [
      'The flagship build: a complete business ERP.',
      'Inventory, orders, and operations in one system.',
      'Java, Spring Boot, React, PostgreSQL.',
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'saturn', planet: 'Saturn', title: 'Education', sp: 0.67, accent: '#cdb384', au: '9.54 AU',
    body: [
      'BSc in Computer Science',
      'BRAC University, 2022 to 2026',
      'Community Lead for a 90k+ member community',
      'Events with 500+ attendees',
      'Verified Upwork freelancer',
    ],
  },
  {
    id: 'uranus', planet: 'Uranus', title: 'The Personal Side', sp: 0.78, accent: '#8dcdd8', au: '19.18 AU',
    body: [
      'Music on, world off',
      'Football on weekends',
      'Gaming and movies after midnight',
      'Tea, always',
      'Photography when the light is right',
    ],
  },
  {
    id: 'neptune', planet: 'Neptune', title: 'Contact', sp: 0.88, accent: '#4f83e2', au: '30.06 AU',
    body: ['Dhaka, Bangladesh', '+880 1919 234860'],
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mehedinas' },
    ],
  },
  {
    // The hidden easter egg at the edge of the map — a reward for whoever
    // scrolls all the way out. The last stretch of scroll belongs to the
    // departure: the ship keeps cruising and Pluto falls behind.
    id: 'pluto', planet: 'Pluto', title: 'You found the easter egg.', sp: 0.95, accent: '#FF8732', au: '39.5 AU',
    body: [
      'Behind the scenes: Next.js, react three fiber, and hand written GLSL.',
      'Every star out here is procedural. No two visits render the same sky.',
      'Fun fact: this whole site is one canvas. You never left it.',
      'Thanks for flying this far.',
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

export const CHAPTER_SP: Record<string, number> = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c.sp]),
);

/* --------------- scroll -> rail parameter (PCHIP remap) --------------- */

// Where each chapter parks on the rail. The sun berth is knot 1; every world
// is its own knot (index 2..10), so its dwell u is exactly the knot's u.
const CHAP_U: Record<string, number> = { sun: knotU(1) };
DEFS.forEach((d, i) => {
  CHAP_U[d.id] = knotU(i + 3);
});

const DWELL = 0.011; // how much rail a world holds while it's the hero

// Wide dwell windows: a big slice of scroll maps to the tiny bit of rail
// around each world, so the ship slows to a crawl and lets the viewer admire
// the hero before the narrow gaps glide on to the next.
const PRE = 0.04;
const POST = 0.045;

const REMAP: [number, number][] = (() => {
  const pts: [number, number][] = [
    // At rest the star already sits ahead, mid-approach; the first scroll
    // flies in until it dominates the frame at its hero stop.
    [0, 0.05],
    [0.02, CHAP_U.sun],
    [0.05, CHAP_U.sun + 0.02],
  ];
  for (const c of CHAPTERS) {
    if (c.id === 'sun') continue;
    const u = CHAP_U[c.id];
    pts.push([c.sp - PRE, u - DWELL]);
    pts.push([c.sp, u]);
    pts.push([c.sp + POST, u + DWELL]);
  }
  pts.push([1, 1]);
  // Sort and enforce strict monotonicity in both axes.
  pts.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && (p[0] <= prev[0] || p[1] <= prev[1])) continue;
    out.push(p);
  }
  return out;
})();

// Monotone cubic (PCHIP / Fritsch-Carlson): C1-continuous velocity. A
// piecewise-linear remap kicks the ship's speed at every anchor.
const RX = REMAP.map((p) => p[0]);
const RY = REMAP.map((p) => p[1]);
const RM: number[] = (() => {
  const n = RX.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((RY[i + 1] - RY[i]) / Math.max(1e-6, RX[i + 1] - RX[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) {
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]));
  }
  m.push(d[n - 2]);
  return m;
})();

function remapU(sp: number): number {
  if (sp <= RX[0]) return RY[0];
  for (let i = 1; i < RX.length; i++) {
    if (sp <= RX[i]) {
      const h = RX[i] - RX[i - 1];
      const t = (sp - RX[i - 1]) / Math.max(1e-6, h);
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        RY[i - 1] * (2 * t3 - 3 * t2 + 1) +
        RM[i - 1] * h * (t3 - 2 * t2 + t) +
        RY[i] * (-2 * t3 + 3 * t2) +
        RM[i] * h * (t3 - t2)
      );
    }
  }
  return RY[RY.length - 1];
}

/* --------------------- the probe --------------------- */

const _mat = new THREE.Matrix4();
const _fwd = new THREE.Vector3();

/**
 * The probe on the rail. Position = the spline at the remapped scroll.
 * Orientation = the rail's tangent, nothing else — as the path curves, the
 * view eases with it. No lookAt on a subject, no roll, no banking. World-up
 * is the reference every frame, so the horizon of space stays level.
 */
export function systemPose(sp: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion): void {
  const u = THREE.MathUtils.clamp(remapU(THREE.MathUtils.clamp(sp, 0, 1)), 0, 1);
  RAIL.getPoint(u, outPos);
  railTangent(u, _fwd);
  // lookAt(eye, target, up) with eye at origin builds a camera orientation
  // whose forward (-Z) points at `target`; feeding the tangent aims the view
  // straight down the rail.
  _mat.lookAt(ORIGIN, _fwd, UP);
  outQuat.setFromRotationMatrix(_mat);
}
