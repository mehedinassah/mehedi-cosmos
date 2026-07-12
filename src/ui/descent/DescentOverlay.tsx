'use client';

import { useEffect, useRef, useState } from 'react';
import { useJourneyStore } from '@/state/journeyStore';
import { useDescentStore, DESCENT_CAPTIONS } from '@/state/descentStore';
import { CHAPTERS } from '@/world/system/systemSpec';

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
const WHEEL_TRAVEL_SYSTEM_PX = 26000; // eleven career chapters: a long ride
const TOUCH_TRAVEL_PX = 2400;
const TOUCH_TRAVEL_SYSTEM_PX = 9500;

function DescentController() {
  useEffect(() => {
    const canScroll = () => useJourneyStore.getState().phase === 'IDLE';
    const arrived = () => useDescentStore.getState().stage === 'ARRIVED';

    const onWheel = (e: WheelEvent) => {
      if (!canScroll()) return;
      useDescentStore
        .getState()
        .addScroll(e.deltaY / (arrived() ? WHEEL_TRAVEL_SYSTEM_PX : WHEEL_TRAVEL_PX));
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY == null || y == null || !canScroll()) return;
      useDescentStore
        .getState()
        .addScroll((touchY - y) / (arrived() ? TOUCH_TRAVEL_SYSTEM_PX : TOUCH_TRAVEL_PX));
      touchY = y;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!canScroll()) return;
      const step = arrived() ? 0.02 : 0.03;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        useDescentStore.getState().addScroll(step);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        useDescentStore.getState().addScroll(-step);
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
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');
  if (arrived || idx < 0) return null;
  const c = DESCENT_CAPTIONS[idx];
  return (
    <div key={idx} className="descent-caption" aria-live="polite">
      <div className="descent-caption__primary">{c.primary}</div>
      <div className="descent-caption__secondary">{c.secondary}</div>
    </div>
  );
}

/** Career chapter panel — the reason the journey exists. One celestial
 *  body, one chapter; quiet typography beside the world it belongs to. */
function ChapterPanel() {
  const idx = useDescentStore((s) => s.sysCaptionIndex);
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');
  if (!arrived || idx < 0) return null;
  const c = CHAPTERS[idx];
  return (
    <aside key={c.id} className="chapter-panel" aria-live="polite">
      <div className="chapter-panel__planet">{c.planet}</div>
      <h2 className="chapter-panel__title">{c.title}</h2>
      {c.body.map((line) => (
        <p key={line} className="chapter-panel__line">
          {line}
        </p>
      ))}
      {c.links && (
        <div className="chapter-panel__links">
          {c.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </aside>
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
      <ChapterPanel />
      <ArrivalFlash />
    </>
  );
}
