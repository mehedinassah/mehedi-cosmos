'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { useQualityStore } from '@/state/qualityStore';

/**
 * Runtime performance governor. Watches the real frame rate and nudges the
 * render pixel ratio up (frames cheap) or down (frames expensive) between the
 * tier's min/max, and sheds the non-essential post passes at the floor. This is
 * what keeps the journey smooth on any machine instead of locking a static
 * guess: a laptop that can't hold 60fps at full DPR simply renders a touch
 * softer rather than stuttering. Adjustments fire only on a sustained fps
 * change (never per frame), so there is no churn.
 */
const STEP = 0.25;

function nudge(dir: number) {
  const q = useQualityStore.getState();
  const next = Math.min(q.perfMaxDpr, Math.max(q.perfMinDpr, q.perfDpr + dir * STEP));
  if (Math.abs(next - q.perfDpr) > 0.001) q.setPerfDpr(next);
  // At the DPR floor we're already struggling — drop the extra post passes too.
  const lite = next <= q.perfMinDpr + 0.001;
  if (lite !== q.postLite) q.setPostLite(lite);
}

export function AdaptiveQuality() {
  return (
    <PerformanceMonitor
      // average over enough frames that a single hitch doesn't trigger a change
      iterations={8}
      // acceptable band: below 46fps sustained -> ease quality down; above 57 -> up
      bounds={() => [46, 57]}
      // after a few up/down swaps, settle instead of oscillating forever
      flipflops={4}
      onIncline={() => nudge(+1)}
      onDecline={() => nudge(-1)}
      onFallback={() => {
        const q = useQualityStore.getState();
        q.setPerfDpr(q.perfMinDpr);
        q.setPostLite(true);
      }}
    />
  );
}
