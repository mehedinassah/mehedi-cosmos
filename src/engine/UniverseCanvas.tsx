'use client';

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Starfield } from '@/world/ambient/Starfield';
import { DeepSpace } from '@/world/ambient/DeepSpace';
import { ImpostorField } from '@/world/ambient/ImpostorField';
import { CentralStar } from '@/world/sun/CentralStar';
import { CameraDirector } from '@/camera/CameraDirector';
import { CinematicEffects } from '@/engine/CinematicEffects';
import { probeCapabilities, prefersReducedMotion } from '@/engine/capabilities';
import { useQualityStore } from '@/state/qualityStore';

/**
 * The single persistent Canvas — blueprint §3.1. The page never changes;
 * this canvas IS the site.
 */
export function UniverseCanvas() {
  const dprClamp = useQualityStore((s) => s.dprClamp);
  const resolutionScale = useQualityStore((s) => s.resolutionScale);

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
      onCreated={({ gl }) => gl.setClearColor('#020207')}
    >
      <CameraDirector />
      <ambientLight intensity={0.03} />
      {/* The sun is the sole key light of the system */}
      <pointLight position={[0, 0, 0]} intensity={2.2} distance={0} decay={0.35} color="#ffd9a0" />
      <Starfield />
      <DeepSpace />
      <CentralStar />
      <ImpostorField />
      <CinematicEffects />
    </Canvas>
  );
}
