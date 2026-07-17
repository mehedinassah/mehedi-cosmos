'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SKILLS, ORBITS, CATEGORY_ORDER, RELATED, colorOfSkill, venusBridge, venusFocus, useVenusUI,
  type Category,
} from '@/state/venusStore';
import { CHAPTER_SP, systemPose } from '@/world/system/systemSpec';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * VenusConstellation — the Skill Galaxy.
 *
 * Six tilted orbits circle Venus, each a skill category with its own colour and
 * kind of celestial body. Orbits turn at their own pace; objects sweep in front
 * of and behind the planet (depth-tested occlusion). Hover a skill and it grows
 * and brightens, its related technologies light, cyan curves animate out to
 * them, and everything else falls to 25%. Faint dust rings mark each orbit and
 * brighten with its category; energy pulses run the rings; the cursor exerts a
 * tiny gravity. No permanent labels — discovery is through hover alone.
 */

const CYAN = new THREE.Color('#8fe6ee');
const WHITE = new THREE.Color('#ffffff');
const MAX_CONN = 6;
const SEG = 12;
const N_PULSE = 6;
const RING_PTS = 128;

export function VenusConstellation({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const glowSp = useRef<(THREE.Sprite | null)[]>([]);
  const glowMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const coreMesh = useRef<(THREE.Mesh | null)[]>([]);
  const coreMat = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const ringRef = useRef<(THREE.Object3D | null)[]>([]);
  const ringMat = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const connRef = useRef<THREE.Object3D | null>(null);
  const pulseRef = useRef<THREE.Object3D | null>(null);

  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(220,220,230,0.55)'], [1, 'rgba(200,200,220,0)']]),
    [],
  );

  // Parked camera basis + per-orbit plane basis (computed once, world-fixed).
  const basis = useMemo(() => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    systemPose(CHAPTER_SP.venus, pos, quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const toCam = fwd.clone().multiplyScalar(-1);
    const planes = {} as Record<Category, { u: THREE.Vector3; v: THREE.Vector3 }>;
    for (const c of CATEGORY_ORDER) {
      const incl = ORBITS[c].incl;
      const u = right.clone();
      const v = up.clone().multiplyScalar(Math.cos(incl)).addScaledVector(fwd, Math.sin(incl));
      planes[c] = { u, v };
    }
    return { right, up, fwd, toCam, planes };
  }, []);

  // Per-node: orbit, base angle spread within its orbit, colour.
  const nodes = useMemo(() => {
    const counts = {} as Record<Category, number>;
    const seen = {} as Record<Category, number>;
    CATEGORY_ORDER.forEach((c) => { counts[c] = 0; seen[c] = 0; });
    SKILLS.forEach((s) => { counts[s.category]++; });
    const catOff: Record<Category, number> = { lang: 0.3, frontend: 1.1, backend: 2.0, database: 0.7, ai: 1.7, tools: 2.6 };
    return SKILLS.map((s) => {
      const k = seen[s.category]++;
      const phase = (k / counts[s.category]) * Math.PI * 2 + catOff[s.category];
      const o = ORBITS[s.category];
      return { cat: s.category, phase, r: o.radius * radius, color: new THREE.Color(colorOfSkill(s)) };
    });
  }, [radius]);

  // Static dust rings (one per orbit), built in world space from the fixed basis.
  const ringGeo = useMemo(() => CATEGORY_ORDER.map((c) => {
    const o = ORBITS[c]; const pl = basis.planes[c];
    const pos = new Float32Array(RING_PTS * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < RING_PTS; i++) {
      const a = (i / RING_PTS) * Math.PI * 2;
      v.copy(center).addScaledVector(pl.u, Math.cos(a) * o.radius * radius).addScaledVector(pl.v, Math.sin(a) * o.radius * radius);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }), [center, radius, basis]);

  const connGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CONN * SEG * 2 * 3), 3));
    return g;
  }, []);
  const connMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const pulseGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_PULSE * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_PULSE * 3), 3));
    return g;
  }, []);
  const pulseMat = useMemo(
    () => new THREE.PointsMaterial({ size: radius * 0.05, vertexColors: true, map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [radius, glowTex],
  );
  const pulses = useMemo(() => Array.from({ length: N_PULSE }, (_, i) => ({
    cat: CATEGORY_ORDER[i % CATEGORY_ORDER.length],
    phase: (i * 2.399963) % (Math.PI * 2),
    speed: 0.5 + (i % 3) * 0.14,
  })), []);

  const spin = useRef<Record<Category, number>>({ lang: 0, frontend: 0, backend: 0, database: 0, ai: 0, tools: 0 });
  const appear = useRef(0);
  const hoverMix = useRef(0);
  const connGrow = useRef(0);
  const npos = useRef<THREE.Vector3[]>(SKILLS.map(() => new THREE.Vector3()));
  const nvis = useRef<boolean[]>(SKILLS.map(() => true));
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _perp = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _a = useMemo(() => new THREE.Vector3(), []);
  const _b = useMemo(() => new THREE.Vector3(), []);
  const _m = useMemo(() => new THREE.Vector3(), []);
  const _c = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const f = venusFocus();
    venusBridge.focus = f;
    const visible = f > 0.02;
    for (const s of glowSp.current) if (s) s.visible = visible;
    for (const m of coreMesh.current) if (m) m.visible = visible;
    for (const r of ringRef.current) if (r) r.visible = visible;
    if (connRef.current) connRef.current.visible = visible;
    if (pulseRef.current) pulseRef.current.visible = visible;
    if (!visible) {
      for (const h of hits.current) if (h) h.visible = false;
      venusBridge.active = false; venusBridge.env = 0;
      appear.current = 0; connGrow.current = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    appear.current = Math.min(1, appear.current + delta * 0.8);
    const app = THREE.MathUtils.smoothstep(appear.current, 0, 1);
    for (const c of CATEGORY_ORDER) spin.current[c] += delta * ORBITS[c].speed * ORBITS[c].dir;

    // hover state
    const hovered = useVenusUI.getState().hovered;
    const hoverActive = hovered != null;
    hoverMix.current += ((hoverActive ? 1 : 0) - hoverMix.current) * Math.min(1, delta * 8);
    connGrow.current += ((hoverActive ? 1 : 0) - connGrow.current) * Math.min(1, delta * 6);
    const hm = hoverMix.current;
    const focusSet = new Set<number>(hoverActive ? [hovered!, ...(RELATED[hovered!] ?? [])] : []);
    const activeCat: Category | null = hoverActive ? SKILLS[hovered!].category : null;
    const ptr = state.pointer; // NDC -1..1

    // 1) node positions (orbit + cursor gravity) + visuals
    for (let i = 0; i < SKILLS.length; i++) {
      const nd = nodes[i];
      const pl = basis.planes[nd.cat];
      const a = nd.phase + spin.current[nd.cat];
      const p = npos.current[i];
      p.copy(center).addScaledVector(pl.u, Math.cos(a) * nd.r).addScaledVector(pl.v, Math.sin(a) * nd.r);

      // occlusion: behind Venus and within its silhouette -> hidden
      _p.copy(p).sub(center);
      const along = _p.dot(basis.toCam);
      _perp.copy(_p).addScaledVector(basis.toCam, -along);
      const occluded = along < 0 && _perp.length() < radius * 1.02;
      nvis.current[i] = !occluded;

      // cursor gravity — a gentle pull, only for visible nodes
      _ndc.copy(p).project(camera);
      if (!occluded && _ndc.z < 1) {
        const dx = ptr.x - _ndc.x, dy = ptr.y - _ndc.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.16) {
          const pull = (1 - d / 0.16) * 0.09 * radius;
          p.addScaledVector(basis.right, dx * pull).addScaledVector(basis.up, dy * pull);
        }
      }

      const o = ORBITS[nd.cat];
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.3);
      const isHover = i === hovered;
      const inFocus = focusSet.has(i);
      const grow = isHover ? 1.15 : inFocus ? 1.06 : 1;
      const dim = hoverActive ? (inFocus ? 1 : 0.25) : 1;

      const sp = glowSp.current[i];
      const gm = glowMat.current[i];
      const gsc = radius * o.glow * grow * (0.9 + 0.14 * breathe);
      if (sp) { sp.position.copy(p); sp.scale.setScalar(gsc); }
      if (gm) {
        gm.color.copy(nd.color).lerp(WHITE, isHover ? 0.4 : 0);
        let op = (0.42 + 0.16 * breathe) * app * dim;
        if (isHover) op = Math.max(op, 0.95 * app);
        else if (inFocus) op = Math.max(op, 0.72 * app);
        gm.opacity = occluded ? 0 : op;
      }
      const cm = coreMesh.current[i];
      const cmat = coreMat.current[i];
      if (cm) { cm.position.copy(p); cm.scale.setScalar(radius * o.core * grow * (0.92 + 0.1 * breathe)); cm.visible = visible && o.core > 0 && !occluded; }
      if (cmat) cmat.opacity = (o.crystal ? 0.85 : 1) * app * dim;

      const hit = hits.current[i];
      if (hit) { hit.position.copy(p); hit.visible = visible && !occluded && app > 0.6; }
    }

    // 2) connection curves (hover only, grow outward, occlude behind Venus)
    const cp = connGeo.attributes.position.array as Float32Array;
    let seg = 0;
    if (hoverActive && connGrow.current > 0.02) {
      const rel = (RELATED[hovered!] ?? []).slice(0, MAX_CONN);
      _a.copy(npos.current[hovered!]);
      const gT = THREE.MathUtils.smoothstep(connGrow.current, 0, 1);
      for (const r of rel) {
        _b.copy(npos.current[r]);
        _m.copy(_a).add(_b).multiplyScalar(0.5).addScaledVector(basis.toCam, _a.distanceTo(_b) * 0.18); // bulge toward camera
        for (let s = 0; s < SEG; s++) {
          const t0 = (s / SEG) * gT, t1 = ((s + 1) / SEG) * gT;
          bez(_a, _m, _b, t0, _p); cp[seg * 6] = _p.x; cp[seg * 6 + 1] = _p.y; cp[seg * 6 + 2] = _p.z;
          bez(_a, _m, _b, t1, _p); cp[seg * 6 + 3] = _p.x; cp[seg * 6 + 4] = _p.y; cp[seg * 6 + 5] = _p.z;
          seg++;
        }
      }
    }
    connGeo.attributes.position.needsUpdate = true;
    connGeo.setDrawRange(0, seg * 2);
    connMat.opacity = 0.55 * connGrow.current * (0.7 + 0.3 * Math.sin(t * 4));

    // 3) orbit paths — faint elliptical lines, brighter for the active category
    CATEGORY_ORDER.forEach((c, ci) => {
      const rm = ringMat.current[ci];
      if (!rm) return;
      const isActive = activeCat === c;
      rm.opacity = (isActive ? 0.55 : 0.16 * (hoverActive ? 0.5 : 1)) * app;
    });

    // 4) energy pulses running the rings
    const pp = pulseGeo.attributes.position.array as Float32Array;
    const pc = pulseGeo.attributes.color.array as Float32Array;
    for (let k = 0; k < N_PULSE; k++) {
      const pu = pulses[k]; const pl = basis.planes[pu.cat]; const o = ORBITS[pu.cat];
      const a = pu.phase + t * pu.speed * o.dir;
      _p.copy(center).addScaledVector(pl.u, Math.cos(a) * o.radius * radius).addScaledVector(pl.v, Math.sin(a) * o.radius * radius);
      _perp.copy(_p).sub(center); const along = _perp.dot(basis.toCam); _b.copy(_perp).addScaledVector(basis.toCam, -along);
      const occ = along < 0 && _b.length() < radius * 1.02;
      pp[k * 3] = _p.x; pp[k * 3 + 1] = _p.y; pp[k * 3 + 2] = _p.z;
      const gl = (occ ? 0 : 0.9) * app;
      _c.set(o.color);
      pc[k * 3] = _c.r * gl; pc[k * 3 + 1] = _c.g * gl; pc[k * 3 + 2] = _c.b * gl;
    }
    pulseGeo.attributes.position.needsUpdate = true;
    pulseGeo.attributes.color.needsUpdate = true;

    // 5) hover card
    if (hoverActive && nvis.current[hovered!]) {
      _ndc.copy(npos.current[hovered!]).project(camera);
      venusBridge.index = hovered!;
      venusBridge.color = colorOfSkill(SKILLS[hovered!]);
      venusBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
      venusBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
      venusBridge.env = hm;
      venusBridge.active = _ndc.z < 1;
    } else {
      venusBridge.env = hm;
      venusBridge.active = hoverActive;
    }
  });

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
  const hitR = radius * 0.2;

  return (
    <group>
      {/* orbit paths — crisp elliptical lines */}
      {CATEGORY_ORDER.map((c, ci) => (
        <lineLoop key={c} ref={(el) => { ringRef.current[ci] = el; }} geometry={ringGeo[ci]} visible={false} frustumCulled={false}>
          <lineBasicMaterial
            ref={(m) => { ringMat.current[ci] = m; if (m) m.color.set(ORBITS[c].color); }}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineLoop>
      ))}

      {/* dynamic connection curves + energy pulses */}
      <lineSegments ref={(el) => { connRef.current = el; }} geometry={connGeo} material={connMat} visible={false} frustumCulled={false} />
      <points ref={(el) => { pulseRef.current = el; }} geometry={pulseGeo} material={pulseMat} visible={false} frustumCulled={false} />

      {/* skill bodies: glow sprite + solid core + hit target */}
      {SKILLS.map((s, i) => {
        const o = ORBITS[s.category];
        const coreColor = new THREE.Color(o.color).lerp(new THREE.Color('#ffffff'), s.category === 'lang' ? 0.6 : 0.25);
        return (
          <group key={s.name}>
            <sprite ref={(el) => { glowSp.current[i] = el; }} visible={false} scale={[radius * o.glow, radius * o.glow, 1]}>
              <spriteMaterial
                ref={(m) => { glowMat.current[i] = m; if (m) m.color.set(o.color); }}
                map={glowTex}
                transparent
                opacity={0.3}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
            {o.core > 0 && (
              <mesh ref={(el) => { coreMesh.current[i] = el; }} visible={false}>
                {o.crystal ? <octahedronGeometry args={[radius * o.core, 0]} /> : <sphereGeometry args={[radius * o.core, 16, 16]} />}
                <meshBasicMaterial
                  ref={(m) => { coreMat.current[i] = m; if (m) m.color.copy(coreColor); }}
                  transparent
                  opacity={1}
                  toneMapped={false}
                  depthWrite={!o.crystal}
                />
              </mesh>
            )}
            <mesh ref={(el) => { hits.current[i] = el; }} visible={false} onPointerOver={onOver(i)} onPointerOut={onOut(i)}>
              <sphereGeometry args={[hitR, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Quadratic bezier sample into `out`. */
function bez(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const s = 1 - t;
  out.set(
    s * s * a.x + 2 * s * t * c.x + t * t * b.x,
    s * s * a.y + 2 * s * t * c.y + t * t * b.y,
    s * s * a.z + 2 * s * t * c.z + t * t * b.z,
  );
}
