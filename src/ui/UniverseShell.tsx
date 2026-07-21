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
  // The heavy WebGL universe is not mounted until the visitor presses ENTER, so
  // the black-hole preloader spins alone (no shader compile competing for the
  // main thread) and stays smooth. The Preloader triggers this on ENTER, then
  // holds its overlay until the galaxy is genuinely up before fading.
  const [entered, setEntered] = useState(false);

  // Phones get the gate — never mount the heavy WebGL universe there. While the
  // class is still 'unknown' (SSR + first paint) we render the full shell, so
  // desktop loads with no hydration mismatch.
  if (device === 'mobile') return <MobileGate />;

  return (
    <>
      {entered && (
        <>
          <UniverseCanvas />
          <IntroSequence />
          <DescentOverlay />
          <JourneyHud />
          <MissionLog />
        </>
      )}
      <Preloader onEnter={() => setEntered(true)} />
    </>
  );
}
