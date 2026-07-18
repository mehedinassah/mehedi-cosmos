import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Venus — the Engineering Ecosystem.
 *
 * Not a list of skills, and not an atom diagram: a living visualisation of how
 * the technologies work together to build complete systems. Six orbits circle
 * Venus, each a layer of the stack — Languages are the foundation (closest,
 * fast), Frontend the experience, Backend the power, Databases the memory, AI
 * the intelligence (highest, slow, mysterious), Tools the support (irregular).
 *
 * The orbits are elliptical, tilted, and unevenly spaced — organic, cinematic,
 * never symmetric. Their paths are only faint orbital dust until you hover a
 * category, when the full ring sweeps in like radar. Most nodes glow softly;
 * a few pulse and twinkle. Signals drift along the real stacks (React ->
 * Next.js -> TypeScript ...). Hovering a technology reveals the stack it
 * enables — you see how the engineer thinks, not just what they know.
 *
 * Bridges are plain mutable objects (written every frame in the canvas, read in
 * a DOM rAF loop) so React never churns at 60fps.
 */

export type Category = 'lang' | 'frontend' | 'backend' | 'database' | 'ai' | 'tools';
export type Shape = 'star' | 'planet' | 'moon' | 'crystal' | 'orb' | 'satellite';

export type OrbitSpec = {
  radius: number; // planet radii from Venus centre (uneven on purpose)
  ecc: number; // 0 = circle, higher = more elliptical
  incl: number; // plane tilt (rad)
  roll: number; // in-view roll (rad) — different inclinations, not all aligned
  speed: number; // rad/s
  dir: 1 | -1;
  color: string;
  glow: number; // glow-sprite size (planet radii)
  core: number; // solid core size; 0 = pure orb
  shape: Shape;
  label: string;
};

// Inner -> outer, but spaced unevenly: Languages hug the atmosphere; Tools ride
// an irregular, steeply tilted orbit; AI sits highest and slowest.
// Camera-FACING rings (see VenusConstellation): `incl`/`roll` roll the ellipse
// in the screen plane, `ecc` flattens it — but no ring ever tilts into depth, so
// no skill ever passes behind Venus or off-screen. Radii are small (they sit in
// the open space beside Venus) and uneven so the rings interweave, not concentric.
export const ORBITS: Record<Category, OrbitSpec> = {
  lang: { radius: 0.34, ecc: 0.12, incl: 0.50, roll: 0.12, speed: 0.05, dir: 1, color: '#bcd4ff', glow: 0.14, core: 0.032, shape: 'star', label: 'LANGUAGES' },
  frontend: { radius: 0.5, ecc: 0.22, incl: 0.66, roll: -0.5, speed: 0.04, dir: -1, color: '#e8913f', glow: 0.16, core: 0.06, shape: 'planet', label: 'FRONTEND' },
  backend: { radius: 0.64, ecc: 0.16, incl: 0.44, roll: 0.6, speed: 0.032, dir: 1, color: '#cfd6de', glow: 0.135, core: 0.055, shape: 'moon', label: 'BACKEND' },
  database: { radius: 0.78, ecc: 0.3, incl: 0.72, roll: -0.34, speed: 0.026, dir: -1, color: '#5fd39a', glow: 0.145, core: 0.056, shape: 'crystal', label: 'DATABASE' },
  tools: { radius: 0.92, ecc: 0.34, incl: 0.94, roll: 0.9, speed: 0.03, dir: -1, color: '#cbb489', glow: 0.115, core: 0.045, shape: 'satellite', label: 'DEVOPS & TOOLS' },
  ai: { radius: 1.04, ecc: 0.2, incl: 0.6, roll: -0.7, speed: 0.02, dir: 1, color: '#b48cff', glow: 0.24, core: 0.0, shape: 'orb', label: 'ARTIFICIAL INTELLIGENCE' },
};
export const CATEGORY_ORDER: Category[] = ['lang', 'frontend', 'backend', 'database', 'tools', 'ai'];

export type Skill = {
  name: string;
  category: Category;
  role: string;
  bullets: string[];
  usedIn?: string;
  years?: string;
  related: string[]; // the stack this technology enables
};

