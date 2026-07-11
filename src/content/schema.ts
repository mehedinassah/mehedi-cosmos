import { z } from 'zod';

/**
 * COSMOS-OS content schema — blueprint §12.
 * Every navigable thing is a CelestialBody. `meaning` is REQUIRED:
 * build-time enforcement of "no decorative objects — every celestial
 * object must have semantic meaning".
 */

export const CelestialKind = z.enum([
  'star',
  'planet',
  'moon',
  'constellation',
  'station',
  'observatory',
  'fleet',
  'nebula',
  'blackhole',
]);
export type CelestialKind = z.infer<typeof CelestialKind>;

export const OrbitSpec = z.object({
  radiusU: z.number().positive(),
  periodS: z.number().positive(),
  inclinationDeg: z.number().default(0),
  phase: z.number().min(0).max(1).default(0),
});
export type OrbitSpec = z.infer<typeof OrbitSpec>;

export const FramingSpec = z.object({
  distanceU: z.number().positive(),
  elevationDeg: z.number().default(10),
  azimuthDeg: z.number().default(0),
});

export const MissionLogEntry = z.object({
  heading: z.string(),
  body: z.string(),
  links: z.array(z.object({ label: z.string(), href: z.string().url() })).default([]),
});
export type MissionLogEntry = z.infer<typeof MissionLogEntry>;

export const StoryBeat = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
});

export const CelestialBody = z.object({
  id: z.string().regex(/^[a-z]+(\.[a-z0-9-]+)?$/),
  kind: CelestialKind,
  name: z.string(),
  /** The semantic reason this object exists. Required. */
  meaning: z.string().min(10),
  parent: z.string().optional(),
  orbit: OrbitSpec.optional(),
  scaleU: z.number().positive(),
  visual: z.object({
    paletteRef: z.string(),
    shaderProfile: z.string(),
    overrides: z.record(z.string(), z.number()).optional(),
  }),
  camera: z.object({
    minDist: z.number().positive(),
    maxDist: z.number().positive(),
    revealFraming: FramingSpec,
  }),
  reveal: z.object({
    choreographyId: z.string(),
    beats: z.array(StoryBeat).default([]),
  }),
  audio: z.object({ soundscapeRef: z.string() }).optional(),
  /** Semantic mirror — Mission Log / a11y / SEO. Required. */
  log: MissionLogEntry,
});
export type CelestialBody = z.infer<typeof CelestialBody>;

export const Project = CelestialBody.extend({
  kind: z.enum(['planet', 'moon']),
  role: z.string(),
  stack: z.array(z.string()).min(1),
  period: z.string(),
  narrative: z.array(StoryBeat),
  links: z.object({
    live: z.string().url().optional(),
    repo: z.string().url().optional(),
    caseStudy: z.string().url().optional(),
  }),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});
export type Project = z.infer<typeof Project>;

export const SkillDomain = z.enum(['frontend', 'backend', 'ml', 'graphics', 'infra', 'language']);

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  domain: SkillDomain,
  relatedTo: z.array(z.string()).default([]),
  /** Visual hierarchy (star magnitude) — NOT proficiency %, per Master Prompt. */
  magnitude: z.number().int().min(1).max(5),
  evidence: z.array(z.string()).default([]),
});
export type Skill = z.infer<typeof Skill>;

export const TravelEdge = z.object({
  from: z.string(),
  to: z.string(),
  splineRef: z.string(),
  durationS: z.number().min(2.5).max(6), // blueprint §5.2 clamp
  waypoints: z.array(z.string()).default([]),
  bidirectional: z.boolean().default(true),
});
export type TravelEdge = z.infer<typeof TravelEdge>;

export const IntroSpec = z.object({
  desktopDurationS: z.number(),
  mobileDurationS: z.number(),
  skipOnReturn: z.boolean(),
});

export const Universe = z.object({
  bodies: z.array(CelestialBody),
  skills: z.array(Skill),
  edges: z.array(TravelEdge),
  intro: IntroSpec,
});
export type Universe = z.infer<typeof Universe>;

/** Validates referential integrity beyond shape: parents, edges, evidence. */
export function validateUniverse(u: Universe): string[] {
  const errors: string[] = [];
  const ids = new Set(u.bodies.map((b) => b.id));
  for (const b of u.bodies) {
    if (b.parent && !ids.has(b.parent)) errors.push(`${b.id}: dangling parent '${b.parent}'`);
  }
  for (const e of u.edges) {
    if (!ids.has(e.from)) errors.push(`edge ${e.splineRef}: dangling from '${e.from}'`);
    if (!ids.has(e.to)) errors.push(`edge ${e.splineRef}: dangling to '${e.to}'`);
  }
  const skillIds = new Set(u.skills.map((s) => s.id));
  for (const s of u.skills) {
    for (const r of s.relatedTo) if (!skillIds.has(r)) errors.push(`skill ${s.id}: dangling relation '${r}'`);
    for (const ev of s.evidence) if (!ids.has(ev)) errors.push(`skill ${s.id}: dangling evidence '${ev}'`);
  }
  return errors;
}
