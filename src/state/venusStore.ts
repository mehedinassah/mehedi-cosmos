import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Venus — the Skill Constellation.
 *
 * Not a bullet list of technologies: a living neural network. Every skill is an
 * energy node orbiting Venus in one of three shells — Languages (inner, the
 * foundation), Frameworks (middle), Infrastructure (outer). Related
 * technologies constantly form and drop glowing connections; tiny signals
 * travel the active ones like current. Hover a node and its neighbours light
 * up; click and it unfolds into a compact holographic record. Every ~14s the
 * whole web synchronises for a breath, so a passive viewer sees that these are
 * not just tools he knows — they form a connected system.
 *
 * Warm by design: amber, gold, orange; ivory for the infrastructure ring. The
 * ONE cool accent — soft cyan — is reserved for the connection lines and the
 * signals, so the wiring reads instantly against the warm nodes.
 *
 * Bridges are plain mutable objects (written every frame in the canvas, read in
 * a DOM rAF loop) so React never churns at 60fps; discrete hover/select lives
 * in a tiny zustand store.
 */

export type Layer = 'inner' | 'middle' | 'outer';
export type Cluster = 'languages' | 'frontend' | 'backend' | 'database' | 'ai' | 'devops';

export const LAYER_LABEL: Record<Layer, string> = {
  inner: 'LANGUAGES',
  middle: 'FRAMEWORKS',
  outer: 'INFRASTRUCTURE',
};

export type Skill = {
  name: string;
  layer: Layer;
  cluster: Cluster;
  cat: string; // small-caps category line on the card
  color: string; // warm node colour
  pulse: number; // idle pulse speed
  tagline: string; // one calm line — the card's meta
  tags: string[]; // expanded record chips
};

// The archive. Colours stay warm (amber / gold / orange), infrastructure runs
// cool ivory, and the AI pair (PyTorch / OpenCV) leans warm red-orange to hint
// its cluster. Cyan is never a node — it belongs to the wiring alone.
export const SKILLS: Skill[] = [
  // Inner shell — Languages (the foundation)
  { name: 'Java', layer: 'inner', cluster: 'languages', cat: 'LANGUAGE · JVM', color: '#e8a24a', pulse: 0.9, tagline: 'Backend and Android foundation', tags: ['Spring Boot APIs', 'Android', 'OOP at scale'] },
  { name: 'Python', layer: 'inner', cluster: 'ai', cat: 'LANGUAGE · AI', color: '#f2c561', pulse: 0.7, tagline: 'Automation, ML, and tooling', tags: ['PyTorch', 'OpenCV', 'OCR thesis', 'Scripting'] },
  { name: 'TypeScript', layer: 'inner', cluster: 'frontend', cat: 'LANGUAGE · WEB', color: '#f0a94e', pulse: 1.0, tagline: 'Typed from client to server', tags: ['React', 'Next.js', 'Node'] },
  { name: 'Kotlin', layer: 'inner', cluster: 'backend', cat: 'LANGUAGE · MOBILE', color: '#eeb15a', pulse: 0.85, tagline: 'Modern Android, MVVM', tags: ['Android', 'Coroutines', 'Jetpack'] },

  // Middle shell — Frameworks
  { name: 'React', layer: 'middle', cluster: 'frontend', cat: 'FRAMEWORK · UI', color: '#e99046', pulse: 1.1, tagline: 'Component driven interfaces', tags: ['Hooks', 'State', 'Design systems'] },
  { name: 'Next.js', layer: 'middle', cluster: 'frontend', cat: 'FRAMEWORK · FULLSTACK', color: '#e07b3a', pulse: 1.0, tagline: 'React across the whole stack', tags: ['App Router', 'Server rendering', 'APIs'] },
  { name: 'Flutter', layer: 'middle', cluster: 'backend', cat: 'FRAMEWORK · MOBILE', color: '#eda45c', pulse: 0.9, tagline: 'One codebase, both platforms', tags: ['Dart', 'Cross platform', 'Native feel'] },
  { name: 'Spring Boot', layer: 'middle', cluster: 'backend', cat: 'FRAMEWORK · BACKEND', color: '#e58a44', pulse: 0.8, tagline: 'Java services and REST APIs', tags: ['REST', 'JPA', 'Security'] },
  { name: 'Node.js', layer: 'middle', cluster: 'backend', cat: 'RUNTIME · BACKEND', color: '#d98b4a', pulse: 0.95, tagline: 'JavaScript on the server', tags: ['APIs', 'Realtime', 'Tooling'] },

  // Outer shell — Infrastructure (cool ivory / the AI pair warm)
  { name: 'Docker', layer: 'outer', cluster: 'devops', cat: 'INFRA · CONTAINERS', color: '#d9dbe0', pulse: 0.7, tagline: 'Reproducible environments', tags: ['Compose', 'Images', 'Deploy'] },
  { name: 'Git', layer: 'outer', cluster: 'devops', cat: 'INFRA · VERSION', color: '#e6e0d4', pulse: 0.6, tagline: 'History and collaboration', tags: ['Branching', 'Reviews', 'CI'] },
  { name: 'Prisma', layer: 'outer', cluster: 'database', cat: 'DATA · ORM', color: '#d6d2c8', pulse: 0.75, tagline: 'Typed database access', tags: ['Schema', 'Migrations', 'Type safety'] },
  { name: 'PostgreSQL', layer: 'outer', cluster: 'database', cat: 'DATA · SQL', color: '#cdd4dc', pulse: 0.65, tagline: 'The relational backbone', tags: ['Modeling', 'Indexes', 'Transactions'] },
  { name: 'Supabase', layer: 'outer', cluster: 'database', cat: 'DATA · PLATFORM', color: '#d2ddd4', pulse: 0.8, tagline: 'Postgres with batteries', tags: ['Auth', 'Realtime', 'Storage'] },
  { name: 'OpenCV', layer: 'outer', cluster: 'ai', cat: 'AI · VISION', color: '#e6b088', pulse: 0.85, tagline: 'Classical computer vision', tags: ['Preprocessing', 'Segmentation', 'OCR'] },
  { name: 'PyTorch', layer: 'outer', cluster: 'ai', cat: 'AI · DEEP LEARNING', color: '#e8895a', pulse: 0.9, tagline: 'Neural networks and training', tags: ['CNNs', 'Training', 'Thesis pipeline'] },
];

