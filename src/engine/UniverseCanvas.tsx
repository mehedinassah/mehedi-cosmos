'use client';

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Starfield } from '@/world/ambient/Starfield';
import { DeepSpace } from '@/world/ambient/DeepSpace';
import { HeroGalaxy } from '@/world/galaxy/HeroGalaxy';
import { LoopWarpField } from '@/world/galaxy/LoopWarpField';
import { DescentField } from '@/world/galaxy/DescentField';
import { SystemLoopRig } from '@/world/system/SystemLoopRig';
import { CameraDirector } from '@/camera/CameraDirector';
import { CinematicEffects } from '@/engine/CinematicEffects';
import { probeCapabilities, prefersReducedMotion } from '@/engine/capabilities';
import { useQualityStore } from '@/state/qualityStore';
import { useDescentStore } from '@/state/descentStore';

/**
 * The single persistent Canvas — blueprint §3.1. The page never changes;
 * this canvas IS the site.
 */

// Every loader shares THREE.Cache, so warming a URL here means the system
// chapter's materials find it instantly — the viewer must never see a
// texture pop in mid-journey.
THREE.Cache.enabled = true;
const PRELOAD_TEXTURES = [
  '/textures/2k_sun.jpg',
  '/textures/2k_mercury.jpg',
  '/textures/2k_venus_atmosphere.jpg',
  '/textures/2k_earth_daymap.jpg',
  '/textures/2k_earth_nightmap.jpg',
  '/textures/2k_earth_clouds.jpg',
  '/textures/2k_moon.jpg',
  '/textures/2k_mars.jpg',
  '/textures/2k_jupiter.jpg',
  '/textures/2k_saturn.jpg',
  '/textures/2k_saturn_ring_alpha.png',
  '/textures/2k_uranus.jpg',
  '/textures/2k_neptune.jpg',
];

export function UniverseCanvas() {
  const dprClamp = useQualityStore((s) => s.dprClamp);
  const resolutionScale = useQualityStore((s) => s.resolutionScale);
  // Chapter gate: galaxy + descent until the dive lands, then the system.
  // The swap happens under the destination star's flare + arrival flash.
  // During the LOOP home, the first half still shows the receding system;
  // the second half shows the galaxy re-emerging (the swap is masked by the
  // near-empty deep space between them).
  const stage = useDescentStore((s) => s.stage);
  // ONE persistent universe. The galaxy is ALWAYS mounted — built once at
  // load and never rebuilt — so nothing ever loads mid-journey (mounting its
  // 24k+ procedural stars during the loop froze a frame and read as
  // "still image, then the galaxy pops in"). During the system chapter the
  // galaxy simply sits far behind the camera, out of frame. The system is
  // mounted from arrival through the whole loop home; the dive scenery only
  // exists for the galaxy->sun descent.
  const showGalaxy = true;
  const showSystem = stage === 'ARRIVED' || stage === 'LOOPING';
  const showDescentField = stage === 'DORMANT' || stage === 'DESCENDING';

  useEffect(() => {
    const { tier } = probeCapabilities();
    useQualityStore.getState().setTier(tier);
    useQualityStore.getState().setReducedMotion(prefersReducedMotion());
    // Warm every journey texture during the galaxy intro (idle time), so
    // the arrival in the system never shows an untextured first frame.
    const loader = new THREE.TextureLoader();
    const warm = () => PRELOAD_TEXTURES.forEach((url) => loader.load(url));
    const ric = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (ric) ric(warm);
    else window.setTimeout(warm, 1200);
  }, []);

  return (
    <Canvas
      className="universe-canvas"
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, dprClamp) * resolutionScale}
      camera={{ fov: 50, near: 1, far: 120000, position: [0, 120, 1400] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#010104');
        gl.toneMappingExposure = 1.18;
      }}
    >
      <CameraDirector />
      <ambientLight intensity={0.03} />
      <Starfield />
      <DeepSpace />
      {showGalaxy && <HeroGalaxy />}
      {/* Star-dust streamed past only while the loop is actually flying; makes
          the empty crossing read as real speed. Cheap + self-gating. */}
      <LoopWarpField />
      {showDescentField && <DescentField />}
      {/* The solar system, wrapped so the loop can shrink + dim it to a speck
          on the climb out to the galaxy (SystemLoopRig). */}
      {showSystem && <SystemLoopRig />}
      <CinematicEffects />
    </Canvas>
  );
}
