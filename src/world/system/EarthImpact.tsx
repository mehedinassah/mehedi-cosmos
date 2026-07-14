'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';
import { IMPACT_DETAILS, earthHover, earthFocus } from '@/state/earthHoverStore';

/**
 * EarthImpact — the Earth chapter stops being a resume. The planet carries its
 * real-world impact physically: four labeled satellites orbit it (one per
 * achievement), aurora breathes at the poles, lightning flickers on the night
 * side, and a little debris drifts by. Everything is gated to the Earth stop
 * (earthFocus) so it fades in when you arrive and never clutters a fly-past.
 *
 * Phase 1 of the "living Earth" build: the static parts. Hover holograms,
 * drag-to-spin, city beams and the timeline come later.
 */

const ACCENT = '#26daaa';

// A crisp label rendered to a canvas: bright accent number with a soft glow,
// a small letter-spaced caption under it, and a dark halo so it stays legible
// over both deep space and the bright day side of Earth.
function makeLabelTexture(big: string, small: string): THREE.CanvasTexture {
  const w = 320, h = 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // dark contrast halo (drawn first, blurred, dark)
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.font = '600 62px Inter, system-ui, sans-serif';
  ctx.fillText(big, w / 2, h / 2 - 18);

  // the accent number with its own glow
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 22;
  ctx.fillStyle = ACCENT;
  ctx.fillText(big, w / 2, h / 2 - 18);

  // caption
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 8;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '5px';
  ctx.fillStyle = 'rgba(226,240,248,0.92)';
  ctx.font = '500 24px Inter, system-ui, sans-serif';
  ctx.fillText(small, w / 2 + 3, h / 2 + 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* -------------------- labeled impact satellites -------------------- */
// Recruiter mode: the satellites don't all show at once. They reveal one by
// one the longer you linger at Earth, so curiosity is rewarded.
const REVEAL_TIMES = [0.4, 3.5, 7.5, 12];

function ImpactSatellites({ radius }: { radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const groupRef = useRef<THREE.Group>(null);
  const satRefs = useRef<(THREE.Group | null)[]>([]);
  const focus = useRef(0);
  const dwell = useRef(0);
  const reveal = useRef<number[]>(IMPACT_DETAILS.map(() => 0));
  const hoverAmt = useRef<number[]>(IMPACT_DETAILS.map(() => 0));
  const hovered = useRef(-1);

  const dotTex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(190,255,232,1)'],
      [0.4, 'rgba(60,220,170,0.6)'],
      [1, 'rgba(38,218,170,0)'],
    ]),
    [],
  );
  const labels = useMemo(() => IMPACT_DETAILS.map((s) => makeLabelTexture(s.big, s.small)), []);
  const dotMats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const labelMats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const _wp = useMemo(() => new THREE.Vector3(), []);

  const orbitR = radius * 1.95;
  const sats = useMemo(
    () =>
      IMPACT_DETAILS.map((_, i) => {
        const a = (i / IMPACT_DETAILS.length) * Math.PI * 2;
        const incl = (i % 2 === 0 ? 1 : -1) * radius * 0.5;
        return new THREE.Vector3(Math.cos(a) * orbitR, incl, Math.sin(a) * orbitR);
      }),
    [orbitR, radius],
  );

  useFrame((state, delta) => {
    const f0 = earthFocus();
    focus.current = THREE.MathUtils.damp(focus.current, f0, 3, delta);
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.05;
    // recruiter dwell timer — accrues while parked, resets on leaving
    if (f0 > 0.6) dwell.current += delta;
    else if (f0 < 0.2) dwell.current = 0;

    const f = focus.current;
    const tw = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 1.6);
    for (let i = 0; i < IMPACT_DETAILS.length; i++) {
      const rTarget = dwell.current > REVEAL_TIMES[i] ? 1 : 0;
      reveal.current[i] = THREE.MathUtils.damp(reveal.current[i], rTarget, 3, delta);
      const hv = hovered.current === i ? 1 : 0;
      hoverAmt.current[i] = THREE.MathUtils.damp(hoverAmt.current[i], hv, 9, delta);
      const shown = f * reveal.current[i];
      const g = satRefs.current[i];
      if (g) g.scale.setScalar(1 + hoverAmt.current[i] * 0.55);
      const dm = dotMats.current[i];
      if (dm) dm.opacity = shown * tw * (1 + hoverAmt.current[i] * 0.5);
      const lm = labelMats.current[i];
      if (lm) lm.opacity = shown;
    }

    // Project the hovered satellite to screen for the DOM hologram overlay.
    const h = hovered.current;
    if (h >= 0 && reveal.current[h] > 0.4) {
      const g = satRefs.current[h];
      if (g) {
        g.getWorldPosition(_wp);
        _wp.project(camera);
        earthHover.index = h;
        earthHover.x = (_wp.x * 0.5 + 0.5) * size.width;
        earthHover.y = (-_wp.y * 0.5 + 0.5) * size.height;
      }
    } else if (earthHover.index !== -1 && h < 0) {
      earthHover.index = -1;
    }
  });

  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (reveal.current[i] < 0.5) return; // only revealed satellites are hoverable
    e.stopPropagation();
    hovered.current = i;
    document.body.style.cursor = 'pointer';
  };
  const onOut = (i: number) => () => {
    if (hovered.current === i) {
      hovered.current = -1;
      earthHover.index = -1;
      document.body.style.cursor = '';
    }
  };

  return (
    <group ref={groupRef}>
      {sats.map((p, i) => (
        <group key={i} position={p} ref={(g) => { satRefs.current[i] = g; }}>
          {/* invisible, larger hit target so the tiny satellite is easy to hover */}
          <mesh onPointerOver={onOver(i)} onPointerOut={onOut(i)}>
            <sphereGeometry args={[radius * 0.7, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <sprite scale={[radius * 0.18, radius * 0.18, 1]}>
            <spriteMaterial
              ref={(m) => { dotMats.current[i] = m; }}
              map={dotTex}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <sprite position={[0, radius * 0.32, 0]} scale={[radius * 0.82, radius * 0.41, 1]}>
            <spriteMaterial
              ref={(m) => { labelMats.current[i] = m; }}
              map={labels[i]}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/* -------------------- aurora at the poles -------------------- */
function Aurora({ radius }: { radius: number }) {
  const geo = useMemo(() => {
    const g = new THREE.TorusGeometry(radius * 0.42, radius * 0.04, 12, 64);
    g.rotateX(Math.PI / 2);
    return g;
  }, [radius]);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#3affd0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  useFrame((state, delta) => {
    const f = earthFocus();
    const breath = 0.1 + 0.06 * Math.sin(state.clock.elapsedTime * 0.7);
    mat.opacity = THREE.MathUtils.damp(mat.opacity, f * breath, 3, delta);
  });
  return (
    <>
      <mesh geometry={geo} material={mat} position={[0, radius * 0.9, 0]} />
      <mesh geometry={geo} material={mat} position={[0, -radius * 0.9, 0]} />
    </>
  );
}

/* -------------------- night-side lightning -------------------- */
const FLASHES = 4;
function Lightning({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const tex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(230,244,255,1)'],
      [0.4, 'rgba(150,200,255,0.5)'],
      [1, 'rgba(120,180,255,0)'],
    ]),
    [],
  );
  const mats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  // Night side faces away from the Sun (origin): outward normal ~ +center dir.
  const nightDir = useMemo(() => center.clone().normalize(), [center]);
  const spots = useMemo(() => {
    const rng = mulberry(9137);
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < FLASHES; i++) {
      const n = new THREE.Vector3();
      for (let t = 0; t < 20; t++) {
        n.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
        if (n.dot(nightDir) > 0.35) break;
      }
      out.push(n.multiplyScalar(radius * 1.01));
    }
    return out;
  }, [nightDir, radius]);
  const st = useRef(spots.map((_, i) => ({ t: -1, next: 2 + i * 1.7 + Math.random() * 4 })));

  useFrame((_, delta) => {
    const f = earthFocus();
    for (let i = 0; i < FLASHES; i++) {
      const s = st.current[i];
      const m = mats.current[i];
      if (s.t < 0) {
        s.next -= delta;
        if (s.next <= 0 && f > 0.4) s.t = 0;
        if (m) m.opacity = 0;
      } else {
        s.t += delta;
        // quick spike then decay over ~180ms
        const a = s.t < 0.04 ? s.t / 0.04 : Math.max(0, 1 - (s.t - 0.04) / 0.16);
        if (m) m.opacity = a * 0.9 * f;
        if (s.t > 0.2) { s.t = -1; s.next = 3 + Math.random() * 7; }
      }
    }
  });

  return (
    <>
      {spots.map((p, i) => (
        <sprite key={i} position={p} scale={[radius * 0.5, radius * 0.5, 1]}>
          <spriteMaterial
            ref={(m) => { mats.current[i] = m; }}
            map={tex}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

/* -------------------- faint drifting debris + ISS -------------------- */
function SpaceDebris({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const iss = useRef<THREE.Group>(null);
  const bits = useMemo(() => {
    const rng = mulberry(5521);
    return Array.from({ length: 4 }, () => {
      const a = rng() * Math.PI * 2;
      const r = radius * (1.4 + rng() * 1.5);
      return new THREE.Vector3(Math.cos(a) * r, (rng() - 0.5) * radius * 0.9, Math.sin(a) * r);
    });
  }, [radius]);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.09;
    if (iss.current) iss.current.rotation.y += delta * 0.16;
  });
  return (
    <>
      <group ref={groupRef}>
        {bits.map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[radius * 0.018, radius * 0.018, radius * 0.018]} />
            <meshBasicMaterial color="#59636f" transparent opacity={0.28} />
          </mesh>
        ))}
      </group>
      {/* ISS-ish silhouette: a small, dim elongated body with two panels —
          almost invisible, just enough motion to notice out of the corner. */}
      <group ref={iss}>
        <group position={[radius * 2.3, radius * 0.35, 0]}>
          <mesh>
            <boxGeometry args={[radius * 0.09, radius * 0.022, radius * 0.022]} />
            <meshBasicMaterial color="#7c8794" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0, radius * 0.07]}>
            <boxGeometry args={[radius * 0.028, radius * 0.004, radius * 0.08]} />
            <meshBasicMaterial color="#38455e" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0, -radius * 0.07]}>
            <boxGeometry args={[radius * 0.028, radius * 0.004, radius * 0.08]} />
            <meshBasicMaterial color="#38455e" transparent opacity={0.6} />
          </mesh>
        </group>
      </group>
    </>
  );
}

