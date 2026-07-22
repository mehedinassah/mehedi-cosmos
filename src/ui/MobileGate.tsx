'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
    const a = (0.3 + Math.random() * 0.6).toFixed(2);
    dots.push(`${x}px ${y}px rgba(255,255,255,${a})`);
  }
  return dots.join(', ');
}

/**
 * Drop-in photoreal black hole. Save a render (e.g. the Interstellar-style
 * image) to `public/gate-blackhole.png` and set this to `true` — it replaces
 * the CSS black hole with that exact image (the dust, glow drift and slow float
 * stay on top). This is the way to get a true lensed black hole; CSS only
 * approximates it. Use a PNG with transparency, or a JPG with a dark surround.
 */
const USE_HERO_IMAGE = false;
const HERO_IMAGE_SRC = '/gate-blackhole.png';

/**
 * The event-horizon center as a fraction of the viewport — kept in ONE place so
 * the CSS placement and the dust gravity agree. Upper-right, partly off-screen.
 */
const HOLE_X = 0.82; // 82% across — pushed off the upper-right
const HOLE_Y = 0.06; // 6% down — high, so only ~40% is on screen, clear of text

/**
 * Dust drifting toward the (off-screen) event horizon — gravity sells the
 * illusion. Deliberately tiny + slow: ~44 particles, gentle pull, some orbit,
 * some fall in. Pauses when the tab is hidden; skipped for reduced motion.
 */
function DustField() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; spin: number; life: number; max: number };
    const N = 44;
    const parts: P[] = [];
    const reset = (p: P): P => {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.vx = 0;
      p.vy = 0;
      p.r = Math.random() * 1.1 + 0.4;
      p.a = Math.random() * 0.35 + 0.15;
      p.spin = Math.random() < 0.55 ? (Math.random() < 0.5 ? 1 : -1) : 0; // many orbit
      p.life = 0;
      p.max = 500 + Math.random() * 700;
      return p;
    };
    for (let i = 0; i < N; i++) parts.push(reset({} as P));

    let raf = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      const cx = W * HOLE_X;
      const cy = H * HOLE_Y;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const g = Math.min(0.032, 2000 / (d * d) + 0.0009); // very gentle pull
        p.vx += (dx / d) * g;
        p.vy += (dy / d) * g;
        if (p.spin) {
          p.vx += (-dy / d) * g * 2.1 * p.spin; // tangential → orbit
          p.vy += (dx / d) * g * 2.1 * p.spin;
        }
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        const near = Math.max(0, 1 - d / Math.max(W, H));
        const warm = near > 0.6;
        ctx.globalAlpha = p.a * (0.4 + 0.6 * near);
        if (d < 260) {
          // near the hole → draw a short tangential streak: bent, orbiting light
          const sp = Math.hypot(p.vx, p.vy) || 0.001;
          const k = Math.min(16, 26 * sp);
          ctx.strokeStyle = warm ? 'rgba(255,206,150,0.95)' : 'rgba(216,224,246,0.75)';
          ctx.lineWidth = p.r * 1.1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * k, p.y - p.vy * k);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = warm ? 'rgba(255,196,140,1)' : 'rgba(206,216,238,1)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        if (d < 40 || p.life > p.max || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
          reset(p);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    };
    step();

    const onVis = () => {
      if (document.hidden) {
        stopped = true;
        cancelAnimationFrame(raf);
      } else if (stopped) {
        stopped = false;
        step();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', resize);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="mbh-dust" aria-hidden="true" />;
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
 * Mobile gate — a cinematic, mostly-off-screen black hole as calm ATMOSPHERE
 * behind the message. Layers (back → front): stars, nebula haze, the black
 * hole, drifting dust, then the text. Very slow motion, warm ambient glow, no
 * WebGL. The text stays the focus and always readable.
 */
export function MobileGate() {
  const farStars = useMemo(() => starShadow(80, 1600), []);
  const nearStars = useMemo(() => starShadow(38, 1600), []);

  return (
    <div className="mobile-gate" role="alert">
      <div className="mobile-gate__space" aria-hidden="true">
        <div className="stars stars--far" style={{ boxShadow: farStars }} />
        <div className="stars stars--near" style={{ boxShadow: nearStars }} />
        <div className="mbh-nebula" />

        {/* Massive black hole, placed via --hx/--hy (must match HOLE_X/Y). */}
        <div
          className={`mbh${USE_HERO_IMAGE ? ' mbh--image' : ''}`}
          style={{
            ['--hx' as string]: `${HOLE_X * 100}vw`,
            ['--hy' as string]: `${HOLE_Y * 100}vh`,
            ...(USE_HERO_IMAGE ? { backgroundImage: `url(${HERO_IMAGE_SRC})` } : {}),
          }}
        >
          {!USE_HERO_IMAGE && (
            <>
              {/* Interstellar/Gargantua structure: a black sphere, the edge-on
                  accretion disk (wings), the lensed Einstein ring wrapping it,
                  and the near disk edge crossing in front. */}
              <div className="mbh__glow" />
              <div className="mbh__disk" />
              <div className="mbh__disk mbh__disk--2" />
              <div className="mbh__disktex" />
              <div className="mbh__core" />
              <div className="mbh__halo" />
              <div className="mbh__diskfront" />
            </>
          )}
        </div>

        <DustField />
        <div className="mobile-gate__rim" />
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
