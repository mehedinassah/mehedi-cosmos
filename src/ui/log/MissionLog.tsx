'use client';

import { useEffect } from 'react';
import { universe } from '@/content/universe';
import { useUiStore } from '@/state/uiStore';

/**
 * Mission Log — in-experience semantic mirror (ADR-004 / §15).
 * Full content as real DOM; togglable with M. SSR twin lives at /log.
 */
export function MissionLog() {
  const open = useUiStore((s) => s.missionLogOpen);
  const toggle = useUiStore((s) => s.toggleMissionLog);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm' && !(e.target instanceof HTMLInputElement)) toggle();
      if (e.key === 'Escape' && useUiStore.getState().missionLogOpen) toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  if (!open) return null;

  return (
    <aside className="log" role="dialog" aria-label="Mission Log">
      <header className="log__header">
        <h2>Mission Log</h2>
        <button onClick={toggle} aria-label="Close log">✕</button>
      </header>
      <div className="log__body">
        {universe.bodies.map((b) => (
          <section key={b.id} className="log__entry">
            <h3>{b.log.heading}</h3>
            <p className="log__meaning">{b.meaning}</p>
            <p>{b.log.body}</p>
            {b.log.links.length > 0 && (
              <ul>
                {b.log.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}
