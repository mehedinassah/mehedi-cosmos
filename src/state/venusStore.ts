import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Venus — the Skill Galaxy.
 *
 * Not a list of technologies: a miniature planetary system. Six orbital layers
 * circle Venus, each a domain of expertise, each with its own colour and its
 * own kind of celestial body — luminous language stars, warm frontend planets,
 * silver backend moons, green database crystals, purple AI nebulae, small tool
 * beacons. Every orbit turns at its own pace and direction; objects sweep in
 * front of and behind the planet. Nothing is ever labelled permanently: you
 * discover a skill by hovering it, which grows and brightens it, lights its
 * related technologies, traces cyan curves between them, and fades the rest.
 *
 * Apple Vision Pro restraint x NASA orbital logic x No Man's Sky discovery.
 *
 * Bridges are plain mutable objects (written every frame in the canvas, read in
 * a DOM rAF loop) so React never churns at 60fps.
 */

export type Category = 'lang' | 'frontend' | 'backend' | 'database' | 'ai' | 'tools';

export type OrbitSpec = {
  radius: number; // planet radii from Venus centre
  speed: number; // rad/s
  dir: 1 | -1;
  incl: number; // orbital-plane tilt (rad)
  color: string;
  glow: number; // glow-sprite size (planet radii)
  core: number; // solid core size (planet radii); 0 = pure nebula
  crystal?: boolean; // render the core as an octahedron (database)
  label: string;
};

// Inner -> outer. Languages closest + fastest (the foundation); AI slowest.
export const ORBITS: Record<Category, OrbitSpec> = {
  lang: { radius: 1.26, speed: 0.055, dir: 1, incl: 0.60, color: '#bcd4ff', glow: 0.11, core: 0.03, label: 'LANGUAGES' },
  frontend: { radius: 1.52, speed: 0.043, dir: -1, incl: 0.64, color: '#e8913f', glow: 0.145, core: 0.058, label: 'FRONTEND' },
  backend: { radius: 1.78, speed: 0.034, dir: 1, incl: 0.58, color: '#cfd6de', glow: 0.12, core: 0.052, label: 'BACKEND' },
  database: { radius: 2.04, speed: 0.025, dir: -1, incl: 0.66, color: '#5fd39a', glow: 0.13, core: 0.056, crystal: true, label: 'DATABASE' },
  ai: { radius: 2.32, speed: 0.017, dir: 1, incl: 0.62, color: '#b48cff', glow: 0.21, core: 0.0, label: 'ARTIFICIAL INTELLIGENCE' },
  tools: { radius: 2.6, speed: 0.036, dir: -1, incl: 0.7, color: '#cbb489', glow: 0.1, core: 0.04, label: 'DEVOPS & TOOLS' },
};
export const CATEGORY_ORDER: Category[] = ['lang', 'frontend', 'backend', 'database', 'ai', 'tools'];

export type Skill = {
  name: string;
  category: Category;
  role: string; // card subtitle
  bullets: string[]; // card body
  usedIn?: string;
  years?: string;
  related: string[]; // names lit + wired on hover
};