/* -------------------- city -> beam -> card -------------------- */
// Every few seconds a city on the night side flares, fires a thin blue beam
// into space, and a small card surfaces. Cinematic, occasional, never spammy.
const BEAM_MSGS = [
  { city: 'DHAKA', line: '90,000+ community' },
  { city: 'DHAKA', line: '500+ at one event' },
  { city: 'DHAKA', line: 'BRAC University' },
];

const BEAM_VERT = /* glsl */ `
varying float vY;
void main() {
  vY = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vY;
void main() {
  float a = 1.0 - vY;   // bright at the base, fades to nothing up top
  a *= a;
  gl_FragColor = vec4(uColor, a * uOpacity);
}`;

function makeBeamLabel(city: string, line: string): THREE.CanvasTexture {
  const w = 340, h = 150;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '6px';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.font = '600 42px Inter, system-ui, sans-serif';
  ctx.fillText(city, w / 2 + 3, h / 2 - 20);
  ctx.shadowColor = '#7bbcff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#8fc6ff';
  ctx.fillText(city, w / 2 + 3, h / 2 - 20);
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 7;
  ctx.fillStyle = 'rgba(222,236,250,0.9)';
  ctx.font = '400 23px Inter, system-ui, sans-serif';
  ctx.fillText(line, w / 2, h / 2 + 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const _UP = new THREE.Vector3(0, 1, 0);

function CityBeams({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const groupRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Sprite>(null);
  const flareMat = useRef<THREE.SpriteMaterial>(null);
  const labelMat = useRef<THREE.SpriteMaterial>(null);

  const flareTex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(222,240,255,1)'],
      [0.4, 'rgba(140,190,255,0.55)'],
      [1, 'rgba(120,170,255,0)'],
    ]),
    [],
  );
  const labelTexs = useMemo(() => BEAM_MSGS.map((m) => makeBeamLabel(m.city, m.line)), []);
  const beamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius * 0.015, radius * 0.05, 1, 12, 1, true);
    g.translate(0, 0.5, 0); // base at the origin, extends +Y
    return g;
  }, [radius]);
  const beamMat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uColor: { value: new THREE.Color('#7fbcff') }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    [],
  );

  const ev = useRef({ t: -1, next: 4, msg: -1 });
  const _cam = useMemo(() => new THREE.Vector3(), []);
  const _n = useMemo(() => new THREE.Vector3(), []);
  const _camDir = useMemo(() => new THREE.Vector3(), []);
  const _nightDir = useMemo(() => new THREE.Vector3(), []);
  const _q = useMemo(() => new THREE.Quaternion(), []);
  const beamH = radius * 2.1;

  useFrame((_, delta) => {
    const f = earthFocus();
    const e = ev.current;
    if (e.t < 0) {
      if (flareMat.current) flareMat.current.opacity = 0;
      if (labelMat.current) labelMat.current.opacity = 0;
      beamMat.uniforms.uOpacity.value = 0;
      e.next -= delta;
      if (e.next <= 0 && f > 0.5) {
        camera.getWorldPosition(_cam);
        _camDir.copy(_cam).sub(center).normalize();
        _nightDir.copy(center).normalize(); // night faces away from the Sun (origin)
        let ok = false;
        for (let i = 0; i < 40; i++) {
          _n.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
          if (_n.lengthSq() < 1e-4) continue;
          _n.normalize();
          // Fire from the night LIMB (camDir near 0): there the beam extends
          // sideways across space and reads clearly, instead of foreshortening
          // toward the camera on the near face.
          const cd = _n.dot(_camDir);
          if (_n.dot(_nightDir) > 0.15 && cd > -0.4 && cd < 0.12) { ok = true; break; }
        }
        if (!ok) {
          e.next = 1.5;
        } else {
          e.msg = (e.msg + 1) % BEAM_MSGS.length;
          e.t = 0;
          if (labelMat.current) {
            labelMat.current.map = labelTexs[e.msg];
            labelMat.current.needsUpdate = true;
          }
          if (groupRef.current) {
            groupRef.current.position.copy(center).addScaledVector(_n, radius * 1.004);
            _q.setFromUnitVectors(_UP, _n);
            groupRef.current.quaternion.copy(_q);
          }
        }
      }
    } else {
      e.t += delta;
      const life = 3.4;
      const rise = THREE.MathUtils.smoothstep(e.t, 0.12, 0.5);
      const out = 1 - THREE.MathUtils.smoothstep(e.t, 2.1, life);
      if (flareMat.current) flareMat.current.opacity = Math.min(e.t / 0.22, 1) * out * 0.95 * f;
      beamMat.uniforms.uOpacity.value = rise * out * 0.8 * f;
      if (beamRef.current) beamRef.current.scale.set(1, beamH * rise, 1);
      if (labelRef.current) labelRef.current.position.set(0, beamH * rise + radius * 0.5, 0);
      if (labelMat.current) labelMat.current.opacity = THREE.MathUtils.smoothstep(e.t, 0.45, 0.9) * out * f;
      if (e.t >= life) { e.t = -1; e.next = 6 + Math.random() * 7; }
    }
  });

  return (
    <group ref={groupRef}>
      <sprite scale={[radius * 0.42, radius * 0.42, 1]}>
        <spriteMaterial ref={flareMat} map={flareTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh ref={beamRef} geometry={beamGeo}>
        <primitive object={beamMat} attach="material" />
      </mesh>
      <sprite ref={labelRef} scale={[radius * 1.0, radius * 0.44, 1]}>
        <spriteMaterial ref={labelMat} transparent opacity={0} depthWrite={false} />
      </sprite>
    </group>
  );
}

