import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Saturn — the Knowledge Archive.
 *
 * The RING itself stores the knowledge: hundreds of tiny particles, most dark;
 * every few seconds one lights up, leaves orbit a few pixels, unfolds into a
 * compact card, then folds back. Courses are colour-coded by category
 * (Programming blue / Core CS gold / AI purple / Math ivory) so relationships
 * read without reading, and when one activates a faint constellation traces to
 * its siblings. Milestones (SSC / HSC / BRAC) are clickable gold beacons on
 * their own orbit — BRAC the largest, the centre of it all. Calm, warm,
 * organized: ivory, sand, soft gold, a single tiny cyan accent.
 */

export type Group = 'programming' | 'core' | 'ai' | 'math' | 'achievement' | 'milestone';

export const GROUP_COLOR: Record<Group, string> = {
  programming: '#6aa0e0', // blue
  core: '#d8b26a', // gold
  ai: '#b48cff', // purple
  math: '#e6e0cf', // ivory / white
  achievement: '#8fd8c8', // the one tiny cyan accent
  milestone: '#f0c674', // gold beacon
};

export type KItem = {
  kind: 'course' | 'achievement' | 'milestone';
  group: Group;
  ring: 0 | 1 | 2 | 3; // 0..2 knowledge streams (inner..outer), 3 = milestone orbit
  cat: string; // small-caps category line
  title: string; // the big line — recognition, not explanation
  code?: string; // course code (tiny meta on the card)
  sem?: string; // semester / when (tiny meta)
  sub?: string; // milestone/achievement subtitle
  inst?: string;
  topics?: string[]; // expanded record only
  year?: '2018' | '2020' | '2022';
};

const INST = 'BRAC University';

