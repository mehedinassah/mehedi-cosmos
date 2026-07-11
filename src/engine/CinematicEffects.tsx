'use client';

import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useQualityStore } from '@/state/qualityStore';

/**
 * Cinematic post pipeline — elegant, never overdone.
 * Bloom is luminance-gated (only the sun, corona, city lights, and star
 * cores bloom). Grain and CA sit at perceptual threshold: felt, not seen.
 * Gated by quality tier; composition survives with post off.
 */
export function CinematicEffects() {
  const postEnabled = useQualityStore((s) => s.postEnabled);
  if (!postEnabled) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.85}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.28}
        mipmapBlur
        radius={0.72}
      />
      <ChromaticAberration offset={[0.00045, 0.00045]} radialModulation modulationOffset={0.6} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.045} />
      <Vignette eskil={false} offset={0.22} darkness={0.62} />
    </EffectComposer>
  );
}
