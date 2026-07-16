import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Saturn — the Knowledge Archive.
 *
 * "Every orbit is a semester. Every particle is a lesson." The rings are three
 * knowledge STREAMS (foundations / core / specializations) of hundreds of tiny
 * particles; one at a time brightens, drifts outward and unfolds into a small
 * card, then folds back. Larger milestone objects (SSC / HSC / University)
 * orbit farther out, synchronized with a small timeline. Calm, organized,
 * scientific: warm ivory, sand, soft gold, a tiny cyan accent. Clicking a card
 * expands the full academic record.
 *
 * Bridges are plain mutable objects (canvas writes every frame, DOM reads in
 * its own rAF) so React never churns at 60fps.
 */

export type KKind = 'course' | 'achievement' | 'milestone';

export type KItem = {
  kind: KKind;
  ring: 0 | 1 | 2 | 3; // 0..2 = knowledge streams, 3 = milestone orbit
  cat: string; // small-caps category line
  title: string; // concise — recognition, not explanation
  sub?: string; // third line (kept short)
  accent?: string; // specialization tint (muted, never neon)
  // expanded record (shown only on click)
  code?: string;
  inst?: string;
  sem?: string;
  topics?: string[];
  year?: '2018' | '2020' | '2022'; // milestone -> timeline dot
};

const INST = 'BRAC University';

