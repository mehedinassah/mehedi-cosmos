'use client';

import { useEffect, useRef, useState } from 'react';
import { MISSIONS, marsBridge } from '@/state/marsStore';

/**
 * Mars's Mission Control DOM layer — a clean, classified mission log projected
 * from the hovered drone. A thin holographic beam links the drone to the card
 * so it reads as projected, not floating. Apple restraint, NASA telemetry.
 */

const CARD_W = 216;

type Card = { code: string; name: string; subtitle: string; status: string; tech: string[]; role: string; year: string; href: string };

export function MissionLog() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const [c, setC] = useState<Card | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current, card = cardRef.current, panel = panelRef.current, line = lineRef.current;
      if (root && card && panel) {
        const env = marsBridge.env;
        if (marsBridge.active || env > 0.02) {
          const i = marsBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const m = MISSIONS[i];
            setC({ code: m.code, name: m.name, subtitle: m.subtitle, status: m.status, tech: m.tech, role: m.role, year: m.year, href: m.href });
            root.style.setProperty('--marc', marsBridge.color);
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = marsBridge.px, py = marsBridge.py;
          // Keep the card in the open corridor between the left panel and Mars,
          // so it never covers either; the beam links it to the drone anywhere.
          const guard = 512, maxLeft = Math.min(vw - CARD_W - 16, vw * 0.55 - CARD_W);
          let left = px - 30 - CARD_W;
          if (left < guard) left = px + 30;
          left = Math.max(guard, Math.min(left, Math.max(guard, maxLeft)));
          const h = card.offsetHeight || 150;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 6}px) scale(${0.96 + env * 0.04})`;
          // holographic beam from the drone to the nearest card edge
          if (line) {
            const cx = px < left + CARD_W / 2 ? left : left + CARD_W;
            const cy = Math.max(top + 14, Math.min(py, top + h - 14));
            line.setAttribute('x1', String(px)); line.setAttribute('y1', String(py));
            line.setAttribute('x2', String(cx)); line.setAttribute('y2', String(cy));
            line.style.opacity = String(env * 0.5);
          }
          root.classList.add('mars-log--on');
        } else {
          if (shown.current !== -1) shown.current = -1;
          if (line) line.style.opacity = '0';
          root.classList.remove('mars-log--on');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="mars-log">
      <svg className="mars-log__link" width="100%" height="100%">
        <line ref={lineRef} stroke="var(--marc)" strokeWidth="1" strokeDasharray="2 4" style={{ opacity: 0 }} />
      </svg>
      <div
        ref={cardRef}
        className="mars-log__card"
        onClick={() => { if (c) window.open(c.href, '_blank', 'noopener'); }}
        role="button"
        tabIndex={-1}
      >
        <div ref={panelRef} className="mars-log__panel">
          <div className="mars-log__head">
            <span className="mars-log__code">{c?.code}</span>
            <span className="mars-log__status">{c?.status}</span>
          </div>
          <div className="mars-log__title">{c?.name}</div>
          <div className="mars-log__sub">{c?.subtitle}</div>
          <div className="mars-log__rule" />
          <div className="mars-log__tech">
            {c?.tech.map((tt) => <span key={tt} className="mars-log__chip">{tt}</span>)}
          </div>
          <div className="mars-log__rule" />
          <div className="mars-log__foot">
            <span className="mars-log__role">{c?.role}</span>
            <span className="mars-log__year">{c?.year}</span>
          </div>
          <div className="mars-log__open">OPEN MISSION →</div>
        </div>
      </div>
    </div>
  );
}
