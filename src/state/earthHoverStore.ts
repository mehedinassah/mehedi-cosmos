import * as THREE from 'three';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Shared, render-loop-free bridge between the ONE orbiting probe (in the canvas)
 * and the DOM hologram it projects. The probe writes its own screen position,
 * the card anchor (offset away from Earth), and the mission color; the hologram
 * reads it in its own rAF loop so we never churn React state at 60fps.
 *
 * Direction: not five satellites — one small autonomous probe that visits each
 * region in turn, brakes, faces the camera, and projects the story briefly.
 */

export type Mission = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  color: string; // reserved per mission — never all-green
  lat: number; // geographic home (degrees) the probe visits
  lon: number;
};

// The probe tours these in order; each is a different story, its own color,
// over a different part of the world (aspirational geography — easy to retune).
export const MISSIONS: Mission[] = [
  { key: 'community', title: 'Community', subtitle: 'Community Lead', body: "One of Bangladesh's largest student communities. 90,000+ members.", color: '#3fd8ff', lat: 23.8, lon: 90.4 }, // cyan · Bangladesh
  { key: 'events', title: 'Events', subtitle: '500+ Attendees', body: 'Organized and hosted events with 500+ attendees.', color: '#ffcf5c', lat: -25, lon: 134 }, // gold · Australia
  { key: 'leadership', title: 'Leadership', subtitle: 'Team Lead & Organizer', body: 'Led teams and ran community operations end to end.', color: '#eef2f8', lat: 39, lon: -98 }, // white · N. America
  { key: 'freelancing', title: 'Freelancing', subtitle: 'Verified Upwork Freelancer', body: 'Completed freelance work for international clients.', color: '#b48cff', lat: 50, lon: 10 }, // purple · Europe
  { key: 'education', title: 'Education', subtitle: 'BRAC University', body: 'BSc in Computer Science, 2022 to 2026.', color: '#5aa0ff', lat: 20, lon: 78 }, // blue · South Asia
];

/** Probe -> hologram bridge. px/py = probe screen (beam start); the DOM places
 *  the card in the open gap to the left. color = mission color. */
export const earthHover: {
  active: boolean;
  px: number;
  py: number;
  color: string;
  index: number;
} = { active: false, px: 0, py: 0, color: '#3fd8ff', index: 0 };

/** Earth's live spin (surface rotation.y) so the probe's targets track their
 *  regions — including under drag. Written by Hero, read by the probe. */
export const earthSpin = { y: 0 };

/** 1 while parked at the Earth chapter, 0 elsewhere. Gates all Earth activity. */
export function earthFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.earth), 0.02, 0.06);
}

/** Latitude/longitude (degrees) to a unit direction on the globe. */
export function latLonDir(lat: number, lon: number, out: THREE.Vector3): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return out.set(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ).normalize();
}
