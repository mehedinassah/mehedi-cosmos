'use client';

import { useEffect, useState } from 'react';
import { useJourneyStore } from '@/state/journeyStore';
import { useUiStore } from '@/state/uiStore';
import { useDescentStore } from '@/state/descentStore';
import { bodyById } from '@/content/universe';

/**
 * Minimal diegetic HUD — location readout + aria-live narration channel (§15).
 * No menus, no nav bar. Fades with journey state.
 *
 * First impression rule: the entire galaxy chapter plays without ANY chrome.
 * The HUD exists only after the descent lands in the solar system — until
 * then nothing reminds the viewer they're on a website.
 */
const HUD_REVEAL_DELAY_MS = 1600;

export function JourneyHud() {
  const location = useJourneyStore((s) => s.location);
  const destination = useJourneyStore((s) => s.destination);
  const phase = useJourneyStore((s) => s.phase);
  const toggleLog = useUiStore((s) => s.toggleMissionLog);
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!arrived) return;
    const t = window.setTimeout(() => setRevealed(true), HUD_REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [arrived]);

  const traveling = phase === 'ACCEL' || phase === 'CRUISE' || phase === 'DECEL';
  const label = traveling
    ? `Traveling — ${bodyById.get(destination ?? '')?.name ?? ''}`
    : bodyById.get(location)?.name ?? '';

  if (!arrived) return null;

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
