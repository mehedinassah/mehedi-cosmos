import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Journey FSM — blueprint §4. The spine of the product.
 * The ONLY way to change location is requestTravel(); legal-transition
 * enforcement is what guarantees "nothing teleports".
 */

export type JourneyPhase =
  | 'INTRO'
  | 'IDLE'
  | 'ACCEL'
  | 'CRUISE'
  | 'DECEL'
  | 'ORBIT'
  | 'FOCUS'
  | 'REVEAL';

const LEGAL: Record<JourneyPhase, JourneyPhase[]> = {
  INTRO: ['IDLE'],
  // IDLE -> ORBIT is the descent-chapter handoff: the scroll dive ends at the
  // destination star and the camera settles into orbit at the sun.
  IDLE: ['ACCEL', 'ORBIT'],
  ACCEL: ['CRUISE'],
  CRUISE: ['DECEL', 'ACCEL'], // ACCEL = mid-cruise re-target (blueprint §5.3)
  DECEL: ['ORBIT'],
  ORBIT: ['FOCUS', 'ACCEL'],
  FOCUS: ['REVEAL', 'ORBIT', 'ACCEL'],
  REVEAL: ['FOCUS', 'ORBIT', 'ACCEL'],
};

interface JourneyState {
  phase: JourneyPhase;
  /** Body id the camera is at / orbiting. */
  location: string;
  /** Body id the camera is traveling toward (ACCEL/CRUISE/DECEL). */
  destination: string | null;
  /** 0–1 progress along the active travel spline. Read via getState() in useFrame only. */
  travelProgress: number;

  transition: (to: JourneyPhase) => boolean;
  requestTravel: (destinationId: string) => boolean;
  arrive: () => void;
  setTravelProgress: (t: number) => void;
}

export const useJourneyStore = create<JourneyState>()(
  subscribeWithSelector((set, get) => ({
    phase: 'INTRO',
    location: 'sun',
    destination: null,
    travelProgress: 0,

    transition: (to) => {
      const { phase } = get();
      if (!LEGAL[phase].includes(to)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[journey] illegal transition ${phase} → ${to} blocked`);
        }
        return false;
      }
      set({ phase: to });
      return true;
    },

    requestTravel: (destinationId) => {
      const { phase, location, destination } = get();
      if (destinationId === location && destination === null) return false;
      if (destinationId === destination) return false;
      const canDepart = ['IDLE', 'ORBIT', 'FOCUS', 'REVEAL', 'CRUISE'].includes(phase);
      if (!canDepart) return false;
      set({ destination: destinationId, travelProgress: 0 });
      return get().transition('ACCEL');
    },

    arrive: () => {
      const { destination } = get();
      if (!destination) return;
      set({ location: destination, destination: null, travelProgress: 1 });
      get().transition('ORBIT');
    },

    setTravelProgress: (t) => set({ travelProgress: t }),
  })),
);
