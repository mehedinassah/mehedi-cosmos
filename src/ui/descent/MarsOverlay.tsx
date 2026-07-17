'use client';

import { useEffect, useRef, useState } from 'react';
import { MISSIONS, CLASS_LABEL, marsBridge } from '@/state/marsStore';

/**
 * Mars's Mission Control DOM layer — a single classified mission log that
 * unfolds beside the hovered drone. NASA telemetry meets Vision Pro glass:
 * mission code, status, tech, role, a completion ring, and an OPEN MISSION
 * link. Never covers Mars; fades out when the drone returns to orbit.
 */

const CARD_W = 244;

type Card = {
  code: string; name: string; cls: string; subtitle: string; facility: string;
  tech: string[]; role: string; status: string; progress: number; year: string; href: string;
};

export function MissionLog() {
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
        const env = marsBridge.env;
        if (marsBridge.active || env > 0.02) {
          const i = marsBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const m = MISSIONS[i];
            setC({ code: m.code, name: m.name, cls: CLASS_LABEL[m.cls], subtitle: m.subtitle, facility: m.facility, tech: m.tech, role: m.role, status: m.status, progress: m.progress, year: m.year, href: m.href });
            root.style.setProperty('--marc', marsBridge.color);
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = marsBridge.px, py = marsBridge.py;
          let left = px - 28 - CARD_W;
          if (left < 16) left = Math.min(px + 28, vw - CARD_W - 16);
          left = Math.max(16, Math.min(left, vw - CARD_W - 16));
          const h = card.offsetHeight || 160;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 6}px) scale(${0.96 + env * 0.04})`;
          root.classList.add('mars-log--on');
        } else {
          if (shown.current !== -1) shown.current = -1;
          root.classList.remove('mars-log--on');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = c ? Math.round(c.progress * 100) : 0;
  const R = 13, C = 2 * Math.PI * R;
  return (
    <div ref={rootRef} className="mars-log">
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

          <div className="mars-log__grid">
            <div>
              <div className="mars-log__k">Class</div>
              <div className="mars-log__v">{c?.cls}</div>
              <div className="mars-log__k">Role</div>
              <div className="mars-log__v">{c?.role}</div>
              <div className="mars-log__k">Facility</div>
              <div className="mars-log__v">{c?.facility}</div>
            </div>
            <div className="mars-log__ring">
              <svg width="34" height="34" viewBox="0 0 34 34">
                <circle cx="17" cy="17" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.4" />
                <circle
                  cx="17" cy="17" r={R} fill="none" stroke="var(--marc)" strokeWidth="2.4" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - (c?.progress ?? 0))} transform="rotate(-90 17 17)"
                />
              </svg>
              <span className="mars-log__pct">{pct === 100 ? '100' : pct}<i>%</i></span>
            </div>
          </div>

          <div className="mars-log__tech">
            {c?.tech.map((tt) => <span key={tt} className="mars-log__chip">{tt}</span>)}
          </div>
          <div className="mars-log__foot">
            <span className="mars-log__year">{c?.year}</span>
            <span className="mars-log__open">OPEN MISSION →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