// Curated activation order: mostly courses, milestones and achievements
// arriving occasionally so they feel like discoveries.
export const K_ITEMS: KItem[] = [
  // --- foundations (inner stream) ---
  { kind: 'course', ring: 0, cat: 'PROGRAMMING', title: 'Programming', sub: 'Language I', code: 'CSE110', inst: INST, sem: 'Semester 1', topics: ['Variables and control flow', 'Functions', 'Problem decomposition'] },
  { kind: 'course', ring: 1, cat: 'SYSTEMS', title: 'Operating Systems', code: 'CSE321', inst: INST, sem: 'Semester 6', topics: ['Processes and threads', 'Scheduling', 'Memory management', 'File systems'] },
  { kind: 'course', ring: 2, cat: 'AI', title: 'Artificial Intelligence', accent: '#8fd8c8', code: 'CSE422', inst: INST, sem: 'Spring 2025', topics: ['Search algorithms', 'Knowledge representation', 'Machine learning basics', 'Optimization'] },
  { kind: 'course', ring: 0, cat: 'PROGRAMMING', title: 'Programming II', sub: 'Object oriented', code: 'CSE111', inst: INST, sem: 'Semester 2', topics: ['Classes and objects', 'Inheritance', 'Polymorphism'] },
  { kind: 'milestone', ring: 3, cat: 'SECONDARY', title: "Motijheel Govt Boys'", sub: 'SSC · 2018', year: '2018', inst: "Motijheel Government Boys' High School", sem: 'SSC, 2018' },
  { kind: 'course', ring: 1, cat: 'DATABASES', title: 'Database Systems', code: 'CSE370', inst: INST, sem: 'Semester 5', topics: ['Relational modeling', 'SQL', 'Normalization', 'Transactions'] },
  { kind: 'course', ring: 2, cat: 'ML', title: 'Machine Learning', accent: '#a8c8e8', code: 'CSE427', inst: INST, sem: 'Semester 9', topics: ['Supervised learning', 'Neural networks', 'Model evaluation'] },
  { kind: 'course', ring: 0, cat: 'FOUNDATION', title: 'Data Structures', code: 'CSE220', inst: INST, sem: 'Semester 3', topics: ['Lists, stacks, queues', 'Trees and graphs', 'Hashing'] },
  { kind: 'achievement', ring: 2, cat: 'RESEARCH', title: 'Smart OCR', sub: 'Thesis', inst: INST, sem: 'Final year', topics: ['Bangla handwriting recognition', 'Document restoration', 'Deep learning pipeline'] },
  { kind: 'course', ring: 1, cat: 'NETWORKING', title: 'Computer Networks', code: 'CSE421', inst: INST, sem: 'Semester 8', topics: ['TCP/IP', 'Routing', 'Application protocols'] },
  { kind: 'course', ring: 2, cat: 'VISION', title: 'Image Processing', accent: '#d8a88f', code: 'CSE428', inst: INST, sem: 'Semester 9', topics: ['Filtering', 'Segmentation', 'Feature extraction'] },
  { kind: 'milestone', ring: 3, cat: 'HIGH SCHOOL', title: 'Birshreshtha Munshi Abdur Rouf', sub: 'HSC · 2020', year: '2020', inst: 'Birshreshtha Munshi Abdur Rouf Public College', sem: 'HSC, 2020' },
  { kind: 'course', ring: 0, cat: 'FOUNDATION', title: 'Algorithms', code: 'CSE221', inst: INST, sem: 'Semester 4', topics: ['Divide and conquer', 'Greedy methods', 'Dynamic programming', 'Complexity'] },
  { kind: 'course', ring: 1, cat: 'ARCHITECTURE', title: 'Computer Architecture', code: 'CSE340', inst: INST, sem: 'Semester 5', topics: ['ISA design', 'Pipelining', 'Memory hierarchy'] },
  { kind: 'course', ring: 2, cat: 'GRAPHICS', title: 'Computer Graphics', accent: '#e8c88f', code: 'CSE423', inst: INST, sem: 'Semester 8', topics: ['Rasterization', 'Transformations', 'Shading'] },
  { kind: 'achievement', ring: 1, cat: 'COMMUNITY', title: '90,000+', sub: 'Student community', inst: INST, sem: 'Since 2022', topics: ['Community leadership', 'Online moderation at scale'] },
  { kind: 'course', ring: 1, cat: 'COMPILERS', title: 'Compiler Design', code: 'CSE420', inst: INST, sem: 'Semester 8', topics: ['Lexing and parsing', 'Semantic analysis', 'Code generation'] },
  { kind: 'course', ring: 2, cat: 'MOBILE', title: 'Android Development', accent: '#a8d8a0', code: 'CSE489', inst: INST, sem: 'Semester 9', topics: ['Kotlin', 'App architecture', 'Device APIs'] },
  { kind: 'milestone', ring: 3, cat: 'BRAC UNIVERSITY', title: 'BSc Computer Science', sub: '2022 – 2026', year: '2022', inst: INST, sem: '2022 to 2026' },
  { kind: 'course', ring: 0, cat: 'MATHEMATICS', title: 'Discrete Mathematics', code: 'CSE230', inst: INST, sem: 'Semester 2', topics: ['Logic and proofs', 'Combinatorics', 'Graph theory'] },
  { kind: 'course', ring: 1, cat: 'AUTOMATA', title: 'Automata Theory', code: 'CSE331', inst: INST, sem: 'Semester 6', topics: ['Finite automata', 'Grammars', 'Turing machines'] },
  { kind: 'course', ring: 2, cat: 'PATTERNS', title: 'Pattern Recognition', accent: '#c8b8e0', code: 'CSE424', inst: INST, sem: 'Semester 10', topics: ['Classifiers', 'Clustering', 'Feature selection'] },
  { kind: 'course', ring: 1, cat: 'DIGITAL LOGIC', title: 'Digital Logic', code: 'CSE260', inst: INST, sem: 'Semester 3', topics: ['Boolean algebra', 'Combinational circuits', 'Sequential circuits'] },
  { kind: 'achievement', ring: 0, cat: 'LEADERSHIP', title: '500+', sub: 'Event participants', inst: INST, sem: 'Since 2022', topics: ['Event planning', 'Team coordination'] },
  { kind: 'course', ring: 1, cat: 'DATA COMM', title: 'Data Communication', code: 'CSE320', inst: INST, sem: 'Semester 5', topics: ['Signals and encoding', 'Error control', 'Link protocols'] },
  { kind: 'course', ring: 2, cat: 'BLOCKCHAIN', title: 'Blockchain', accent: '#d8bf8f', code: 'CSE446', inst: INST, sem: 'Semester 10', topics: ['Distributed ledgers', 'Consensus', 'Smart contracts'] },
  { kind: 'course', ring: 2, cat: 'ENGINEERING', title: 'Software Engineering', accent: '#cfc4a8', code: 'CSE470', inst: INST, sem: 'Semester 7', topics: ['Requirements', 'Design patterns', 'Testing', 'Agile delivery'] },
];

/** Active card -> DOM. env 0..1 drives unfold/fold; px/py = particle screen pos. */
export const saturnBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number;
  focus: number; // chapter focus 0..1, gates the DOM layer
  paused: boolean; // expanded panel open -> hold the cycle
  milestone: '' | '2018' | '2020' | '2022'; // lights the timeline dot
} = { active: false, index: 0, px: 0, py: 0, env: 0, focus: 0, paused: false, milestone: '' };

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
