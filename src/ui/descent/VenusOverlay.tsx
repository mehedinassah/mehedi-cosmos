'use client';

import { useEffect, useRef, useState } from 'react';
import { SKILLS, ORBITS, venusBridge } from '@/state/venusStore';

/**
 * Venus's Skill Galaxy DOM layer — a single holographic card that appears
 * beside the hovered skill. Apple Vision Pro: dark translucent glass, a very
 * thin border, soft blur, small type. It never covers Venus (clamped left) and
 * fades out smoothly when the hover ends.
 */

const CARD_W = 232;

type Card = { role: string; title: string; cat: string; bullets: string[]; usedIn?: string; years?: string };

export function SkillCard() {
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
        const env = venusBridge.env;
        if (venusBridge.active || env > 0.02) {
          const i = venusBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const it = SKILLS[i];
            setC({ role: it.role, title: it.name, cat: ORBITS[it.category].label, bullets: it.bullets, usedIn: it.usedIn, years: it.years });
            root.style.setProperty('--varc', venusBridge.color);
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = venusBridge.px, py = venusBridge.py;
          // never cover Venus: prefer opening to the LEFT of the object
          let left = px - 26 - CARD_W;
          if (left < 16) left = Math.min(px + 26, vw - CARD_W - 16);
          left = Math.max(16, Math.min(left, vw - CARD_W - 16));
          const h = card.offsetHeight || 120;
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
          <div className="vsk-holo__cat">{c?.cat}</div>
          <div className="vsk-holo__title">{c?.title}</div>
          <div className="vsk-holo__role">{c?.role}</div>
          <ul className="vsk-holo__bullets">
            {c?.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
          {(c?.usedIn || c?.years) && (
            <div className="vsk-holo__foot">
              {c?.usedIn && <span className="vsk-holo__used">Used in {c.usedIn}</span>}
              {c?.years && <span className="vsk-holo__years">{c.years}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
