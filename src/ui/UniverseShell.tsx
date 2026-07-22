'use client';

import { useEffect, useState } from 'react';
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
  // The heavy WebGL universe mounts only once the ENTER dive has closed the
  // screen to darkness — so it builds/compiles behind a STILL, opaque cover with
  // nothing animating (no jank possible), then the galaxy emerges. The black
  // hole spins and dives entirely alone, so those stay perfectly smooth.
  const [mounted, setMounted] = useState(false);

  // Prefetch the (large) universe chunk during the spin — download + parse only,
  // no render, so it can't jank the black hole. This makes the post-dive mount
  // instant instead of waiting on a network fetch. Desktop only.
  useEffect(() => {
    if (device === 'desktop') void import('@/engine/UniverseCanvas');
  }, [device]);

  // Phones get the gate — never mount the heavy WebGL universe there. While the
  // class is still 'unknown' (SSR + first paint) we render the full shell, so
  // desktop loads with no hydration mismatch.
  if (device === 'mobile') return <MobileGate />;

  return (
    <>
      {mounted && (
        <>
          <UniverseCanvas />
          <IntroSequence />
          <DescentOverlay />
          <JourneyHud />
          <MissionLog />
        </>
      )}
      <Preloader onMount={() => setMounted(true)} />
    </>
  );
}