export const SKILLS: Skill[] = [
  // Languages — the foundation
  { name: 'Java', category: 'lang', role: 'Language · JVM', bullets: ['OOP at scale', 'Spring Boot services', 'Android'], usedIn: 'Enterprise ERP', years: '2021 – Present', related: ['Spring Boot', 'Kotlin'] },
  { name: 'Python', category: 'lang', role: 'Language · AI', bullets: ['ML and tooling', 'Automation', 'OCR pipeline'], usedIn: 'Smart OCR Thesis', related: ['PyTorch', 'OpenCV', 'Machine Learning'] },
  { name: 'Kotlin', category: 'lang', role: 'Language · Mobile', bullets: ['Modern Android', 'Coroutines', 'MVVM'], related: ['Java', 'Flutter'] },
  { name: 'TypeScript', category: 'lang', role: 'Language · Web', bullets: ['Typed end to end', 'React', 'Node'], years: '2022 – Present', related: ['React', 'Next.js', 'Node.js'] },

  // Frontend — the experience
  { name: 'React', category: 'frontend', role: 'Frontend Framework', bullets: ['Component architecture', 'Hooks', 'State management'], usedIn: 'Portfolio & ERP', years: '2023 – Present', related: ['Next.js', 'TypeScript', 'Tailwind CSS'] },
  { name: 'Next.js', category: 'frontend', role: 'Fullstack React', bullets: ['App Router', 'Server rendering', 'APIs'], usedIn: 'Portfolio', years: '2023 – Present', related: ['React', 'TypeScript', 'Node.js', 'Prisma'] },
  { name: 'Flutter', category: 'frontend', role: 'Cross-platform Mobile', bullets: ['Dart', 'One codebase', 'Native feel'], related: ['Kotlin', 'Java'] },
  { name: 'Tailwind CSS', category: 'frontend', role: 'Styling', bullets: ['Utility-first', 'Design systems', 'Responsive'], related: ['React', 'Next.js'] },

  // Backend — the power
  { name: 'Spring Boot', category: 'backend', role: 'Backend Development', bullets: ['REST APIs', 'Authentication', 'JWT'], usedIn: 'Enterprise ERP', years: '2024 – Present', related: ['Java', 'PostgreSQL', 'Docker'] },
  { name: 'Node.js', category: 'backend', role: 'Backend Runtime', bullets: ['APIs', 'Realtime', 'Tooling'], related: ['Express', 'TypeScript', 'PostgreSQL', 'Docker'] },
  { name: 'Express', category: 'backend', role: 'Web Framework', bullets: ['Routing', 'Middleware', 'REST'], related: ['Node.js', 'PostgreSQL'] },

  // Database — the memory
  { name: 'PostgreSQL', category: 'database', role: 'Relational Database', bullets: ['Query optimization', 'Prisma ORM', 'Multi-tenant design'], usedIn: 'ERP', related: ['Prisma', 'MySQL', 'Node.js'] },
  { name: 'Prisma', category: 'database', role: 'ORM', bullets: ['Type-safe queries', 'Migrations', 'Schema modelling'], related: ['PostgreSQL', 'Next.js'] },
  { name: 'MySQL', category: 'database', role: 'Relational Database', bullets: ['Schema design', 'Joins', 'Indexing'], related: ['PostgreSQL'] },

  // AI — the intelligence
  { name: 'Machine Learning', category: 'ai', role: 'Intelligence', bullets: ['Supervised learning', 'Model training', 'Evaluation'], usedIn: 'Thesis', related: ['PyTorch', 'OpenCV', 'Python'] },
  { name: 'PyTorch', category: 'ai', role: 'Deep Learning', bullets: ['Neural networks', 'Training loops', 'Thesis pipeline'], usedIn: 'Smart OCR Thesis', related: ['Machine Learning', 'OpenCV', 'Python'] },
  { name: 'OpenCV', category: 'ai', role: 'Computer Vision', bullets: ['Preprocessing', 'Segmentation', 'Feature extraction'], usedIn: 'Smart OCR', related: ['Machine Learning', 'Python'] },

  // DevOps & Tools — the support
  { name: 'Docker', category: 'tools', role: 'Containers', bullets: ['Compose', 'Images', 'Reproducible envs'], related: ['Node.js', 'Git', 'Linux', 'Spring Boot'] },
  { name: 'Git', category: 'tools', role: 'Version Control', bullets: ['Branching', 'Reviews', 'History'], related: ['Docker', 'Node.js'] },
  { name: 'Linux', category: 'tools', role: 'Operating System', bullets: ['Shell', 'Servers', 'Tooling'], related: ['Docker'] },
];

export const colorOfSkill = (s: Skill): string => ORBITS[s.category].color;

const _idx = (n: string) => SKILLS.findIndex((s) => s.name === n);

/** Related-technology adjacency (names -> indices), for the hover reveal. */
export const RELATED: number[][] = SKILLS.map((s) => s.related.map(_idx).filter((i) => i >= 0));

// Ambient signal loops — tiny pulses that drift the real stacks, alive without
// any hover (React -> Next.js -> TypeScript -> Tailwind -> React, ...).
const PULSE_PATH_NAMES: string[][] = [
  ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'React'],
  ['PostgreSQL', 'Prisma', 'MySQL', 'PostgreSQL'],
  ['Python', 'PyTorch', 'Machine Learning', 'OpenCV', 'Python'],
  ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'Node.js'],
  ['Java', 'Spring Boot', 'PostgreSQL', 'Docker'],
];
export const PULSE_PATHS: number[][] = PULSE_PATH_NAMES
  .map((p) => p.map(_idx))
  .filter((p) => p.every((i) => i >= 0));

/** Active skill (hovered) -> DOM card + orbit label. */
export const venusBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number;
  color: string;
  focus: number; // chapter focus 0..1, gates the DOM layer
  hovering: boolean;
  catLabel: string; // active orbit label (shown on hover)
  catColor: string;
  catPx: number;
  catPy: number;
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#e8913f', focus: 0, hovering: false, catLabel: '', catColor: '#e8913f', catPx: 0, catPy: 0 };

/** Discrete hover state (low frequency -> fine for React / canvas reads). */
type VenusUI = {
  hovered: number | null;
  setHovered: (i: number | null) => void;
};
export const useVenusUI = create<VenusUI>((set) => ({
  hovered: null,
  setHovered: (i) => {
    venusBridge.hovering = i != null;
    set({ hovered: i });
  },
}));

/** 1 while parked at the Venus chapter, 0 elsewhere. Gates all Venus activity. */
export function venusFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.venus), 0.02, 0.06);
}
