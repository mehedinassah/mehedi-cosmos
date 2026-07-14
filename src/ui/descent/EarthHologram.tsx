'use client';

import { useEffect, useRef, useState } from 'react';
import { earthHover, IMPACT_DETAILS } from '@/state/earthHoverStore';

/**
 * The holographic detail that surfaces when you hover an impact satellite. Not
 * a modal, not a popup — a small projected panel that tracks the satellite's
 * screen position and fades as you look away. Driven by a rAF loop reading the
 * shared earthHover bridge, so it never re-renders the scene.
 */
export function EarthHologram() {
  const ref = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);
  const shown = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const i = earthHover.index;
        if (i >= 0) {
          if (i !== shown.current) {
            shown.current = i;
            setContent({ title: IMPACT_DETAILS[i].title, body: IMPACT_DETAILS[i].body });
          }
          el.style.transform = `translate(${earthHover.x}px, ${earthHover.y}px)`;
          el.classList.add('earth-holo--on');
        } else {
          if (shown.current !== -1) shown.current = -1;
          el.classList.remove('earth-holo--on');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="earth-holo" aria-hidden="true">
      <span className="earth-holo__pin" />
      <div className="earth-holo__card">
        <div className="earth-holo__title">{content?.title}</div>
        <div className="earth-holo__body">{content?.body}</div>
      </div>
    </div>
  );
}
