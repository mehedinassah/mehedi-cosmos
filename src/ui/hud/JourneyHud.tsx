'use client';

import { useEffect, useState } from 'react';
import { useJourneyStore } from '@/state/journeyStore';
import { useUiStore } from '@/state/uiStore';
import { bodyById } from '@/content/universe';

/**
 * Minimal diegetic HUD — location readout + aria-live narration channel (§15).
 * No menus, no nav bar. Fades with journey state.
 *
 * First impression rule: after the intro hands off, the galaxy holds the
 * frame ALONE for a few seconds before the HUD fades in — nothing should
 * remind the viewer they're on a website until the image has landed.
 */
const HUD_REVEAL_DELAY_MS = 4200;

export function JourneyHud() {
  const phase = useJourneyStore((s) => s.phase);
  const location = useJourneyStore((s) => s.location);
  const destination = useJourneyStore((s) => s.destination);
  const toggleLog = useUiStore((s) => s.toggleMissionLog);
  const [revealed, setRevealed] = useState(false);

  const inIntro = phase === 'INTRO';
  useEffect(() => {
    if (inIntro) return;
    const t = window.setTimeout(() => setRevealed(true), HUD_REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [inIntro]);

  const traveling = phase === 'ACCEL' || phase === 'CRUISE' || phase === 'DECEL';
  const label = traveling
    ? `Traveling — ${bodyById.get(destination ?? '')?.name ?? ''}`
    : bodyById.get(location)?.name ?? '';

  if (inIntro) return null;

  return (
    <>
      <div className={`hud${revealed ? ' hud--visible' : ''}`} aria-hidden="true">
        <span className="hud__location">{label}</span>
        <button className="hud__log" onClick={toggleLog} title="Mission Log (M)" tabIndex={revealed ? 0 : -1}>
          ◈ Log
        </button>
      </div>
      <div aria-live="polite" className="sr-only">
        {traveling
          ? `Traveling to ${bodyById.get(destination ?? '')?.name}. ${bodyById.get(destination ?? '')?.meaning ?? ''}`
          : `Arrived at ${bodyById.get(location)?.name}.`}
      </div>
    </>
  );
}
