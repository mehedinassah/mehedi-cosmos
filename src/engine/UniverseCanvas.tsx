'use client';

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Starfield } from '@/world/ambient/Starfield';
import { DeepSpace } from '@/world/ambient/DeepSpace';
import { HeroGalaxy } from '@/world/galaxy/HeroGalaxy';
import { DescentField } from '@/world/galaxy/DescentField';
import { SolarSystem } from '@/world/system/SolarSystem';
import { CentralStar } from '@/world/sun/CentralStar';
import { CameraDirector } from '@/camera/CameraDirector';
import { CinematicEffects } from '@/engine/CinematicEffects';
import { probeCapabilities, prefersReducedMotion } from '@/engine/capabilities';
import { useQualityStore } from '@/state/qualityStore';
import { useDescentStore } from '@/state/descentStore';

/**
 * The single persistent Canvas — blueprint §3.1. The page never changes;
 * this canvas IS the site.
 */

export function UniverseCanvas() {
  const dprClamp = useQualityStore((s) => s.dprClamp);
  const resolutionScale = useQualityStore((s) => s.resolutionScale);
  // Chapter gate: galaxy + descent until the dive lands, then the system.
  // The swap happens under the destination star's flare + arrival flash.
  const arrived = useDescentStore((s) => s.stage === 'ARRIVED');

  useEffect(() => {
    const { tier } = probeCapabilities();
    useQualityStore.getState().setTier(tier);
    useQualityStore.getState().setReducedMotion(prefersReducedMotion());
  }, []);

  return (
    <Canvas
      className="universe-canvas"
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, dprClamp) * resolutionScale}
      camera={{ fov: 50, near: 1, far: 120000, position: [0, 120, 1400] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#010104');
        gl.toneMappingExposure = 1.18;
      }}
    >
      <CameraDirector />
      <ambientLight intensity={0.03} />
      <Starfield />
      <DeepSpace />
      {!arrived && (
        <>
          <HeroGalaxy />
          <DescentField />
        </>
      )}
      {arrived && (
        <>
          {/* The one real light: textured worlds (MeshStandard) actually use
              it now, so decay stays 0 for readable lighting across 20k units */}
          <pointLight position={[0, 0, 0]} intensity={2.6} distance={0} decay={0} color="#fff2dc" />
          <CentralStar />
          <SolarSystem />
        </>
      )}
      <CinematicEffects />
    </Canvas>
  );
}
