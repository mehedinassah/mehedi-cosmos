'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SKILLS, EDGES, NEIGHBORS, PULSE_PATHS, CYCLE_ORDER,
  colorOfSkill, sizeOfSkill, venusBridge, venusFocus, useVenusUI,
} from '@/state/venusStore';
import { CHAPTER_SP, systemPose } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * VenusConstellation — a designed skill graph emitted by Venus.
 *
 * On arrival the nodes rise OUT of Venus's atmosphere and settle into a fixed,
 * meaningful graph that arcs AROUND the planet (a cylindrical band about Venus's
 * up-axis): the readable core faces the open area, the right edge wraps toward
 * the limb where nodes tuck in front of and behind the planet (depth-tested, so
 * Venus occludes the ones behind it). The whole band rotates imperceptibly.
 *
 * Nodes breathe; cyan signals drift the edges; a knowledge pulse occasionally
 * runs a whole path (Programming -> ... -> AI); every ~6.5s Venus emits an
 * atmospheric pulse that brightens the network. Hover a node and it plus its
 * neighbours hold full brightness while everything else falls to 20%.
 */

// The graph is a facing plane, yawed in 3D about Venus's up-axis so its RIGHT
// edge (AI / infrastructure) recedes behind the planet's limb while the
// fundamentals sit forward in the open dark area — a chart wrapped around
// Venus, some nodes in front, some behind (depth-tested occlusion).
const SPREAD_X = 1.15; // lx -> horizontal (planet radii along the yawed plane)
const SPREAD_Y = 0.95; // ly -> vertical (planet radii)
const CENTER_X = 0.55; // shift the graph left so AI + fundamentals sit in open space
const OFF_UP = 0.05;
const PLANE_YAW = 0.5; // tilt so the right edge wraps behind Venus (front/back)
const YAW_OSC = 0.1; // gentle chart rotation (almost imperceptible)
const YAW_RATE = 0.05;

const SLOT = 5.2; // featured-card cadence
const FORM_DUR = 2.6; // Venus -> constellation formation
const PULSE_PERIOD = 6.5; // atmospheric pulse
const KFLOW_PERIOD = 5.5; // knowledge-flow pulse along a path
const CYAN = new THREE.Color('#7fd8e0');
const WHITE = new THREE.Color('#fff6ec');
const N_SIG = 16;

