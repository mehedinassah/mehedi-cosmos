'use client';

import { useEffect, useState } from 'react';
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
import { AdaptiveQuality } from '@/engine/AdaptiveQuality';
import { probeCapabilities, prefersReducedMotion } from '@/engine/capabilities';
import { useQualityStore } from '@/state/qualityStore';
import { useDescentStore } from '@/state/descentStore';
import { loadSignals } from '@/state/loadSignals';

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
  // Live, adaptively-tuned pixel ratio (see AdaptiveQuality). Capped well below
  // raw retina DPR — the biggest single per-frame GPU saving.
  const perfDpr = useQualityStore((s) => s.perfDpr);
  // Chapter gate: galaxy + descent until the dive lands, then the system.
  // The swap happens under the destination star's flare + arrival flash.
  // During the LOOP home, the first half still shows the receding system;
  // the second half shows the galaxy re-emerging (the swap is masked by the
  // near-empty deep space between them).
  const stage = useDescentStore((s) => s.stage);
  // The solar system + Sun are the heaviest shaders in the app and are invisible
  // during the galaxy view, so we DON'T compile them at load (that wall of
  // compilation was the "stuck for a few seconds" freeze). They mount once the
  // preloader has revealed the galaxy, then compile quietly during the galaxy
  // rest — long before the visitor ever scrolls down to them.
  const [mountSystem, setMountSystem] = useState(false);
  useEffect(() => {
    if (mountSystem) return;
    let raf = 0;
    const check = () => {
      if (loadSignals.revealed) setMountSystem(true);
      else raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [mountSystem]);
  // ONE persistent universe. The galaxy is ALWAYS mounted — built once at
  // load and never rebuilt — so nothing ever loads mid-journey (mounting its
  // 24k+ procedural stars during the loop froze a frame and read as
  // "still image, then the galaxy pops in"). During the system chapter the
  // galaxy simply sits far behind the camera, out of frame. The system is
  // mounted from arrival through the whole loop home; the dive scenery only
  // exists for the galaxy->sun descent.
  const showGalaxy = true;
  const showDescentField = stage === 'DORMANT' || stage === 'DESCENDING';

  useEffect(() => {
    const { tier } = probeCapabilities();
    useQualityStore.getState().setTier(tier);
    useQualityStore.getState().initPerf(window.devicePixelRatio || 1);
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
      dpr={perfDpr}
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
      {/* The solar system + Sun (the heaviest shaders) mount only AFTER the
          preloader reveals the galaxy — not at load, where compiling them added
          seconds to the freeze. They then compile during the galaxy rest, long
          before the visitor scrolls to them (still well ahead of arrival, so no
          on-arrival stall). SystemLoopRig keeps them an invisible dark speck
          until arrival, blooms them in on arrival, dims them out on the loop. */}
      {mountSystem && <SystemLoopRig />}
      <CinematicEffects />
      <AdaptiveQuality />
    </Canvas>
  );
}
