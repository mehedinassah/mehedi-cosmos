'use client';

import { useEffect, useRef, useState } from 'react';
import { loadSignals } from '@/state/loadSignals';
import { useQualityStore } from '@/state/qualityStore';

/**
 * Black-hole preloader (hybrid gate). A 2D-canvas galaxy of stars spirals
 * around a dark center while the WebGL universe builds underneath. The ENTER
 * control stays dim until the scene is genuinely ready (real loadSignals), then
 * lights up. On ENTER the stars explode outward ("expanse") and the overlay
 * fades — handing off to the galaxy already blooming beneath it.
 *
 * Ported from a jQuery/Canvas pen to plain React (no jQuery, no deps). The star
 * math is faithful to the original; only the wiring is ours.
 */
export function Preloader() {
  const [phase, setPhase] = useState<'load' | 'ready' | 'ignite' | 'done'>('load');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const collapseRef = useRef(false); // ENTER hovered → stars pull toward the rim
  const expanseRef = useRef(false); // ENTER clicked → stars explode outward

  // ── The spiraling black-hole canvas (skipped for reduced motion) ──
  useEffect(() => {
    const reduced =
      useQualityStore.getState().reducedMotion ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    context.scale(dpr, dpr);
    context.globalCompositeOperation = 'lighter';

    const maxorbit = 255;
    const centerx = cw / 2;
    const centery = ch / 2;
    const BG = '6,6,11';
    const startTime = Date.now();
    let currentTime = 0;
    let raf = 0;
    let stopped = false;
    const stars: Star[] = [];

    function rotate(cx: number, cy: number, x: number, y: number, angle: number) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        cos * (x - cx) + sin * (y - cy) + cx,
        cos * (y - cy) - sin * (x - cx) + cy,
      ] as const;
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
        // Weighted random so most stars cluster toward the center of the orbit.
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
        this.color = 'rgba(255,255,255,' + (1 - this.orbital / 255) + ')';
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
          this.rotation = this.startRotation + currentTime * (this.speed / 2);
          if (this.y > this.expansePos) this.y -= Math.floor(this.expansePos - this.y) / -140;
        }

        context!.save();
        context!.fillStyle = this.color;
        context!.strokeStyle = this.color;
        context!.beginPath();
        const old = rotate(centerx, centery, this.prevX, this.prevY, -this.prevR);
        context!.moveTo(old[0], old[1]);
        context!.translate(centerx, centery);
        context!.rotate(this.rotation);
        context!.translate(-centerx, -centery);
        context!.lineTo(this.x, this.y);
        context!.stroke();
        context!.restore();

        this.prevR = this.rotation;
        this.prevX = this.x;
        this.prevY = this.y;
      }
    }

    function loop() {
      if (stopped) return;
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
    for (let i = 0; i < 2000; i++) new Star();
    loop();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Watch real readiness → light up ENTER (safety cap so it always lights) ──
  useEffect(() => {
    if (phase !== 'load') return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const ready =
        loadSignals.firstFrame && loadSignals.galaxyReady && loadSignals.galaxyBloom > 0.9;
      if (ready || performance.now() - start > 9000) setPhase('ready');
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Reduced motion / return skip: don't force a click — auto-enter once ready.
  useEffect(() => {
    if (phase !== 'ready') return;
    const reduced =
      useQualityStore.getState().reducedMotion ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setPhase('ignite');
  }, [phase]);

  // ENTER pressed → explode the stars, fade the overlay, then release the scene.
  useEffect(() => {
    if (phase !== 'ignite') return;
    expanseRef.current = true;
    collapseRef.current = false;
    const id = window.setTimeout(() => {
      loadSignals.revealed = true;
      setPhase('done');
    }, 1700);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === 'done') return null;

  const onEnter = () => {
    if (phase === 'ready') setPhase('ignite');
  };

  return (
    <div className={`preloader blackhole${phase === 'ignite' ? ' preloader--ignite' : ''}`}>
      <canvas ref={canvasRef} className="blackhole__canvas" aria-hidden="true" />
      <button
        type="button"
        className={
          'centerHover' +
          (phase === 'load' ? ' centerHover--wait' : '') +
          (phase === 'ignite' ? ' open' : '')
        }
        onClick={onEnter}
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
