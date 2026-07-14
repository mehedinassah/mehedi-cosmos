'use client';

import { useEffect, useRef, useState } from 'react';
import { earthHover, IMPACT_SATS } from '@/state/earthHoverStore';

/**
 * The holographic detail that surfaces when you hover an impact satellite.
 * Not a modal, not a tooltip — a projection that builds upward from a scanline,
 * in the satellite's own color, connected to it by a thin beam. It lives in the
 * left gap so it NEVER overlaps Earth, and dissolves the moment you look away.
 */
const CARD_W = 214;
const CARD_H = 86;
const GAP_RIGHT = 740; // card's right edge never crosses this (keeps it off Earth)

function hexRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function EarthHologram() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const pinRef = useRef<SVGCircleElement>(null);
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current;
      const card = cardRef.current;
      if (root && card) {
        const i = earthHover.index;
        if (i >= 0) {
          if (i !== shown.current) {
            shown.current = i;
            const s = IMPACT_SATS[i];
            setContent({ title: s.title, body: s.body });
            const col = earthHover.color;
            root.style.setProperty('--holo', col);
            root.style.setProperty('--holo-a', hexRgba(col, 0.5));
            root.style.setProperty('--holo-glow', hexRgba(col, 0.24));
            root.style.setProperty('--holo-soft', hexRgba(col, 0.14));
            // retrigger the scanline build
            card.classList.remove('earth-holo__card--build');
            void card.offsetWidth;
            card.classList.add('earth-holo__card--build');
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const sx = earthHover.x, sy = earthHover.y;
          let right = Math.min(sx - 26, GAP_RIGHT);
          let left = right - CARD_W;
          if (left < 24) { left = 24; right = left + CARD_W; }
          const top = Math.max(24, Math.min(sy - CARD_H / 2, vh - CARD_H - 24));
          card.style.transform = `translate(${left}px, ${top}px)`;
          if (lineRef.current && pinRef.current) {
            lineRef.current.setAttribute('x1', String(sx));
            lineRef.current.setAttribute('y1', String(sy));
            lineRef.current.setAttribute('x2', String(right));
            lineRef.current.setAttribute('y2', String(top + CARD_H / 2));
            pinRef.current.setAttribute('cx', String(sx));
            pinRef.current.setAttribute('cy', String(sy));
          }
          void vw;
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
        <circle ref={pinRef} className="earth-holo__pin" cx="0" cy="0" r="3" />
      </svg>
      <div ref={cardRef} className="earth-holo__card">
        <span className="earth-holo__scan" />
        <div className="earth-holo__title">{content?.title}</div>
        <div className="earth-holo__body">{content?.body}</div>
      </div>
    </div>
  );
}
