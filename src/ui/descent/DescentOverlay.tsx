'use client';

import { useEffect, useRef, useState } from 'react';
import { useJourneyStore } from '@/state/journeyStore';
import { useDescentStore, DESCENT_CAPTIONS } from '@/state/descentStore';

/**
 * Descent chapter DOM layer — three quiet elements and an input bridge:
 *   1) DescentController — wheel / touch / keys feed the descent progress
 *   2) TitleCard — the galaxy holds the frame ALONE for five seconds, then
 *      the name fades in; it dissolves the moment the dive begins
 *   3) DescentCaption — the distance ladder narrating the way down
 *   4) ArrivalFlash — the white wash that masks the swap into the system
 * Everything is pointer-events: none; the site never feels like a website
 * until the journey has landed.
 */

const WHEEL_TRAVEL_PX = 6500; // full descent in ~6.5k px of wheel
const TOUCH_TRAVEL_PX = 2400;

function DescentController() {
  useEffect(() => {
    const canDescend = () =>
      useJourneyStore.getState().phase === 'IDLE' &&
      useDescentStore.getState().stage !== 'ARRIVED';

    const onWheel = (e: WheelEvent) => {
      if (!canDescend()) return;
      useDescentStore.getState().addScroll(e.deltaY / WHEEL_TRAVEL_PX);
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY == null || y == null || !canDescend()) return;
      useDescentStore.getState().addScroll((touchY - y) / TOUCH_TRAVEL_PX);
      touchY = y;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!canDescend()) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        useDescentStore.getState().addScroll(0.03);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        useDescentStore.getState().addScroll(-0.03);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}

const TITLE_DELAY_MS = 5000;

function TitleCard() {
  const phase = useJourneyStore((s) => s.phase);
  const stage = useDescentStore((s) => s.stage);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (phase === 'IDLE' && stage === 'DORMANT') {
      const t = window.setTimeout(() => setShown(true), TITLE_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    setShown(false);
  }, [phase, stage]);

  if (stage === 'ARRIVED') return null;

  return (
    <div className={`title-card${shown ? ' title-card--visible' : ''}`} aria-hidden={!shown}>
      <h1>Mehedi Hassan</h1>
      <p>Creative Technologist</p>
      <p className="title-card__hint">Scroll to Begin</p>
    </div>
  );
}

function DescentCaption() {
  const idx = useDescentStore((s) => s.captionIndex);
  if (idx < 0) return null;
  const c = DESCENT_CAPTIONS[idx];
  return (
    <div key={idx} className="descent-caption" aria-live="polite">
      <div className="descent-caption__primary">{c.primary}</div>
      <div className="descent-caption__secondary">{c.secondary}</div>
    </div>
  );
}

function ArrivalFlash() {
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');
  const [cls, setCls] = useState('');
  const raf = useRef(0);

  useEffect(() => {
    if (!arrived) return;
    setCls('arrival-flash--on');
    raf.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => setCls('arrival-flash--fade')),
    );
    const done = window.setTimeout(() => setCls(''), 3000);
    return () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(done);
    };
  }, [arrived]);

  if (!cls) return null;
  return <div className={`arrival-flash ${cls}`} aria-hidden="true" />;
}

export function DescentOverlay() {
  return (
    <>
      <DescentController />
      <TitleCard />
      <DescentCaption />
      <ArrivalFlash />
    </>
  );
}
