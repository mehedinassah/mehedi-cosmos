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

// The DPR ceiling per tier. Capable tiers render at the display's native
// ratio (up to 2.0) so the galaxy stays razor-sharp on retina — that is the
// hero quality, and we never cut it blindly. The adaptive governor
// (AdaptiveQuality) is the safety net: it lowers perfDpr toward `min` ONLY when
// a machine genuinely can't hold frame rate, so the cost is shed invisibly
// instead of up front. (Past 2.0 the extra pixels buy nothing here, so that is
// the hard ceiling.)
// `min` is the softest the adaptive governor is ever allowed to render at.
// On capable tiers we keep it at (or just below) native so the hero galaxy can
// never be parked in a blurry low-DPR state by a transient frame dip — the
// governor sheds cost elsewhere (post passes, particle drift) before it touches
// hero sharpness. A tier-3 machine on a 1.5x display is therefore pinned at 1.5
// (native), exactly the crisp look; a 2x retina can ease to 1.5 and still stay
// sharp.
const DPR_RANGE: Record<GpuTier, { min: number; max: number }> = {
  0: { min: 0.6, max: 1.0 },
  // Phones/tablets land on tier 1. The old 1.35 ceiling rendered a 2x-3x phone
  // display at well under half its native resolution — the scene looked like
  // "144p" upscaled. Modern phones can drive 2x for this (deliberately light)
  // tier: no post, reduced particles, fewer volumetric steps. Start at native
  // (up to 2x) and let the governor ease DOWN toward 1.0 only if a specific
  // device can't hold frame rate — sharp by default, smooth as the fallback.
  1: { min: 1.25, max: 2.5 },
  2: { min: 1.25, max: 1.75 },
  3: { min: 1.5, max: 2.0 },
};

export const useQualityStore = create<QualityState>((set, get) => ({
  tier: 2,
  ...TIER_PRESETS[2],
  reducedMotion: false,
  perfDpr: 1.5,
  perfMinDpr: 1.0,
  perfMaxDpr: 1.75,
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
