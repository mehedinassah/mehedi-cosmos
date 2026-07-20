'use client';

import { useEffect, useRef, useState } from 'react';
import { useJourneyStore } from '@/state/journeyStore';
import { useDescentStore, DESCENT_CAPTIONS, nowS } from '@/state/descentStore';
import { CHAPTERS } from '@/world/system/systemSpec';
import { EarthHologram } from '@/ui/descent/EarthHologram';
import { HoverLabel, OrbitPanel } from '@/ui/descent/EarthOrbitUI';
import { KnowledgeCard, SaturnExpand } from '@/ui/descent/SaturnOverlay';
import { SkillCard } from '@/ui/descent/VenusOverlay';
import { UranusCard } from '@/ui/descent/UranusOverlay';
import { MissionLog } from '@/ui/descent/MarsOverlay';
import { portalDive } from '@/state/portalDive';

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

// One deliberate gesture = one destination. Accumulate wheel/touch delta to a
// threshold, fire a single step, then latch until the transition finishes AND
// a short cooldown clears the inertial tail of the same flick.
const WHEEL_THRESHOLD = 40;
const TOUCH_THRESHOLD = 60;
const COOLDOWN_S = 0.45;

function DescentController() {
  useEffect(() => {
    const canScroll = () => useJourneyStore.getState().phase === 'IDLE';
    let accum = 0;
    let lastStep = 0;
    let decayTimer = 0;

    // A step is accepted only when the ship is idle at a chapter: not mid
    // journey (navBusy) and past the cooldown that swallows a flick's tail.
    const ready = () => {
      const s = useDescentStore.getState();
      return canScroll() && !s.navBusy && nowS() - lastStep > COOLDOWN_S;
    };
    const step = (dir: number) => {
      accum = 0;
      lastStep = nowS();
      if (dir > 0) useDescentStore.getState().goNext();
      else useDescentStore.getState().goPrev();
    };

    const onWheel = (e: WheelEvent) => {
      if (useDescentStore.getState().navBusy || !canScroll()) return;
      accum += e.deltaY;
      window.clearTimeout(decayTimer);
      decayTimer = window.setTimeout(() => { accum = 0; }, 160);
      if (!ready()) return;
      if (accum > WHEEL_THRESHOLD) step(1);
      else if (accum < -WHEEL_THRESHOLD) step(-1);
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
      accum = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY == null || y == null || !canScroll()) return;
      accum += touchY - y;
      touchY = y;
      if (!ready()) return;
      if (accum > TOUCH_THRESHOLD) step(1);
      else if (accum < -TOUCH_THRESHOLD) step(-1);
    };
    const onTouchEnd = () => { touchY = null; accum = 0; };

    const onKey = (e: KeyboardEvent) => {
      if (!ready()) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') step(1);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') step(-1);
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(decayTimer);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}

const TITLE_DELAY_MS = 900; // appears promptly, still eases in (premium, no pop)

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
      <p>Developer</p>
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

/** Radio-transmission reveal: the letters arrive one by one, fast (~38ms
 *  each, NASA telemetry), with a blinking caret until the line completes.
 *  Restarts whenever the text changes (each chapter remounts the panel). */
function TypeReveal({ text, className }: { text: string; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, 38);
    return () => window.clearInterval(id);
  }, [text]);
  const done = n >= text.length;
  return (
    <span className={className}>
      {text.slice(0, n)}
      {!done && <span className="type-caret" aria-hidden="true" />}
    </span>
  );
}

/** Career chapter panel — the reason the journey exists. One celestial
 *  body, one chapter; quiet typography beside the world it belongs to.
 *  Each world's signature color tints its label and link underlines. */
function ChapterPanel() {
  const idx = useDescentStore((s) => s.sysCaptionIndex);
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');
  if (!arrived || idx < 0) return null;
  const c = CHAPTERS[idx];
  return (
    <aside
      key={c.id}
      className="chapter-panel"
      aria-live="polite"
      style={{ '--accent': c.accent } as React.CSSProperties}
    >
      <div className="chapter-panel__planet">
        <span className="chapter-panel__pip" aria-hidden="true" />
        {c.planet}
        <span className="chapter-panel__au">{c.au}</span>
      </div>
      <h2 className="chapter-panel__title">
        <TypeReveal text={c.title} />
      </h2>
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

/** The navigation rail — every celestial body, pip-marked in its signature
 *  color. Click a world and the ship simply flies there: the click only
 *  moves the scroll target, so the journey stays one continuous glide.
 *  On arrival the rings fade in one by one and a brief hint teaches the
 *  interaction, then gets out of the way. */
function PlanetMenu() {
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');
  const idx = useDescentStore((s) => s.sysCaptionIndex);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    if (!arrived) return;
    const t = window.setTimeout(() => setHint(false), 6500);
    return () => window.clearTimeout(t);
  }, [arrived]);

  if (!arrived) return null;
  return (
    <nav className="planet-menu" aria-label="Journey chapters">
      {CHAPTERS.map((c, k) => (
        <button
          key={c.id}
          type="button"
          className={`planet-menu__item${k === idx ? ' planet-menu__item--active' : ''}`}
          style={{ '--accent': c.accent, animationDelay: `${1.2 + k * 0.14}s` } as React.CSSProperties}
          onClick={() => useDescentStore.getState().goTo(k)}
          aria-label={`${c.title} — ${c.planet}`}
        >
          <span className="planet-menu__ring" aria-hidden="true" />
          <span className="planet-menu__info">
            <span className="planet-menu__title">
              <span className="planet-menu__pip" aria-hidden="true" />
              {c.title}
            </span>
            <span className="planet-menu__au">
              {c.planet} · {c.au}
            </span>
          </span>
        </button>
      ))}
      {hint && <div className="planet-menu__hint">Scroll to travel to the next world · click a ring to fly there</div>}
    </nav>
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

/** Jupiter portal dive — NOT a fade to black. A brief wash of LIGHT over the
 *  final beat of the fall: the throat fills with light in the canvas, and this
 *  covers the DOM panels the same way, so the last frame is a bright seam that
 *  the Perico page load resolves out of (no black, no spinner). Driven off the
 *  module ref. */
function PortalFade() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const sstep = (x: number, a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const loop = () => {
      const el = ref.current;
      if (el) el.style.opacity = String(portalDive.active ? sstep(portalDive.t, 0.9, 1.0) : 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, background: '#faf9f7', opacity: 0, zIndex: 9999, pointerEvents: 'none' }}
    />
  );
}

/** During the portal dive the on-screen chrome (chapter panel, nav rail) must
 *  not bleed through the storm — it fades out fast the instant the fall begins,
 *  well before the light seam, so the frame is purely the dive. */
function DiveDimmable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const sstep = (x: number, a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const loop = () => {
      const el = ref.current;
      if (el) {
        const dim = portalDive.active ? sstep(portalDive.t, 0.04, 0.22) : 0;
        el.style.opacity = String(1 - dim);
        el.style.pointerEvents = dim > 0.5 ? 'none' : '';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref}>{children}</div>;
}

export function DescentOverlay() {
  return (
    <>
      <DescentController />
      <TitleCard />
      <DescentCaption />
      <DiveDimmable>
        <PlanetMenu />
        <ChapterPanel />
      </DiveDimmable>
      <EarthHologram />
      <HoverLabel />
      <OrbitPanel />
      <KnowledgeCard />
      <SaturnExpand />
      <SkillCard />
      <UranusCard />
      <MissionLog />
      <ArrivalFlash />
      <PortalFade />
    </>
  );
}
