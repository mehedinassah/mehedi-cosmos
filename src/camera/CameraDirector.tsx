'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourneyStore } from '@/state/journeyStore';
import { useQualityStore } from '@/state/qualityStore';
import { bodyById, universe } from '@/content/universe';
import { bodyWorldPosition } from '@/world/ambient/ImpostorField';
import { GALAXY_CAM_POS, GALAXY_LOOK, GALAXY_CENTER, OUTER_RADIUS } from '@/world/galaxy/HeroGalaxy';
import { buildDescentCurve, GALAXY_REST_LOOK } from '@/camera/descentPath';
import { useDescentStore, DESCENT_CAPTIONS, SUN_SP, nowS } from '@/state/descentStore';
import { systemPose, chapterIndexAt, HEROES, CHAPTERS } from '@/world/system/systemSpec';
import { portalDive } from '@/state/portalDive';
import { loadSignals } from '@/state/loadSignals';

const _pvLook = new THREE.Vector3();

// Reused per-frame scratch so the idle / orbit / parallax hot paths allocate
// ZERO vectors each frame (fresh `new THREE.Vector3()` every frame was steady
// GC pressure that showed up as micro-stutter while resting on the galaxy).
const _sA = new THREE.Vector3();
const _sB = new THREE.Vector3();
const _sC = new THREE.Vector3();
const _sUp = new THREE.Vector3(0, 1, 0);
const _introStart = new THREE.Vector3(-7000, -2400, 16000);
const _portraitLook = new THREE.Vector3();

/** Premium travel easing: slow acceleration, momentum, soft deceleration. */
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/* ------------------------- the loop home ------------------------- */
// ONE continuous flight from Pluto all the way to the opening galaxy vantage.
// No region swap, no unmount: both worlds are mounted for the whole loop, so
// the solar system recedes by DISTANCE and the galaxy grows by APPROACH.
// Nothing pops in or out; the camera simply travels farther.
const _loopLook = new THREE.Vector3();
const _dvFwd = new THREE.Vector3();
const _dvPoint = new THREE.Vector3();
// Distance -> arc fraction. A trapezoidal velocity (quick ramp up, long FLAT
// cruise, gentle ramp down) integrated to displacement. Feeding this into the
// curve's ARC-LENGTH sampling (getPointAt) makes the ship hold a constant
// world speed the whole way — no crawl near the start, no rush in the middle.
function loopArc(x: number): number {
  const A = 0.1, D = 0.78; // accel ends at A, decel starts at D
  if (x < A) return A * 0.5 * (x / A) * (x / A);
  if (x < D) return A * 0.5 + (x - A);
  const k = (x - D) / (1 - D);
  return A * 0.5 + (D - A) + (1 - D) * (k - 0.5 * k * k);
}
const LOOP_ARC_MAX = loopArc(1);


/**
 * CameraDirector — blueprint §5. Foundation build.
 * - Travel: straight-line path with authored accel/cruise/decel easing profile
 *   (authored Catmull-Rom splines replace the path in Camera System phase;
 *   the easing profile, FSM plumbing, and ownership model are final).
 * - Orbit: damped slow orbit at the body's revealFraming distance.
 * - BreathingIdle: additive Perlin-ish drift, amplitude ≤ 0.3% focal distance,
 *   zeroed under prefers-reduced-motion.
 * There is NO other writer of camera transforms in the app.
 */

function hashOffset(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const ux = ((h >>> 0) % 100) / 100; // 0..1
  const uy = ((h >>> 8) % 100) / 100;
  // Map to rule-of-thirds quadrants, biased away from dead center, never 0.5/0.5
  const qx = ux < 0.5 ? 0.30 + ux * 0.16 : 0.70 - (ux - 0.5) * 0.16; // ~left or right third
  const qy = uy < 0.5 ? 0.32 + uy * 0.12 : 0.68 - (uy - 0.5) * 0.12; // ~upper or lower third
  return [qx, qy];
}

const ACCEL_END = 0.2;
const DECEL_START = 0.8;

/** Piecewise easing: power3-in accel → linear cruise → expo-out decel. Never linear overall. */
function travelEase(t: number): number {
  // Distance fractions allotted to each phase (accel covers 10%, cruise 70%, decel 20% of path)
  const A = 0.1, C = 0.8;
  if (t < ACCEL_END) {
    const k = t / ACCEL_END;
    return A * k * k * k;
  }
  if (t < DECEL_START) {
    const k = (t - ACCEL_END) / (DECEL_START - ACCEL_END);
    return A + C * k;
  }
  const k = (t - DECEL_START) / (1 - DECEL_START);
  return A + C + (1 - A - C) * (1 - Math.pow(2, -8 * k) * (1 - k));
}

