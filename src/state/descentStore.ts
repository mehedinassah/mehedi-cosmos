import { create } from 'zustand';
import { CHAPTERS } from '@/world/system/systemSpec';

/**
 * The journey as a finite state machine.
 *
 * The camera is no longer a free cursor mapped to the wheel. Each destination
 * is a discrete STATE — galaxy hero, then the Sun and every world — and one
 * deliberate scroll commands ONE cinematic journey to the neighbouring state.
 * A transition plays a timed, eased animation (easeInOutCubic) and always
 * lands EXACTLY on a chapter; input is ignored (`navBusy`) until it settles.
 *
 * nav index:  0 = galaxy hero
 *             1 = Sun   (CHAPTERS[0])
 *             k = CHAPTERS[k-1]
 *             LAST = Pluto
 */

export type DescentStage = 'DORMANT' | 'DESCENDING' | 'ARRIVED' | 'LOOPING';

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

const CHAPTER_SP = CHAPTERS.map((c) => c.sp);
export const SUN_SP = CHAPTER_SP[0];
export const LAST_NAV = CHAPTERS.length; // Pluto

// Durations (seconds). The galaxy dive is long and majestic — an impossible
// cosmic distance; the planet hops are a heavy spacecraft coasting to berth.
const DESCENT_DUR = 9.0;
const TRAVEL_DUR = 4.6;
// The loop home: past Pluto, drift into deep space, then the Milky Way
// emerges from the dark and we settle back at the opening — one long,
// unbroken orbit of a much larger journey.
const LOOP_DUR = 16.0;

export const nowS = () =>
  (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export type TweenField = 'dp' | 'sp' | 'loop' | null;

interface DescentState {
  /** Descent progress 0..1 (galaxy -> sun), the value world layers read. */
  smoothed: number;
  /** System progress 0..1 (sp along the rail), the value the camera reads. */
  sysSmoothed: number;
  stage: DescentStage;
  captionIndex: number;
  sysCaptionIndex: number;

  navIndex: number;
  navBusy: boolean;
  /** During LOOPING: 0 = still in the solar system, 1 = the galaxy half. */
  loopHalf: number;

  // Active transition (evaluated by CameraDirector each frame)
  tField: TweenField;
  tFrom: number;
  tTo: number;
  tStart: number;
  tDur: number;

  goNext: () => void;
  goPrev: () => void;
  goTo: (chapterZeroBased: number) => void;
}

export const useDescentStore = create<DescentState>((set, get) => {
  const startSp = (fromIdx: number, toIdx: number, dur = TRAVEL_DUR) => {
    const s = get();
    set({
      navIndex: toIdx,
      navBusy: true,
      tField: 'sp',
      tFrom: s.sysSmoothed,
      tTo: CHAPTER_SP[toIdx - 1],
      tStart: nowS(),
      tDur: dur,
    });
    void fromIdx;
  };

  return {
    smoothed: 0,
    sysSmoothed: 0,
    stage: 'DORMANT',
    captionIndex: -1,
    sysCaptionIndex: -1,
    navIndex: 0,
    navBusy: false,
    loopHalf: 0,
    tField: null,
    tFrom: 0,
    tTo: 0,
    tStart: 0,
    tDur: 0,

    goNext: () => {
      const s = get();
      if (s.navBusy) return;
      if (s.navIndex === LAST_NAV) {
        // Past Pluto: one more scroll begins another orbit — drift out, let
        // the galaxy re-emerge, settle back at the opening. Seamless loop.
        set({
          navBusy: true,
          loopHalf: 0,
          stage: 'LOOPING',
          tField: 'loop',
          tFrom: 0,
          tTo: 1,
          tStart: nowS(),
          tDur: LOOP_DUR,
        });
        return;
      }
      if (s.navIndex === 0) {
        // Galaxy -> Sun: one scroll launches the whole descent cinematic
        set({
          navIndex: 1,
          navBusy: true,
          stage: 'DESCENDING',
          tField: 'dp',
          tFrom: s.smoothed,
          tTo: 1,
          tStart: nowS(),
          tDur: DESCENT_DUR,
        });
      } else {
        startSp(s.navIndex, s.navIndex + 1);
      }
    },

    goPrev: () => {
      const s = get();
      if (s.navBusy || s.navIndex <= 0) return;
      if (s.navIndex === 1) {
        // Sun -> Galaxy: reverse the dive. Un-arrive now; the destination
        // star's flare (smoothed ~ 1) masks the swap back to the galaxy.
        set({
          navIndex: 0,
          navBusy: true,
          stage: 'DESCENDING',
          smoothed: 1,
          tField: 'dp',
          tFrom: 1,
          tTo: 0,
          tStart: nowS(),
          tDur: DESCENT_DUR,
        });
      } else {
        startSp(s.navIndex, s.navIndex - 1);
      }
    },

    goTo: (chapterZeroBased) => {
      const s = get();
      const to = chapterZeroBased + 1;
      if (s.navBusy || s.navIndex === 0 || to === s.navIndex) return;
      // Longer flights for longer jumps, so a Sun->Neptune hop stays coasting
      const dur = TRAVEL_DUR * (0.7 + 0.3 * Math.abs(to - s.navIndex));
      startSp(s.navIndex, to, Math.min(dur, TRAVEL_DUR * 2.4));
    },
  };
});
