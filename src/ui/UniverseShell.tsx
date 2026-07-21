'use client';

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

  // Phones get the gate — never mount the heavy WebGL universe there. While the
  // class is still 'unknown' (SSR + first paint) we render the full shell, so
  // desktop loads the canvas instantly with no hydration mismatch.
  if (device === 'mobile') return <MobileGate />;

  return (
    <>
      <UniverseCanvas />
      <Preloader />
      <IntroSequence />
      <DescentOverlay />
      <JourneyHud />
      <MissionLog />
    </>
  );
}
