import * as THREE from 'three';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Shared, render-loop-free bridge between the 3D Earth (impact satellites) and
 * the DOM holographic overlay. The satellites (in the canvas) write which one
 * is hovered and its projected screen position; the hologram (a DOM layer)
 * reads it in its own rAF loop, so we never churn React state at 60fps.
 */

export type ImpactDetail = { big: string; small: string; title: string; body: string };

// One per orbiting satellite. big/small drive the label; title/body the hologram.
export const IMPACT_DETAILS: ImpactDetail[] = [
  {
    big: '90K+',
    small: 'COMMUNITY',
    title: 'Community Leader',
    body: "One of Bangladesh's largest student communities. 90,000+ members and growing.",
  },
  {
    big: '500+',
    small: 'ATTENDEES',
    title: 'Events',
    body: 'Organized and hosted events with 500+ attendees.',
  },
  {
    big: 'VERIFIED',
    small: 'UPWORK',
    title: 'Verified Freelancer',
    body: 'Verified on Upwork. Client work delivered end to end.',
  },
  {
    big: 'BRACU',
    small: 'LEADERSHIP',
    title: 'BRAC University',
    body: 'Computer Science, 2022 to 2026. Community lead and organizer.',
  },
];

/** index = which satellite is hovered (-1 none); x,y = its screen position. */
export const earthHover: { index: number; x: number; y: number } = { index: -1, x: 0, y: 0 };

/** 1 while parked at the Earth chapter, 0 elsewhere. Gates all Earth interactivity. */
export function earthFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.earth), 0.02, 0.06);
}
