'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { K_ITEMS, saturnBridge, useSaturnUI } from '@/state/saturnStore';

/**
 * Saturn's Knowledge Archive DOM layer:
 * - KnowledgeCard: the compact card a particle unfolds into (rAF-driven, calm).
 *   Clicking it expands the full academic record.
 * - SaturnTimeline: 2018 —— 2020 —— 2022, dots lighting as milestones present.
 * - SaturnExpand: the full record panel (course code, institution, semester,
 *   topics), auto-closing from the store.
 */

const CARD_W = 200;

export function KnowledgeCard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [c, setC] = useState<{ cat: string; title: string; sub: string; accent: string } | null>(null);
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
            setC({ cat: it.cat, title: it.title, sub: it.sub ?? it.code ?? '', accent: it.accent ?? '#cdb384' });
            root.style.setProperty('--karc', it.accent ?? '#cdb384');
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = saturnBridge.px, py = saturnBridge.py;
          let left = px + 26;
          if (left + CARD_W > vw - 16) left = px - 26 - CARD_W;
          const h = card.offsetHeight || 80;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          const env = saturnBridge.env;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 6}px) scale(${0.96 + env * 0.04})`;
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
          {c?.sub ? <div className="sat-holo__sub">{c.sub}</div> : null}
          <div className="sat-holo__more">details</div>
        </div>
      </div>
    </div>
  );
}

const DOTS: { year: '2018' | '2020' | '2022'; label: string }[] = [
  { year: '2018', label: 'SSC' },
  { year: '2020', label: 'HSC' },
  { year: '2022', label: 'BSc' },
];

export function SaturnTimeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<string>('');
  const litRef = useRef('');

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = rootRef.current;
      if (root) {
        root.classList.toggle('sat-timeline--on', saturnBridge.focus > 0.6);
        if (saturnBridge.milestone !== litRef.current) {
          litRef.current = saturnBridge.milestone;
          setLit(saturnBridge.milestone);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="sat-timeline" aria-hidden="true">
      <div className="sat-timeline__track">
        {DOTS.map((d) => (
          <div key={d.year} className={`sat-timeline__stop ${lit === d.year ? 'sat-timeline__stop--lit' : ''}`}>
            <span className="sat-timeline__dot" />
            <span className="sat-timeline__year">{d.year}</span>
            <span className="sat-timeline__label">{d.label}</span>
          </div>
        ))}
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
      style={it ? ({ '--karc': it.accent ?? '#cdb384' } as CSSProperties) : undefined}
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
