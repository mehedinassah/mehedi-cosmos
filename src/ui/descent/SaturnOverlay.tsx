'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { K_ITEMS, saturnBridge, useSaturnUI } from '@/state/saturnStore';

/**
 * Saturn's Knowledge Archive DOM layer.
 * - KnowledgeCard: the card a ring particle unfolds into. VisionOS hierarchy —
 *   one big title, tiny category above, tiny code/semester below. Clicking it
 *   opens the full record.
 * - SaturnExpand: the full academic record (auto-closes from the store). Also
 *   opened by clicking a milestone beacon in 3D.
 */

const CARD_W = 210;

export function KnowledgeCard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [c, setC] = useState<{ cat: string; title: string; meta: string } | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current, card = cardRef.current, panel = panelRef.current;
      if (root && card && panel) {
        if (saturnBridge.active) {
          const i = saturnBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const it = K_ITEMS[i];
            const meta = it.code ? `${it.code} · ${it.sem ?? ''}` : it.sub ?? it.sem ?? '';
            setC({ cat: it.cat, title: it.title, meta });
            root.style.setProperty('--karc', saturnBridge.color);
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = saturnBridge.px, py = saturnBridge.py;
          let left = px + 24; // the card unfolds just beside the particle
          if (left + CARD_W > vw - 16) left = px - 24 - CARD_W;
          left = Math.max(16, Math.min(left, vw - CARD_W - 16)); // never clipped
          const h = card.offsetHeight || 78;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          const env = saturnBridge.env;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 5}px) scale(${0.95 + env * 0.05})`;
          root.classList.add('sat-holo--on');
        } else {
          if (shown.current !== -1) shown.current = -1;
          root.classList.remove('sat-holo--on');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="sat-holo">
      <div
        ref={cardRef}
        className="sat-holo__card"
        onClick={() => { if (shown.current >= 0) useSaturnUI.getState().setSelected(shown.current); }}
        role="button"
        tabIndex={-1}
      >
        <div ref={panelRef} className="sat-holo__panel">
          <div className="sat-holo__cat">{c?.cat}</div>
          <div className="sat-holo__title">{c?.title}</div>
          <div className="sat-holo__meta">{c?.meta}</div>
        </div>
      </div>
    </div>
  );
}

export function SaturnExpand() {
  const selected = useSaturnUI((s) => s.selected);
  const setSelected = useSaturnUI((s) => s.setSelected);
  const it = selected != null ? K_ITEMS[selected] : null;
  return (
    <div
      className={`sat-expand ${it ? 'sat-expand--on' : ''}`}
      style={it ? ({ '--karc': it.kind === 'milestone' ? '#f0c674' : undefined } as CSSProperties) : undefined}
    >
      {it && (
        <>
          <button className="sat-expand__close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <div className="sat-expand__cat">{it.cat}</div>
          <div className="sat-expand__title">{it.title}</div>
          <dl className="sat-expand__meta">
            {it.code ? (<><dt>Course</dt><dd>{it.code}</dd></>) : null}
            {it.inst ? (<><dt>Institution</dt><dd>{it.inst}</dd></>) : null}
            {it.sem ? (<><dt>When</dt><dd>{it.sem}</dd></>) : null}
          </dl>
          {it.topics && (
            <ul className="sat-expand__topics">
              {it.topics.map((tp, i) => (
                <li key={i}>{tp}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
