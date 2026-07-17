'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SKILLS, RELATIONS, NEIGHBORS, CYCLE_ORDER, colorOfSkill, venusBridge, venusFocus, useVenusUI,
  type Layer,
} from '@/state/venusStore';
import { CHAPTER_SP, systemPose } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * VenusConstellation — skills as a living neural network orbiting Venus.
 *
 * Three shells (Languages inner, Frameworks middle, Infrastructure outer) each
 * ride their own tilted orbit at their own pace, so the eye reads foundation ->
 * framework -> infrastructure without a single label. Warm glowing nodes; cyan
 * connection lines flicker between related technologies while tiny signals run
 * along them like current. A featured node surfaces a compact card (important
 * skills first); hover lights a node and its neighbours; click unfolds the full
 * record. Every ~14s the whole web synchronises for a breath.
 *
 * The shells' planes are fixed in world space (built once from the parked
 * camera basis) so scrolling away just glides the camera past — nothing is
 * re-solved in the moving frustum, nothing snaps.
 */

// Venus fills the right of the frame, so a network concentric on its centre
// would sit mostly behind the planet or fly off-screen. Instead the whole web
// floats in the open space to Venus's left (like Earth's ecosystem): a compact,
// self-contained constellation. Radii are in planet radii from that offset.
const LAYERS: Record<Layer, { r: number; speed: number; tiltX: number; roll: number }> = {
  inner: { r: 0.46, speed: 0.05, tiltX: 0.5, roll: 0.22 },
  middle: { r: 0.78, speed: 0.066, tiltX: -0.42, roll: -0.5 },
  outer: { r: 1.06, speed: 0.03, tiltX: 0.6, roll: 0.95 },
};
// Where the network floats, relative to Venus, in the parked-camera basis. Far
// enough left that even the outer shell clears Venus's bright limb, so the web
// reads against dark space, not the planet.
const OFF_RIGHT = -1.95; // planet radii to the LEFT (open area)
const OFF_UP = 0.12;
const OFF_FWD = -0.35; // slightly toward the camera

const SLOT = 5.0; // seconds a node stays featured
const HERO_PERIOD = 14.0; // the whole-web synchronise
const HERO_DUR = 1.7;
const CYAN = new THREE.Color('#7fd8e0');
const N_SIGNALS = 12;

/** Build an orbit plane basis from the parked-camera axes: u roughly the
 *  viewer's right, v the up tipped toward the depth axis and rolled, so each
 *  shell is a distinct 3D ellipse (half in front of Venus, half behind it). */
function shellBasis(
  right: THREE.Vector3, up: THREE.Vector3, fwd: THREE.Vector3, tiltX: number, roll: number,
): { u: THREE.Vector3; v: THREE.Vector3 } {
  const v0 = up.clone().multiplyScalar(Math.cos(tiltX)).addScaledVector(fwd, Math.sin(tiltX));
  const u0 = right.clone();
  const cu = Math.cos(roll), su = Math.sin(roll);
  const u = u0.clone().multiplyScalar(cu).addScaledVector(v0, su).normalize();
  const v = v0.clone().multiplyScalar(cu).addScaledVector(u0, -su).normalize();
  return { u, v };
}

