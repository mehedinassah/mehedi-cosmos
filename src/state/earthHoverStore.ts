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

// Orbits live in CAMERA/SCREEN space so every craft stays inside the frame: each
// loops on a small ellipse positioned in the open area of the frustum (left of
// Earth), just in front of the planet. Fractions are of the frustum size at
// Earth's depth; fx/fy are the ellipse-center offset (negative fx = left).
export type Orbit = {
  fx: number; // ellipse-center x, fraction of half-width (- = left of view center)
  fy: number; // ellipse-center y, fraction of half-height
  rx: number; // ellipse radius x, fraction of half-height
  ry: number; // ellipse radius y, fraction of half-height
  speed: number; // rad/s
  dir: 1 | -1;
  phase: number;
  tilt: number; // small depth bob for a 3D feel
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

// A tighter cast, all kept on-screen, ISS clearly the largest.
export const CRAFT: Craft[] = [
  {
    id: 'iss', kind: 'iss', label: 'ISS', color: '#eaf1fb', scale: 0.12, transmit: true,
    orbit: { fx: -0.16, fy: -0.02, rx: 0.28, ry: 0.22, speed: 0.13, dir: 1, phase: 0.3, tilt: 0.6 },
    title: 'LEADERSHIP', big: 'Team Lead', sub: 'Community · university · teams',
    lines: ['Led a large student developer community', 'Coordinated teams and university projects', 'Collaboration end to end'],
  },
  {
    id: 'commsat', kind: 'commsat', label: 'COMMS', color: '#3fd8ff', scale: 0.055, transmit: true,
    orbit: { fx: -0.5, fy: 0.52, rx: 0.16, ry: 0.14, speed: 0.2, dir: -1, phase: 1.1, tilt: 0.5 },
    title: 'COMMUNITY', big: '90,000+', sub: 'Largest BRAC University student community',
    lines: ['90,000+ members', 'Online leadership and social impact', 'Built from the ground up'],
  },
  {
    id: 'cubesat', kind: 'cubesat', label: 'CUBESAT', color: '#5aa0ff', scale: 0.045, transmit: true,
    orbit: { fx: -0.3, fy: -0.5, rx: 0.14, ry: 0.12, speed: 0.28, dir: 1, phase: 2.2, tilt: 0.4 },
    title: 'EDUCATION', big: 'BRAC University', sub: 'BSc Computer Science',
    lines: ['BSc Computer Science, 2022–2026', 'Focus on machine learning and systems', 'Research-minded'],
  },
  {
    id: 'weathersat', kind: 'weathersat', label: 'EO SAT', color: '#ffcf5c', scale: 0.058, transmit: true,
    orbit: { fx: 0.04, fy: 0.58, rx: 0.18, ry: 0.15, speed: 0.18, dir: -1, phase: 3.0, tilt: 0.5 },
    title: 'EVENTS', big: '500+', sub: 'Students managed · event organization',
    lines: ['500+ attendees managed', 'Planning and organization', 'Large-scale activities'],
  },
  {
    id: 'freelancer', kind: 'freelancer', label: 'RELAY', color: '#b48cff', scale: 0.056, transmit: true,
    orbit: { fx: -0.28, fy: 0.14, rx: 0.15, ry: 0.16, speed: 0.15, dir: 1, phase: 4.1, tilt: 0.5 },
    title: 'UPWORK', big: 'Verified Freelancer', sub: 'International clients',
    lines: ['Verified on Upwork', 'International client work', 'Professional delivery'],
  },
  {
    id: 'telescope', kind: 'telescope', label: 'TELESCOPE', color: '#8fe3d0', scale: 0.06, transmit: true,
    orbit: { fx: -0.34, fy: 0.66, rx: 0.15, ry: 0.13, speed: 0.17, dir: -1, phase: 5.0, tilt: 0.5 },
    title: 'FUTURE', big: 'AI · Innovation', sub: 'Always learning',
    lines: ['Building with AI', 'Research and innovation', 'The next chapter'],
  },
  {
    id: 'gps-1', kind: 'gps', label: 'GPS', color: '#9fb2c8', scale: 0.05, transmit: false,
    orbit: { fx: -0.4, fy: -0.72, rx: 0.14, ry: 0.12, speed: 0.23, dir: 1, phase: 0.9, tilt: 0.4 },
    title: 'NAVIGATION', big: 'GPS', sub: 'Keeping the constellation in sync',
    lines: ['Part of the orbital network'],
  },
  {
    id: 'deb-1', kind: 'debris', label: 'DEBRIS', color: '#8b96a4', scale: 0.03, transmit: false,
    orbit: { fx: 0.12, fy: -0.5, rx: 0.12, ry: 0.1, speed: 0.3, dir: -1, phase: 2.7, tilt: 0.3 },
    title: 'EASTER EGG', big: '★', sub: 'A hidden milestone drifts by',
    lines: ['You found a piece of the story.'],
  },
  {
    id: 'moon', kind: 'moon', label: 'MOON', color: '#c4c0b6', scale: 0.075, transmit: false,
    orbit: { fx: -0.24, fy: -0.24, rx: 0.09, ry: 0.09, speed: 0.06, dir: 1, phase: 1.6, tilt: 0.2 },
    title: 'DISTANT', big: 'Small Moon', sub: 'A quiet companion',
    lines: ['A slow, distant orbit.'],
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
