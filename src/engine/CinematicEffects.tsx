'use client';

import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useQualityStore } from '@/state/qualityStore';
import { HeatShimmer } from '@/engine/HeatShimmer';

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
  // When the governor is fighting to hold framerate it flags postLite; we then
  // keep only the passes that define the look (bloom + colour grade + vignette)
  // and drop the costlier distortion/grain passes. Toggles rarely, so the one
  // composer remount is a non-issue. Mobile (tier <= 1) ALWAYS runs the lite
  // pipeline: bloom is what makes the planets read as lit/glowing rather than
  // dark night-side discs, but the full distortion/grain stack is too heavy for
  // a phone — so we keep the cheap essentials and drop the rest.
  const postLite = useQualityStore((s) => s.postLite);
  const tier = useQualityStore((s) => s.tier);
  if (!postEnabled) return null;

  if (postLite || tier <= 1) {
    return (
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.4} luminanceThreshold={0.92} luminanceSmoothing={0.24} mipmapBlur radius={0.6} />
        <HueSaturation hue={0} saturation={0.06} />
        <BrightnessContrast brightness={-0.03} contrast={0.11} />
        <Vignette eskil={false} offset={0.24} darkness={0.68} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      {/* Heat haze in a thin ring around the star — distorts the scene render
          only (DOM UI untouched); first so bloom lands on the rippled edge */}
      <HeatShimmer />
      {/* Threshold sits high enough that the sun close-up (system chapter)
          reads as plasma with a corona, not a full-frame white wash */}
      <Bloom
        intensity={0.43}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.24}
        mipmapBlur
        radius={0.7}
      />
      <ChromaticAberration offset={[0.0005, 0.0005]} radialModulation modulationOffset={0.6} />
      {/* Nudge back toward richer color and deeper, higher-contrast blacks —
          cinematic NASA look without oversaturation. */}
      <HueSaturation hue={0} saturation={0.06} />
      <BrightnessContrast brightness={-0.03} contrast={0.11} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} />
      <Vignette eskil={false} offset={0.24} darkness={0.68} />
    </EffectComposer>
  );
}
