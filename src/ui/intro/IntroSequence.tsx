'use client';

import { useEffect } from 'react';
import { useUiStore, type IntroPhase } from '@/state/uiStore';
import { useJourneyStore } from '@/state/journeyStore';
import { useQualityStore } from '@/state/qualityStore';
import { universe } from '@/content/universe';

/**
 * Intro driver — blueprint §13 L1. Darkness → particle → formation →
 * identity → handoff. No spinner, no logo, no text.
 * Skip-on-return per §17.4 (session-stored).
 */
const SKIP_KEY = 'cosmos.visited';

export function IntroSequence() {
  const setIntroPhase = useUiStore((s) => s.setIntroPhase);

  useEffect(() => {
    const journey = useJourneyStore.getState();
    const reduced = useQualityStore.getState().reducedMotion;
    const returning = universe.intro.skipOnReturn && sessionStorage.getItem(SKIP_KEY) === '1';
    sessionStorage.setItem(SKIP_KEY, '1');

    const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|mobile/i.test(navigator.userAgent);
    const total = returning || reduced ? 1.2 : isMobile ? universe.intro.mobileDurationS : universe.intro.desktopDurationS;

    const schedule: [IntroPhase, number][] = [
      ['DARKNESS', 0],
      ['PARTICLE', total * 0.08],
      ['FORMATION', total * 0.2],
      ['IDENTITY', total * 0.72],
      ['HANDOFF', total * 0.92],
      ['DONE', total],
    ];

    const timers = schedule.map(([phase, at]) =>
      window.setTimeout(() => {
        setIntroPhase(phase);
        if (phase === 'DONE') journey.transition('IDLE');
      }, at * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [setIntroPhase]);

  return null;
}
