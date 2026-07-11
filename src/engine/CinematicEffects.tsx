'use client';

import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration, GodRays, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useQualityStore } from '@/state/qualityStore';
import { useSunRefStore } from '@/state/sunRefStore';

/**
 * Cinematic post pipeline. Every pass is restrained by design — nothing
 * announces itself. Bloom catches only true light sources (sun, corona,
 * city lights, star cores). GodRays anchor to the sun mesh once mounted.
 * Color grade nudges toward navy/gold, away from neutral-gray render default.
 */
export function CinematicEffects() {
  const postEnabled = useQualityStore((s) => s.postEnabled);
  const sunMesh = useSunRefStore((s) => s.mesh);
  if (!postEnabled || !sunMesh) return null;

  return (
    <EffectComposer multisampling={0}>
      <GodRays
        sun={sunMesh}
        samples={40}
        density={0.92}
        decay={0.94}
        weight={0.35}
        exposure={0.28}
        clampMax={0.9}
        blur
        kernelSize={KernelSize.SMALL}
      />
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.28}
        mipmapBlur
        radius={0.74}
      />
      <ChromaticAberration offset={[0.0005, 0.0005]} radialModulation modulationOffset={0.6} />
      <HueSaturation hue={0} saturation={-0.06} />
      <BrightnessContrast brightness={-0.015} contrast={0.06} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.04} />
      <Vignette eskil={false} offset={0.24} darkness={0.66} />
    </EffectComposer>
  );
}
