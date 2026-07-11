'use client';

import dynamic from 'next/dynamic';
import { IntroSequence } from '@/ui/intro/IntroSequence';
import { JourneyHud } from '@/ui/hud/JourneyHud';
import { MissionLog } from '@/ui/log/MissionLog';

const UniverseCanvas = dynamic(
  () => import('@/engine/UniverseCanvas').then((m) => m.UniverseCanvas),
  { ssr: false }, // WebGL is client-only; darkness (CSS) is the first pixel
);

export function UniverseShell() {
  return (
    <>
      <UniverseCanvas />
      <IntroSequence />
      <JourneyHud />
      <MissionLog />
    </>
  );
}
