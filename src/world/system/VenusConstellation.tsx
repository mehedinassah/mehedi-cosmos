'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SKILLS, ORBITS, CATEGORY_ORDER, RELATED, PULSE_PATHS, colorOfSkill, venusBridge, venusFocus, useVenusUI,
  type Category,
} from '@/state/venusStore';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * VenusConstellation — the Engineering Ecosystem.
 *
 * Six elliptical, tilted, unevenly-spaced orbits circle Venus, each a layer of
 * the stack with its own colour and kind of body (language stars, frontend
 * planets, backend moons, database crystals, tool satellites, AI orbs). Paths
 * are only faint orbital dust until a category is hovered, when the full ring
 * sweeps in like radar. Most nodes glow softly; a few pulse and twinkle. As
 * objects graze Venus's atmosphere they haze and, behind it, vanish. Signals
 * drift the real stacks. Hover reveals the technologies a skill enables, with
 * the node growing, its orbit glowing, particles swirling, and a card fading in.
 */

const CYAN = new THREE.Color('#8fe6ee');
const WHITE = new THREE.Color('#ffffff');
const MAX_CONN = 6;
const SEG = 12;
const N_SIG = 4;
const N_SWIRL = 14;
const RING_PTS = 130;

export function VenusConstellation({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const glowSp = useRef<(THREE.Sprite | null)[]>([]);
  const glowMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const coreMesh = useRef<(THREE.Mesh | null)[]>([]);
  const coreMat = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const dustRef = useRef<(THREE.Object3D | null)[]>([]);
  const dustMat = useRef<(THREE.PointsMaterial | null)[]>([]);
  const lineRef = useRef<(THREE.Object3D | null)[]>([]);
  const lineMat = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const connRef = useRef<THREE.Object3D | null>(null);
  const sigRef = useRef<THREE.Object3D | null>(null);
  const swirlRef = useRef<THREE.Object3D | null>(null);
  const swirlMat = useRef<THREE.PointsMaterial | null>(null);

  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(220,220,230,0.55)'], [1, 'rgba(200,200,220,0)']]),
    [],
  );

  // Live camera-facing basis, recomputed each frame so the skill galaxy faces
  // the camera however it is aimed (desktop rail pose OR the portrait re-aim that
  // centres Venus). On DESKTOP the cluster sits in the open space beside the
  // planet (its authored tilted/elliptical orbits). On a PORTRAIT phone (Venus
  // centred, panel below) that would run off the narrow frame, so the orbits
  // become clean concentric rings AROUND the planet, squeezed horizontally to
  // stay in frame.
  const basis = useRef({
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    toCam: new THREE.Vector3(0, 0, 1),
    hub: center.clone(),
    hTight: 1,
    planes: {} as Record<Category, { u: THREE.Vector3; v: THREE.Vector3; R: number; b: number }>,
  });
  for (const c of CATEGORY_ORDER) {
    if (!basis.current.planes[c]) basis.current.planes[c] = { u: new THREE.Vector3(), v: new THREE.Vector3(), R: 0, b: 1 };
  }
  const updateBasis = () => {
    const b = basis.current;
    b.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    b.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    b.toCam.copy(camera.position).sub(center).normalize();
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 1;
    if (portrait) {
      b.hub.copy(center).addScaledVector(b.toCam, 1.2 * radius); // centred, in front
      b.hTight = 0.6 + 0.42 * aspect; // squeeze the rings into the narrow width
    } else {
      b.hub.copy(center)
        .addScaledVector(b.right, -0.78 * radius)
        .addScaledVector(b.up, 0.12 * radius)
        .addScaledVector(b.toCam, 1.3 * radius);
      b.hTight = 1;
    }
    for (const c of CATEGORY_ORDER) {
      const o = ORBITS[c];
      const pl = b.planes[c];
      if (portrait) {
        pl.u.copy(b.right);
        pl.v.copy(b.up);
        pl.R = radius * (0.98 + o.radius * 0.92); // concentric rings clearing the limb
        pl.b = 0.72; // flat perspective ring
      } else {
        pl.u.copy(b.right).applyAxisAngle(b.toCam, o.roll);
        pl.v.copy(b.up).applyAxisAngle(b.toCam, o.roll);
        pl.R = o.radius * radius;
        pl.b = 1 - o.ecc;
      }
    }
  };

  const nodes = useMemo(() => {
    const counts = {} as Record<Category, number>;
    const seen = {} as Record<Category, number>;
    CATEGORY_ORDER.forEach((c) => { counts[c] = 0; seen[c] = 0; });
    SKILLS.forEach((s) => { counts[s.category]++; });
    const catOff: Record<Category, number> = { lang: 0.3, frontend: 1.1, backend: 2.0, database: 0.7, tools: 2.6 };
    return SKILLS.map((s, i) => {
      const k = seen[s.category]++;
      const phase = (k / counts[s.category]) * Math.PI * 2 + catOff[s.category];
      return { cat: s.category, phase, r: ORBITS[s.category].radius * radius, color: new THREE.Color(colorOfSkill(s)), p2: i * 2.7, p3: i * 1.9 };
    });
  }, [radius]);

  const orbitPos = (cat: Category, a: number, out: THREE.Vector3) => {
    const b = basis.current; const pl = b.planes[cat];
    return out.copy(b.hub)
      .addScaledVector(pl.u, Math.cos(a) * pl.R * b.hTight)
      .addScaledVector(pl.v, Math.sin(a) * pl.R * pl.b);
  };

  // Dust + clean line geometry per orbit — empty buffers with a STABLE jitter
  // table, rebuilt each frame against the live basis (so the rings track the
  // camera aim and the portrait re-layout without the dust shimmering).
  const rings = useMemo(() => CATEGORY_ORDER.map((c) => {
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_PTS * 3), 3));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_PTS * 3), 3));
    let seed = 4013 + c.length * 131;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const jit = new Float32Array(RING_PTS);
    for (let i = 0; i < RING_PTS; i++) jit[i] = 1 + (rng() - 0.5) * 0.06;
    return { dg, lg, jit };
  }), []);

  const connGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CONN * SEG * 2 * 3), 3));
    return g;
  }, []);
  const connMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const sigGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SIG * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_SIG * 3), 3));
    return g;
  }, []);
  const sigMat = useMemo(
    () => new THREE.PointsMaterial({ size: radius * 0.045, vertexColors: true, map: glowTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [radius, glowTex],
  );
  const swirlGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SWIRL * 3), 3));
    return g;
  }, []);
  const signals = useMemo(() => Array.from({ length: N_SIG }, (_, i) => ({ path: i % Math.max(1, PULSE_PATHS.length), prog: i * 0.6, speed: 0.32 + (i % 3) * 0.06 })), []);

  const spin = useRef<Record<Category, number>>({ lang: 0, frontend: 0, backend: 0, database: 0, tools: 0 });
  const appear = useRef(0);
  const hoverMix = useRef(0);
  const connGrow = useRef(0);
  const catMix = useRef<Record<Category, number>>({ lang: 0, frontend: 0, backend: 0, database: 0, tools: 0 });
  const npos = useRef<THREE.Vector3[]>(SKILLS.map(() => new THREE.Vector3()));
  const nvis = useRef<number[]>(SKILLS.map(() => 1));
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _a = useMemo(() => new THREE.Vector3(), []);
  const _b = useMemo(() => new THREE.Vector3(), []);
  const _m = useMemo(() => new THREE.Vector3(), []);
  const _c = useMemo(() => new THREE.Color(), []);
  const _rv = useMemo(() => new THREE.Vector3(), []);

  // The constellation now sits beside and IN FRONT of Venus, so nothing is ever
  // occluded — every node is fully lit and hoverable. (Kept as a hook so the
  // node/signal code reads a single clarity factor.)
  const atmo = (_p: THREE.Vector3) => 1;

  useFrame((state, delta) => {
    const f = venusFocus();
    venusBridge.focus = f;
    const visible = f > 0.02;
    for (const s of glowSp.current) if (s) s.visible = visible;
    for (const m of coreMesh.current) if (m) m.visible = visible;
    for (const r of dustRef.current) if (r) r.visible = visible;
    for (const r of lineRef.current) if (r) r.visible = visible;
    if (connRef.current) connRef.current.visible = visible;
    if (sigRef.current) sigRef.current.visible = visible;
    if (swirlRef.current) swirlRef.current.visible = visible;
    if (!visible) {
      for (const h of hits.current) if (h) h.visible = false;
      venusBridge.active = false; venusBridge.env = 0; venusBridge.catLabel = '';
      appear.current = 0; connGrow.current = 0;
      return;
    }

    updateBasis(); // face the live camera (desktop rail pose or portrait re-aim)

    const t = state.clock.elapsedTime;
    appear.current = Math.min(1, appear.current + delta * 0.8);
    const app = THREE.MathUtils.smoothstep(appear.current, 0, 1);
    for (const c of CATEGORY_ORDER) spin.current[c] += delta * ORBITS[c].speed * ORBITS[c].dir;

    // Rebuild the faint dust + line rings against the live basis (tracks the aim
    // and the portrait re-layout). Line is clean; dust uses the stable jitter.
    {
      const b = basis.current;
      CATEGORY_ORDER.forEach((c, ci) => {
        const pl = b.planes[c];
        const { dg, lg, jit } = rings[ci];
        const la = lg.attributes.position.array as Float32Array;
        const da = dg.attributes.position.array as Float32Array;
        for (let i = 0; i < RING_PTS; i++) {
          const a = (i / RING_PTS) * Math.PI * 2;
          const cx = Math.cos(a) * pl.R * b.hTight;
          const sy = Math.sin(a) * pl.R * pl.b;
          _rv.copy(b.hub).addScaledVector(pl.u, cx).addScaledVector(pl.v, sy);
          la[i * 3] = _rv.x; la[i * 3 + 1] = _rv.y; la[i * 3 + 2] = _rv.z;
          const jf = jit[i];
          _rv.copy(b.hub).addScaledVector(pl.u, cx * jf).addScaledVector(pl.v, sy * jf);
          da[i * 3] = _rv.x; da[i * 3 + 1] = _rv.y; da[i * 3 + 2] = _rv.z;
        }
        lg.attributes.position.needsUpdate = true;
        dg.attributes.position.needsUpdate = true;
      });
    }

    const hovered = useVenusUI.getState().hovered;
    const hoverActive = hovered != null;
    hoverMix.current += ((hoverActive ? 1 : 0) - hoverMix.current) * Math.min(1, delta * 8);
    connGrow.current += ((hoverActive ? 1 : 0) - connGrow.current) * Math.min(1, delta * 6);
    const hm = hoverMix.current;
    const focusSet = new Set<number>(hoverActive ? [hovered!, ...(RELATED[hovered!] ?? [])] : []);
    const activeCat: Category | null = hoverActive ? SKILLS[hovered!].category : null;
    for (const c of CATEGORY_ORDER) catMix.current[c] += ((activeCat === c ? 1 : 0) - catMix.current[c]) * Math.min(1, delta * 6);
    const ptr = state.pointer;

    // 1) nodes: orbit + cursor gravity + hierarchy + atmosphere
    for (let i = 0; i < SKILLS.length; i++) {
      const nd = nodes[i];
      const o = ORBITS[nd.cat];
      const p = npos.current[i];
      orbitPos(nd.cat, nd.phase + spin.current[nd.cat], p);
      const av = atmo(p);
      nvis.current[i] = av;

      _ndc.copy(p).project(camera);
      if (av > 0.2 && _ndc.z < 1) {
        const dx = ptr.x - _ndc.x, dy = ptr.y - _ndc.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.16) {
          const pull = (1 - d / 0.16) * 0.09 * radius;
          p.addScaledVector(basis.current.right, dx * pull).addScaledVector(basis.current.up, dy * pull);
        }
      }

      const breathe = 0.5 + 0.5 * Math.sin(t * 0.8 + nd.phase);
      const glowPulse = Math.pow(0.5 + 0.5 * Math.sin(t * 0.42 + nd.p2), 4); // spiky: ~20% bright
      const twinkle = Math.pow(0.5 + 0.5 * Math.sin(t * 3.1 + nd.p3), 12);
      const isHover = i === hovered;
      const inFocus = focusSet.has(i);
      const grow = isHover ? 1.16 : inFocus ? 1.06 : 1;
      let op = 0.2 + 0.09 * breathe + 0.46 * glowPulse + 0.22 * twinkle;
      if (hoverActive) op = inFocus ? op : op * 0.22;
      if (isHover) op = Math.max(op, 0.98);
      else if (inFocus) op = Math.max(op, 0.7);
      op *= av * app;

      const sp = glowSp.current[i];
      const gm = glowMat.current[i];
      const gsc = radius * o.glow * grow * (0.9 + 0.14 * breathe);
      if (sp) { sp.position.copy(p); sp.scale.setScalar(gsc); }
      if (gm) { gm.color.copy(nd.color).lerp(WHITE, isHover ? 0.4 : 0); gm.opacity = op; }
      const cm = coreMesh.current[i];
      const cmat = coreMat.current[i];
      if (cm) { cm.position.copy(p); cm.scale.setScalar(radius * o.core * grow * (0.92 + 0.12 * breathe)); cm.visible = visible && o.core > 0 && av > 0.05; }
      if (cmat) cmat.opacity = Math.min(1, op * 1.4);

      const hit = hits.current[i];
      if (hit) { hit.position.copy(p); hit.visible = visible && av > 0.35 && app > 0.6; }
    }

    // 2) connection curves (hover only, grow outward)
    const cp = connGeo.attributes.position.array as Float32Array;
    let seg = 0;
    if (hoverActive && connGrow.current > 0.02) {
      const rel = (RELATED[hovered!] ?? []).slice(0, MAX_CONN);
      _a.copy(npos.current[hovered!]);
      const gT = THREE.MathUtils.smoothstep(connGrow.current, 0, 1);
      for (const r of rel) {
        _b.copy(npos.current[r]);
        _m.copy(_a).add(_b).multiplyScalar(0.5).addScaledVector(basis.current.toCam, _a.distanceTo(_b) * 0.18);
        for (let s = 0; s < SEG; s++) {
          bez(_a, _m, _b, (s / SEG) * gT, _p); cp[seg * 6] = _p.x; cp[seg * 6 + 1] = _p.y; cp[seg * 6 + 2] = _p.z;
          bez(_a, _m, _b, ((s + 1) / SEG) * gT, _p); cp[seg * 6 + 3] = _p.x; cp[seg * 6 + 4] = _p.y; cp[seg * 6 + 5] = _p.z;
          seg++;
        }
      }
    }
    connGeo.attributes.position.needsUpdate = true;
    connGeo.setDrawRange(0, seg * 2);
    connMat.opacity = 0.55 * connGrow.current * (0.7 + 0.3 * Math.sin(t * 4));

    // 3) orbit paths: dust always faint; the clean ring sweeps in on hover
    CATEGORY_ORDER.forEach((c, ci) => {
      const dm = dustMat.current[ci]; const lm = lineMat.current[ci];
      const mix = catMix.current[c];
      if (dm) dm.opacity = (0.11 + 0.12 * mix) * app * (hoverActive && activeCat !== c ? 0.5 : 1);
      if (lm) lm.opacity = 0.55 * mix * app;
    });

    // 4) signals drift the real stacks (ambient, alive without hover)
    const sp2 = sigGeo.attributes.position.array as Float32Array;
    const sc2 = sigGeo.attributes.color.array as Float32Array;
    for (let k = 0; k < N_SIG; k++) {
      const sg = signals[k]; const path = PULSE_PATHS[sg.path] ?? [];
      if (path.length < 2) { sc2[k * 3] = sc2[k * 3 + 1] = sc2[k * 3 + 2] = 0; continue; }
      sg.prog += delta * sg.speed; const L = path.length - 1;
      const fp = sg.prog % L; const seg2 = Math.floor(fp); const lt = fp - seg2;
      _a.copy(npos.current[path[seg2]]); _b.copy(npos.current[path[seg2 + 1]]);
      _p.copy(_a).lerp(_b, lt);
      sp2[k * 3] = _p.x; sp2[k * 3 + 1] = _p.y; sp2[k * 3 + 2] = _p.z;
      const gl = atmo(_p) * (0.5 + 0.5 * Math.sin(lt * Math.PI)) * app;
      sc2[k * 3] = CYAN.r * gl; sc2[k * 3 + 1] = CYAN.g * gl; sc2[k * 3 + 2] = CYAN.b * gl;
    }
    sigGeo.attributes.position.needsUpdate = true;
    sigGeo.attributes.color.needsUpdate = true;

    // 5) swirl particles around the hovered node
    const sw = swirlGeo.attributes.position.array as Float32Array;
    if (hoverActive && hm > 0.02) {
      _a.copy(npos.current[hovered!]);
      const rr = radius * ORBITS[SKILLS[hovered!].category].glow * 1.3;
      for (let k = 0; k < N_SWIRL; k++) {
        const a = (k / N_SWIRL) * Math.PI * 2 + t * 1.6;
        _p.copy(_a).addScaledVector(basis.current.right, Math.cos(a) * rr).addScaledVector(basis.current.up, Math.sin(a) * rr * 0.8);
        sw[k * 3] = _p.x; sw[k * 3 + 1] = _p.y; sw[k * 3 + 2] = _p.z;
      }
    } else {
      for (let k = 0; k < N_SWIRL * 3; k++) sw[k] = 0;
    }
    swirlGeo.attributes.position.needsUpdate = true;
    if (swirlMat.current) {
      swirlMat.current.opacity = hm * 0.8;
      if (hoverActive) swirlMat.current.color.copy(_c.set(colorOfSkill(SKILLS[hovered!])));
    }

    // 6) hover card + orbit label
    if (hoverActive && nvis.current[hovered!] > 0.2) {
      _ndc.copy(npos.current[hovered!]).project(camera);
      venusBridge.index = hovered!;
      venusBridge.color = colorOfSkill(SKILLS[hovered!]);
      venusBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
      venusBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
      venusBridge.env = hm;
      venusBridge.active = _ndc.z < 1;
      // orbit label at the orbit's left extreme
      const o = ORBITS[activeCat!];
      orbitPos(activeCat!, Math.PI, _p);
      _ndc.copy(_p).project(camera);
      venusBridge.catLabel = o.label;
      venusBridge.catColor = o.color;
      venusBridge.catPx = (_ndc.x * 0.5 + 0.5) * size.width;
      venusBridge.catPy = (-_ndc.y * 0.5 + 0.5) * size.height;
    } else {
      venusBridge.env = hm;
      venusBridge.active = hoverActive;
      if (!hoverActive) venusBridge.catLabel = '';
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
      {/* orbit dust (faint always) + clean radar ring (on hover) */}
      {CATEGORY_ORDER.map((c, ci) => (
        <group key={c}>
          <points ref={(el) => { dustRef.current[ci] = el; }} geometry={rings[ci].dg} visible={false} frustumCulled={false}>
            <pointsMaterial
              ref={(m) => { dustMat.current[ci] = m; if (m) m.color.set(ORBITS[c].color); }}
              size={radius * 0.011}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              sizeAttenuation
            />
          </points>
          <lineLoop ref={(el) => { lineRef.current[ci] = el; }} geometry={rings[ci].lg} visible={false} frustumCulled={false}>
            <lineBasicMaterial
              ref={(m) => { lineMat.current[ci] = m; if (m) m.color.set(ORBITS[c].color); }}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineLoop>
        </group>
      ))}

      {/* connection curves, stack signals, hover swirl */}
      <lineSegments ref={(el) => { connRef.current = el; }} geometry={connGeo} material={connMat} visible={false} frustumCulled={false} />
      <points ref={(el) => { sigRef.current = el; }} geometry={sigGeo} material={sigMat} visible={false} frustumCulled={false} />
      <points ref={(el) => { swirlRef.current = el; }} geometry={swirlGeo} visible={false} frustumCulled={false}>
        <pointsMaterial ref={(m) => { swirlMat.current = m; }} size={radius * 0.03} map={glowTex} color={CYAN} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* skill bodies: glow sprite + solid core (shape by category) + hit target */}
      {SKILLS.map((s, i) => {
        const o = ORBITS[s.category];
        const coreColor = new THREE.Color(o.color).lerp(new THREE.Color('#ffffff'), s.category === 'lang' ? 0.65 : s.category === 'tools' ? 0.1 : 0.25);
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
                {o.shape === 'crystal' ? (
                  <octahedronGeometry args={[radius * o.core, 0]} />
                ) : o.shape === 'satellite' ? (
                  <boxGeometry args={[radius * o.core * 2.2, radius * o.core * 0.7, radius * o.core * 0.7]} />
                ) : (
                  <sphereGeometry args={[radius * o.core, 16, 16]} />
                )}
                <meshBasicMaterial
                  ref={(m) => { coreMat.current[i] = m; if (m) m.color.copy(coreColor); }}
                  transparent
                  opacity={1}
                  toneMapped={false}
                  depthWrite={o.shape !== 'crystal'}
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
