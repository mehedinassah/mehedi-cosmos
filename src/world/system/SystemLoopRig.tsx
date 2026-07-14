'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CentralStar } from '@/world/sun/CentralStar';
import { SolarSystem } from '@/world/system/SolarSystem';
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
// goes to zero, so at galaxy level it is a faint speck at most, never a
// detailed disc catching the eye. Still visible small early in the climb.
const MIN_SCALE = 0.025; // contracts to a sub-pixel dot at full ascent
const LIGHT_FLOOR = 0.0; // the planets go dark (invisible) as we leave

/**
 * Wraps the whole solar system in one group so the loop can shrink and dim it
 * as a unit — starting at full size right at Pluto (no jump), contracting to a
 * speck as we climb toward the galaxy. Everywhere else it stays full size.
 */
export function SystemLoopRig() {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const d = useDescentStore.getState();
    if (d.stage === 'LOOPING') {
      const lp = THREE.MathUtils.clamp((nowS() - d.tStart) / d.tDur, 0, 1);
      // Full at Pluto (lp 0), shrunk+dimmed to the floor by mid-ascent.
      const target = 1 - THREE.MathUtils.smoothstep(lp, 0.05, 0.55);
      systemPresence.value = THREE.MathUtils.damp(systemPresence.value, target, 4, delta);
    } else {
      systemPresence.value = 1; // full size in every other stage
    }
    const p = systemPresence.value;
    if (groupRef.current) groupRef.current.scale.setScalar(MIN_SCALE + (1 - MIN_SCALE) * p);
    if (lightRef.current) lightRef.current.intensity = 2.6 * (LIGHT_FLOOR + (1 - LIGHT_FLOOR) * p);
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
