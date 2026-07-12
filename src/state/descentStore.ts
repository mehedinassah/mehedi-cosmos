import { create } from 'zustand';

/**
 * Descent chapter state — the scroll-driven dive from the galaxy hero into
 * the beacon arm, ending at the star that becomes the solar system.
 *
 * `target` accumulates raw scroll input; `smoothed` is the frame-damped
 * value the camera and world layers actually read (written by
 * CameraDirector's rig each frame). The descent is fully reversible until
 * the moment of arrival.
 */

export type DescentStage = 'DORMANT' | 'DESCENDING' | 'ARRIVED';

/** Distance ladder shown as the dive deepens. Poetic, not astrometric. */
export const DESCENT_CAPTIONS: { at: number; primary: string; secondary: string }[] = [
  { at: 0.03, primary: '500,000 light-years', secondary: 'the Milky Way' },
  { at: 0.18, primary: '200,000 light-years', secondary: 'dust lanes resolve' },
  { at: 0.34, primary: '100,000 light-years', secondary: 'nebulae surface from the dark' },
  { at: 0.5, primary: '50,000 light-years', secondary: 'star clusters ignite' },
  { at: 0.66, primary: '20,000 light-years', secondary: 'stars become individuals' },
  { at: 0.8, primary: '5,000 light-years', secondary: 'constellations take shape' },
  { at: 0.9, primary: '500 light-years', secondary: 'one star grows brighter' },
];

interface DescentState {
  /** Scroll-accumulated destination progress, 0..1. */
  target: number;
  /** Frame-damped progress every camera/world consumer reads. */
  smoothed: number;
  stage: DescentStage;
  /** Index into DESCENT_CAPTIONS, -1 when no caption is showing. */
  captionIndex: number;
  /** Solar-system chapter progress (post-arrival), same target/smoothed split. */
  sysTarget: number;
  sysSmoothed: number;
  /** Index into SYSTEM_CAPTIONS (systemSpec.ts), -1 when none. */
  sysCaptionIndex: number;
  addScroll: (delta: number) => void;
}

export const useDescentStore = create<DescentState>((set, get) => ({
  target: 0,
  smoothed: 0,
  stage: 'DORMANT',
  captionIndex: -1,
  sysTarget: 0,
  sysSmoothed: 0,
  sysCaptionIndex: -1,

  addScroll: (delta) => {
    const { stage, target, sysTarget } = get();
    if (stage === 'ARRIVED') {
      // Post-arrival, the same gesture travels outward through the system
      set({ sysTarget: Math.min(1, Math.max(0, sysTarget + delta)) });
      return;
    }
    const next = Math.min(1, Math.max(0, target + delta));
    set({ target: next, stage: next > 0 ? 'DESCENDING' : 'DORMANT' });
  },
}));
