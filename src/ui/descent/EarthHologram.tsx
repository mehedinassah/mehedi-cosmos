'use client';

import { useEffect, useRef, useState } from 'react';
import { orbitBridge, CRAFT } from '@/state/earthHoverStore';

/**
 * The brief transmission a craft projects as it passes the visible side — a
 * hull pulse, a thin beam, a compact card that softly expands beside it and
 * fades in ~2s while the craft keeps moving. Non-interactive; it's a signal,
 * not a popup. Minimal: category / metric / one line.
 */
const CARD_W = 190;

function hexRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function EarthHologram() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const [c, setC] = useState<{ title: string; big: string; sub: string } | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current, card = cardRef.current, panel = panelRef.current;
      if (root && card && panel) {
        if (orbitBridge.active) {
          const i = orbitBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const m = CRAFT[i];
            setC({ title: m.title ?? '', big: m.big ?? '', sub: m.sub ?? '' });
            const col = orbitBridge.color;
            root.style.setProperty('--holo', col);
            root.style.setProperty('--holo-soft', hexRgba(col, 0.5));
            root.style.setProperty('--holo-faint', hexRgba(col, 0.16));
            if (pulseRef.current) {
              pulseRef.current.classList.remove('earth-holo__pulse--go');
              void pulseRef.current.offsetWidth;
              pulseRef.current.classList.add('earth-holo__pulse--go');
            }
          }
          const env = orbitBridge.env;
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = orbitBridge.px, py = orbitBridge.py;
          // sit just to the side of the craft, flipping to keep on-screen
          let left = px + 30;
          let beamX = left;
          if (left + CARD_W > vw - 16) { left = px - 30 - CARD_W; beamX = left + CARD_W; }
          const h = card.offsetHeight || 70;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 7}px)`;
          if (pulseRef.current) pulseRef.current.style.transform = `translate(${px}px, ${py}px)`;
          if (lineRef.current) {
            lineRef.current.setAttribute('x1', String(px));
            lineRef.current.setAttribute('y1', String(py));
            lineRef.current.setAttribute('x2', String(beamX));
            lineRef.current.setAttribute('y2', String(top + h / 2));
            lineRef.current.style.opacity = String(env * 0.5);
          }
          root.classList.add('earth-holo--on');
        } else {
          if (shown.current !== -1) shown.current = -1;
          root.classList.remove('earth-holo--on');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="earth-holo" aria-hidden="true">
      <svg className="earth-holo__link" width="100%" height="100%">
        <line ref={lineRef} className="earth-holo__beam" x1="0" y1="0" x2="0" y2="0" />
      </svg>
      <div ref={pulseRef} className="earth-holo__pulse" />
      <div ref={cardRef} className="earth-holo__card">
        <div ref={panelRef} className="earth-holo__panel">
          <div className="earth-holo__title">{c?.title}</div>
          <div className="earth-holo__big">{c?.big}</div>
          <div className="earth-holo__sub">{c?.sub}</div>
        </div>
      </div>
    </div>
  );
}
