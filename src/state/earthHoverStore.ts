import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Earth's orbital ecosystem — data model + render-loop-free bridges.
 *
 * Earth is a living orbital network, not a slideshow. Every craft orbits
 * continuously (unique radius, speed, inclination, DIRECTION); the camera stays
 * perfectly still. Craft occasionally transmit a brief holographic card while
 * they keep moving, and the viewer drives discovery by hovering (brighten +
 * slow + label) and clicking (a side panel) any object. Nothing ever stops.
 *
 * Bridges are plain mutable objects (written every frame in the canvas, read in
 * a DOM rAF loop) so we never churn React at 60fps; discrete hover/select state
 * lives in a tiny zustand store.
 */

export type Kind =
  | 'iss'
  | 'commsat'
  | 'cubesat'
  | 'weathersat'
  | 'freelancer'
  | 'telescope'
  | 'gps'
  | 'debris'
  | 'moon'
  | 'shootingsat';

export type Orbit = {
  radius: number; // Earth radii
  incl: number; // inclination, rad
  raan: number; // ascending-node rotation, rad
  phase: number; // start angle, rad
  speed: number; // rad/s (magnitude)
  dir: 1 | -1; // orbital direction
};

export type Craft = {
  id: string;
  kind: Kind;
  label: string; // short hover tag
  color: string;
  scale: number; // model scale, Earth radii (kept small)
  orbit: Orbit;
  path: boolean; // draw a thin orbit ring
  transmit: boolean; // occasionally projects a card
  // card / side-panel content
  title?: string;
  big?: string;
  sub?: string;
  lines?: string[]; // side-panel bullets
};