export const colorOfSkill = (s: Skill): string => s.color;

const _idx = (n: string) => SKILLS.findIndex((s) => s.name === n);

// The connective tissue — related technologies that wire up. These are the
// lines that flicker in and out, and the paths the signals travel.
const REL_NAMES: [string, string][] = [
  ['Java', 'Kotlin'],
  ['Java', 'Spring Boot'],
  ['Kotlin', 'Flutter'],
  ['Python', 'PyTorch'],
  ['Python', 'OpenCV'],
  ['PyTorch', 'OpenCV'],
  ['TypeScript', 'React'],
  ['React', 'Next.js'],
  ['TypeScript', 'Next.js'],
  ['Next.js', 'Node.js'],
  ['Node.js', 'Spring Boot'],
  ['Node.js', 'Docker'],
  ['PostgreSQL', 'Prisma'],
  ['Prisma', 'Supabase'],
  ['PostgreSQL', 'Supabase'],
  ['Prisma', 'Next.js'],
  ['Docker', 'Git'],
  ['TypeScript', 'Node.js'],
  ['Python', 'Docker'],
];

export const RELATIONS: [number, number][] = REL_NAMES
  .map(([a, b]) => [_idx(a), _idx(b)] as [number, number])
  .filter(([a, b]) => a >= 0 && b >= 0);

/** Adjacency: for a node, the indices it is wired to. */
export const NEIGHBORS: number[][] = SKILLS.map((_, i) =>
  RELATIONS.filter(([a, b]) => a === i || b === i).map(([a, b]) => (a === i ? b : a)),
);

// Featured cycle: the strongest skills surface first, then the rest. Every node
// still gets its moment; hover/click override the cycle at any time.
const IMPORTANT = ['Python', 'TypeScript', 'React', 'Next.js', 'PyTorch'].map(_idx).filter((i) => i >= 0);
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
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#e99046', focus: 0, paused: false, hovering: false };

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
  // Selecting opens the record and arms a 9s self-close; managed here, outside
  // React, so re-render churn can't defeat the timer.
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
