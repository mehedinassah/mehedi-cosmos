'use client';

import { useEffect, useRef, useState } from 'react';
import { earthHover, MISSIONS } from '@/state/earthHoverStore';

/**
 * The hologram the probe projects. Ephemeral, not a modal: frosted glass, no
 * border, a soft inner glow in the mission's color, a scanline reveal and a
 * slight upward drift. It sits ~80px from the probe (a projection, not a floating
 * label), connected by a thin beam, in the open space away from Earth.
 */
const CARD_W = 210;
const CARD_H = 96;
const GAP_RIGHT = 920; // card's right edge never crosses this -> never on Earth

function hexRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function EarthHologram() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const pinRef = useRef<SVGCircleElement>(null);
  const [c, setC] = useState<{ title: string; subtitle: string; body: string } | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current, card = cardRef.current, panel = panelRef.current;
      if (root && card && panel) {
        if (earthHover.active) {
          const i = earthHover.index;
          if (i !== shown.current) {
            shown.current = i;
            const m = MISSIONS[i];
            setC({ title: m.title, subtitle: m.subtitle, body: m.body });
            const col = earthHover.color;
            root.style.setProperty('--holo', col);
            root.style.setProperty('--holo-glow', hexRgba(col, 0.22));
            root.style.setProperty('--holo-soft', hexRgba(col, 0.1));
            panel.classList.remove('earth-holo__panel--build');
            void panel.offsetWidth;
            panel.classList.add('earth-holo__panel--build');
          }
          const vh = window.innerHeight;
          // Card sits in the open gap to the LEFT of the probe — close when the
          // probe is near the gap, but never allowed onto Earth (GAP_RIGHT).
          const right = Math.min(earthHover.px - 30, GAP_RIGHT);
          const left = Math.max(14, right - CARD_W);
          const top = Math.max(14, Math.min(earthHover.py - CARD_H / 2, vh - CARD_H - 14));
          card.style.transform = `translate(${left}px, ${top}px)`;
          if (lineRef.current && pinRef.current) {
            lineRef.current.setAttribute('x1', String(earthHover.px));
            lineRef.current.setAttribute('y1', String(earthHover.py));
            lineRef.current.setAttribute('x2', String(left + CARD_W)); // card's right edge
            lineRef.current.setAttribute('y2', String(top + CARD_H / 2));
            pinRef.current.setAttribute('cx', String(earthHover.px));
            pinRef.current.setAttribute('cy', String(earthHover.py));
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
        <circle ref={pinRef} className="earth-holo__pin" cx="0" cy="0" r="2.5" />
      </svg>
      <div ref={cardRef} className="earth-holo__card">
        <div ref={panelRef} className="earth-holo__panel">
          <span className="earth-holo__scan" />
          <div className="earth-holo__title">{c?.title}</div>
          <div className="earth-holo__subtitle">{c?.subtitle}</div>
          <div className="earth-holo__rule" />
          <div className="earth-holo__body">{c?.body}</div>
        </div>
      </div>
    </div>
  );
}
