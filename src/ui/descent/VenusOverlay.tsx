'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SKILLS, NEIGHBORS, LAYER_LABEL, venusBridge, useVenusUI } from '@/state/venusStore';

/**
 * Venus's Skill Constellation DOM layer.
 * - SkillCard: the compact card a node unfolds into. VisionOS hierarchy — one
 *   big name, a tiny category above, a tiny tagline below. Follows the node.
 * - VenusExpand: the full skill record (auto-closes from the store). Opened by
 *   clicking a node; lists what it connects to.
 */

const CARD_W = 208;

export function SkillCard() {
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
        if (venusBridge.active) {
          const i = venusBridge.index;
          if (i !== shown.current) {
            shown.current = i;
            const it = SKILLS[i];
            setC({ cat: it.cat, title: it.name, meta: it.tagline });
            root.style.setProperty('--varc', venusBridge.color);
          }
          const vw = window.innerWidth, vh = window.innerHeight;
          const px = venusBridge.px, py = venusBridge.py;
          // The network sits left of Venus, so unfold toward the open space on
          // the left; only flip right if that would run off the left edge.
          let left = px - 22 - CARD_W;
          if (left < 16) left = px + 22;
          left = Math.max(16, Math.min(left, vw - CARD_W - 16)); // never clipped
          const h = card.offsetHeight || 74;
          const top = Math.max(16, Math.min(py - h / 2, vh - h - 16));
          card.style.transform = `translate(${left}px, ${top}px)`;
          const env = venusBridge.env;
          panel.style.opacity = String(env);
          panel.style.transform = `translateY(${(1 - env) * 5}px) scale(${0.95 + env * 0.05})`;
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
      <div
        ref={cardRef}
        className="vsk-holo__card"
        onClick={() => { if (shown.current >= 0) useVenusUI.getState().setSelected(shown.current); }}
        role="button"
        tabIndex={-1}
      >
        <div ref={panelRef} className="vsk-holo__panel">
          <div className="vsk-holo__cat">{c?.cat}</div>
          <div className="vsk-holo__title">{c?.title}</div>
          <div className="vsk-holo__meta">{c?.meta}</div>
        </div>
      </div>
    </div>
  );
}

export function VenusExpand() {
  const selected = useVenusUI((s) => s.selected);
  const setSelected = useVenusUI((s) => s.setSelected);
  const it = selected != null ? SKILLS[selected] : null;
  const linked = selected != null ? (NEIGHBORS[selected] ?? []).map((j) => SKILLS[j].name) : [];
  return (
    <div
      className={`vsk-expand ${it ? 'vsk-expand--on' : ''}`}
      style={it ? ({ '--varc': it.color } as CSSProperties) : undefined}
    >
      {it && (
        <>
          <button className="vsk-expand__close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <div className="vsk-expand__cat">{it.cat}</div>
          <div className="vsk-expand__title">{it.name}</div>
          <div className="vsk-expand__tagline">{it.tagline}</div>
          <dl className="vsk-expand__meta">
            <dt>Layer</dt><dd>{LAYER_LABEL[it.layer]}</dd>
          </dl>
          {it.tags.length > 0 && (
            <div className="vsk-expand__tags">
              {it.tags.map((tg) => (
                <span key={tg} className="vsk-expand__tag">{tg}</span>
              ))}
            </div>
          )}
          {linked.length > 0 && (
            <div className="vsk-expand__links">
              <div className="vsk-expand__links-label">Connects to</div>
              <div className="vsk-expand__links-list">
                {linked.map((n) => (
                  <span key={n} className="vsk-expand__chip">{n}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
