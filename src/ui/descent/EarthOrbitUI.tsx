'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { CRAFT, hoverBridge, useEarthUI } from '@/state/earthHoverStore';

// If the viewer opens a panel and forgets it, it closes itself.
const AUTO_CLOSE_MS = 4000;

/**
 * Curiosity-driven Earth UI: a subtle tag that follows a hovered craft, and a
 * compact side panel that opens on click. The world never freezes — the object
 * keeps orbiting; only the information expands.
 */

export function HoverLabel() {
  const hovered = useEarthUI((s) => s.hovered);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) el.style.transform = `translate(${hoverBridge.px}px, ${hoverBridge.py}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const craft = hovered != null ? CRAFT[hovered] : null;
  return (
    <div
      ref={ref}
      className={`earth-hover ${craft ? 'earth-hover--on' : ''}`}
      style={craft ? ({ '--holo': craft.color } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <span className="earth-hover__dot" />
      <span className="earth-hover__tag">{craft?.label}</span>
    </div>
  );
}

export function OrbitPanel() {
  const selected = useEarthUI((s) => s.selected);
  const setSelected = useEarthUI((s) => s.setSelected);
  const craft = selected != null ? CRAFT[selected] : null;

  // Auto-close after a few seconds (reset whenever the selection changes).
  useEffect(() => {
    if (selected == null) return;
    const id = window.setTimeout(() => setSelected(null), AUTO_CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [selected, setSelected]);
  return (
    <div
      className={`orbit-panel ${craft ? 'orbit-panel--on' : ''}`}
      style={craft ? ({ '--holo': craft.color } as CSSProperties) : undefined}
    >
      {craft && (
        <>
          <button className="orbit-panel__close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <div className="orbit-panel__tag">{craft.label}</div>
          <div className="orbit-panel__title">{craft.title}</div>
          <div className="orbit-panel__big">{craft.big}</div>
          <div className="orbit-panel__sub">{craft.sub}</div>
          {craft.lines && (
            <ul className="orbit-panel__lines">
              {craft.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
