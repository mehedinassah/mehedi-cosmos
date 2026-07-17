'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CentralStar } from '@/world/sun/CentralStar';
import { SolarSystem } from '@/world/system/SolarSystem';
import { sunActivity } from '@/world/sun/sunActivity';
import { useDescentStore, nowS } from '@/state/descentStore';

/**
 * systemPresence — 1 = the solar system at its normal self (galaxy chapter,
 * descent, all planet chapters); ramps toward a floor ONLY during the loop
 * climb out from Pluto, so the whole system shrinks to a small speck and its
 * Sun dims. In this scene the solar system is nearly as wide as the galaxy
 * disc, so on the ascent it would otherwise read as almost as big as the
 * galaxy — wrong. Shrinking + dimming it makes it a believable tiny thing
 * inside the vast galaxy while it is still visible. Module ref (not store
 * state) so per-frame writes never re-render; CentralStar reads it to dim.
 */
export const systemPresence = { value: 1 };

// The system fades HARD on the ascent: shrinks to a tiny point and its light
// goes to zero, so it is gone almost as soon as we leave Pluto, never a disc
// catching the eye at galaxy level.
const MIN_SCALE = 0.02; // contracts to a sub-pixel dot
const LIGHT_FLOOR = 0.0; // the planets go dark (invisible) as we leave

// The rig is ALWAYS mounted (so the Sun shaders compile at load, not on
// arrival). presence maps to what we want to see per stage:
//   DORMANT / DESCENDING -> 0  (invisible dark speck at the origin; the Sun is
//                               still compiled and ready, just not shown)
//   ARRIVED              -> 1  (blooms in — grows + ignites together, never a
//                               big dark occluding sphere)
//   LOOPING              -> 1 -> 0 fast on the climb out
function presenceTarget(stage: string, lp: number): number {
  if (stage === 'ARRIVED') return 1;
  if (stage === 'LOOPING') return 1 - THREE.MathUtils.smoothstep(lp, 0.0, 0.28);
  return 0;
}

/**
 * Wraps the whole solar system in one group so the loop can shrink and dim it
 * as a unit — starting at full size right at Pluto (no jump), contracting to a
 * speck as we climb toward the galaxy. Everywhere else it stays full size.
 */
export function SystemLoopRig() {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    const d = useDescentStore.getState();
    const lp = d.stage === 'LOOPING' ? THREE.MathUtils.clamp((nowS() - d.tStart) / d.tDur, 0, 1) : 0;
    const target = presenceTarget(d.stage, lp);
    // Damp everywhere so arrival BLOOMS in (0 -> 1 over ~0.5s: grows + ignites
    // together, no pop, no dark sphere) and the loop fade stays smooth.
    systemPresence.value = THREE.MathUtils.damp(systemPresence.value, target, 4.5, delta);
    const p = systemPresence.value;
    if (groupRef.current) groupRef.current.scale.setScalar(MIN_SCALE + (1 - MIN_SCALE) * p);
    if (lightRef.current) {
      // The star's light is alive, not static: a ~1.5% activity shimmer (two
      // incommensurate breaths so it never obviously repeats), plus a brief few
      // percent lift while a flare erupts. Never enough to read as flicker.
      const t = state.clock.elapsedTime;
      const shimmer = 1 + 0.009 * Math.sin(t * 0.73) + 0.006 * Math.sin(t * 2.17 + 1.3)
        + 0.03 * sunActivity.flare;
      lightRef.current.intensity = 2.6 * (LIGHT_FLOOR + (1 - LIGHT_FLOOR) * p) * shimmer;
    }
  });

  return (
    <group ref={groupRef}>
      {/* The one real light: textured worlds actually use it, so decay stays 0
          for readable lighting across 20k units. Dimmed on the loop ascent. */}
      <pointLight ref={lightRef} position={[0, 0, 0]} intensity={2.6} distance={0} decay={0} color="#fff2dc" />
      <CentralStar />
      <SolarSystem />
    </group>
  );
}
