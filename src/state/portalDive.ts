import * as THREE from 'three';

/**
 * Jupiter → Perico ERP portal dive — a shared, per-frame module ref (not store
 * state, so the camera and the portal visual can read/write it at 60fps without
 * re-rendering). `active` gates the dive; `t` (0..1) is its eased progress;
 * `target` is the world point the camera falls toward (inside the Great Red
 * Spot). CameraDirector reads it to override the parked pose and dive in;
 * JupiterPortal drives `t`, grows the vortex, and navigates when it lands.
 */
export const portalDive = {
  active: false,
  t: 0,
  target: new THREE.Vector3(),
};
