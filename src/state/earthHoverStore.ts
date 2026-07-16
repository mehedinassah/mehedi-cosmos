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

// REAL world-space orbits around Earth's actual position — so scrolling past is
// natural (the camera just flies by; Earth's sphere occludes ones behind it).
// The orbit PLANE is oriented once against the parked-camera view (tiltA/tiltB
// off the Earth->camera axis) so the rings sit around Earth in the open area
// while parked; the orbit itself stays fixed in world space.
export type Orbit = {
  radius: number; // Earth radii
  tiltA: number; // plane tilt about the parked-camera up (rad)
  tiltB: number; // plane tilt about the parked-camera right (rad)
  phase: number; // start angle (rad)
  speed: number; // rad/s (gentle, real orbital pace)
  dir: 1 | -1;
};

export type Craft = {
  id: string;
  kind: Kind;
  label: string; // short hover tag
  color: string;
  scale: number; // model scale, Earth radii
  orbit: Orbit;
  transmit: boolean; // occasionally projects a card
  title?: string;
  big?: string;
  sub?: string;
  lines?: string[]; // side-panel bullets
};

// Real orbits around Earth. ISS clearly the largest. (No moon — the scene
// already has the real Moon.)
export const CRAFT: Craft[] = [
  {
    id: 'iss', kind: 'iss', label: 'ISS', color: '#eaf1fb', scale: 0.06, transmit: true,
    orbit: { radius: 0.6, tiltA: 0.12, tiltB: -0.08, phase: 0.5, speed: 0.05, dir: 1 },
    title: 'LEADERSHIP', big: 'Team Lead', sub: 'Community · university · teams',
    lines: ['Led a large student developer community', 'Coordinated teams and university projects', 'Collaboration end to end'],
  },
  {
    id: 'commsat', kind: 'commsat', label: 'COMMS', color: '#3fd8ff', scale: 0.055, transmit: true,
    orbit: { radius: 0.8, tiltA: -0.15, tiltB: 0.1, phase: 1.4, speed: 0.07, dir: -1 },
    title: 'COMMUNITY', big: '90,000+', sub: 'Largest BRAC University student community',
    lines: ['90,000+ members', 'Online leadership and social impact', 'Built from the ground up'],
  },
  {
    id: 'cubesat', kind: 'cubesat', label: 'CUBESAT', color: '#5aa0ff', scale: 0.045, transmit: true,
    orbit: { radius: 0.5, tiltA: 0.12, tiltB: 0.08, phase: 2.5, speed: 0.1, dir: 1 },
    title: 'EDUCATION', big: 'BRAC University', sub: 'BSc Computer Science',
    lines: ['BSc Computer Science, 2022–2026', 'Focus on machine learning and systems', 'Research-minded'],
  },
  {
    id: 'weathersat', kind: 'weathersat', label: 'EO SAT', color: '#ffcf5c', scale: 0.058, transmit: true,
    orbit: { radius: 0.72, tiltA: 0.1, tiltB: -0.14, phase: 3.2, speed: 0.06, dir: -1 },
    title: 'EVENTS', big: '500+', sub: 'Students managed · event organization',
    lines: ['500+ attendees managed', 'Planning and organization', 'Large-scale activities'],
  },
  {
    id: 'freelancer', kind: 'freelancer', label: 'RELAY', color: '#b48cff', scale: 0.056, transmit: true,
    orbit: { radius: 0.85, tiltA: -0.12, tiltB: -0.08, phase: 4.0, speed: 0.045, dir: 1 },
    title: 'UPWORK', big: 'Verified Freelancer', sub: 'International clients',
    lines: ['Verified on Upwork', 'International client work', 'Professional delivery'],
  },
  {
    id: 'telescope', kind: 'telescope', label: 'TELESCOPE', color: '#8fe3d0', scale: 0.06, transmit: true,
    orbit: { radius: 0.58, tiltA: -0.14, tiltB: 0.12, phase: 5.0, speed: 0.065, dir: -1 },
    title: 'FUTURE', big: 'AI · Innovation', sub: 'Always learning',
    lines: ['Building with AI', 'Research and innovation', 'The next chapter'],
  },
  {
    id: 'gps-1', kind: 'gps', label: 'GPS', color: '#9fb2c8', scale: 0.05, transmit: false,
    orbit: { radius: 0.9, tiltA: 0.13, tiltB: 0.1, phase: 0.9, speed: 0.05, dir: 1 },
    title: 'NAVIGATION', big: 'GPS', sub: 'Keeping the constellation in sync',
    lines: ['Part of the orbital network'],
  },
  {
    id: 'deb-1', kind: 'debris', label: 'DEBRIS', color: '#8b96a4', scale: 0.03, transmit: false,
    orbit: { radius: 0.45, tiltA: 0.15, tiltB: -0.1, phase: 2.0, speed: 0.11, dir: -1 },
    title: 'EASTER EGG', big: '★', sub: 'A hidden milestone drifts by',
    lines: ['You found a piece of the story.'],
  },
];

/** Indices of the story craft (those with a card), in transmission order. */
export const STORY_INDICES: number[] = CRAFT.map((c, i) => (c.transmit ? i : -1)).filter((i) => i >= 0);

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
let _closeTimer: ReturnType<typeof setTimeout> | null = null;
export const useEarthUI = create<EarthUI>((set) => ({
  hovered: null,
  selected: null,
  setHovered: (i) => set({ hovered: i }),
  // Selecting opens the side panel and arms a 4s self-close (reset on each
  // change). Managed here, outside React, so it can't be defeated by re-renders.
  setSelected: (i) => {
    if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
    set({ selected: i });
    if (i != null) {
      _closeTimer = setTimeout(() => { _closeTimer = null; set({ selected: null }); }, 4000);
    }
  },
}));

/** Earth's live surface rotation (drag-to-spin globe writes this). */
export const earthSpin = { y: 0 };

/** 1 while parked at the Earth chapter, 0 elsewhere. Gates all Earth activity. */
export function earthFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.earth), 0.02, 0.06);
}