// The archive. Order = activation order (courses cycle; achievements are rarer
// discoveries). Milestones are NOT in the cycle — they are clickable beacons.
export const K_ITEMS: KItem[] = [
  { kind: 'course', group: 'programming', ring: 0, cat: 'PROGRAMMING', title: 'Programming I', code: 'CSE110', sem: 'Semester 1', inst: INST, topics: ['Variables and control flow', 'Functions', 'Problem decomposition'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'SYSTEMS', title: 'Operating Systems', code: 'CSE321', sem: 'Semester 6', inst: INST, topics: ['Processes and threads', 'Scheduling', 'Memory management', 'File systems'] },
  { kind: 'course', group: 'ai', ring: 2, cat: 'ARTIFICIAL INTELLIGENCE', title: 'Artificial Intelligence', code: 'CSE422', sem: 'Spring 2025', inst: INST, topics: ['Search algorithms', 'Knowledge representation', 'Machine learning basics', 'Optimization'] },
  { kind: 'course', group: 'programming', ring: 0, cat: 'PROGRAMMING', title: 'Programming II', code: 'CSE111', sem: 'Semester 2', inst: INST, topics: ['Classes and objects', 'Inheritance', 'Polymorphism'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'DATABASES', title: 'Database Systems', code: 'CSE370', sem: 'Semester 5', inst: INST, topics: ['Relational modeling', 'SQL', 'Normalization', 'Transactions'] },
  { kind: 'course', group: 'ai', ring: 2, cat: 'MACHINE LEARNING', title: 'Machine Learning', code: 'CSE427', sem: 'Semester 9', inst: INST, topics: ['Supervised learning', 'Neural networks', 'Model evaluation'] },
  { kind: 'course', group: 'core', ring: 0, cat: 'FOUNDATIONS', title: 'Data Structures', code: 'CSE220', sem: 'Semester 3', inst: INST, topics: ['Lists, stacks, queues', 'Trees and graphs', 'Hashing'] },
  { kind: 'achievement', group: 'achievement', ring: 2, cat: 'RESEARCH', title: 'Smart OCR', sub: 'Thesis', sem: 'Final year', inst: INST, topics: ['Bangla handwriting recognition', 'Document restoration', 'Deep learning pipeline'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'NETWORKING', title: 'Computer Networks', code: 'CSE421', sem: 'Semester 8', inst: INST, topics: ['TCP/IP', 'Routing', 'Application protocols'] },
  { kind: 'course', group: 'ai', ring: 2, cat: 'VISION', title: 'Image Processing', code: 'CSE428', sem: 'Semester 9', inst: INST, topics: ['Filtering', 'Segmentation', 'Feature extraction'] },
  { kind: 'course', group: 'core', ring: 0, cat: 'FOUNDATIONS', title: 'Algorithms', code: 'CSE221', sem: 'Semester 4', inst: INST, topics: ['Divide and conquer', 'Greedy methods', 'Dynamic programming', 'Complexity'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'ARCHITECTURE', title: 'Computer Architecture', code: 'CSE340', sem: 'Semester 5', inst: INST, topics: ['ISA design', 'Pipelining', 'Memory hierarchy'] },
  { kind: 'course', group: 'ai', ring: 2, cat: 'GRAPHICS', title: 'Computer Graphics', code: 'CSE423', sem: 'Semester 8', inst: INST, topics: ['Rasterization', 'Transformations', 'Shading'] },
  { kind: 'achievement', group: 'achievement', ring: 1, cat: 'COMMUNITY', title: '90,000+', sub: 'Student community', sem: 'Since 2022', inst: INST, topics: ['Community leadership', 'Online moderation at scale'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'COMPILERS', title: 'Compiler Design', code: 'CSE420', sem: 'Semester 8', inst: INST, topics: ['Lexing and parsing', 'Semantic analysis', 'Code generation'] },
  { kind: 'course', group: 'programming', ring: 2, cat: 'MOBILE', title: 'Android Development', code: 'CSE489', sem: 'Semester 9', inst: INST, topics: ['Kotlin', 'App architecture', 'Device APIs'] },
  { kind: 'course', group: 'math', ring: 0, cat: 'MATHEMATICS', title: 'Discrete Mathematics', code: 'CSE230', sem: 'Semester 2', inst: INST, topics: ['Logic and proofs', 'Combinatorics', 'Graph theory'] },
  { kind: 'course', group: 'math', ring: 1, cat: 'THEORY', title: 'Automata Theory', code: 'CSE331', sem: 'Semester 6', inst: INST, topics: ['Finite automata', 'Grammars', 'Turing machines'] },
  { kind: 'course', group: 'ai', ring: 2, cat: 'PATTERNS', title: 'Pattern Recognition', code: 'CSE424', sem: 'Semester 10', inst: INST, topics: ['Classifiers', 'Clustering', 'Feature selection'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'DIGITAL LOGIC', title: 'Digital Logic', code: 'CSE260', sem: 'Semester 3', inst: INST, topics: ['Boolean algebra', 'Combinational circuits', 'Sequential circuits'] },
  { kind: 'achievement', group: 'achievement', ring: 0, cat: 'LEADERSHIP', title: '500+', sub: 'Event participants', sem: 'Since 2022', inst: INST, topics: ['Event planning', 'Team coordination'] },
  { kind: 'course', group: 'core', ring: 1, cat: 'DATA COMM', title: 'Data Communication', code: 'CSE320', sem: 'Semester 5', inst: INST, topics: ['Signals and encoding', 'Error control', 'Link protocols'] },
  { kind: 'course', group: 'core', ring: 2, cat: 'DISTRIBUTED', title: 'Blockchain', code: 'CSE446', sem: 'Semester 10', inst: INST, topics: ['Distributed ledgers', 'Consensus', 'Smart contracts'] },
  { kind: 'course', group: 'programming', ring: 2, cat: 'ENGINEERING', title: 'Software Engineering', code: 'CSE470', sem: 'Semester 7', inst: INST, topics: ['Requirements', 'Design patterns', 'Testing', 'Agile delivery'] },

  // Milestones — clickable gold beacons, NOT in the auto cycle.
  { kind: 'milestone', group: 'milestone', ring: 3, cat: 'SECONDARY', title: 'SSC', sub: 'Motijheel Govt Boys', year: '2018', sem: '2018', inst: "Motijheel Government Boys' High School", topics: ['Secondary School Certificate'] },
  { kind: 'milestone', group: 'milestone', ring: 3, cat: 'HIGHER SECONDARY', title: 'HSC', sub: 'Birshreshtha Munshi Abdur Rouf', year: '2020', sem: '2020', inst: 'Birshreshtha Munshi Abdur Rouf Public College', topics: ['Higher Secondary Certificate'] },
  { kind: 'milestone', group: 'milestone', ring: 3, cat: 'BRAC UNIVERSITY', title: 'BSc Computer Science', sub: '2022 – 2026', year: '2022', sem: '2022 to 2026', inst: INST, topics: ['Bachelor of Science', 'Computer Science and Engineering'] },
];

export const colorOf = (it: KItem): string => GROUP_COLOR[it.group];

/** Indices that participate in the activation cycle (everything but milestones). */
export const CYCLE_INDICES: number[] = K_ITEMS.map((it, i) => (it.kind === 'milestone' ? -1 : i)).filter((i) => i >= 0);
/** Milestone indices, in orbital order (SSC -> HSC -> BRAC). */
export const MILE_INDICES: number[] = K_ITEMS.map((it, i) => (it.kind === 'milestone' ? i : -1)).filter((i) => i >= 0);

/** Active card -> DOM. env 0..1 drives unfold/fold; px/py = particle screen pos. */
export const saturnBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number;
  color: string;
  focus: number; // chapter focus 0..1, gates the DOM layer
  paused: boolean; // expanded panel open -> hold the cycle
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#cdb384', focus: 0, paused: false };

/** Click-to-expand state (low frequency, fine for React). */
type SaturnUI = {
  selected: number | null;
  setSelected: (i: number | null) => void;
};
let _closeTimer: ReturnType<typeof setTimeout> | null = null;
export const useSaturnUI = create<SaturnUI>((set) => ({
  selected: null,
  setSelected: (i) => {
    if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
    set({ selected: i });
    saturnBridge.paused = i != null;
    if (i != null) {
      _closeTimer = setTimeout(() => {
        _closeTimer = null;
        saturnBridge.paused = false;
        set({ selected: null });
      }, 8000);
    }
  },
}));

/** 1 while parked at the Saturn chapter, 0 elsewhere. */
export function saturnFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.saturn), 0.02, 0.06);
}
