import * as THREE from 'three';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Shared, render-loop-free bridge between the 3D Earth and the DOM holographic
 * overlay. The satellites (in the canvas) write which one is hovered, its
 * projected screen position, and its color; the hologram (a DOM layer) reads it
 * in its own rAF loop, so we never churn React state at 60fps.
 *
 * Restraint pass: the satellites are silent tiny objects. NO persistent labels.
 * Each carries a color and a geographic home; its achievement is revealed only
 * on hover, briefly.
 */

export type ImpactSat = {
  key: string;
  title: string;
  body: string;
  color: string; // reserved per achievement — never all-green
  lat: number; // geographic home (degrees)
  lon: number;
};

export const IMPACT_SATS: ImpactSat[] = [
  { key: 'community', title: 'Community', body: '90,000+ members', color: '#3fd8ff', lat: 23.8, lon: 90.4 }, // cyan · Bangladesh
  { key: 'leadership', title: 'Leadership', body: 'Community lead and organizer', color: '#eef4ff', lat: 39, lon: -98 }, // white · N. America
  { key: 'education', title: 'Education', body: 'BSc, BRAC University', color: '#5aa0ff', lat: 20, lon: 78 }, // blue · South Asia
  { key: 'freelance', title: 'Freelancing', body: 'Verified on Upwork', color: '#b48cff', lat: 50, lon: 10 }, // purple · Europe
  { key: 'events', title: 'Events', body: '500+ attendees', color: '#ffcf5c', lat: -27, lon: 134 }, // gold · Australia
];

/** Hover bridge: index (-1 none), screen position, and the hovered color. */
export const earthHover: { index: number; x: number; y: number; color: string } = {
  index: -1,
  x: 0,
  y: 0,
  color: '#3fd8ff',
};

/** Earth's live spin (surface rotation.y), so satellites can orbit WITH their
 *  regions — including under drag. Written by Hero, read by the satellites. */
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
  );
}
