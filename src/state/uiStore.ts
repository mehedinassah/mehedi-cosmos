import { create } from 'zustand';

export type IntroPhase = 'DARKNESS' | 'PARTICLE' | 'FORMATION' | 'IDENTITY' | 'HANDOFF' | 'DONE';

interface UiState {
  introPhase: IntroPhase;
  hoverTarget: string | null; // body id
  missionLogOpen: boolean;
  setIntroPhase: (p: IntroPhase) => void;
  setHoverTarget: (id: string | null) => void;
  toggleMissionLog: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  introPhase: 'DARKNESS',
  hoverTarget: null,
  missionLogOpen: false,
  setIntroPhase: (introPhase) => set({ introPhase }),
  setHoverTarget: (hoverTarget) => set({ hoverTarget }),
  toggleMissionLog: () => set((s) => ({ missionLogOpen: !s.missionLogOpen })),
}));
