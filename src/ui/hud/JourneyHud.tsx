'use client';

import { useJourneyStore } from '@/state/journeyStore';
import { useUiStore } from '@/state/uiStore';
import { bodyById } from '@/content/universe';

/**
 * Minimal diegetic HUD — location readout + aria-live narration channel (§15).
 * No menus, no nav bar. Fades with journey state.
 */
export function JourneyHud() {
  const phase = useJourneyStore((s) => s.phase);
  const location = useJourneyStore((s) => s.location);
  const destination = useJourneyStore((s) => s.destination);
  const toggleLog = useUiStore((s) => s.toggleMissionLog);

  const traveling = phase === 'ACCEL' || phase === 'CRUISE' || phase === 'DECEL';
  const label = traveling
    ? `Traveling — ${bodyById.get(destination ?? '')?.name ?? ''}`
    : bodyById.get(location)?.name ?? '';

  if (phase === 'INTRO') return null;

  return (
    <>
      <div className="hud" aria-hidden="true">
        <span className="hud__location">{label}</span>
        <button className="hud__log" onClick={toggleLog} title="Mission Log (M)">
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
