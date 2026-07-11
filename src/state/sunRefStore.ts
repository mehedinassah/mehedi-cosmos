import { create } from 'zustand';
import type * as THREE from 'three';

/** Non-content ref bridge: the sun mesh, exposed for GodRays anchoring. */
interface SunRefState {
  mesh: THREE.Mesh | null;
  setMesh: (m: THREE.Mesh | null) => void;
}

export const useSunRefStore = create<SunRefState>((set) => ({
  mesh: null,
  setMesh: (mesh) => set({ mesh }),
}));
