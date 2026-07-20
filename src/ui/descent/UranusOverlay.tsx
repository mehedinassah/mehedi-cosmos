'use client';

import { useEffect, useRef, useState } from 'react';
import { INTERESTS, uranusBridge } from '@/state/uranusStore';

/**
 * Uranus "Beyond Code" DOM layer — one small glass card that lifts in beside
 * the hovered interest satellite. Reuses the Venus skill-card styling (dark
 * translucent glass, thin accent border, small type) so the whole system reads
 * as one language. Kept minimal: a kicker, the interest, and its tags.
 */

const CARD_W = 222;

type Card = { title: string; tags: string[] };

export function UranusCard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [c, setC] = useState<Card | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current, card = cardRef.current, panel = panelRef.current;
      if (root && card && panel) {
        const env = uranusBridge.env;
        if (uranusBridge.active || env > 0.02) {
          const i = uranusBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const it = INTERESTS[i];
            setC({ title: it.name, tags: it.tags });
            root.style.setProperty('--varc', uranusBridge.color);
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = uranusBridge.px, py = uranusBridge.py;
          // prefer opening to the LEFT of the satellite (Uranus sits on the right)
          let left = px - 26 - CARD_W;
          if (left < 16) left = Math.min(px + 26, vw - CARD_W - 16);
          left = Math.max(16, Math.min(left, vw - CARD_W - 16));
          const h = card.offsetHeight || 110;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 6}px) scale(${0.96 + env * 0.04})`;
          root.classList.add('vsk-holo--on');
        } else {
          if (shown.current !== -1) shown.current = -1;
          root.classList.remove('vsk-holo--on');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="vsk-holo">
      <div ref={cardRef} className="vsk-holo__card">
        <div ref={panelRef} className="vsk-holo__panel">
          <div className="vsk-holo__cat">Beyond Code</div>
          <div className="vsk-holo__title">{c?.title}</div>
          <ul className="vsk-holo__bullets">
            {c?.tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
