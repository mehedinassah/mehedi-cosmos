import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Venus — the Skill Constellation.
 *
 * One idea: skills are interconnected; every technology strengthens another.
 * The constellation is not a floating UI graph — it is emitted BY Venus. Small
 * glowing particles leave the atmosphere and crystallise into a designed graph
 * that arcs AROUND the planet like a magnetic field: some nodes pass in front,
 * some behind (real depth + occlusion). The whole chart rotates around Venus
 * almost imperceptibly; nodes breathe; signals drift along the edges; every few
 * seconds Venus emits an atmospheric pulse that brightens the entire network.
 *
 * Museum-like, not flashy. One warm palette: amber/orange nodes (AI a touch
 * cooler), soft cyan for the wiring, white for the hovered highlight. The graph
 * is meaningful — every edge is a relationship a CS mind reads instantly.
 *
 * Bridges are plain mutable objects (written every frame in the canvas, read in
 * a DOM rAF loop) so React never churns at 60fps.
 */

export type Category = 'core' | 'engineering' | 'ai' | 'development' | 'infra';

// One warm palette. AI reads a touch cooler (paler gold), never a rainbow.
export const CAT_COLOR: Record<Category, string> = {
  core: '#f2bd64', // brightest gold — the foundation
  engineering: '#e79a4a', // amber
  ai: '#d7cc9a', // cooler pale gold
  development: '#e0813c', // warm orange
  infra: '#c99a63', // dim warm, supporting
};
// Core fundamentals are the largest nodes; infrastructure the smallest.
export const CAT_SIZE: Record<Category, number> = {
  core: 1.0,
  engineering: 0.82,
  ai: 0.84,
  development: 0.64,
  infra: 0.54,
};
export const CAT_LABEL: Record<Category, string> = {
  core: 'FOUNDATION',
  engineering: 'ENGINEERING',
  ai: 'INTELLIGENCE',
  development: 'DEVELOPMENT',
  infra: 'INFRASTRUCTURE',
};

export type Skill = {
  name: string;
  category: Category;
  tagline: string; // one calm line — the card meta
  lx: number; // designed layout X (left = open area / front, right = wraps toward Venus)
  ly: number; // designed layout Y (up / down)
};

// The graph. Positions are hand-designed so it reads left-to-right: the
// important clusters (AI + fundamentals) sit LEFT in the open dark area
// (readable); development + infrastructure sit RIGHT and wrap over / behind
// Venus. Edges stay short within and between neighbouring clusters.
export const SKILLS: Skill[] = [
  // AI — upper-left, open, cooler glow
  { name: 'Artificial Intelligence', category: 'ai', tagline: 'Machines that reason', lx: -1.05, ly: 0.72 },
  { name: 'Machine Learning', category: 'ai', tagline: 'Learning from data', lx: -0.72, ly: 0.48 },
  { name: 'Pattern Recognition', category: 'ai', tagline: 'Finding structure', lx: -0.95, ly: 0.18 },
  { name: 'Image Processing', category: 'ai', tagline: 'Seeing with code', lx: -1.18, ly: 0.42 },

  // Core fundamentals — center-left spine (largest)
  { name: 'Algorithms', category: 'core', tagline: 'Solving efficiently', lx: -0.55, ly: 0.28 },
  { name: 'Data Structures', category: 'core', tagline: 'Organising information', lx: -0.50, ly: -0.08 },
  { name: 'Programming', category: 'core', tagline: 'Where every system begins', lx: -0.62, ly: -0.45 },
  { name: 'Operating Systems', category: 'core', tagline: 'How machines run', lx: -0.28, ly: 0.00 },

  // Engineering — center (medium)
  { name: 'Software Engineering', category: 'engineering', tagline: 'Building to last', lx: -0.34, ly: -0.32 },
  { name: 'Networks', category: 'engineering', tagline: 'Systems that talk', lx: -0.05, ly: 0.28 },
  { name: 'Computer Architecture', category: 'engineering', tagline: 'Under the hood', lx: 0.00, ly: -0.02 },
  { name: 'Database', category: 'engineering', tagline: 'Modelling and storing data', lx: -0.08, ly: -0.40 },

  // Development — right, wraps onto Venus (smaller)
  { name: 'React', category: 'development', tagline: 'Interfaces in components', lx: 0.20, ly: -0.35 },
  { name: 'Next.js', category: 'development', tagline: 'React across the stack', lx: 0.16, ly: -0.66 },
  { name: 'Kotlin', category: 'development', tagline: 'Modern Android', lx: 0.40, ly: -0.20 },
  { name: 'Android', category: 'development', tagline: 'Apps in your pocket', lx: 0.58, ly: -0.05 },
  { name: 'Flutter', category: 'development', tagline: 'One codebase, both platforms', lx: 0.34, ly: -0.50 },

  // Infrastructure — far right, wraps around / behind Venus (small)
  { name: 'PostgreSQL', category: 'infra', tagline: 'The relational backbone', lx: 0.28, ly: -0.66 },
  { name: 'Prisma', category: 'infra', tagline: 'Typed database access', lx: 0.14, ly: -0.90 },
  { name: 'Supabase', category: 'infra', tagline: 'Postgres with batteries', lx: 0.44, ly: -0.85 },
  { name: 'Docker', category: 'infra', tagline: 'Reproducible environments', lx: 0.56, ly: -0.60 },
  { name: 'Git', category: 'infra', tagline: 'History and collaboration', lx: 0.66, ly: -0.32 },
];