/* -------------------- timeline orbit under Earth -------------------- */
const TIMELINE_YEARS = ['2020', '2022', '2024', '2026'];

function makeYearLabel(year: string): THREE.CanvasTexture {
  const w = 160, h = 80;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.font = '500 38px Inter, system-ui, sans-serif';
  ctx.fillText(year, w / 2 + 2, h / 2);
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#8ff0d4';
  ctx.fillText(year, w / 2 + 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function ImpactTimeline({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const focus = useRef(0);
  const dotMats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const labelMats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const dotTex = useMemo(
    () => makeGlowTexture([
      [0, 'rgba(180,255,228,1)'],
      [0.5, 'rgba(50,210,165,0.5)'],
      [1, 'rgba(38,218,170,0)'],
    ]),
    [],
  );
  const yearTexs = useMemo(() => TIMELINE_YEARS.map(makeYearLabel), []);

  // A tilted orbital ring AROUND Earth (there is no room "under" it in frame):
  // a faint circle with the four years marked on it, drifting as Earth turns.
  const R = radius * 1.55;
  const pts = useMemo(
    () =>
      TIMELINE_YEARS.map((_, i) => {
        const a = (i / TIMELINE_YEARS.length) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      }),
    [R],
  );
  const lineObj = useMemo(() => {
    const segs = 96;
    const arr = new Float32Array((segs + 1) * 3);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * R;
      arr[i * 3 + 2] = Math.sin(a) * R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Line(g, lineMat);
  }, [R, lineMat]);

  useFrame((_, delta) => {
    focus.current = THREE.MathUtils.damp(focus.current, earthFocus(), 3, delta);
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.03; // drifts as Earth turns
    const f = focus.current;
    lineMat.opacity = f * 0.26;
    for (let i = 0; i < TIMELINE_YEARS.length; i++) {
      const dm = dotMats.current[i];
      if (dm) dm.opacity = f * 0.55;
      const lm = labelMats.current[i];
      if (lm) lm.opacity = f * 0.7;
    }
  });

  return (
    <group ref={groupRef} rotation={[0.52, 0, 0]}>
      <primitive object={lineObj} />
      {pts.map((p, i) => (
        <group key={i} position={p}>
          <sprite scale={[radius * 0.1, radius * 0.1, 1]}>
            <spriteMaterial ref={(m) => { dotMats.current[i] = m; }} map={dotTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite position={[0, radius * 0.24, 0]} scale={[radius * 0.34, radius * 0.17, 1]}>
            <spriteMaterial ref={(m) => { labelMats.current[i] = m; }} map={yearTexs[i]} transparent opacity={0} depthWrite={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function EarthImpact({ center, radius }: { center: THREE.Vector3; radius: number }) {
  return (
    <group position={center}>
      <Aurora radius={radius} />
      <Lightning center={center} radius={radius} />
      <SpaceDebris radius={radius} />
      <CityBeams center={center} radius={radius} />
      <ImpactTimeline radius={radius} />
      <ImpactSatellites radius={radius} />
    </group>
  );
}
