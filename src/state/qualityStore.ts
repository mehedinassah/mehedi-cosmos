import { create } from 'zustand';

/** Quality tiers — blueprint §9. Degradation ladder preserves composition, cuts fidelity. */
export type GpuTier = 0 | 1 | 2 | 3; // 0 = fallback/log-mode, 3 = desktop dGPU

interface QualityState {
  tier: GpuTier;
  resolutionScale: number;
  dprClamp: number;
  particleScale: number;   // multiplier on all particle counts
  volumetricSteps: number; // raymarch step budget
  postEnabled: boolean;
  reducedMotion: boolean;
  setTier: (tier: GpuTier) => void;
  setReducedMotion: (v: boolean) => void;
}

const TIER_PRESETS: Record<GpuTier, Omit<QualityState, 'tier' | 'setTier' | 'reducedMotion' | 'setReducedMotion'>> = {
  0: { resolutionScale: 0.6, dprClamp: 1, particleScale: 0.1, volumetricSteps: 0, postEnabled: false },
  1: { resolutionScale: 0.7, dprClamp: 1.5, particleScale: 0.25, volumetricSteps: 16, postEnabled: false },
  2: { resolutionScale: 0.85, dprClamp: 2, particleScale: 0.6, volumetricSteps: 32, postEnabled: true },
  3: { resolutionScale: 1.0, dprClamp: 2, particleScale: 1.0, volumetricSteps: 64, postEnabled: true },
};

export const useQualityStore = create<QualityState>((set) => ({
  tier: 2,
  ...TIER_PRESETS[2],
  reducedMotion: false,
  setTier: (tier) => set({ tier, ...TIER_PRESETS[tier] }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
