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
};
