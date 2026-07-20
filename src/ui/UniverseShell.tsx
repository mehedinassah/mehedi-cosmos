'use client';

import dynamic from 'next/dynamic';
import { Preloader } from '@/ui/intro/Preloader';
import { IntroSequence } from '@/ui/intro/IntroSequence';
import { JourneyHud } from '@/ui/hud/JourneyHud';
import { MissionLog } from '@/ui/log/MissionLog';
import { DescentOverlay } from '@/ui/descent/DescentOverlay';

const UniverseCanvas = dynamic(
  () => import('@/engine/UniverseCanvas').then((m) => m.UniverseCanvas),
  { ssr: false }, // WebGL is client-only; darkness (CSS) is the first pixel
);

export function UniverseShell() {
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
