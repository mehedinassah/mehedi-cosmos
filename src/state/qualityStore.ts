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
  // --- live, adaptively-tuned render settings ---
  // perfDpr is the pixel ratio the Canvas actually renders at; the runtime
  // PerformanceMonitor raises it toward perfMaxDpr when frames are cheap and
  // lowers it toward perfMinDpr when they get expensive, so the scene stays
  // smooth on any machine. postLite sheds the non-essential post passes at the
  // floor. Changing these is rare (only on a sustained fps shift), so it never
  // churns per frame.
  perfDpr: number;
  perfMinDpr: number;
  perfMaxDpr: number;
  postLite: boolean;
  setTier: (tier: GpuTier) => void;
  setReducedMotion: (v: boolean) => void;
  initPerf: (deviceDpr: number) => void;
  setPerfDpr: (v: number) => void;
  setPostLite: (v: boolean) => void;
}

const TIER_PRESETS: Record<GpuTier, Omit<QualityState, 'tier' | 'setTier' | 'reducedMotion' | 'setReducedMotion' | 'perfDpr' | 'perfMinDpr' | 'perfMaxDpr' | 'postLite' | 'initPerf' | 'setPerfDpr' | 'setPostLite'>> = {
  0: { resolutionScale: 0.6, dprClamp: 1, particleScale: 0.1, volumetricSteps: 0, postEnabled: false },
  1: { resolutionScale: 0.7, dprClamp: 1.5, particleScale: 0.25, volumetricSteps: 16, postEnabled: false },
  2: { resolutionScale: 0.85, dprClamp: 2, particleScale: 0.6, volumetricSteps: 32, postEnabled: true },
  3: { resolutionScale: 1.0, dprClamp: 2, particleScale: 1.0, volumetricSteps: 64, postEnabled: true },
};

// The DPR ceiling per tier. Beyond ~1.5 the extra pixels cost a lot and buy
// almost nothing visible for this scene, so even top tiers are capped there.
const DPR_RANGE: Record<GpuTier, { min: number; max: number }> = {
  0: { min: 0.6, max: 1.0 },
  1: { min: 0.75, max: 1.25 },
  2: { min: 1.0, max: 1.5 },
  3: { min: 1.0, max: 1.5 },
};

export const useQualityStore = create<QualityState>((set, get) => ({
  tier: 2,
  ...TIER_PRESETS[2],
  reducedMotion: false,
  perfDpr: 1.25,
  perfMinDpr: 1.0,
  perfMaxDpr: 1.5,
  postLite: false,
  setTier: (tier) => set({ tier, ...TIER_PRESETS[tier] }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  initPerf: (deviceDpr) => {
    const range = DPR_RANGE[get().tier];
    const max = Math.min(deviceDpr || 1, range.max);
    const min = Math.min(max, range.min);
    set({ perfMaxDpr: max, perfMinDpr: min, perfDpr: max, postLite: false });
  },
  setPerfDpr: (v) => set({ perfDpr: v }),
  setPostLite: (v) => set({ postLite: v }),
}));