export function VenusConstellation({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const nodeSp = useRef<(THREE.Sprite | null)[]>([]);
  const nodeMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const lineRef = useRef<THREE.Object3D | null>(null);
  const sigRef = useRef<THREE.Object3D | null>(null);

  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,246,232,1)'], [0.4, 'rgba(240,180,110,0.55)'], [1, 'rgba(230,150,90,0)']]),
    [],
  );

  // Fixed shell planes + the network's world-space centre, from the parked pose
  // (computed once — so scrolling away just glides the camera past).
  const { bases, hub } = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.venus, pos, quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const b = {
      inner: shellBasis(right, up, fwd, LAYERS.inner.tiltX, LAYERS.inner.roll),
      middle: shellBasis(right, up, fwd, LAYERS.middle.tiltX, LAYERS.middle.roll),
      outer: shellBasis(right, up, fwd, LAYERS.outer.tiltX, LAYERS.outer.roll),
    } as Record<Layer, { u: THREE.Vector3; v: THREE.Vector3 }>;
    const h = center.clone()
      .addScaledVector(right, OFF_RIGHT * radius)
      .addScaledVector(up, OFF_UP * radius)
      .addScaledVector(fwd, OFF_FWD * radius);
    return { bases: b, hub: h };
  }, [center, radius]);

  // Per-node placement: base angle spread within its shell.
  const nodes = useMemo(() => {
    const counts: Record<Layer, number> = { inner: 0, middle: 0, outer: 0 };
    SKILLS.forEach((s) => { counts[s.layer]++; });
    const seen: Record<Layer, number> = { inner: 0, middle: 0, outer: 0 };
    return SKILLS.map((s) => {
      const k = seen[s.layer]++;
      const base = (k / counts[s.layer]) * Math.PI * 2 + (s.layer === 'middle' ? 0.4 : s.layer === 'outer' ? 0.8 : 0);
      return { layer: s.layer, base, color: new THREE.Color(colorOfSkill(s)), pulse: s.pulse };
    });
  }, []);

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RELATIONS.length * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(RELATIONS.length * 2 * 3), 3));
    return g;
  }, []);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const sigGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SIGNALS * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_SIGNALS * 3), 3));
    return g;
  }, []);
  const sigMat = useMemo(
    () => new THREE.PointsMaterial({ size: radius * 0.06, vertexColors: true, map: glowTex, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [radius, glowTex],
  );

  const rot = useRef<Record<Layer, number>>({ inner: 0, middle: 0, outer: 0 });
  const clock = useRef(0);
  const heroClock = useRef(0);
  const npos = useRef<THREE.Vector3[]>(SKILLS.map(() => new THREE.Vector3()));
  const _w = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const f = venusFocus();
    venusBridge.focus = f;
    const visible = f > 0.02;
    for (const sp of nodeSp.current) if (sp) sp.visible = visible;
    for (const h of hits.current) if (h) h.visible = visible;
    if (lineRef.current) lineRef.current.visible = visible;
    if (sigRef.current) sigRef.current.visible = visible;
    if (!visible) {
      venusBridge.active = false;
      venusBridge.env = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    const running = !venusBridge.paused && f > 0.85;
    if (running) {
      rot.current.inner += delta * LAYERS.inner.speed;
      rot.current.middle += delta * LAYERS.middle.speed;
      rot.current.outer += delta * LAYERS.outer.speed;
      clock.current += delta;
      heroClock.current += delta;
    }
    if (f < 0.4) { clock.current = 0; heroClock.current = 0; }

    // hero synchronise pulse
    const hin = heroClock.current % HERO_PERIOD;
    const heroEnv = THREE.MathUtils.smoothstep(hin, 0, 0.4) * (1 - THREE.MathUtils.smoothstep(hin, HERO_DUR - 0.5, HERO_DUR));

    // featured node (cycle) vs hovered node (user drives)
    const hovered = useVenusUI.getState().hovered;
    const activation = Math.floor(clock.current / SLOT);
    const featIdx = CYCLE_ORDER[activation % CYCLE_ORDER.length];
    const tin = clock.current % SLOT;
    const featEnv = THREE.MathUtils.smoothstep(tin, 0.5, 1.1) * (1 - THREE.MathUtils.smoothstep(tin, SLOT - 1.2, SLOT - 0.4));
    const activeIdx = hovered != null ? hovered : featIdx;
    const cardEnv = hovered != null ? 1 : featEnv;
    const nbActive = NEIGHBORS[activeIdx] ?? [];

    // 1) node world positions + brightness
    for (let i = 0; i < SKILLS.length; i++) {
      const nd = nodes[i];
      const L = LAYERS[nd.layer];
      const bas = bases[nd.layer];
      const ang = nd.base + rot.current[nd.layer];
      const R = L.r * radius;
      const p = npos.current[i];
      p.copy(hub).addScaledVector(bas.u, Math.cos(ang) * R).addScaledVector(bas.v, Math.sin(ang) * R);

      const sp = nodeSp.current[i];
      const mat = nodeMat.current[i];
      const isActive = i === activeIdx;
      const isNb = nbActive.includes(i);
      let op = 0.28 + 0.12 * Math.sin(t * nd.pulse + i * 1.7);
      if (heroEnv > 0) op = Math.max(op, 0.4 + 0.5 * heroEnv);
      if (isNb) op = Math.max(op, 0.4 + 0.32 * cardEnv);
      if (isActive) op = Math.max(op, 0.72 + 0.28 * cardEnv);
      const sc = radius * (isActive ? 0.15 + 0.06 * cardEnv : isNb ? 0.12 : 0.09);
      if (sp) { sp.position.copy(p); sp.scale.setScalar(sc); }
      if (mat) { mat.opacity = op; mat.color.copy(nd.color); }
      const hit = hits.current[i];
      if (hit) hit.position.copy(p);
    }

    // 2) which links are drawn this frame, and how bright
    // hero -> all; otherwise the active node's wiring + one ambient wanderer.
    type Link = { a: number; b: number; alpha: number };
    const drawn: Link[] = [];
    if (heroEnv > 0.01) {
      for (const [a, b] of RELATIONS) drawn.push({ a, b, alpha: 0.28 + 0.55 * heroEnv });
    }
    // active node's wiring (also flares on hover)
    for (const j of nbActive) drawn.push({ a: activeIdx, b: j, alpha: 0.35 + 0.5 * cardEnv });
    // one ambient connection keeps the network alive between features
    if (RELATIONS.length) {
      const ai = Math.floor(t / 2.3) % RELATIONS.length;
      const amb = t / 2.3 - Math.floor(t / 2.3);
      const aenv = Math.sin(amb * Math.PI);
      const [a, b] = RELATIONS[ai];
      drawn.push({ a, b, alpha: 0.18 * aenv });
    }

    const lp = lineGeo.attributes.position.array as Float32Array;
    const lc = lineGeo.attributes.color.array as Float32Array;
    const nSeg = Math.min(drawn.length, RELATIONS.length);
    for (let s = 0; s < nSeg; s++) {
      const { a, b, alpha } = drawn[s];
      const pa = npos.current[a], pb = npos.current[b];
      lp[s * 6] = pa.x; lp[s * 6 + 1] = pa.y; lp[s * 6 + 2] = pa.z;
      lp[s * 6 + 3] = pb.x; lp[s * 6 + 4] = pb.y; lp[s * 6 + 5] = pb.z;
      const g = Math.min(1, alpha);
      lc[s * 6] = CYAN.r * g; lc[s * 6 + 1] = CYAN.g * g; lc[s * 6 + 2] = CYAN.b * g;
      lc[s * 6 + 3] = CYAN.r * g; lc[s * 6 + 4] = CYAN.g * g; lc[s * 6 + 5] = CYAN.b * g;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;
    lineGeo.setDrawRange(0, nSeg * 2);

    // 3) signals run along the drawn links like current
    const sp2 = sigGeo.attributes.position.array as Float32Array;
    const sc2 = sigGeo.attributes.color.array as Float32Array;
    for (let k = 0; k < N_SIGNALS; k++) {
      if (nSeg === 0) { sp2[k * 3] = sp2[k * 3 + 1] = sp2[k * 3 + 2] = 0; sc2[k * 3] = sc2[k * 3 + 1] = sc2[k * 3 + 2] = 0; continue; }
      const link = drawn[k % nSeg];
      const pa = npos.current[link.a], pb = npos.current[link.b];
      const phase = (t * 0.5 + k / N_SIGNALS) % 1;
      _w.copy(pa).lerp(pb, phase);
      sp2[k * 3] = _w.x; sp2[k * 3 + 1] = _w.y; sp2[k * 3 + 2] = _w.z;
      const glow = Math.sin(phase * Math.PI) * Math.min(1, link.alpha + 0.2);
      sc2[k * 3] = CYAN.r * glow; sc2[k * 3 + 1] = CYAN.g * glow; sc2[k * 3 + 2] = (CYAN.b + 0.15) * glow;
    }
    sigGeo.attributes.position.needsUpdate = true;
    sigGeo.attributes.color.needsUpdate = true;

    // 4) present the active node's card at its screen position
    const ap = npos.current[activeIdx];
    _ndc.copy(ap).project(camera);
    venusBridge.index = activeIdx;
    venusBridge.color = colorOfSkill(SKILLS[activeIdx]);
    venusBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
    venusBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
    venusBridge.env = cardEnv;
    venusBridge.active = _ndc.z < 1 && cardEnv > 0.02 && f > 0.6;
  });

  const hitR = radius * 0.26;
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
      {/* connection lines + travelling signals */}
      <lineSegments ref={(el) => { lineRef.current = el; }} geometry={lineGeo} material={lineMat} visible={false} frustumCulled={false} />
      <points ref={(el) => { sigRef.current = el; }} geometry={sigGeo} material={sigMat} visible={false} frustumCulled={false} />

      {/* skill nodes (warm glow) + invisible hit targets */}
      {SKILLS.map((s, i) => (
        <group key={s.name}>
          <sprite ref={(el) => { nodeSp.current[i] = el; }} visible={false} scale={[radius * 0.12, radius * 0.12, 1]}>
            <spriteMaterial
              ref={(m) => { nodeMat.current[i] = m; if (m) m.color.set(s.color); }}
              map={glowTex}
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
