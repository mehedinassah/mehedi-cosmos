'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Preloader } from '@/ui/intro/Preloader';
import { IntroSequence } from '@/ui/intro/IntroSequence';
import { JourneyHud } from '@/ui/hud/JourneyHud';
import { MissionLog } from '@/ui/log/MissionLog';
import { DescentOverlay } from '@/ui/descent/DescentOverlay';
import { MobileGate, useDeviceClass } from '@/ui/MobileGate';

const UniverseCanvas = dynamic(
  () => import('@/engine/UniverseCanvas').then((m) => m.UniverseCanvas),
  { ssr: false }, // WebGL is client-only; darkness (CSS) is the first pixel
);

export function UniverseShell() {
  const device = useDeviceClass();
  // The universe canvas mounts immediately but stays PAUSED (frameloop="never")
  // and compiles its shaders in the background while the black-hole preloader
  // spins — so the spin/dive keep the main thread and stay smooth, and the
  // reveal lands on an already-compiled scene with no freeze. The intro/HUD
  // overlays mount only at reveal (so the galaxy forms as the overlay fades).
  const [revealed, setRevealed] = useState(false);

  // Phones get the gate — never mount the heavy WebGL universe there. While the
  // class is still 'unknown' (SSR + first paint) we render the full shell, so
  // desktop loads with no hydration mismatch.
  if (device === 'mobile') return <MobileGate />;

  return (
    <>
      <UniverseCanvas />
      {revealed && (
        <>
          <IntroSequence />
          <DescentOverlay />
          <JourneyHud />
          <MissionLog />
        </>
      )}
      <Preloader onReveal={() => setRevealed(true)} />
    </>
  );
}
