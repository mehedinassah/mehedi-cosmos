'use client';

import { useEffect, useMemo, useState } from 'react';

export type DeviceClass = 'unknown' | 'mobile' | 'desktop';

/**
 * Drop-in photoreal background. When you have a Midjourney (or other) black-hole
 * render, save it to `public/gate-blackhole.jpg` and set this to `true` — the
 * CSS black hole is instantly replaced by your image (Ken Burns drift + the
 * star overlay stay). Change the path here if you use a different filename.
 */
const USE_HERO_IMAGE = false;
const HERO_IMAGE_SRC = '/gate-blackhole.jpg';

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

/* ── Line icons (typographic, stroke-only, amber-tinted) ── */

function SaturnIcon() {
  return (
    <svg className="gate-saturn" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="8.2" stroke="currentColor" strokeWidth="1.4" />
      <ellipse
        cx="20"
        cy="20"
        rx="16"
        ry="5.4"
        stroke="currentColor"
        strokeWidth="1.4"
        transform="rotate(-24 20 20)"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="gate-dev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" stroke="currentColor" strokeWidth="1.4" />
      <line x1="10.6" y1="18.4" x2="13.4" y2="18.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LaptopIcon() {
  return (
    <svg className="gate-dev" viewBox="0 0 30 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="20" height="13" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 20.5h26" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Full-screen "please visit on desktop" gate for phones. Pure CSS/SVG cosmos
 * (lensing black hole over a drifting starfield) — no WebGL, so it stays light
 * on any phone. Layout mirrors the design mock.
 */
export function MobileGate() {
  const farStars = useMemo(() => starShadow(90, 1600), []);
  const nearStars = useMemo(() => starShadow(45, 1600), []);

  return (
    <div className="mobile-gate" role="alert">
      <div className="mobile-gate__space" aria-hidden="true">
        <div className="stars stars--far" style={{ boxShadow: farStars }} />
        <div className="stars stars--near" style={{ boxShadow: nearStars }} />
        {USE_HERO_IMAGE ? (
          <div
            className="mobile-gate__hero"
            style={{ backgroundImage: `url(${HERO_IMAGE_SRC})` }}
          />
        ) : (
          <div className="bh">
            <div className="bh__glow" />
            <div className="bh__disk" />
            <div className="bh__disk bh__disk--rev" />
            <div className="bh__core" />
          </div>
        )}
        <div className="mobile-gate__vignette" />
      </div>

      <div className="mobile-gate__inner">
        <div className="gate-divider">
          <span className="gate-divider__line" />
          <SaturnIcon />
          <span className="gate-divider__line" />
        </div>

        <h1 className="gate-title">
          Wrong Device,
          <span className="gate-title__accent">Big Universe.</span>
        </h1>

        <p className="gate-body">
          This experience is built for bigger screens. Open it on a{' '}
          <strong>laptop</strong> or <strong>desktop</strong> to explore the
          full universe.
        </p>

        <div className="gate-devices">
          <PhoneIcon />
          <span className="gate-devices__dots" />
          <span className="gate-devices__x">✕</span>
          <span className="gate-devices__dots" />
          <LaptopIcon />
        </div>

        <p className="gate-soon">(Mobile version launching soon)</p>
        <p className="gate-sign">— Mehedi Hassan</p>
      </div>
    </div>
  );
}
