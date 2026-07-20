import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Uranus — "Beyond Code". The human side, kept deliberately quiet: six interests
 * drift as small line-icon satellites around the ice giant. Nothing flashy —
 * they orbit slowly in a soft blue aurora, and hovering one lifts a small glass
 * card with the details already listed in the chapter panel. The panel carries
 * the 5-second read; the orbit is just the calm, humanising visual.
 *
 * `uranusBridge` is a plain mutable object written every frame in the canvas and
 * read in a DOM rAF loop (UranusOverlay), so React never churns at 60fps.
 */

export type IconKind = 'ball' | 'film' | 'compass' | 'controller' | 'note' | 'cup';

export type Interest = {
  name: string;
  kind: IconKind;
  tags: string[];
  color: string;
  spin: boolean; // hover reaction: the icon slowly rotates (reads well for reel/compass)
};

// Order mirrors the chapter panel exactly, so hovering a satellite surfaces the
// same category the recruiter is reading on the left.
export const INTERESTS: Interest[] = [
  { name: 'Football', kind: 'ball', tags: ['Argentina', 'FC Barcelona'], color: '#a9d4da', spin: false },
  { name: 'Movies & Series', kind: 'film', tags: ['Psychological thrillers', 'Sci-fi'], color: '#bcd4ff', spin: true },
  { name: 'Anime', kind: 'compass', tags: ['One Piece'], color: '#8fe6ee', spin: true },
  { name: 'Gaming', kind: 'controller', tags: ['Open-world', 'RPG'], color: '#c9b6e6', spin: false },
  { name: 'Music', kind: 'note', tags: ['Bangla', 'Hindi', 'English'], color: '#9fd8c2', spin: false },
  { name: 'Tea', kind: 'cup', tags: ['Always'], color: '#e2c79a', spin: false },
];

/** Active interest (hovered) -> DOM card. Mutated per frame in the canvas. */
export const uranusBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number; // 0..1 hover presence, drives the card fade
  color: string;
  focus: number; // chapter focus 0..1, gates the DOM layer
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#a9d4da', focus: 0 };

/** Discrete hover state (low frequency -> fine for React reads). */
type UranusUI = {
  hovered: number | null;
  setHovered: (i: number | null) => void;
};
export const useUranusUI = create<UranusUI>((set) => ({
  hovered: null,
  setHovered: (i) => set({ hovered: i }),
}));

/** 1 while parked at the Uranus chapter, 0 elsewhere. Gates all Uranus activity. */
export function uranusFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.uranus), 0.02, 0.06);
}
