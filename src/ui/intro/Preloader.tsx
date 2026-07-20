'use client';

import { useEffect, useState } from 'react';
import { loadSignals } from '@/state/loadSignals';

/**
 * Ignition preloader (concept 1). From the very first server-rendered pixel it
 * is a black field with a single warm point of light gathering energy — this
 * paints BEFORE the WebGL bundle even loads (UniverseCanvas is dynamic/ssr:false,
 * this is not). It reads REAL readiness (loadSignals), and the instant the
 * galaxy is built it IGNITES: the point flares, the black fades, and it hands
 * straight off to the galaxy blooming in underneath. The loader's light becomes
 * the galaxy's core, so there is no cut and no fake progress bar.
 */
export function Preloader() {
  const [phase, setPhase] = useState<'load' | 'ignite' | 'done'>('load');

  // Watch real readiness; ignite when the scene is ready (with a safety cap so
  // the visitor is never trapped behind the loader if a signal never fires).
  useEffect(() => {
    if (phase !== 'load') return;
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      // Reveal only once the galaxy has actually bloomed to (nearly) full. The
      // bloom value advances only as REAL frames render, so it can't cross this
      // threshold until the compile stall has cleared and the finished galaxy is
      // genuinely on screen behind the black — no half-drawn reveal.
      const ready = loadSignals.firstFrame && loadSignals.galaxyReady && loadSignals.galaxyBloom > 0.9;
      if (ready || performance.now() - start > 9000) setPhase('ignite');
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // After the ignition flare + fade, remove the overlay and — now that the
  // galaxy is fully on screen — release the heavy solar system + Sun to mount
  // and compile in the background (well before the visitor scrolls to them).
  useEffect(() => {
    if (phase !== 'ignite') return;
    const id = window.setTimeout(() => {
      loadSignals.revealed = true;
      setPhase('done');
    }, 1700);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div className={`preloader${phase === 'ignite' ? ' preloader--ignite' : ''}`} aria-hidden="true">
      <div className="preloader__field">
        <span className="preloader__wave" />
        <span className="preloader__wave preloader__wave--b" />
        <span className="preloader__ring" />
        <span className="preloader__halo" />
        <span className="preloader__point" />
      </div>
      <div className="preloader__name">Mehedi Hassan</div>
    </div>
  );
}
