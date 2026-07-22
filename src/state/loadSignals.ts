/**
 * Readiness signals the DOM preloader reads to know when the WebGL scene is
 * actually ready to be revealed. Plain module ref (not store state) so the
 * canvas can flip these from a useFrame without triggering React re-renders.
 *
 *   firstFrame  — the render loop has produced at least one frame
 *   galaxyReady — the galaxy star field finished its off-thread build and the
 *                 whole galaxy is ready to bloom in (see HeroGalaxy)
 *
 * The preloader ignites + hands off to the galaxy the moment both are true.
 */
export const loadSignals = {
  firstFrame: false,
  galaxyReady: false,
  // 0..1 — how far the galaxy has actually bloomed IN (advances only as real
  // frames render, so it can't reach ~1 until the compile stall has cleared and
  // the galaxy is genuinely on screen). The preloader reveals on this, so it
  // never uncovers a half-drawn frame.
  galaxyBloom: 0,
  // flips true when the preloader finishes revealing — the cue to mount the
  // heavy solar system + Sun in the background, once the galaxy is already up.
  revealed: false,
  // flips true when the universe's shaders have finished compiling in the
  // background (via renderer.compileAsync) while the black-hole preloader spins
  // — so the ENTER dive can reveal an already-compiled scene with no freeze.
  warmed: false,
};
