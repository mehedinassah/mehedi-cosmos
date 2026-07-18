import * as THREE from 'three';

/**
 * Cursor-driven magnetic perturbation — a shared, per-frame module ref. The
 * visitor's cursor does NOT rotate the star; instead it nudges the magnetic
 * field: `dir` is the world-space direction on the sphere nearest the cursor
 * ray, `str` (0..1) is how strongly the field is being perturbed there (1 over
 * the disc, fading to 0 away from it, damped so it settles back when the cursor
 * leaves). Prominences bend toward it, the corona ripples, plasma drifts toward
 * it. CentralStar computes it; Prominences and the corona shells read it.
 */
export const sunCursor = { dir: new THREE.Vector3(1, 0, 0), str: 0 };
