'use client';

import { useEffect, useMemo, useState } from 'react';

export type DeviceClass = 'unknown' | 'mobile' | 'desktop';

/**
 * Live device classification. Phones and small/coarse-pointer screens are
 * classed 'mobile' so the heavy WebGL universe never mounts there — they get
 * the gate instead. Re-evaluates on resize/orientation change.
 *
 * Starts 'unknown' (matches SSR) and resolves after mount, so desktop still
 * renders the full shell immediately with no hydration mismatch.
 */
export function useDeviceClass(): DeviceClass {
  const [device, setDevice] = useState<DeviceClass>('unknown');

  useEffect(() => {
    // Phones in either orientation (coarse pointer) up to tablet-ish widths,
    // or any genuinely narrow viewport.
    const mq = window.matchMedia(
      '(max-width: 820px), (pointer: coarse) and (max-width: 1024px)',
    );
    const update = () => setDevice(mq.matches ? 'mobile' : 'desktop');
    update();
    mq.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return device;
}

/** Build a `box-shadow` string of N randomly-placed star dots. */
function starShadow(count: number, range: number): string {
  const dots: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(Math.random() * range);
    const y = Math.round(Math.random() * range);
    const a = (0.35 + Math.random() * 0.65).toFixed(2);
    dots.push(`${x}px ${y}px rgba(255,255,255,${a})`);
  }
  return dots.join(', ');
}

/**
 * Full-screen "please visit on desktop" gate. Shown instead of the universe on
 * phones. Pure CSS/SVG cosmos behind it — a lensing black hole over a drifting
 * starfield — so it stays light even on old phones (no WebGL).
 */
export function MobileGate() {
  // Random each mount; memoized so re-renders don't reshuffle the sky.
  const farStars = useMemo(() => starShadow(90, 1600), []);
  const nearStars = useMemo(() => starShadow(45, 1600), []);

  return (
    <div className="mobile-gate" role="alert">
      <div className="mobile-gate__space" aria-hidden="true">
        <div className="stars stars--far" style={{ boxShadow: farStars }} />
        <div className="stars stars--near" style={{ boxShadow: nearStars }} />
        <div className="bh">
          <div className="bh__glow" />
          <div className="bh__disk" />
          <div className="bh__disk bh__disk--rev" />
          <div className="bh__core" />
        </div>
      </div>

      <div className="mobile-gate__inner">
        <h1 className="mobile-gate__title">Well… this is awkward.</h1>
        <p className="mobile-gate__body">
          I built this portfolio for desktops, not tiny screens.
        </p>
        <p className="mobile-gate__cta">
          If you want the full cinematic space journey, open it on your{' '}
          <strong>laptop or desktop</strong>.
        </p>
        <p className="mobile-gate__wink">I&apos;m still working on the mobile version.</p>
        <p className="mobile-gate__signature">— Mehedi</p>
      </div>
    </div>
  );
}
