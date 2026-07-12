import * as THREE from 'three';

/**
 * The system chapter — a VEHICLE, not a director.
 *
 * One straight lane runs radially outward from the sun. Every world is
 * berthed along it with the identical geometry: two radii to the RIGHT of
 * the lane, half a radius low. The camera is a spacecraft cruising the
 * lane with ONE fixed orientation for the entire chapter — no lookAt, no
 * roll, no banking, no per-frame gaze. Worlds appear ahead, grow to ~40%
 * of the viewport at their stop (content on the left, always), then slide
 * past the window and fall behind. The motion is identical at every stop;
 * after two planets the viewer knows the layout by instinct.
 *
 * Scroll moves a target along the lane; a monotone cubic (PCHIP) remap
 * spends most of the ride dwelling near the worlds and glides across the
 * gaps, and heavy damping downstream gives the ship its mass.
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

/* --------------------- the lane --------------------- */

const D = new THREE.Vector3(Math.cos(1.2), 0, Math.sin(1.2)); // direction of travel
const R = new THREE.Vector3(D.z, 0, -D.x); // right of travel
// The sun keeps the same two-radii berth as every other world, which fixes
// the lane's origin: it passes just left of and slightly above the sun at
// (0,0,0). Light therefore always comes from behind the ship — every face
// we meet is lit.
const SUN_RADIUS = 120;
const L0 = R.clone().multiplyScalar(-SUN_RADIUS * 2).addScaledVector(new THREE.Vector3(0, 1, 0), SUN_RADIUS * 0.5);

const lanePoint = (s: number) => L0.clone().addScaledVector(D, s);

/** Identical berth for every body: two radii right, half a radius low. */
function berth(s: number, radius: number): THREE.Vector3 {
  return lanePoint(s).addScaledVector(R, radius * 2).addScaledVector(UP, -radius * 0.5);
}

/* --------------------- the worlds --------------------- */

interface BodyDef {
  id: string;
  name: string;
  radius: number;
  /** Lane coordinate — roughly the real orbital radius, so the asteroid
   *  belt, Kuiper belt, dust and comet (all sun-centered) stay physical. */
  s: number;
  tex: HeroSpec['tex'];
  palette: HeroSpec['palette'];
  rings?: boolean;
  moons?: MoonSpec[];
}

const DEFS: BodyDef[] = [
  {
    id: 'mercury', name: 'Mercury', radius: 2.4, s: 900,
    tex: { map: '/textures/2k_mercury.jpg' },
    palette: { deep: '#2e2a26', mid: '#5c554c', high: '#9a9188', atmo: '#6b655c', night: 0, clouds: 0 },
  },
  {
    id: 'venus', name: 'Venus', radius: 7.5, s: 1500,
    tex: { map: '/textures/2k_venus_atmosphere.jpg' },
    palette: { deep: '#6b5433', mid: '#a8874e', high: '#e0c890', atmo: '#d9b877', night: 0, clouds: 1.0 },
  },
  {
    id: 'earth', name: 'Earth', radius: 8, s: 2300,
    tex: { map: '/textures/2k_earth_daymap.jpg', night: '/textures/2k_earth_nightmap.jpg', clouds: '/textures/2k_earth_clouds.jpg' },
    palette: { deep: '#0e3a66', mid: '#2f6152', high: '#d8d2c4', atmo: '#7db4e8', night: 0.35, clouds: 0.7 },
  },
  {
    id: 'mars', name: 'Mars', radius: 4.2, s: 3300,
    tex: { map: '/textures/2k_mars.jpg' },
    palette: { deep: '#4a2a1c', mid: '#8a4f33', high: '#c88a62', atmo: '#b07a58', night: 0, clouds: 0.06 },
  },
  {
    id: 'jupiter', name: 'Jupiter', radius: 30, s: 6600,
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
    id: 'saturn', name: 'Saturn', radius: 25, s: 9200,
    tex: { map: '/textures/2k_saturn.jpg' },
    palette: { deep: '#7a6543', mid: '#b09468', high: '#e2cfa4', atmo: '#cdb384', night: 0, clouds: 0.28 },
    rings: true,
    moons: [{ radius: 1.6, dist: 92, speed: 0.01, incl: 0.08, phase: 2.0 }],
  },
  {
    id: 'uranus', name: 'Uranus', radius: 13, s: 12500,
    tex: { map: '/textures/2k_uranus.jpg' },
    palette: { deep: '#2b4b52', mid: '#4f7d86', high: '#a4ccd2', atmo: '#8fc4cc', night: 0, clouds: 0.3 },
  },
  {
    id: 'neptune', name: 'Neptune', radius: 12.5, s: 15800,
    tex: { map: '/textures/2k_neptune.jpg' },
    palette: { deep: '#16305c', mid: '#2f5590', high: '#7c9cd0', atmo: '#6a8fc8', night: 0, clouds: 0.4 },
  },
  {
    id: 'pluto', name: 'Pluto', radius: 1.9, s: 19000,
    tex: { map: '/textures/2k_moon.jpg', tint: '#c9b49a' },
    palette: { deep: '#5c5248', mid: '#8d8177', high: '#cfc6b8', atmo: '#9a9089', night: 0, clouds: 0 },
    moons: [{ radius: 0.95, dist: 6.5, speed: 0.03, incl: 0.12, phase: 2.2 }],
  },
];

export const HEROES: HeroSpec[] = DEFS.map((d) => ({
  ...d,
  position: berth(d.s, d.radius),
}));

export const EARTH_POS = HEROES.find((h) => h.id === 'earth')!.position;
const EARTH_S = 2300;

