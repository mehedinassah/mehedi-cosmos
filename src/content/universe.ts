import { z } from 'zod';
import { Universe, validateUniverse, type Universe as UniverseT } from './schema';

/**
 * World content — content-as-code (ADR-001 / blueprint §11).
 * NOTE: Project bodies (Perico, Top-Line, Whispers, banauAI, Android cluster)
 * carry PLACEHOLDER copy pending content from Mehedi (blueprint §17.6).
 * Structure, graph, and framing are final; prose is not.
 */

const raw = {
  intro: { desktopDurationS: 10, mobileDurationS: 5, skipOnReturn: true },

  bodies: [
    {
      id: 'sun',
      kind: 'star',
      name: 'Mehedi Hassan',
      meaning: 'The identity at the center of the universe. Everything orbits the person, not the resume.',
      scaleU: 120,
      visual: { paletteRef: 'solar-core', shaderProfile: 'sun_plasma' },
      camera: { minDist: 300, maxDist: 2000, revealFraming: { distanceU: 600, elevationDeg: 8, azimuthDeg: 0 } },
      reveal: {
        choreographyId: 'identity-emergence',
        beats: [
          { id: 'who', title: 'Software Engineer', text: 'Full-stack developer and creative technologist. Builder of systems that comply, recognize, and render.' },
        ],
      },
      log: {
        heading: 'Mehedi Hassan — Software Engineer, Creative Technologist, Full-Stack Developer',
        body: 'Central star of the system. Computer Science, BRAC University. Full-stack web development and machine learning, from compliance platforms to deep-learning research.',
        links: [{ label: 'GitHub', href: 'https://github.com/mehedinassah' }],
      },
    },
    {
      id: 'planet.about',
      kind: 'planet',
      name: 'Origin',
      meaning: 'The formation story — where the engineer came from, closest orbit to the identity star.',
      parent: 'sun',
      orbit: { radiusU: 900, periodS: 480, inclinationDeg: 3, phase: 0.1 },
      scaleU: 55,
      visual: { paletteRef: 'terrestrial-warm', shaderProfile: 'planet_standard' },
      camera: { minDist: 120, maxDist: 700, revealFraming: { distanceU: 200, elevationDeg: 12, azimuthDeg: 20 } },
      reveal: { choreographyId: 'surface-holo-rise', beats: [] },
      log: {
        heading: 'About',
        body: 'Final-year Computer Science student at BRAC University, Dhaka. Full-stack engineer (NestJS, Next.js) on a multi-framework compliance product; deep-learning researcher (Bangla handwritten word recognition — Pix2Pix restoration, TrOCR recognition).',
        links: [],
      },
    },
    {
      id: 'planet.perico',
      kind: 'planet',
      name: 'Perico ERP',
      meaning: 'Largest industrial civilization — the biggest engineered system in the portfolio.',
      parent: 'sun',
      orbit: { radiusU: 1600, periodS: 720, inclinationDeg: 1.5, phase: 0.35 },
      scaleU: 90,
      visual: { paletteRef: 'industrial-steel', shaderProfile: 'planet_city' },
      camera: { minDist: 180, maxDist: 900, revealFraming: { distanceU: 320, elevationDeg: 15, azimuthDeg: -30 } },
      reveal: {
        choreographyId: 'surface-holo-rise',
        beats: [{ id: 'placeholder', title: 'PLACEHOLDER', text: 'Awaiting project narrative from Mehedi (§17.6).' }],
      },
      log: { heading: 'Perico ERP', body: 'PLACEHOLDER — enterprise resource planning platform. Details pending.', links: [] },
    },
    {
      id: 'planet.topline',
      kind: 'planet',
      name: 'Top-Line',
      meaning: 'Modern commercial world — polished product engineering.',
      parent: 'sun',
      orbit: { radiusU: 2100, periodS: 900, inclinationDeg: 2, phase: 0.6 },
      scaleU: 60,
      visual: { paletteRef: 'commercial-glass', shaderProfile: 'planet_standard' },
      camera: { minDist: 130, maxDist: 700, revealFraming: { distanceU: 220, elevationDeg: 10, azimuthDeg: 15 } },
      reveal: { choreographyId: 'surface-holo-rise', beats: [{ id: 'placeholder', title: 'PLACEHOLDER', text: 'Awaiting project narrative (§17.6).' }] },
      log: { heading: 'Top-Line', body: 'PLACEHOLDER — details pending.', links: [] },
    },
    {
      id: 'moon.whispers',
      kind: 'moon',
      name: 'Whispers',
      meaning: 'Foggy mysterious moon — an atmospheric, quieter project orbiting the commercial world.',
      parent: 'planet.topline',
      orbit: { radiusU: 160, periodS: 140, inclinationDeg: 12, phase: 0.2 },
      scaleU: 18,
      visual: { paletteRef: 'fog-violet', shaderProfile: 'moon_fog' },
      camera: { minDist: 45, maxDist: 250, revealFraming: { distanceU: 80, elevationDeg: 6, azimuthDeg: 0 } },
      reveal: { choreographyId: 'fog-part', beats: [{ id: 'placeholder', title: 'PLACEHOLDER', text: 'Awaiting project narrative (§17.6).' }] },
      log: { heading: 'Whispers', body: 'PLACEHOLDER — details pending.', links: [] },
    },
    {
      id: 'planet.banauai',
      kind: 'planet',
      name: 'banauAI',
      meaning: 'AI laboratory world — machine learning engineering made visible.',
      parent: 'sun',
      orbit: { radiusU: 2600, periodS: 1100, inclinationDeg: 4, phase: 0.85 },
      scaleU: 50,
      visual: { paletteRef: 'lab-cyan-muted', shaderProfile: 'planet_lab' },
      camera: { minDist: 110, maxDist: 650, revealFraming: { distanceU: 190, elevationDeg: 14, azimuthDeg: -10 } },
      reveal: { choreographyId: 'lab-boot', beats: [{ id: 'placeholder', title: 'PLACEHOLDER', text: 'Awaiting project narrative (§17.6).' }] },
      log: { heading: 'banauAI', body: 'PLACEHOLDER — details pending.', links: [] },
    },
    {
      id: 'fleet.android',
      kind: 'fleet',
      name: 'Android Satellite Cluster',
      meaning: 'Mobile projects as a satellite constellation — smaller craft, coordinated purpose.',
      parent: 'sun',
      orbit: { radiusU: 3000, periodS: 1300, inclinationDeg: 8, phase: 0.5 },
      scaleU: 30,
      visual: { paletteRef: 'satellite-white', shaderProfile: 'instanced_craft' },
      camera: { minDist: 90, maxDist: 500, revealFraming: { distanceU: 150, elevationDeg: 20, azimuthDeg: 0 } },
      reveal: { choreographyId: 'fleet-formation', beats: [{ id: 'placeholder', title: 'PLACEHOLDER', text: 'Awaiting project list (§17.6).' }] },
      log: { heading: 'Android Projects', body: 'PLACEHOLDER — details pending.', links: [] },
    },
    {
      id: 'constellation.skills',
      kind: 'constellation',
      name: 'Skill Constellations',
      meaning: 'Skills as connected stars — relationships over rankings. No bars, no percentages.',
      parent: 'sun',
      orbit: { radiusU: 3600, periodS: 1600, inclinationDeg: 0, phase: 0.15 },
      scaleU: 400,
      visual: { paletteRef: 'starlight', shaderProfile: 'constellation_star' },
      camera: { minDist: 300, maxDist: 1500, revealFraming: { distanceU: 700, elevationDeg: 0, azimuthDeg: 0 } },
      reveal: { choreographyId: 'constellation-ignite', beats: [] },
      log: {
        heading: 'Skills',
        body: 'Constellations of related technologies. Anchor stars: TypeScript, React/Next.js, NestJS, Python, PyTorch, Three.js.',
        links: [],
      },
    },
    {
      id: 'station.ubicomply',
      kind: 'station',
      name: 'UbiComply Station',
      meaning: 'Working experience as an orbital station — a place you dock at and discover, not a timeline row.',
      parent: 'sun',
      orbit: { radiusU: 4100, periodS: 1900, inclinationDeg: 5, phase: 0.4 },
      scaleU: 40,
      visual: { paletteRef: 'station-steel', shaderProfile: 'station_pbr' },
      camera: { minDist: 90, maxDist: 500, revealFraming: { distanceU: 140, elevationDeg: 5, azimuthDeg: 40 } },
      reveal: {
        choreographyId: 'docking-sequence',
        beats: [
          { id: 'role', title: 'Engineering — Compliance Platform', text: 'Multi-framework compliance product (HIPAA, CMMC, SOC 2, GDPR). NestJS backend, Next.js frontends. SOC 2 control seeding (61 Trust Services Criteria), DAST agent operations on AWS, scan-runner debugging, frontend systems.' },
        ],
      },
      log: {
        heading: 'Experience — UbiComply',
        body: 'Engineering team member on a multi-framework compliance product (HIPAA, CMMC, SOC 2, GDPR): NestJS backend, Next.js frontends, DAST agent deployment on AWS, SOC 2 Trust Services Criteria seeding.',
        links: [],
      },
    },
    {
      id: 'observatory.research',
      kind: 'observatory',
      name: 'Research Observatory',
      meaning: 'Research as deep-space observation — telescopes reveal knowledge instead of pages listing papers.',
      parent: 'sun',
      orbit: { radiusU: 4700, periodS: 2200, inclinationDeg: 7, phase: 0.7 },
      scaleU: 45,
      visual: { paletteRef: 'observatory-dark', shaderProfile: 'station_pbr' },
      camera: { minDist: 100, maxDist: 550, revealFraming: { distanceU: 160, elevationDeg: 18, azimuthDeg: -20 } },
      reveal: {
        choreographyId: 'telescope-align',
        beats: [
          { id: 'thesis', title: 'Distorted Bangla Handwritten Word Recognition', text: 'Five-stage deep learning pipeline: Pix2Pix cGAN restoration, fine-tuned TrOCR recognition, LLM correction. 26.62 dB PSNR, median SSIM 0.9016.' },
        ],
      },
      log: {
        heading: 'Research',
        body: 'Thesis: Deep Learning Approach for Distorted Bangla Handwritten Word Recognition — Pix2Pix cGAN restoration, fine-tuned TrOCR, LLM-based correction. 26.62 dB PSNR, median SSIM 0.9016.',
        links: [],
      },
    },
    {
      id: 'fleet.github',
      kind: 'fleet',
      name: 'GitHub Fleet',
      meaning: 'Open code as a fleet in motion — repositories are working vessels, not list items.',
      parent: 'sun',
      orbit: { radiusU: 5200, periodS: 2500, inclinationDeg: 3, phase: 0.05 },
      scaleU: 35,
      visual: { paletteRef: 'fleet-graphite', shaderProfile: 'instanced_craft' },
      camera: { minDist: 100, maxDist: 550, revealFraming: { distanceU: 170, elevationDeg: 12, azimuthDeg: 0 } },
      reveal: { choreographyId: 'fleet-flyby', beats: [] },
      log: { heading: 'GitHub', body: 'Public repositories and open work.', links: [{ label: 'github.com/mehedinassah', href: 'https://github.com/mehedinassah' }] },
    },
    {
      id: 'nebula.innovation',
      kind: 'nebula',
      name: 'Innovation Nebula',
      meaning: 'Ideas still forming — a stellar nursery for experiments and future work.',
      parent: 'sun',
      orbit: { radiusU: 5800, periodS: 2900, inclinationDeg: 10, phase: 0.55 },
      scaleU: 500,
      visual: { paletteRef: 'nebula-rose-teal', shaderProfile: 'nebula_volume' },
      camera: { minDist: 400, maxDist: 2000, revealFraming: { distanceU: 900, elevationDeg: 0, azimuthDeg: 0 } },
      reveal: { choreographyId: 'nebula-drift', beats: [] },
      log: { heading: 'Innovation', body: 'Experiments in progress — graphics programming, applied ML, creative tools.', links: [] },
    },
    {
      id: 'blackhole.contact',
      kind: 'blackhole',
      name: 'Contact',
      meaning: 'The ending. Everything falls away; only collaboration remains. Light bends, sound fades.',
      parent: 'sun',
      orbit: { radiusU: 6600, periodS: 3400, inclinationDeg: 0, phase: 0.9 },
      scaleU: 70,
      visual: { paletteRef: 'void', shaderProfile: 'blackhole_lensing' },
      camera: { minDist: 250, maxDist: 1200, revealFraming: { distanceU: 450, elevationDeg: 4, azimuthDeg: 0 } },
      reveal: { choreographyId: 'event-horizon', beats: [{ id: 'cta', title: 'Transmit', text: 'Send a message across the horizon.' }] },
      log: { heading: 'Contact', body: 'Reach Mehedi for collaboration and opportunities.', links: [] },
    },
  ],

  skills: [
    { id: 'ts', name: 'TypeScript', domain: 'language', magnitude: 5, relatedTo: ['react', 'next', 'nest', 'three'], evidence: ['planet.perico', 'station.ubicomply'] },
    { id: 'react', name: 'React', domain: 'frontend', magnitude: 5, relatedTo: ['next', 'three'], evidence: ['station.ubicomply'] },
    { id: 'next', name: 'Next.js', domain: 'frontend', magnitude: 5, relatedTo: ['react'], evidence: ['station.ubicomply'] },
    { id: 'nest', name: 'NestJS', domain: 'backend', magnitude: 4, relatedTo: ['ts', 'prisma'], evidence: ['station.ubicomply'] },
    { id: 'prisma', name: 'Prisma', domain: 'backend', magnitude: 3, relatedTo: ['nest', 'supabase'], evidence: [] },
    { id: 'supabase', name: 'Supabase', domain: 'infra', magnitude: 3, relatedTo: ['prisma'], evidence: [] },
    { id: 'python', name: 'Python', domain: 'language', magnitude: 5, relatedTo: ['pytorch', 'numpy'], evidence: ['observatory.research'] },
    { id: 'pytorch', name: 'PyTorch', domain: 'ml', magnitude: 4, relatedTo: ['python', 'gan', 'trocr'], evidence: ['observatory.research'] },
    { id: 'numpy', name: 'NumPy', domain: 'ml', magnitude: 4, relatedTo: ['python'], evidence: [] },
    { id: 'gan', name: 'GANs / Pix2Pix', domain: 'ml', magnitude: 4, relatedTo: ['pytorch'], evidence: ['observatory.research'] },
    { id: 'trocr', name: 'TrOCR', domain: 'ml', magnitude: 3, relatedTo: ['pytorch'], evidence: ['observatory.research'] },
    { id: 'three', name: 'Three.js / R3F', domain: 'graphics', magnitude: 3, relatedTo: ['react', 'glsl'], evidence: [] },
    { id: 'glsl', name: 'GLSL', domain: 'graphics', magnitude: 2, relatedTo: ['three'], evidence: [] },
    { id: 'aws', name: 'AWS', domain: 'infra', magnitude: 3, relatedTo: ['docker'], evidence: ['station.ubicomply'] },
    { id: 'docker', name: 'Docker', domain: 'infra', magnitude: 3, relatedTo: ['aws'], evidence: ['station.ubicomply'] },
  ],

  // Spine per blueprint §6.1 + local project edges. Splines authored in Phase: Camera System.
  edges: [
    { from: 'sun', to: 'planet.about', splineRef: 'sun__about', durationS: 3 },
    { from: 'planet.about', to: 'planet.perico', splineRef: 'about__perico', durationS: 3.5 },
    { from: 'planet.perico', to: 'constellation.skills', splineRef: 'perico__skills', durationS: 4, waypoints: ['planet.topline'] },
    { from: 'constellation.skills', to: 'station.ubicomply', splineRef: 'skills__ubicomply', durationS: 3.5 },
    { from: 'station.ubicomply', to: 'observatory.research', splineRef: 'ubicomply__observatory', durationS: 3 },
    { from: 'observatory.research', to: 'fleet.github', splineRef: 'observatory__fleet', durationS: 3 },
    { from: 'fleet.github', to: 'nebula.innovation', splineRef: 'fleet__nebula', durationS: 3.5 },
    { from: 'nebula.innovation', to: 'blackhole.contact', splineRef: 'nebula__blackhole', durationS: 5 },
    // Local project edges
    { from: 'planet.perico', to: 'planet.topline', splineRef: 'perico__topline', durationS: 3 },
    { from: 'planet.topline', to: 'moon.whispers', splineRef: 'topline__whispers', durationS: 2.5 },
    { from: 'planet.topline', to: 'planet.banauai', splineRef: 'topline__banauai', durationS: 3 },
    { from: 'planet.banauai', to: 'fleet.android', splineRef: 'banauai__android', durationS: 3 },
    // Return-home shortcuts (flown, longer cruise)
    { from: 'blackhole.contact', to: 'sun', splineRef: 'blackhole__sun', durationS: 6, bidirectional: false },
  ],
} satisfies z.input<typeof Universe>;

export const universe: UniverseT = Universe.parse(raw);

const integrityErrors = validateUniverse(universe);
if (integrityErrors.length > 0) {
  throw new Error(`Universe integrity failed:\n${integrityErrors.join('\n')}`);
}

export const bodyById = new Map(universe.bodies.map((b) => [b.id, b]));
