/**
 * Shared, per-frame solar-activity state — a module ref (not store state) so
 * the Sun's sub-systems can read each other's live values without re-rendering
 * at 60fps.
 *   ignite  0..1  the star's overall "on" level (intro ignition x loop-presence)
 *   flare   0..1  current flare-glow brightness, spikes during an eruption
 * CentralStar writes `ignite`; PlasmaEjecta writes `flare`. CoronalLoops reads
 * both (gate + flare-driven brightening near the eruption); the system light
 * reads them for its tiny activity fluctuation.
 */
export const sunActivity = { ignite: 0, flare: 0 };
