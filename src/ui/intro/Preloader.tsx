'use client';

import { useEffect, useRef, useState } from 'react';
import { loadSignals } from '@/state/loadSignals';
import { useQualityStore } from '@/state/qualityStore';

type Phase = 'load' | 'ready' | 'burst' | 'fade' | 'done';

/**
 * Black-hole preloader (hybrid gate) — and, critically, the universe does NOT
 * mount until the visitor presses ENTER. A 2D canvas lives on the main thread,
 * and so does WebGL shader compilation; if both run at once the spiral stutters
 * exactly when loading is heaviest. So here the black hole spins entirely alone
 * (smooth), and only on ENTER do we (1) let the stars explode for a beat while
 * still alone, (2) mount the heavy universe + freeze the canvas so the compile
 * has nothing to stutter, and (3) fade the overlay via CSS opacity (compositor
 * thread) once the galaxy is genuinely up. Ported from a jQuery pen to plain
 * React — no jQuery, no deps.
 */
export function Preloader({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState<Phase>('load');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const collapseRef = useRef(false); // ENTER hovered → stars pull toward the rim
  const expanseRef = useRef(false); // ENTER pressed → stars explode outward
  const frozenRef = useRef(false); // stop the RAF so a compile can't stutter it
  const reducedRef = useRef(false);

  // ── The spiraling black-hole canvas (runs alone; skipped for reduced motion) ──
  useEffect(() => {
    const reduced =
      useQualityStore.getState().reducedMotion ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    reducedRef.current = reduced;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Keep the preloader cheap: 1x DPR + a lean star count + transform-free draws.
    const dpr = 1;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    context.scale(dpr, dpr);
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = 1.4;

    // Scale the black hole to the viewport so it fills the screen instead of
    // sitting as a tiny puddle in the void.
    const maxorbit = Math.round(Math.min(cw, ch) * 0.46);
    const centerx = cw / 2;
    const centery = ch / 2;
    const BG = '6,6,11';
    const startTime = Date.now();
    let currentTime = 0;
    let raf = 0;
    let stopped = false;
    const stars: Star[] = [];

    // Transform a point by canvas rotate(ang) about the center — done in math so
    // each star skips save/translate/rotate/restore (the big per-frame cost).
    function tp(x: number, y: number, ang: number) {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const dx = x - centerx;
      const dy = y - centery;
      return [centerx + c * dx - s * dy, centery + s * dx + c * dy] as const;
    }

    class Star {
      orbital: number;
      x: number;
      y: number;
      yOrigin: number;
      speed: number;
      rotation: number;
      startRotation: number;
      id: number;
      collapseBonus: number;
      color: string;
      hoverPos: number;
      expansePos: number;
      prevR: number;
      prevX: number;
      prevY: number;

      constructor() {
        const r1 = Math.random() * (maxorbit / 2) + 1;
        const r2 = Math.random() * (maxorbit / 2) + maxorbit;
        this.orbital = (r1 + r2) / 2;
        this.x = centerx;
        this.y = centery + this.orbital;
        this.yOrigin = centery + this.orbital;
        this.speed = ((Math.floor(Math.random() * 2.5) + 1.5) * Math.PI) / 180;
        this.rotation = 0;
        this.startRotation = ((Math.floor(Math.random() * 360) + 1) * Math.PI) / 180;
        this.id = stars.length;
        this.collapseBonus = Math.max(0, this.orbital - maxorbit * 0.7);
        // Brighter, with a lit core that falls off toward the rim (was capped
        // near 0.5, which read as faded).
        const a = Math.min(0.95, 0.18 + 1.7 * (1 - this.orbital / maxorbit));
        this.color = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        this.hoverPos = centery + maxorbit / 2 + this.collapseBonus;
        this.expansePos =
          centery + (this.id % 100) * -10 + (Math.floor(Math.random() * 20) + 1);
        this.prevR = this.startRotation;
        this.prevX = this.x;
        this.prevY = this.y;
        stars.push(this);
      }

      draw() {
        const collapse = collapseRef.current;
        const expanse = expanseRef.current;
        if (!expanse) {
          this.rotation = this.startRotation + currentTime * this.speed;
          if (!collapse) {
            if (this.y > this.yOrigin) this.y -= 2.5;
            if (this.y < this.yOrigin - 4) this.y += (this.yOrigin - this.y) / 10;
          } else {
            if (this.y > this.hoverPos) this.y -= (this.hoverPos - this.y) / -5;
            if (this.y < this.hoverPos - 4) this.y += 2.5;
          }
        } else {
          // DIVE — faithful to the reference pen: the field glides outward past
          // the camera toward fixed targets with a gentle EASE-OUT (fast, then
          // decelerating to a settle), rotating at half speed. The step is
          // proportional to remaining distance, so it never rushes — this is the
          // premium, un-hurried feel (not an accelerating sprint).
          this.rotation = this.startRotation + currentTime * (this.speed / 2);
          if (this.y > this.expansePos) {
            this.y -= Math.floor(this.expansePos - this.y) / -140;
          }
        }

        const a = tp(this.prevX, this.prevY, this.prevR);
        const b = tp(this.x, this.y, this.rotation);
        context!.strokeStyle = this.color;
        context!.beginPath();
        context!.moveTo(a[0], a[1]);
        context!.lineTo(b[0], b[1]);
        context!.stroke();

        this.prevR = this.rotation;
        this.prevX = this.x;
        this.prevY = this.y;
      }
    }

    function loop() {
      if (stopped || frozenRef.current) return; // freeze → nothing to stutter
      currentTime = (Date.now() - startTime) / 50;
      context!.globalCompositeOperation = 'source-over';
      context!.fillStyle = 'rgba(' + BG + ',0.22)';
      context!.fillRect(0, 0, cw, ch);
      context!.globalCompositeOperation = 'lighter';
      for (let i = 0; i < stars.length; i++) stars[i].draw();
      raf = requestAnimationFrame(loop);
    }

    context.fillStyle = 'rgba(' + BG + ',1)';
    context.fillRect(0, 0, cw, ch);
    // The spin runs alone (universe mounts on ENTER), so we can afford a dense,
    // vivid field — more stars to keep the now-larger disk from looking sparse.
    for (let i = 0; i < 2400; i++) new Star();
    loop();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── load → ready: give the spiral a beat to form, THEN light ENTER. No WebGL
  //    is building yet, so this phase is contention-free and smooth. ──
  useEffect(() => {
    if (phase !== 'load') return;
    const reduced = reducedRef.current;
    const id = window.setTimeout(
      () => setPhase(reduced ? 'burst' : 'ready'),
      reduced ? 0 : 1800,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  // ── ENTER pressed → explode the stars for a beat (still alone), then mount the
  //    heavy universe + freeze the canvas, and wait until the galaxy is up. ──
  useEffect(() => {
    if (phase !== 'burst') return;
    collapseRef.current = false;
    expanseRef.current = true; // stars break orbit and sprint outward (warp)

    // The warp runs ALONE for most of the dive so it's perfectly smooth. Only
    // near the end do we mount the universe (compile) and freeze the sim — by
    // then the flash is climaxing and covers the frozen frame + the compile.
    const mountId = window.setTimeout(
      () => {
        onEnter(); // mount UniverseCanvas → shader compile starts now
        frozenRef.current = true; // freeze the warp; the flash covers the rest
      },
      reducedRef.current ? 0 : 1600,
    );

    let raf = 0;
    const start = performance.now();
    const wait = () => {
      // Let the ~2s particle dive dominate, then reveal onto the ready galaxy.
      const ready = loadSignals.firstFrame && loadSignals.galaxyReady;
      if (ready && performance.now() - start > 2000) setPhase('fade');
      else raf = requestAnimationFrame(wait);
    };
    raf = requestAnimationFrame(wait);
    // Hard cap on a timer (fires even if rAF is throttled/paused), so a stuck or
    // never-firing signal can never trap the visitor behind the flash.
    const capId = window.setTimeout(() => setPhase('fade'), 9000);

    return () => {
      window.clearTimeout(mountId);
      window.clearTimeout(capId);
      cancelAnimationFrame(raf);
    };
  }, [phase, onEnter]);

  // ── fade: galaxy is up → dissolve the overlay (CSS opacity, compositor thread,
  //    smooth through any residual compile), then unmount + release the scene. ──
  useEffect(() => {
    if (phase !== 'fade') return;
    const id = window.setTimeout(() => {
      loadSignals.revealed = true;
      setPhase('done');
    }, 1650);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === 'done') return null;

  const onEnterClick = () => {
    if (phase === 'ready') setPhase('burst');
  };

  const diving = phase === 'burst' || phase === 'fade';

  return (
    <div
      className={
        `preloader blackhole${diving ? ' diving' : ''}` +
        (phase === 'fade' ? ' preloader--ignite' : '')
      }
    >
      <canvas ref={canvasRef} className="blackhole__canvas" aria-hidden="true" />
      {/* Final whiteout — a brief climax at the very end of the dive; the dive
          itself is the starfield scaling up (see .blackhole.diving canvas). */}
      <div className="gate-flash" aria-hidden="true" />
      <button
        type="button"
        className={
          'centerHover' +
          (phase === 'load' ? ' centerHover--wait' : '') +
          (phase === 'burst' || phase === 'fade' ? ' open' : '')
        }
        onClick={onEnterClick}
        onMouseEnter={() => {
          if (phase === 'ready') collapseRef.current = true;
        }}
        onMouseLeave={() => {
          collapseRef.current = false;
        }}
        aria-label="Enter the experience"
        disabled={phase !== 'ready'}
      >
        <span>ENTER</span>
      </button>
    </div>
  );
}