export const SKILLS: Skill[] = [
  // Languages — the foundation
  { name: 'Java', category: 'lang', role: 'Language · JVM', bullets: ['OOP at scale', 'Spring Boot services', 'Android'], usedIn: 'Enterprise ERP', years: '2021 – Present', related: ['Spring Boot', 'Kotlin'] },
  { name: 'Python', category: 'lang', role: 'Language · AI', bullets: ['ML and tooling', 'Automation', 'OCR pipeline'], usedIn: 'Smart OCR Thesis', related: ['PyTorch', 'OpenCV', 'Machine Learning'] },
  { name: 'Kotlin', category: 'lang', role: 'Language · Mobile', bullets: ['Modern Android', 'Coroutines', 'MVVM'], related: ['Java', 'Flutter'] },
  { name: 'TypeScript', category: 'lang', role: 'Language · Web', bullets: ['Typed end to end', 'React', 'Node'], years: '2022 – Present', related: ['React', 'Next.js', 'Node.js'] },

  // Frontend — the visible experience
  { name: 'React', category: 'frontend', role: 'Frontend Framework', bullets: ['Component architecture', 'Hooks', 'State management'], usedIn: 'Portfolio & ERP', years: '2023 – Present', related: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion'] },
  { name: 'Next.js', category: 'frontend', role: 'Fullstack React', bullets: ['App Router', 'Server rendering', 'APIs'], usedIn: 'Portfolio', years: '2023 – Present', related: ['React', 'TypeScript', 'Node.js', 'Prisma'] },
  { name: 'Flutter', category: 'frontend', role: 'Cross-platform Mobile', bullets: ['Dart', 'One codebase', 'Native feel'], related: ['Kotlin', 'Java'] },
  { name: 'Tailwind CSS', category: 'frontend', role: 'Styling', bullets: ['Utility-first', 'Design systems', 'Responsive'], related: ['React', 'Next.js'] },
  { name: 'Framer Motion', category: 'frontend', role: 'Animation', bullets: ['Gestures', 'Transitions', 'Micro-interactions'], related: ['React', 'Next.js'] },

  // Backend — behind the scenes
  { name: 'Spring Boot', category: 'backend', role: 'Backend Development', bullets: ['REST APIs', 'Authentication', 'JWT'], usedIn: 'Enterprise ERP', years: '2024 – Present', related: ['Java', 'PostgreSQL', 'Docker'] },
  { name: 'Node.js', category: 'backend', role: 'Backend Runtime', bullets: ['APIs', 'Realtime', 'Tooling'], related: ['Express', 'TypeScript', 'PostgreSQL', 'Docker'] },
  { name: 'Express', category: 'backend', role: 'Web Framework', bullets: ['Routing', 'Middleware', 'REST'], related: ['Node.js', 'PostgreSQL'] },

  // Database — knowledge storage
  { name: 'PostgreSQL', category: 'database', role: 'Relational Database', bullets: ['Query optimization', 'Prisma ORM', 'Multi-tenant design'], usedIn: 'ERP', related: ['Prisma', 'Supabase', 'MySQL', 'Node.js'] },
  { name: 'Prisma', category: 'database', role: 'ORM', bullets: ['Type-safe queries', 'Migrations', 'Schema modelling'], related: ['PostgreSQL', 'Supabase', 'Next.js'] },
  { name: 'Supabase', category: 'database', role: 'Backend Platform', bullets: ['Auth', 'Realtime', 'Storage'], related: ['PostgreSQL', 'Prisma'] },
  { name: 'MySQL', category: 'database', role: 'Relational Database', bullets: ['Schema design', 'Joins', 'Indexing'], related: ['PostgreSQL'] },

  // AI — the intelligence layer
  { name: 'Machine Learning', category: 'ai', role: 'Intelligence', bullets: ['Supervised learning', 'Model training', 'Evaluation'], usedIn: 'Thesis', related: ['PyTorch', 'Pattern Recognition', 'Image Processing', 'OpenCV', 'Python'] },
  { name: 'PyTorch', category: 'ai', role: 'Deep Learning', bullets: ['Neural networks', 'Training loops', 'Thesis pipeline'], usedIn: 'Smart OCR Thesis', related: ['Machine Learning', 'Pattern Recognition', 'Image Processing', 'OpenCV', 'Python'] },
  { name: 'OpenCV', category: 'ai', role: 'Computer Vision', bullets: ['Preprocessing', 'Segmentation', 'Feature extraction'], usedIn: 'Smart OCR', related: ['Image Processing', 'Pattern Recognition', 'Machine Learning', 'Python'] },
  { name: 'Pattern Recognition', category: 'ai', role: 'Intelligence', bullets: ['Classification', 'Clustering', 'Features'], related: ['Machine Learning', 'PyTorch', 'Image Processing'] },
  { name: 'Image Processing', category: 'ai', role: 'Vision', bullets: ['Filtering', 'Restoration', 'OCR'], usedIn: 'Smart OCR', related: ['OpenCV', 'Machine Learning', 'PyTorch', 'Pattern Recognition'] },

  // DevOps & Tools — supporting infrastructure
  { name: 'Docker', category: 'tools', role: 'Containers', bullets: ['Compose', 'Images', 'Reproducible envs'], related: ['Node.js', 'Git', 'Linux', 'Spring Boot'] },
  { name: 'Git', category: 'tools', role: 'Version Control', bullets: ['Branching', 'Reviews', 'History'], related: ['GitHub', 'Docker', 'Node.js'] },
  { name: 'GitHub', category: 'tools', role: 'Collaboration', bullets: ['Pull requests', 'Actions', 'Hosting'], related: ['Git'] },
  { name: 'Linux', category: 'tools', role: 'Operating System', bullets: ['Shell', 'Servers', 'Tooling'], related: ['Docker'] },
];

export const colorOfSkill = (s: Skill): string => ORBITS[s.category].color;

const _idx = (n: string) => SKILLS.findIndex((s) => s.name === n);

/** Related-technology adjacency (names -> indices), for the hover reveal. */
export const RELATED: number[][] = SKILLS.map((s) => s.related.map(_idx).filter((i) => i >= 0));

/** Active skill (hovered) -> DOM card. env 0..1 drives the card in/out. */
export const venusBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number;
  color: string;
  focus: number; // chapter focus 0..1, gates the DOM layer
  hovering: boolean;
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#e8913f', focus: 0, hovering: false };

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
