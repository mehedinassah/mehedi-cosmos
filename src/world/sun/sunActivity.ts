/**
 * Shared, per-frame solar-activity state — a module ref (not store state) so
 * the Sun's sub-systems can read each other's live values without re-rendering
 * at 60fps.
 *   ignite  0..1  the star's overall "on" level (intro ignition x loop-presence)
 *   flare   0..1  current small-flare glow (PlasmaEjecta eruptions)
 *   storm   0..1  a rare magnetic-storm envelope: one region erupts hugely, the
 *                 corona brightens and nearby lighting warms, then it settles
 * CentralStar writes `ignite` and reads `storm` (corona/halo). PlasmaEjecta
 * writes `flare`. Prominences (the magnetic-activity sim) writes `storm`. The
 * system light reads `flare` + `storm` for its living fluctuation.
 */
export const sunActivity = { ignite: 0, flare: 0, storm: 0 };