// Each craft symbolizes a chapter. Sizes are deliberately small so they read as
// distant spacecraft, not props.
export const CRAFT: Craft[] = [
  {
    id: 'iss', kind: 'iss', label: 'ISS', color: '#eaf1fb', scale: 0.075, path: true, transmit: true,
    orbit: { radius: 1.5, incl: 0.9, raan: 2.2, phase: 1.0, speed: 0.06, dir: 1 },
    title: 'LEADERSHIP', big: 'Team Lead', sub: 'Community · university · teams',
    lines: ['Led a large student developer community', 'Coordinated teams and university projects', 'Collaboration end to end'],
  },
  {
    id: 'commsat', kind: 'commsat', label: 'COMMS', color: '#3fd8ff', scale: 0.03, path: true, transmit: true,
    orbit: { radius: 2.15, incl: 0.5, raan: 0.6, phase: 0.0, speed: 0.05, dir: 1 },
    title: 'COMMUNITY', big: '90,000+', sub: 'Largest BRAC University student community',
    lines: ['90,000+ members', 'Online leadership and social impact', 'Built from the ground up'],
  },
  {
    id: 'cubesat', kind: 'cubesat', label: 'CUBESAT', color: '#5aa0ff', scale: 0.02, path: true, transmit: true,
    orbit: { radius: 1.78, incl: 1.4, raan: 4.0, phase: 2.0, speed: 0.092, dir: -1 },
    title: 'EDUCATION', big: 'BRAC University', sub: 'BSc Computer Science',
    lines: ['BSc Computer Science, 2022–2026', 'Focus on machine learning and systems', 'Research-minded'],
  },
  {
    id: 'weathersat', kind: 'weathersat', label: 'EO SAT', color: '#ffcf5c', scale: 0.028, path: true, transmit: true,
    orbit: { radius: 1.98, incl: 1.65, raan: 1.2, phase: 4.6, speed: 0.07, dir: 1 },
    title: 'EVENTS', big: '500+', sub: 'Students managed · event organization',
    lines: ['500+ attendees managed', 'Planning and organization', 'Large-scale activities'],
  },
  {
    id: 'freelancer', kind: 'freelancer', label: 'RELAY', color: '#b48cff', scale: 0.03, path: true, transmit: true,
    orbit: { radius: 2.5, incl: 0.35, raan: 5.0, phase: 3.4, speed: 0.04, dir: -1 },
    title: 'UPWORK', big: 'Verified Freelancer', sub: 'International clients',
    lines: ['Verified on Upwork', 'International client work', 'Professional delivery'],
  },
  {
    id: 'telescope', kind: 'telescope', label: 'TELESCOPE', color: '#8fe3d0', scale: 0.03, path: true, transmit: true,
    orbit: { radius: 2.85, incl: 1.1, raan: 3.2, phase: 5.6, speed: 0.033, dir: 1 },
    title: 'FUTURE', big: 'AI · Innovation', sub: 'Always learning',
    lines: ['Building with AI', 'Research and innovation', 'The next chapter'],
  },

  // Ambient traffic — hoverable, but no transmission card.
  {
    id: 'gps-1', kind: 'gps', label: 'GPS', color: '#9fb2c8', scale: 0.022, path: false, transmit: false,
    orbit: { radius: 3.25, incl: 0.95, raan: 0.4, phase: 0.7, speed: 0.03, dir: 1 },
    title: 'NAVIGATION', big: 'GPS', sub: 'Keeping the constellation in sync',
    lines: ['Part of the orbital network'],
  },
  {
    id: 'gps-2', kind: 'gps', label: 'GPS', color: '#9fb2c8', scale: 0.022, path: false, transmit: false,
    orbit: { radius: 3.5, incl: 1.15, raan: 2.5, phase: 2.3, speed: 0.027, dir: -1 },
    title: 'NAVIGATION', big: 'GPS', sub: 'Keeping the constellation in sync',
    lines: ['Part of the orbital network'],
  },
  {
    id: 'deb-1', kind: 'debris', label: 'DEBRIS', color: '#7c8794', scale: 0.008, path: false, transmit: false,
    orbit: { radius: 1.62, incl: 0.6, raan: 1.1, phase: 2.7, speed: 0.1, dir: 1 },
    title: 'EASTER EGG', big: '★', sub: 'A hidden milestone drifts by',
    lines: ['You found a piece of the story.'],
  },
  {
    id: 'deb-2', kind: 'debris', label: 'DEBRIS', color: '#7c8794', scale: 0.007, path: false, transmit: false,
    orbit: { radius: 2.25, incl: 1.9, raan: 3.3, phase: 0.4, speed: 0.066, dir: -1 },
    title: 'EASTER EGG', big: '★', sub: 'Another tiny milestone',
    lines: ['Every small thing counts.'],
  },
  {
    id: 'deb-3', kind: 'debris', label: 'DEBRIS', color: '#7c8794', scale: 0.009, path: false, transmit: false,
    orbit: { radius: 2.7, incl: 0.9, raan: 5.5, phase: 4.1, speed: 0.05, dir: 1 },
    title: 'EASTER EGG', big: '★', sub: 'Keep exploring',
    lines: ['Curiosity is the point.'],
  },
  {
    id: 'moon', kind: 'moon', label: 'MOON', color: '#c4c0b6', scale: 0.05, path: true, transmit: false,
    orbit: { radius: 6.4, incl: 0.28, raan: 0.9, phase: 1.5, speed: 0.02, dir: 1 },
    title: 'DISTANT', big: 'Small Moon', sub: 'A quiet companion far out',
    lines: ['A slow, distant orbit.'],
  },
  {
    id: 'shooting', kind: 'shootingsat', label: 'FLYBY', color: '#dfeaff', scale: 0.016, path: false, transmit: false,
    orbit: { radius: 1.35, incl: 1.75, raan: 2.9, phase: 0.0, speed: 0.42, dir: 1 },
    title: 'FLYBY', big: 'Fast Pass', sub: 'A satellite streaks by',
    lines: ['Gone in a moment.'],
  },
];

/** Active transmission -> the DOM card. `env` (0..1) drives pulse/expand/fade;
 *  px/py is the live screen position of the transmitting craft. */
export const orbitBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  color: string;
  env: number; // 0..1 card visibility envelope
} = { active: false, index: 0, px: 0, py: 0, color: '#3fd8ff', env: 0 };

/** Live screen position of the hovered craft, for the DOM hover label. */
export const hoverBridge: { px: number; py: number } = { px: 0, py: 0 };

/** Discrete pointer state (low frequency -> fine for React). */
type EarthUI = {
  hovered: number | null;
  selected: number | null;
  setHovered: (i: number | null) => void;
  setSelected: (i: number | null) => void;
};
export const useEarthUI = create<EarthUI>((set) => ({
  hovered: null,
  selected: null,
  setHovered: (i) => set({ hovered: i }),
  setSelected: (i) => set({ selected: i }),
}));

/** Earth's live surface rotation (drag-to-spin globe writes this). */
export const earthSpin = { y: 0 };

/** 1 while parked at the Earth chapter, 0 elsewhere. Gates all Earth activity. */
export function earthFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.earth), 0.02, 0.06);
}
