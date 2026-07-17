import * as THREE from 'three';
import { create } from 'zustand';
import { useDescentStore } from '@/state/descentStore';
import { CHAPTER_SP } from '@/world/system/systemSpec';

/**
 * Mars — Mission Control.
 *
 * Projects are not a list: they are missions. Every project is an autonomous
 * inspection drone orbiting Mars, colour-coded by mission class (Enterprise
 * orange / AI purple / Mobile blue / Web white / Research green), with a lit
 * landing site on the surface below. Hover a drone and it slows, its thrusters
 * glow, a beam rises from its landing site, and a classified mission log unfolds
 * — code, status, tech, role, completion — then it returns to orbit. No
 * permanent cards. The scene reads like a NASA Mars colony, not a portfolio.
 *
 * Live GitHub sync is intentionally NOT wired here (it needs a token + build
 * step); the mission data is curated from the real repositories.
 */

export type MissionClass = 'enterprise' | 'ai' | 'mobile' | 'web' | 'research';

export const CLASS_COLOR: Record<MissionClass, string> = {
  enterprise: '#e8913f', // orange — heavy industrial drone
  ai: '#b48cff', // purple — research probe
  mobile: '#5aa0ff', // blue — cubesat
  web: '#dfe6f0', // white — engineering drone
  research: '#5fd39a', // green — scientific probe
};
export const CLASS_LABEL: Record<MissionClass, string> = {
  enterprise: 'ENTERPRISE',
  ai: 'AI',
  mobile: 'MOBILE',
  web: 'WEB',
  research: 'RESEARCH',
};
// Orbit tier per class: radius (Mars radii), tilt, roll, eccentricity, speed,
// dir, craft size. Deliberately uneven — different altitudes, inclinations
// (research is near-polar), eccentricities, speeds and directions, with real
// breathing room from the planet.
export const CLASS_ORBIT: Record<MissionClass, { radius: number; incl: number; roll: number; ecc: number; speed: number; dir: 1 | -1; size: number }> = {
  web: { radius: 1.6, incl: 0.62, roll: -0.3, ecc: 0.12, speed: 0.055, dir: -1, size: 0.9 },
  enterprise: { radius: 1.88, incl: 0.46, roll: 0.14, ecc: 0.18, speed: 0.044, dir: 1, size: 1.3 },
  mobile: { radius: 2.12, incl: 0.4, roll: 0.36, ecc: 0.24, speed: 0.06, dir: 1, size: 0.78 },
  ai: { radius: 2.4, incl: 0.7, roll: -0.24, ecc: 0.15, speed: 0.03, dir: -1, size: 1.05 },
  research: { radius: 2.68, incl: 1.28, roll: 0.5, ecc: 0.3, speed: 0.036, dir: 1, size: 0.98 },
};

export type Mission = {
  id: string;
  code: string; // MISSION-0X
  name: string;
  cls: MissionClass;
  subtitle: string;
  facility: string; // colony structure name
  tech: string[];
  role: string;
  status: string; // ACTIVE / DEPLOYED / COMPLETE
  progress: number; // 0..1 (ring); status carries "active"
  year: string;
  href: string;
  phase: number; // orbital start angle
  ax: number; // landing site offset on the camera-facing disc (-1..1)
  ay: number;
};

const GH = 'https://github.com/mehedinassah';

export const MISSIONS: Mission[] = [
  { id: 'perico', code: 'MISSION-01', name: 'Perico ERP', cls: 'enterprise', subtitle: 'Enterprise Resource Planning', facility: 'Command Center', tech: ['Next.js', 'Prisma', 'PostgreSQL'], role: 'Founder', status: 'ACTIVE', progress: 0.92, year: '2026', href: GH, phase: 0.3, ax: 0.12, ay: 0.24 },
  { id: 'topline', code: 'MISSION-02', name: 'TopLine', cls: 'enterprise', subtitle: 'Commercial Platform', facility: 'Commercial Hub', tech: ['React', 'Node.js', 'PostgreSQL'], role: 'Developer', status: 'ACTIVE', progress: 0.85, year: '2025', href: GH, phase: 1.5, ax: -0.34, ay: -0.1 },
  { id: 'banauai', code: 'MISSION-03', name: 'banauAI', cls: 'ai', subtitle: 'AI Product Builder', facility: 'AI Research Lab', tech: ['Python', 'PyTorch', 'Next.js'], role: 'Founder', status: 'ACTIVE', progress: 0.7, year: '2025', href: GH, phase: 2.6, ax: 0.42, ay: 0.3 },
  { id: 'whispers', code: 'MISSION-04', name: 'Whispers', cls: 'ai', subtitle: 'Signal Processing', facility: 'Signal Processing Lab', tech: ['Python', 'OpenCV', 'PyTorch'], role: 'Developer', status: 'DEPLOYED', progress: 1, year: '2024', href: GH, phase: 3.7, ax: -0.16, ay: 0.46 },
  { id: 'ocr', code: 'MISSION-05', name: 'Smart OCR', cls: 'research', subtitle: 'Bangla Handwriting Recognition', facility: 'Vision Lab', tech: ['PyTorch', 'OpenCV', 'Pix2Pix'], role: 'Researcher', status: 'COMPLETE', progress: 1, year: '2025', href: GH, phase: 4.6, ax: 0.5, ay: -0.22 },
  { id: 'geo', code: 'MISSION-06', name: 'Smart Geo Landmarks', cls: 'research', subtitle: 'Navigation & Mapping', facility: 'Navigation Facility', tech: ['Flutter', 'Maps', 'Firebase'], role: 'Developer', status: 'DEPLOYED', progress: 1, year: '2024', href: GH, phase: 5.5, ax: -0.5, ay: 0.16 },
  { id: 'android', code: 'MISSION-07', name: 'Android Apps', cls: 'mobile', subtitle: 'Mobile Communications', facility: 'Comms Station', tech: ['Kotlin', 'Android', 'MVVM'], role: 'Developer', status: 'DEPLOYED', progress: 1, year: '2023', href: GH, phase: 0.95, ax: 0.22, ay: -0.46 },
  { id: 'portfolio', code: 'MISSION-08', name: 'Cosmos Portfolio', cls: 'web', subtitle: 'Mission Control Interface', facility: 'Mission Control', tech: ['Next.js', 'react-three-fiber', 'GLSL'], role: 'Creator', status: 'ACTIVE', progress: 0.8, year: '2026', href: GH, phase: 2.0, ax: -0.3, ay: -0.4 },
];

export const colorOfMission = (m: Mission): string => CLASS_COLOR[m.cls];

/** Active mission (hovered) -> DOM card. env 0..1 drives the card in/out. */
export const marsBridge: {
  active: boolean;
  index: number;
  px: number;
  py: number;
  env: number;
  color: string;
  focus: number;
  hovering: boolean;
} = { active: false, index: 0, px: 0, py: 0, env: 0, color: '#e8913f', focus: 0, hovering: false };

type MarsUI = {
  hovered: number | null;
  setHovered: (i: number | null) => void;
};
export const useMarsUI = create<MarsUI>((set) => ({
  hovered: null,
  setHovered: (i) => {
    marsBridge.hovering = i != null;
    set({ hovered: i });
  },
}));

/** 1 while parked at the Mars chapter, 0 elsewhere. */
export function marsFocus(): number {
  const d = useDescentStore.getState();
  if (d.stage !== 'ARRIVED') return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.abs(d.sysSmoothed - CHAPTER_SP.mars), 0.02, 0.06);
}
