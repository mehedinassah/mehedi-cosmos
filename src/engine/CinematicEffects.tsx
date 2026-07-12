'use client';

import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useQualityStore } from '@/state/qualityStore';

/**
 * Cinematic post pipeline. Every pass is restrained by design — nothing
 * announces itself. Bloom catches only true light sources (galaxy core,
 * arm clusters, bright stars). Color grade nudges toward navy/gold, away
 * from the neutral-gray render default.
 *
 * NOTE: the sun-anchored GodRays pass was removed with the galaxy-hero
 * reframe (the sun is no longer in-frame). Restore it from git history if
 * the solar-system journey is brought back.
 */
export function CinematicEffects() {
  const postEnabled = useQualityStore((s) => s.postEnabled);
  if (!postEnabled) return null;

  return (
    <EffectComposer multisampling={0}>
      {/* Threshold sits high enough that the sun close-up (system chapter)
          reads as plasma with a corona, not a full-frame white wash */}
      <Bloom
        intensity={0.5}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.24}
        mipmapBlur
        radius={0.7}
      />
      <ChromaticAberration offset={[0.0005, 0.0005]} radialModulation modulationOffset={0.6} />
      <HueSaturation hue={0} saturation={-0.06} />
      <BrightnessContrast brightness={-0.015} contrast={0.06} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.04} />
      <Vignette eskil={false} offset={0.24} darkness={0.66} />
    </EffectComposer>
  );
}