export const colorOfSkill = (s: Skill): string => CAT_COLOR[s.category];
export const sizeOfSkill = (s: Skill): number => CAT_SIZE[s.category];
export const catLabelOf = (s: Skill): string => CAT_LABEL[s.category];

const _idx = (n: string) => SKILLS.findIndex((s) => s.name === n);

// Meaningful edges — every connection a CS mind reads instantly. Sparse and
// intentional: readability over a tangled web.
const EDGE_NAMES: [string, string][] = [
  ['Programming', 'Data Structures'],
  ['Data Structures', 'Algorithms'],
  ['Algorithms', 'Operating Systems'],
  ['Data Structures', 'Database'],
  ['Algorithms', 'Software Engineering'],
  ['Operating Systems', 'Computer Architecture'],
  ['Operating Systems', 'Networks'],
  ['Networks', 'Computer Architecture'],
  ['Algorithms', 'Machine Learning'],
  ['Artificial Intelligence', 'Machine Learning'],
  ['Machine Learning', 'Pattern Recognition'],
  ['Machine Learning', 'Image Processing'],
  ['Pattern Recognition', 'Image Processing'],
  ['Software Engineering', 'React'],
  ['Software Engineering', 'Kotlin'],
  ['Database', 'PostgreSQL'],
  ['React', 'Next.js'],
  ['Android', 'Kotlin'],
  ['Kotlin', 'Flutter'],
  ['Next.js', 'Prisma'],
  ['Git', 'Docker'],
  ['Docker', 'PostgreSQL'],
  ['PostgreSQL', 'Prisma'],
  ['Prisma', 'Supabase'],
  ['PostgreSQL', 'Supabase'],
];

export const EDGES: [number, number][] = EDGE_NAMES
  .map(([a, b]) => [_idx(a), _idx(b)] as [number, number])
  .filter(([a, b]) => a >= 0 && b >= 0);

/** Adjacency for hover highlight + the card's "connects to" list. */
export const NEIGHBORS: number[][] = SKILLS.map((_, i) =>
  EDGES.filter(([a, b]) => a === i || b === i).map(([a, b]) => (a === i ? b : a)),
);

// Knowledge-flow pulses: occasionally a bright signal runs a whole path, e.g.
// Programming -> ... -> AI, so it reads as knowledge flowing through the graph.
const PULSE_PATH_NAMES: string[][] = [
  ['Programming', 'Data Structures', 'Algorithms', 'Machine Learning', 'Artificial Intelligence'],
  ['Database', 'PostgreSQL', 'Prisma', 'Supabase'],
  ['Operating Systems', 'Computer Architecture', 'Networks'],
  ['Software Engineering', 'React', 'Next.js', 'Prisma'],
];
export const PULSE_PATHS: number[][] = PULSE_PATH_NAMES
  .map((p) => p.map(_idx))
  .filter((p) => p.every((i) => i >= 0));

// Featured cycle: fundamentals surface first, then the rest. Hover overrides.
const IMPORTANT = ['Programming', 'Data Structures', 'Algorithms', 'Artificial Intelligence', 'Machine Learning']
  .map(_idx).filter((i) => i >= 0);
export const CYCLE_ORDER: number[] = [
  ...IMPORTANT,
  ...SKILLS.map((_, i) => i).filter((i) => !IMPORTANT.includes(i)),
];

/** Active node -> DOM card. env 0..1 drives unfold/fold; px/py = node screen pos. */
export const venusBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number;
  color: string;
  focus: number; // chapter focus 0..1, gates the DOM layer
  paused: boolean; // expanded record open -> hold the cycle
  hovering: boolean; // a node is under the pointer
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#e79a4a', focus: 0, paused: false, hovering: false };

/** Discrete pointer state (low frequency -> fine for React). */
type VenusUI = {
  hovered: number | null;
  selected: number | null;
  setHovered: (i: number | null) => void;
  setSelected: (i: number | null) => void;
};
let _closeTimer: ReturnType<typeof setTimeout> | null = null;
export const useVenusUI = create<VenusUI>((set) => ({
  hovered: null,
  selected: null,
  setHovered: (i) => {
    venusBridge.hovering = i != null;
    set({ hovered: i });
  },
  setSelected: (i) => {
    if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
    set({ selected: i });
    venusBridge.paused = i != null;
    if (i != null) {
      _closeTimer = setTimeout(() => {
        _closeTimer = null;
        venusBridge.paused = false;
        set({ selected: null });
      }, 9000);
    }
  },
}));

/** 1 while parked at the Venus chapter, 0 elsewhere. Gates all Venus activity. */
export function venusFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.venus), 0.02, 0.06);
}