export function VenusConstellation({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const nodeSp = useRef<(THREE.Sprite | null)[]>([]);
  const nodeMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const lineRef = useRef<THREE.Object3D | null>(null);
  const sigRef = useRef<THREE.Object3D | null>(null);
  const pulseSp = useRef<THREE.Sprite | null>(null);
  const pulseMat = useRef<THREE.SpriteMaterial | null>(null);
  const haloSp = useRef<THREE.Sprite | null>(null);
  const haloMat = useRef<THREE.SpriteMaterial | null>(null);

  const nodeTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,247,232,1)'], [0.35, 'rgba(240,178,96,0.7)'], [1, 'rgba(230,150,80,0)']]),
    [],
  );
  const haloTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,228,180,0.5)'], [0.5, 'rgba(240,180,110,0.18)'], [1, 'rgba(230,150,80,0)']]),
    [],
  );

  // Fixed camera-basis of the parked pose (computed once). right/up span the
  // graph plane; yawing `right` about `up` tilts the plane into depth.
  const frame = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.venus, pos, quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    return { right, up };
  }, []);

  // Per-node plane coords + breathing phase.
  const meta = useMemo(
    () => SKILLS.map((s, i) => ({
      hx: s.lx * SPREAD_X - CENTER_X,
      vy: s.ly * SPREAD_Y + OFF_UP,
      color: new THREE.Color(colorOfSkill(s)),
      sizeF: sizeOfSkill(s),
      phase: i * 1.7,
    })),
    [],
  );

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EDGES.length * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(EDGES.length * 2 * 3), 3));
    return g;
  }, []);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const sigGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SIG * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_SIG * 3), 3));
    return g;
  }, []);
  const sigMat = useMemo(
    () => new THREE.PointsMaterial({ size: radius * 0.055, vertexColors: true, map: nodeTex, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [radius, nodeTex],
  );

  const clock = useRef(0);
  const formClock = useRef(0);
  const hoverMix = useRef(0);
  const formed = useRef(false);
  const npos = useRef<THREE.Vector3[]>(SKILLS.map(() => new THREE.Vector3()));
  const _rt = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  const _start = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const f = venusFocus();
    venusBridge.focus = f;
    const visible = f > 0.02;
    for (const sp of nodeSp.current) if (sp) sp.visible = visible;
    for (const h of hits.current) if (h) h.visible = visible;
    if (lineRef.current) lineRef.current.visible = visible;
    if (sigRef.current) sigRef.current.visible = visible;
    if (pulseSp.current) pulseSp.current.visible = visible;
    if (haloSp.current) haloSp.current.visible = visible;
    if (!visible) {
      venusBridge.active = false;
      venusBridge.env = 0;
      formed.current = false;
      formClock.current = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    const running = !venusBridge.paused && f > 0.85;
    if (f < 0.4) { clock.current = 0; formClock.current = 0; formed.current = false; }
    if (running) {
      clock.current += delta;
      formClock.current += delta;
    }

    // yawed graph plane: right axis tilted about up, gently rotating
    const yaw = PLANE_YAW + YAW_OSC * Math.sin(t * YAW_RATE);
    _rt.copy(frame.right).applyAxisAngle(frame.up, yaw);

    // formation: nodes rise out of Venus and settle into the band
    const form = THREE.MathUtils.clamp(formClock.current / FORM_DUR, 0, 1);

    // atmospheric pulse — Venus powers the network
    const pin = formClock.current % PULSE_PERIOD;
    const pulseEnv = Math.max(0, Math.sin((pin / PULSE_PERIOD) * Math.PI * 2)) ** 3;

    // hover state (user) vs featured node (cycle)
    const hovered = useVenusUI.getState().hovered;
    const hoverActive = hovered != null;
    hoverMix.current += ((hoverActive ? 1 : 0) - hoverMix.current) * Math.min(1, delta * 8);
    const hm = hoverMix.current;
    const activation = Math.floor(clock.current / SLOT);
    const featIdx = CYCLE_ORDER[activation % CYCLE_ORDER.length];
    const tin = clock.current % SLOT;
    const featEnv = THREE.MathUtils.smoothstep(tin, 0.5, 1.1) * (1 - THREE.MathUtils.smoothstep(tin, SLOT - 1.2, SLOT - 0.4));
    const activeIdx = hoverActive ? hovered! : featIdx;
    const cardEnv = hoverActive ? 1 : featEnv;
    const focusSet = new Set<number>([activeIdx, ...(NEIGHBORS[activeIdx] ?? [])]);

    // 1) node positions (form from surface) + brightness
    for (let i = 0; i < SKILLS.length; i++) {
      const m = meta[i];
      const target = npos.current[i];
      target.copy(center).addScaledVector(_rt, m.hx * radius).addScaledVector(frame.up, m.vy * radius);
      if (form < 1) {
        // formation: rise out of Venus's atmosphere along the node's direction
        _dir.copy(_rt).multiplyScalar(m.hx).addScaledVector(frame.up, m.vy);
        if (_dir.lengthSq() > 1e-6) _dir.normalize();
        _start.copy(center).addScaledVector(_dir, 1.02 * radius);
        const fe = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(form * 1.3 - i * 0.014, 0, 1), 0, 1);
        target.lerpVectors(_start, target, fe);
      }

      const isActive = i === activeIdx;
      const inFocus = focusSet.has(i);
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.7 + m.phase);
      let op = (0.42 + 0.14 * breathe) * form; // base + breathing, faded in on formation
      op += pulseEnv * 0.18; // Venus pulse lifts the whole network
      // hover: focus nodes stay full, everything else falls toward 20%
      const dimF = inFocus ? 1 : (1 - 0.8 * hm);
      op *= dimF;
      if (isActive) op = Math.max(op, (0.85 + 0.15 * cardEnv) * form);
      else if (inFocus) op = Math.max(op, (0.6 + 0.25 * hm) * form);

      const sp = nodeSp.current[i];
      const mat = nodeMat.current[i];
      const sc = radius * (0.135 * m.sizeF) * (isActive ? 1.35 : inFocus ? 1.12 : 1) * (0.9 + 0.1 * breathe) * (0.5 + 0.5 * form);
      if (sp) { sp.position.copy(target); sp.scale.setScalar(sc); }
      if (mat) {
        // hovered node highlights toward white
        mat.color.copy(m.color).lerp(WHITE, isActive && hoverActive ? 0.6 : 0);
        mat.opacity = op;
      }
      const hit = hits.current[i];
      if (hit) hit.position.copy(target);
    }

    // 2) edges — cyan, brightened for the focus/active wiring, dimmed on hover
    const lp = lineGeo.attributes.position.array as Float32Array;
    const lc = lineGeo.attributes.color.array as Float32Array;
    // knowledge-flow pulse: which path + segment is lit right now
    const kPath = PULSE_PATHS.length ? PULSE_PATHS[Math.floor(formClock.current / KFLOW_PERIOD) % PULSE_PATHS.length] : [];
    const kProg = (formClock.current % KFLOW_PERIOD) / KFLOW_PERIOD; // 0..1 along the path
    const kSeg = Math.min(kPath.length - 2, Math.floor(kProg * Math.max(1, kPath.length - 1)));
    const kA = kPath[kSeg], kB = kPath[kSeg + 1];
    for (let s = 0; s < EDGES.length; s++) {
      const [a, b] = EDGES[s];
      const pa = npos.current[a], pb = npos.current[b];
      lp[s * 6] = pa.x; lp[s * 6 + 1] = pa.y; lp[s * 6 + 2] = pa.z;
      lp[s * 6 + 3] = pb.x; lp[s * 6 + 4] = pb.y; lp[s * 6 + 5] = pb.z;
      let alpha = 0.14 + pulseEnv * 0.06;
      const touchesActive = a === activeIdx || b === activeIdx;
      if (hoverActive) alpha *= touchesActive ? 3.0 : 0.12; // hover isolates the wiring
      else if (touchesActive) alpha = Math.max(alpha, 0.16 + cardEnv * 0.28);
      if ((a === kA && b === kB) || (a === kB && b === kA)) alpha = Math.max(alpha, 0.5); // knowledge pulse edge
      alpha *= form;
      const g = Math.min(1, alpha);
      lc[s * 6] = CYAN.r * g; lc[s * 6 + 1] = CYAN.g * g; lc[s * 6 + 2] = CYAN.b * g;
      lc[s * 6 + 3] = CYAN.r * g; lc[s * 6 + 4] = CYAN.g * g; lc[s * 6 + 5] = CYAN.b * g;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;

    // 3) signals drift along edges (subtle current); a few ride the pulse edge
    const sp2 = sigGeo.attributes.position.array as Float32Array;
    const sc2 = sigGeo.attributes.color.array as Float32Array;
    for (let k = 0; k < N_SIG; k++) {
      const useKflow = k < 3 && kA != null && kB != null;
      const eA = useKflow ? kA : EDGES[(k * 7) % EDGES.length][0];
      const eB = useKflow ? kB : EDGES[(k * 7) % EDGES.length][1];
      const pa = npos.current[eA], pb = npos.current[eB];
      const phase = ((t * 0.42) + k / N_SIG) % 1;
      _start.copy(pa).lerp(pb, phase);
      sp2[k * 3] = _start.x; sp2[k * 3 + 1] = _start.y; sp2[k * 3 + 2] = _start.z;
      const touchesActive = eA === activeIdx || eB === activeIdx;
      let glow = Math.sin(phase * Math.PI) * 0.5 * form;
      if (useKflow) glow *= 1.8;
      if (hoverActive) glow *= touchesActive ? 1.4 : 0.1;
      const c = useKflow ? WHITE : CYAN;
      sc2[k * 3] = c.r * glow; sc2[k * 3 + 1] = c.g * glow; sc2[k * 3 + 2] = c.b * glow;
    }
    sigGeo.attributes.position.needsUpdate = true;
    sigGeo.attributes.color.needsUpdate = true;

    // 4) Venus atmospheric pulse ring (subtle, expands + fades from the planet)
    if (pulseSp.current && pulseMat.current) {
      const g = pulseEnv;
      pulseSp.current.position.copy(center);
      pulseSp.current.scale.setScalar(radius * (2.3 + g * 1.6));
      pulseMat.current.opacity = g * 0.1 * form;
    }
    if (haloSp.current && haloMat.current) {
      haloSp.current.position.copy(center);
      haloSp.current.scale.setScalar(radius * 3.0);
      haloMat.current.opacity = (0.05 + pulseEnv * 0.05) * form;
    }

    // 5) present the active node's card at its screen position
    const ap = npos.current[activeIdx];
    _ndc.copy(ap).project(camera);
    venusBridge.index = activeIdx;
    venusBridge.color = colorOfSkill(SKILLS[activeIdx]);
    venusBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
    venusBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
    venusBridge.env = cardEnv;
    venusBridge.active = _ndc.z < 1 && cardEnv > 0.02 && f > 0.6 && form > 0.6;
    formed.current = form >= 1;
  });

  const hitR = radius * 0.24;
  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (venusFocus() < 0.4) return;
    e.stopPropagation();
    useVenusUI.getState().setHovered(i);
    document.body.style.cursor = 'pointer';
  };
  const onOut = (i: number) => () => {
    if (useVenusUI.getState().hovered === i) useVenusUI.getState().setHovered(null);
    document.body.style.cursor = '';
  };
  const onClick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    if (venusFocus() < 0.4) return;
    e.stopPropagation();
    useVenusUI.getState().setSelected(i);
  };

  return (
    <group>
      {/* Venus atmospheric pulse: a soft halo + an expanding ring of light */}
      <sprite ref={(el) => { haloSp.current = el; }} visible={false} scale={[radius * 3, radius * 3, 1]}>
        <spriteMaterial ref={(m) => { haloMat.current = m; }} map={haloTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={(el) => { pulseSp.current = el; }} visible={false} scale={[radius * 2.4, radius * 2.4, 1]}>
        <spriteMaterial ref={(m) => { pulseMat.current = m; }} map={haloTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* edges + travelling signals (depth-tested so Venus occludes the far side) */}
      <lineSegments ref={(el) => { lineRef.current = el; }} geometry={lineGeo} material={lineMat} visible={false} frustumCulled={false} />
      <points ref={(el) => { sigRef.current = el; }} geometry={sigGeo} material={sigMat} visible={false} frustumCulled={false} />

      {/* skill nodes + invisible hit targets */}
      {SKILLS.map((s, i) => (
        <group key={s.name}>
          <sprite ref={(el) => { nodeSp.current[i] = el; }} visible={false} scale={[radius * 0.12, radius * 0.12, 1]}>
            <spriteMaterial
              ref={(m) => { nodeMat.current[i] = m; if (m) m.color.set(colorOfSkill(s)); }}
              map={nodeTex}
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <mesh
            ref={(el) => { hits.current[i] = el; }}
            visible={false}
            onPointerOver={onOver(i)}
            onPointerOut={onOut(i)}
            onClick={onClick(i)}
          >
            <sphereGeometry args={[hitR, 10, 10]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