/** The Moon is the one variation: it passes close on the LEFT just after
 *  Earth — a silent beat, no panel. */
export const MOON_RADIUS = 2.2;
export const MOON_ANCHOR = lanePoint(EARTH_S + 90)
  .addScaledVector(R, -26)
  .addScaledVector(UP, 6);

/* --------------------- chapters: the career --------------------- */

export interface Chapter {
  id: string;
  planet: string;
  title: string;
  body: string[];
  links?: { label: string; href: string }[];
  /** Designed scroll anchor — every chapter gets the same share of the ride. */
  sp: number;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'sun', planet: 'the Sun', title: 'Mehedi Hassan', sp: 0.02,
    body: ['Full Stack Developer', 'Building software, games, AI tools, and interactive experiences.'],
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
    ],
  },
  {
    id: 'mercury', planet: 'Mercury', title: 'About', sp: 0.1,
    body: [
      'Full stack developer from Dhaka, Bangladesh.',
      'BSc in Computer Science, BRAC University, 2022 to 2026.',
      'Available now, onsite Dhaka or remote.',
    ],
  },
  {
    id: 'venus', planet: 'Venus', title: 'Skills', sp: 0.2,
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
    id: 'earth', planet: 'Earth', title: 'Experience', sp: 0.3,
    body: [
      'Community Lead for a 90k+ member community',
      'Events with 500+ attendees',
      'Verified Upwork freelancer',
      'BRAC University',
    ],
  },
  {
    id: 'mars', planet: 'Mars', title: 'Projects', sp: 0.42,
    body: ['Perico ERP', 'Top-Line', 'Whispers', 'banauAI', 'Smart Geo Landmarks'],
  },
  {
    id: 'jupiter', planet: 'Jupiter', title: 'Featured: Perico ERP', sp: 0.55,
    body: [
      'The flagship build: a complete business ERP.',
      'Inventory, orders, and operations in one system.',
      'Java, Spring Boot, React, PostgreSQL.',
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'saturn', planet: 'Saturn', title: 'Open Source', sp: 0.67,
    body: ['Repositories, commits, and stars', 'Perico ERP, Whispers, Top-Line, banauAI'],
    links: [{ label: 'github.com/mehedinassah', href: 'https://github.com/mehedinassah' }],
  },
  {
    id: 'uranus', planet: 'Uranus', title: 'Off the Clock', sp: 0.78,
    body: ['Movies and games', 'Football', 'Music and tea', 'A late night builder'],
  },
  {
    id: 'neptune', planet: 'Neptune', title: 'Contact', sp: 0.88,
    body: ['Dhaka, Bangladesh', '+880 1919 234860'],
    links: [
      { label: 'Email', href: 'mailto:idehemnassah@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/mehedinassah' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mehedinas' },
    ],
  },
  {
    // The last stretch of scroll belongs to the departure: the ship simply
    // keeps cruising and Pluto falls behind like everything else did
    id: 'pluto', planet: 'Pluto', title: 'The edge of the map.', sp: 0.95,
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

export const CHAPTER_SP: Record<string, number> = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c.sp]),
);

/* --------------- scroll -> lane coordinate (PCHIP remap) --------------- */

// The stop for each world: far enough back that the whole planet sits
// comfortably in frame ahead-right (~20 degrees of arc = ~40% of viewport)
const viewS = (s: number, r: number) => s - r * 5.5;

const S_START = -900; // the sun grows ahead-right out of the arrival flash
const S_END = 19000 + 700; // cruise on past Pluto; it falls behind

const RADII: Record<string, number> = Object.fromEntries(DEFS.map((d) => [d.id, d.radius]));
const LANE_S: Record<string, number> = Object.fromEntries(DEFS.map((d) => [d.id, d.s]));

const REMAP: [number, number][] = [
  [0, S_START],
  // The sun is berthed at s=0 like everything else
  [0.02, viewS(0, SUN_RADIUS)],
  [0.055, viewS(0, SUN_RADIUS) + SUN_RADIUS * 2.5],
  ...CHAPTERS.filter((c) => c.id !== 'sun').flatMap((c) => {
    const r = RADII[c.id];
    const v = viewS(LANE_S[c.id], r);
    return [
      [c.sp - 0.03, v - r * 3],
      [c.sp, v],
      [c.sp + 0.035, v + r * 2.5],
    ] as [number, number][];
  }),
  // The Moon's silent left-side pass gets its own share of the ride
  [0.36, EARTH_S + 90 - 110],
  [1, S_END],
].sort((a, b) => a[0] - b[0]) as [number, number][];

// Monotone cubic (PCHIP / Fritsch-Carlson): C1-continuous velocity. A
// piecewise-linear remap kicks at every anchor.
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

function remapS(sp: number): number {
  if (sp <= 0) return RY[0];
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

/* --------------------- the camera --------------------- */

/** ONE orientation for the entire chapter, computed once: forward along
 *  the lane, yawed 12 degrees toward the worlds' side. Roll is zero by
 *  construction and stays zero — the horizon of space never moves. */
export const SYSTEM_QUAT = (() => {
  const forward = D.clone().multiplyScalar(Math.cos(0.21)).addScaledVector(R, Math.sin(0.21));
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), forward, UP);
  return new THREE.Quaternion().setFromRotationMatrix(m);
})();

/** The vehicle: position on the lane. Nothing else. */
export function systemPose(sp: number, outPos: THREE.Vector3): void {
  outPos.copy(lanePoint(remapS(THREE.MathUtils.clamp(sp, 0, 1))));
}