function edgeDuration(from: string, to: string): number {
  const e = universe.edges.find(
    (ed) => (ed.from === from && ed.to === to) || (ed.bidirectional && ed.from === to && ed.to === from),
  );
  return e?.durationS ?? 4;
}

export function CameraDirector() {
  const camera = useThree((s) => s.camera);
  const elapsed = useRef(0);
  const duration = useRef(4);
  const fromPos = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const orbitAngle = useRef(0);
  const lookTarget = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3());
  const lastPhase = useRef('');
  const lastStage = useRef('DORMANT');
  const baseFov = useRef(50);
  const pointerSmooth = useRef(new THREE.Vector2());
  const parallaxApplied = useRef(new THREE.Vector3());
  const idleDrift = useRef(0);
  const descentCurve = useRef<THREE.CatmullRomCurve3 | null>(null);
  const loopCurve = useRef<THREE.CatmullRomCurve3 | null>(null);
  const descentAhead = useRef(new THREE.Vector3());
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  useFrame((state, delta) => {
    loadSignals.firstFrame = true; // the render loop is alive (preloader handoff)
    const j = useJourneyStore.getState();
    const reducedMotion = useQualityStore.getState().reducedMotion;
    const t = state.clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;

    // Portrait-adaptive base FOV. The entire universe is composed for a wide
    // landscape frame; with a fixed 50° vertical FOV a tall phone screen crops
    // the sides brutally (a narrow ~24° horizontal slice). So we WIDEN the FOV as
    // the screen gets narrower — zooming out just enough that the composition
    // still reads on a phone — while leaving desktop/landscape untouched at 50°.
    // Every FOV effect below builds on baseFov.current, so they all inherit this.
    const aspectR = size.width / Math.max(1, size.height);
    baseFov.current = aspectR >= 1 ? 50 : Math.min(82, 50 + (1 / aspectR - 1) * 32);
    // Track whether a speed-boost owns the FOV this frame; if not, resting states
    // reconcile to the adaptive base at the end (so it follows device rotation).
    let fovManaged = false;

    // Parallax is a per-frame overlay, never part of the base camera path:
    // remove last frame's offset before any phase logic reads the position.
    cam.position.sub(parallaxApplied.current);
    parallaxApplied.current.set(0, 0, 0);

    // FSM journey rig: each transition is a timed, eased move that lands
    // EXACTLY on a chapter and then releases input. Slow acceleration, gentle
    // momentum, soft deceleration — a spacecraft coasting, never a cursor.
    const descent = useDescentStore.getState();
    let dp = descent.smoothed;
    let sp = descent.sysSmoothed;

    // Reversing Sun -> Galaxy: the system just unmounted; rebuild the dive
    // spline from the canonical vantage so dp=1 sits at the destination star.
    if (lastStage.current === 'ARRIVED' && descent.stage === 'DESCENDING') {
      descentCurve.current = buildDescentCurve(GALAXY_CAM_POS.clone());
    }
    lastStage.current = descent.stage;

    // ---- the loop home: Pluto -> the opening galaxy, one continuous flight --
    if (descent.stage === 'LOOPING' && descent.tField === 'loop') {
      // Build the flight once, from wherever the camera actually is (Pluto's
      // berth). It coasts outward from the sun, curves gently toward the
      // galaxy, and ends exactly on the opening approach axis. Centripetal
      // Catmull-Rom => no kinks. Both worlds are mounted the whole time
      // (UniverseCanvas), so the system recedes and the galaxy grows with no
      // swap and no build hitch mid-flight.
      if (!loopCurve.current) {
        // One continuous forward climb — Pluto up and OUT of the disc to the
        // hero vantage. The solar system is now embedded in the galaxy (see
        // HeroGalaxy: origin sits on the beacon arm), so leaving Pluto means
        // rising up through the galaxy's own stars, never crossing an empty
        // gap. We keep heading forward (away from the Sun, never back toward
        // it) and lift out of the disc plane; the flat sea of arm-stars slowly
        // organizes into the full spiral as we gain altitude, and we settle
        // exactly on the opening framing. Both worlds stay mounted the whole
        // way (UniverseCanvas) and LoopWarpField streams stars past for speed.
        const p0 = cam.position.clone(); // Pluto
        const p3 = GALAXY_CAM_POS.clone(); // hero vantage
        // "Up and out of the disc" is the direction from the core to the hero.
        const outDir = GALAXY_CAM_POS.clone().sub(GALAXY_CENTER).normalize();
        // Forward past Pluto: continue away from the Sun (origin) and start
        // lifting out of the plane. Never a component back toward the Sun.
        const awayFromSun = p0.clone().normalize();
        const p1 = p0
          .clone()
          .addScaledVector(awayFromSun, OUTER_RADIUS * 0.55)
          .addScaledVector(outDir, OUTER_RADIUS * 0.55);
        // Well clear of the disc, most of the way home.
        const p2 = p3.clone().addScaledVector(outDir, -OUTER_RADIUS * 0.55);
        loopCurve.current = new THREE.CatmullRomCurve3([p0, p1, p2, p3], false, 'centripetal');
      }
      const lp = THREE.MathUtils.clamp((nowS() - descent.tStart) / descent.tDur, 0, 1);
      const curve = loopCurve.current;
      // ARC-LENGTH sampling => constant cruise speed, no crawl, no rush.
      const s = loopArc(lp) / LOOP_ARC_MAX;
      curve.getPointAt(s, cam.position);
      // Look at the galaxy the whole way — it is centred and simply GROWS as
      // we close in (no swing-in, no pop). currentLook eases out of the Pluto
      // heading gently, so the camera turns toward home in one smooth arc.
      _loopLook.copy(GALAXY_REST_LOOK);
      currentLook.current.lerp(_loopLook, 1 - Math.exp(-2.2 * delta));
      cam.up.set(0, 1, 0);
      cam.lookAt(currentLook.current);
      // A subtle warp push: widen through the fast middle so peripheral streaks
      // rake faster, easing back to base exactly at both ends (seamless with
      // the DORMANT galaxy framing on either side).
      cam.fov = baseFov.current + 7 * Math.sin(Math.PI * lp);
      cam.updateProjectionMatrix();
      cam.clearViewOffset();
      if (lp >= 1) {
        // Home — hold exactly where the loop landed on the galaxy. Reset the
        // idle drift/orbit accumulators so the resting telescope CONTINUES from
        // here instead of correcting back to the stale pre-descent pose (that
        // correction was the shake/turn/tilt at the end of the loop). We do not
        // restore any earlier camera position; the galaxy keeps turning on its
        // own and the camera simply stays on it.
        loopCurve.current = null;
        orbitAngle.current = 0;
        idleDrift.current = 0;
        pointerSmooth.current.set(0, 0);
        useDescentStore.setState({
          stage: 'DORMANT', navIndex: 0, navBusy: false,
          tField: null, loopHalf: 0, smoothed: 0, sysSmoothed: 0, sysCaptionIndex: -1,
        });
        currentLook.current.copy(GALAXY_REST_LOOK);
      }
      return;
    }

    if (descent.tField) {
      const raw = THREE.MathUtils.clamp((nowS() - descent.tStart) / descent.tDur, 0, 1);
      const e = easeInOutCubic(raw);
      const v = descent.tFrom + (descent.tTo - descent.tFrom) * e;

      if (descent.tField === 'dp') {
        dp = v;
        let captionIndex = -1;
        for (let k = 0; k < DESCENT_CAPTIONS.length; k++) {
          if (dp >= DESCENT_CAPTIONS[k].at) captionIndex = k;
        }
        if (descent.tTo === 1 && dp > 0.994) {
          // Arrival at the Sun: land exactly at the hero framing (SUN_SP);
          // the flare + DOM flash mask the swap into the system.
          useDescentStore.setState({
            smoothed: 1, captionIndex: -1, stage: 'ARRIVED',
            sysSmoothed: SUN_SP, sysCaptionIndex: 0,
            navBusy: false, tField: null,
          });
          sp = SUN_SP;
          cam.fov = baseFov.current;
          cam.updateProjectionMatrix();
          currentLook.current.set(0, 0, 0);
          pointerSmooth.current.set(0, 0);
        } else if (descent.tTo === 0 && dp < 0.006) {
          // Back at the galaxy hero
          useDescentStore.setState({
            smoothed: 0, captionIndex: -1, stage: 'DORMANT',
            navBusy: false, tField: null,
          });
          dp = 0;
        } else {
          useDescentStore.setState({ smoothed: dp, captionIndex });
        }
      } else {
        // 'sp' — travel along the rail between two chapters
        sp = v;
        const sysCaptionIndex = chapterIndexAt(sp);
        const done = raw >= 1;
        useDescentStore.setState({
          sysSmoothed: sp, sysCaptionIndex,
          ...(done ? { navBusy: false, tField: null } : {}),
        });
      }
    }

    // Phase entry setup
    if (j.phase !== lastPhase.current) {
      if (j.phase === 'ACCEL' && j.destination) {
        elapsed.current = 0;
        duration.current = reducedMotion ? 0.4 : edgeDuration(j.location, j.destination);
        fromPos.current.copy(cam.position);
        const dest = bodyById.get(j.destination)!;
        const destCenter = bodyWorldPosition(dest);
        // Arrive at revealFraming distance, offset toward approach direction
        const approach = fromPos.current.clone().sub(destCenter).normalize();
        toPos.current.copy(destCenter).addScaledVector(approach, dest.camera.revealFraming.distanceU);
        toPos.current.y += dest.camera.revealFraming.distanceU * Math.tan(THREE.MathUtils.degToRad(dest.camera.revealFraming.elevationDeg));
      }
      if (j.phase === 'ORBIT') {
        const body = bodyById.get(j.location)!;
        const center = bodyWorldPosition(body);
        const rel = cam.position.clone().sub(center);
        orbitAngle.current = Math.atan2(rel.z, rel.x);
      }
      lastPhase.current = j.phase;
    }

    if (descent.stage === 'ARRIVED') {
      // System chapter: the camera is a probe on one graceful rail. Position
      // rides the spline; orientation IS the spline's tangent — as the path
      // curves through the worlds, the view eases with it. No lookAt on a
      // subject, no roll, no breathing, no parallax. The worlds come to the
      // window; the horizon of space never tilts.
      // Earth (and every chapter): the camera is dead still on the rail. The
      // scene comes alive on its own — Earth spins, the whole constellation
      // orbits — with no camera automation at all.
      systemPose(sp, cam.position, cam.quaternion);
      // Portrait re-frame: on desktop the worlds sit off to the side (room for
      // the side panel). On a tall phone that pushes them half off-frame, so we
      // re-aim the camera at the chapter's body — centred horizontally and lifted
      // into the upper frame, leaving the bottom for the (bottom-anchored) panel.
      // Position is untouched; only the aim changes, so the on-rail feel holds.
      if (aspectR < 1 && !portalDive.active) {
        const cid = CHAPTERS[chapterIndexAt(sp)]?.id;
        _portraitLook.set(0, 0, 0); // the Sun sits at the origin
        if (cid && cid !== 'sun') {
          const hero = HEROES.find((h) => h.id === cid);
          if (hero) _portraitLook.copy(hero.position);
        }
        _portraitLook.y -= cam.position.distanceTo(_portraitLook) * 0.14; // raise the body
        cam.up.set(0, 1, 0);
        // lookAt derives the camera's world position from its matrix, which
        // systemPose only updated on `.position` this frame — refresh the matrix
        // first, or lookAt aims from last frame's position and the body drifts
        // off-centre (worst for far-off-axis worlds like Venus).
        cam.updateMatrixWorld();
        cam.lookAt(_portraitLook);
      }
      // Jupiter portal dive: the storm opens, then the camera FALLS through it —
      // it is not a zoom. For the first beat it holds dead still while the eye
      // forms (Phase 1), then gravity takes it: quadratic freefall acceleration
      // straight down the throat, the frame widening with the mounting speed,
      // and the scene navigates to the app the instant it lands.
      if (portalDive.active) {
        const pt = portalDive.t;
        const fall = pt <= 0.14 ? 0 : Math.pow((pt - 0.14) / 0.86, 2.0) * 0.995;
        // fall direction = parked pose -> the eye (cam.position is still the
        // parked pose at this point in the frame)
        _pvLook.copy(portalDive.target).sub(cam.position).normalize();
        cam.position.lerp(portalDive.target, fall);
        // look straight down the fall so the eye stays dead-centre and the look
        // point never collapses onto the camera as it arrives
        _pvLook.multiplyScalar(500).add(cam.position);
        cam.up.set(0, 1, 0);
        cam.lookAt(_pvLook);
        cam.fov = baseFov.current + 18 * fall; // widening = accelerating freefall
        cam.updateProjectionMatrix();
      } else if (cam.fov !== baseFov.current) {
        // Parked at a chapter: keep the FOV at the adaptive base so the planet
        // frames correctly on any screen (and re-adapts if the phone rotates).
        cam.fov = baseFov.current;
        cam.updateProjectionMatrix();
      }
      cam.clearViewOffset();
      return;
    }

    switch (j.phase) {
      case 'INTRO': {
        // Cinematic push into the galaxy hero pose while the disc forms.
        // Starts farther out and slightly off-axis, eases to the resting vantage.
        const p = Math.min(t / 12, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        _sA.copy(GALAXY_CAM_POS).add(_introStart);
        cam.position.lerpVectors(_sA, GALAXY_CAM_POS, ease);
        lookTarget.current.copy(GALAXY_REST_LOOK);
        break;
      }
      case 'ACCEL':
      case 'CRUISE':
      case 'DECEL': {
        elapsed.current += delta;
        const raw = Math.min(elapsed.current / duration.current, 1);
        j.setTravelProgress(raw);
        // FSM checkpoints — legal transitions only
        if (raw >= ACCEL_END && j.phase === 'ACCEL') j.transition('CRUISE');
        if (raw >= DECEL_START && j.phase === 'CRUISE') j.transition('DECEL');

        const s = travelEase(raw);
        cam.position.lerpVectors(fromPos.current, toPos.current, s);

        // FOV widening during accel/cruise — speed sensation (§5.2), off under reduced motion
        if (!reducedMotion) {
          const fovBoost = Math.sin(Math.min(raw / DECEL_START, 1) * Math.PI) * 3.5;
          cam.fov = baseFov.current + fovBoost;
          cam.updateProjectionMatrix();
          fovManaged = true;
        }

        if (j.destination) lookTarget.current.copy(bodyWorldPosition(bodyById.get(j.destination)!));
        if (raw >= 1) {
          cam.fov = baseFov.current;
          cam.updateProjectionMatrix();
          j.arrive();
        }
        break;
      }
      case 'IDLE': {
        // Scroll descent: the camera rides the dive spline into the beacon
        // arm. Built lazily from the CURRENT position so idle drift never
        // causes a pop, cleared when the viewer scrolls all the way back.
        if (dp > 0.0015) {
          if (!descentCurve.current) descentCurve.current = buildDescentCurve(cam.position.clone());
          const curve = descentCurve.current;
          curve.getPoint(dp, cam.position);
          // Gaze: ALWAYS look forward along the flight tangent. The old code
          // lerped a look-target from the galaxy core (which falls behind the
          // camera during the dive) to points ahead — when that target swept
          // through the camera the view flipped a full 360. A forward tangent
          // never reverses, so the camera never spins; at the very start it
          // eases out of the resting core gaze so there is no jump.
          curve.getPoint(Math.min(dp + 0.035, 1), descentAhead.current);
          _dvFwd.copy(descentAhead.current).sub(cam.position);
          if (_dvFwd.lengthSq() > 1e-6) _dvFwd.normalize();
          _dvPoint.copy(cam.position).addScaledVector(_dvFwd, 8000);
          lookTarget.current
            .copy(GALAXY_REST_LOOK)
            .lerp(_dvPoint, THREE.MathUtils.smoothstep(dp, 0.02, 0.16));
          // Speed sensation mid-dive, easing off for the arrival
          if (!reducedMotion) {
            cam.fov =
              baseFov.current +
              4 * THREE.MathUtils.smoothstep(dp, 0.15, 0.55) * (1 - THREE.MathUtils.smoothstep(dp, 0.8, 0.98));
            cam.updateProjectionMatrix();
            fovManaged = true;
          }
          break;
        }
        descentCurve.current = null;

        // Galaxy hero rest — a free-floating telescope, never a locked tripod:
        // very slow orbital drift plus a constant, asymptotic forward creep.
        // The creep caps at 14% of the vantage distance so the framing holds.
        const center = GALAXY_LOOK;
        if (!reducedMotion) {
          orbitAngle.current += delta * 0.008;
          idleDrift.current = Math.min(idleDrift.current + delta * 0.0018, 0.14);
        }
        _sA.copy(GALAXY_CAM_POS)
          .sub(center)
          .applyAxisAngle(_sUp, orbitAngle.current)
          .multiplyScalar(1 - idleDrift.current);
        _sB.copy(center).add(_sA);
        cam.position.lerp(_sB, 1 - Math.exp(-1.5 * delta));
        lookTarget.current.copy(GALAXY_REST_LOOK);
        break;
      }
      case 'ORBIT':
      case 'FOCUS':
      case 'REVEAL': {
        const body = bodyById.get(j.location)!;
        const center = bodyWorldPosition(body);
        const dist = body.camera.revealFraming.distanceU;
        if (!reducedMotion) orbitAngle.current += delta * 0.03; // slow drift orbit
        const elev = THREE.MathUtils.degToRad(body.camera.revealFraming.elevationDeg);
        _sA.set(
          center.x + Math.cos(orbitAngle.current) * dist * Math.cos(elev),
          center.y + dist * Math.sin(elev),
          center.z + Math.sin(orbitAngle.current) * dist * Math.cos(elev),
        );
        cam.position.lerp(_sA, 1 - Math.exp(-2.5 * delta)); // damped follow
        // Rule-of-thirds framing: shift the gaze so the body sits off-center
        _sB.copy(center).sub(cam.position).normalize();
        _sC.crossVectors(_sB, cam.up).normalize();
        lookTarget.current.copy(center).addScaledVector(_sC, dist * 0.14).addScaledVector(cam.up, dist * 0.05);
        break;
      }
    }

    // Mouse parallax — small real camera translation toward the pointer while
    // resting on the galaxy hero. Because it's true translation, every depth
    // layer (foreground motes / disc slices / deep space) shifts at its own
    // rate — that differential motion is what sells the scale.
    if (!reducedMotion && (j.phase === 'INTRO' || (j.phase === 'IDLE' && dp < 0.02))) {
      pointerSmooth.current.lerp(state.pointer, 1 - Math.exp(-2.2 * delta));
      _sA.copy(lookTarget.current).sub(cam.position).normalize(); // fwd
      _sB.crossVectors(_sA, cam.up).normalize();                  // right
      _sC.crossVectors(_sB, _sA);                                 // up
      parallaxApplied.current
        .set(0, 0, 0)
        .addScaledVector(_sB, pointerSmooth.current.x * 1400)
        .addScaledVector(_sC, pointerSmooth.current.y * 700);
      cam.position.add(parallaxApplied.current);
    }

    // Look-lag: the gaze trails the intent with drone weight. NO breathing
    // sway and NO micro-roll — world-up is locked every frame, so the horizon
    // never tilts, the camera never banks, and there is zero jitter. The ship
    // is perfectly stabilised.
    const lookRate = j.phase === 'IDLE' && dp > 0.02 ? 5.5 : 3.2;
    currentLook.current.lerp(lookTarget.current, 1 - Math.exp(-lookRate * delta));
    cam.up.set(0, 1, 0);
    cam.lookAt(currentLook.current);

    // Resting states (galaxy hero, intro) run no speed-boost, so reconcile their
    // FOV to the adaptive base here — this is what widens the hero view on a
    // phone and lets it re-adapt when the device rotates.
    if (!fovManaged && cam.fov !== baseFov.current) {
      cam.fov = baseFov.current;
      cam.updateProjectionMatrix();
    }

    // Rule of thirds: shift the frustum so the subject composes off-center
    // (setViewOffset — the subject stays correctly tracked/lit, only the
    // framing shifts). Never dead-center on arrival. Cleared mid-travel.
    const w = size.width || gl.domElement.width || 1920;
    const h = size.height || gl.domElement.height || 1080;
    if ((j.phase === 'ORBIT' || j.phase === 'FOCUS' || j.phase === 'REVEAL') && j.location !== 'sun') {
      const [qx, qy] = hashOffset(j.location);
      // setViewOffset(fullW, fullH, offsetX, offsetY, windowW, windowH):
      // shifting the window off the full-frame center pushes the subject
      // toward the opposite third.
      const shiftX = (qx - 0.5) * w * 0.5;
      const shiftY = (qy - 0.5) * h * 0.5;
      cam.setViewOffset(w, h, shiftX, shiftY, w, h);
    } else {
      cam.clearViewOffset();
    }
  });

  return null;
}
