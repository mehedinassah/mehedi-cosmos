import { create } from 'zustand';

/** Region lifecycle — blueprint §3.2. */
export type RegionState = 'COLD' | 'WARMING' | 'ACTIVE' | 'SUSPENDED';

interface WorldState {
  regions: Record<string, RegionState>;
  discovered: Record<string, boolean>; // "visited Whispers"
  setRegionState: (id: string, state: RegionState) => void;
  markDiscovered: (id: string) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  regions: {},
  discovered: {},
  setRegionState: (id, state) =>
    set((s) => ({ regions: { ...s.regions, [id]: state } })),
  markDiscovered: (id) =>
    set((s) => (s.discovered[id] ? s : { discovered: { ...s.discovered, [id]: true } })),
}));
