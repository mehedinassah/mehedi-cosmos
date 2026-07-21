'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  INTERESTS, uranusBridge, uranusFocus, useUranusUI, type IconKind,
} from '@/state/uranusStore';
import { makeGlowTexture } from '@/world/galaxy/HeroGalaxy';

/**
 * UranusConstellation — "Beyond Code", the calm human chapter.
 *
 * Six interests drift as small line-icon satellites on a single camera-facing
 * ring around the ice giant, wrapped in a soft aurora, a faint atmospheric rim,
 * and slow floating ice motes. Nothing flashy: everything is low-opacity and
 * slow. Hovering a satellite lifts it, brightens it (reels/compasses give a
 * gentle spin), and fades in a small glass card — the same details already on
 * the chapter panel, so the recruiter never has to hunt.
 *
 * Gated entirely by uranusFocus(): invisible and inert everywhere but the
 * Uranus stop, fading in and out with the chapter exactly like the panel.
 */

const N = INTERESTS.length;
const N_SWIRL = 12;
const N_ICE = 46;
const WHITE = new THREE.Color('#ffffff');
// Touch devices have no hover — nodes are tapped instead (see onTap).
const IS_TOUCH =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

/* ---- line-icon glyphs, drawn once onto small transparent canvases ---- */
function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind) {
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const circle = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  switch (kind) {
    case 'ball': {
      circle(64, 64, 40);
      // central pentagon + short seams
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        const x = 64 + Math.cos(a) * 15;
        const y = 64 + Math.sin(a) * 15;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 15, 64 + Math.sin(a) * 15);
        ctx.lineTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
        ctx.stroke();
      }
      break;
    }
    case 'film': {
      circle(64, 64, 40);
      circle(64, 64, 9);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        circle(64 + Math.cos(a) * 25, 64 + Math.sin(a) * 25, 8);
      }
      break;
    }
    case 'compass': {
      circle(64, 64, 40);
      ctx.beginPath();
      ctx.moveTo(64, 28);
      ctx.lineTo(74, 64);
      ctx.lineTo(64, 100);
      ctx.lineTo(54, 64);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 64, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'controller': {
      // body
      const x = 22, y = 46, w = 84, h = 40, r = 18;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.stroke();
      // d-pad
      ctx.beginPath();
      ctx.moveTo(38, 66); ctx.lineTo(54, 66);
      ctx.moveTo(46, 58); ctx.lineTo(46, 74);
      ctx.stroke();
      // buttons
      ctx.beginPath(); ctx.arc(82, 60, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(94, 72, 4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'note': {
      circle(50, 92, 11);
      ctx.beginPath();
      ctx.moveTo(61, 92);
      ctx.lineTo(61, 38);
      ctx.lineTo(82, 50);
      ctx.stroke();
      break;
    }
    case 'cup': {
      ctx.beginPath();
      ctx.moveTo(38, 56);
      ctx.lineTo(86, 56);
      ctx.lineTo(78, 96);
      ctx.quadraticCurveTo(62, 106, 46, 96);
      ctx.closePath();
      ctx.stroke();
      // handle
      ctx.beginPath();
      ctx.moveTo(86, 62);
      ctx.quadraticCurveTo(104, 70, 84, 86);
      ctx.stroke();
      // steam
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(54, 44); ctx.quadraticCurveTo(60, 38, 54, 30);
      ctx.moveTo(70, 44); ctx.quadraticCurveTo(76, 38, 70, 30);
      ctx.stroke();
      break;
    }
  }
}

function makeIconTexture(kind: IconKind): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  drawIcon(ctx, kind);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function UranusConstellation({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const glowSp = useRef<(THREE.Sprite | null)[]>([]);
  const glowMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const iconSp = useRef<(THREE.Sprite | null)[]>([]);
  const iconMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const auroraSp = useRef<(THREE.Sprite | null)[]>([]);
  const auroraMat = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const rimSp = useRef<THREE.Sprite | null>(null);
  const rimMat = useRef<THREE.SpriteMaterial | null>(null);
  const iceRef = useRef<THREE.Points | null>(null);
  const iceMat = useRef<THREE.PointsMaterial | null>(null);
  const swirlRef = useRef<THREE.Points | null>(null);
  const swirlMat = useRef<THREE.PointsMaterial | null>(null);
  const ringRef = useRef<THREE.Object3D | null>(null);
  const ringMat = useRef<THREE.LineBasicMaterial | null>(null);

  const glowTex = useMemo(
    () => makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(220,232,240,0.5)'], [1, 'rgba(200,220,235,0)']]),
    [],
  );
  const iconTex = useMemo(() => INTERESTS.map((it) => makeIconTexture(it.kind)), []);

  // Camera-facing basis, recomputed from the LIVE camera every frame. Using the
  // real camera (not a fixed rail pose) means the ring faces the camera however
  // it is actually aimed — crucially including the portrait re-aim that centres
  // the planet — so the satellites always ring the planet instead of drifting off
  // to one side. right/up are the camera's own screen axes; the hub sits just in
  // front of the planet toward the camera so every icon stays lit and tappable.
  const basis = useRef({
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    toCam: new THREE.Vector3(0, 0, 1),
    hub: center.clone(),
    rx: radius * 1.34,
    ry: radius * 0.66,
  });
  const iceAxis = useRef(new THREE.Vector3(0, 0, 1));
  const updateBasis = () => {
    const b = basis.current;
    b.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    b.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    b.toCam.copy(camera.position).sub(center).normalize();
    b.hub.copy(center).addScaledVector(b.toCam, 1.15 * radius);
    iceAxis.current.copy(b.toCam).applyAxisAngle(b.right, 0.5).normalize();
    // A wide, flat perspective ring hugging the planet. On a WIDE screen it can
    // spread out (1.34x); on a narrow PORTRAIT frame that pushes the side icons
    // off the edges, so we tighten the horizontal amplitude toward the planet.
    const aspect = size.width / Math.max(1, size.height);
    b.rx = radius * (aspect >= 1 ? 1.34 : 0.86 + 0.48 * aspect);
    b.ry = radius * (aspect >= 1 ? 0.66 : 0.74); // a touch taller on portrait so top/bottom icons clear the disc
  };

  const orbitPos = (a: number, out: THREE.Vector3) => {
    const b = basis.current;
    return out.copy(b.hub).addScaledVector(b.right, Math.cos(a) * b.rx).addScaledVector(b.up, Math.sin(a) * b.ry);
  };

  // faint orbit ring — an empty buffer, rebuilt each frame against the live basis
  const RING_PTS = 128;
  const ringGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_PTS * 3), 3));
    return g;
  }, []);

  // ice motes: a slow 3D shell of tiny particles around the planet. Positions
  // are LOCAL (relative to the planet), so the <points> sits at `center` and can
  // spin about its own centre — not swing around the world origin (the Sun).
  const iceGeo = useMemo(() => {
    const arr = new Float32Array(N_ICE * 3);
    let seed = 9187;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const v = new THREE.Vector3();
    for (let i = 0; i < N_ICE; i++) {
      const a = rng() * Math.PI * 2;
      const b = Math.acos(2 * rng() - 1);
      const r = radius * (1.15 + rng() * 1.15);
      v.set(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(r);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [radius]);

  const swirlGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SWIRL * 3), 3));
    return g;
  }, []);

  const phases = useMemo(() => INTERESTS.map((_, i) => (i / N) * Math.PI * 2), []);
  const spin = useRef(0);
  const appear = useRef(0);
  const hoverMix = useRef(0);
  const grow = useRef<number[]>(INTERESTS.map(() => 0));
  const npos = useRef<THREE.Vector3[]>(INTERESTS.map(() => new THREE.Vector3()));
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _a = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const f = uranusFocus();
    uranusBridge.focus = f;
    const visible = f > 0.02;
    for (const s of glowSp.current) if (s) s.visible = visible;
    for (const s of iconSp.current) if (s) s.visible = visible;
    for (const s of auroraSp.current) if (s) s.visible = visible;
    if (rimSp.current) rimSp.current.visible = visible;
    if (iceRef.current) iceRef.current.visible = visible;
    if (ringRef.current) ringRef.current.visible = visible;
    if (swirlRef.current) swirlRef.current.visible = visible;
    if (!visible) {
      for (const h of hits.current) if (h) h.visible = false;
      uranusBridge.active = false;
      uranusBridge.env = 0;
      appear.current = 0;
      return;
    }

    updateBasis(); // face the live camera (desktop rail pose or portrait re-aim)

    const t = state.clock.elapsedTime;
    appear.current = Math.min(1, appear.current + delta * 0.7);
    const app = THREE.MathUtils.smoothstep(appear.current, 0, 1) * f;
    spin.current += delta * 0.06;

    const hovered = useUranusUI.getState().hovered;
    const hoverActive = hovered != null;
    hoverMix.current += ((hoverActive ? 1 : 0) - hoverMix.current) * Math.min(1, delta * 8);
    const hm = hoverMix.current;

    // 1) satellites: orbit + gentle breath + hover lift/brighten/spin
    for (let i = 0; i < N; i++) {
      const it = INTERESTS[i];
      const p = npos.current[i];
      orbitPos(phases[i] + spin.current, p);
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.6 + i);
      const isHover = i === hovered;
      grow.current[i] += ((isHover ? 1 : 0) - grow.current[i]) * Math.min(1, delta * 9);
      const g = grow.current[i];

      let op = 0.5 + 0.18 * breathe;
      if (hoverActive) op = isHover ? 1 : op * 0.4;
      op *= app;

      const base = radius * 0.32;
      const sc = base * (1 + 0.22 * g) * (0.96 + 0.06 * breathe);
      const sp = iconSp.current[i];
      const im = iconMat.current[i];
      if (sp) {
        sp.position.copy(p);
        sp.scale.setScalar(sc);
        if (it.spin && g > 0.02) sp.material.rotation += delta * 0.7 * g;
      }
      if (im) { im.color.copy(new THREE.Color(it.color)).lerp(WHITE, 0.15 + 0.4 * g); im.opacity = op; }

      const gm = glowMat.current[i];
      const gsp = glowSp.current[i];
      if (gsp) { gsp.position.copy(p); gsp.scale.setScalar(sc * 1.5); }
      if (gm) { gm.color.set(it.color); gm.opacity = (0.12 + 0.45 * g) * op; }

      const hit = hits.current[i];
      if (hit) { hit.position.copy(p); hit.visible = app > 0.5; }
    }

    // 2) faint orbit ring — rebuilt against the live basis so it tracks the aim
    {
      const rp = ringGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < RING_PTS; i++) {
        orbitPos((i / RING_PTS) * Math.PI * 2, _p);
        rp[i * 3] = _p.x; rp[i * 3 + 1] = _p.y; rp[i * 3 + 2] = _p.z;
      }
      ringGeo.attributes.position.needsUpdate = true;
    }
    if (ringMat.current) ringMat.current.opacity = 0.06 * app;

    // 3) aurora veil (top of the planet) — slow horizontal drift + breath
    for (let k = 0; k < auroraSp.current.length; k++) {
      const s = auroraSp.current[k];
      const m = auroraMat.current[k];
      const br = 0.5 + 0.5 * Math.sin(t * (0.14 + k * 0.05) + k);
      if (s) {
        _p.copy(center)
          .addScaledVector(basis.current.up, radius * (0.92 + k * 0.14))
          .addScaledVector(basis.current.right, Math.sin(t * 0.1 + k) * radius * 0.16);
        s.position.copy(_p);
      }
      if (m) m.opacity = (0.04 + 0.05 * br) * app;
    }

    // 4) atmospheric rim glow
    if (rimMat.current) rimMat.current.opacity = (0.07 + 0.04 * Math.sin(t * 0.2)) * app;

    // 5) ice motes: slow drift about a tilted axis through the planet centre
    if (iceRef.current) iceRef.current.rotateOnWorldAxis(iceAxis.current, delta * 0.02);
    if (iceMat.current) iceMat.current.opacity = 0.4 * app;

    // 6) swirl around the hovered satellite
    const sw = swirlGeo.attributes.position.array as Float32Array;
    if (hoverActive && hm > 0.02) {
      _a.copy(npos.current[hovered!]);
      const rr = radius * 0.5;
      for (let k = 0; k < N_SWIRL; k++) {
        const a = (k / N_SWIRL) * Math.PI * 2 + t * 1.4;
        _p.copy(_a).addScaledVector(basis.current.right, Math.cos(a) * rr).addScaledVector(basis.current.up, Math.sin(a) * rr * 0.85);
        sw[k * 3] = _p.x; sw[k * 3 + 1] = _p.y; sw[k * 3 + 2] = _p.z;
      }
    } else {
      for (let k = 0; k < N_SWIRL * 3; k++) sw[k] = 0;
    }
    swirlGeo.attributes.position.needsUpdate = true;
    if (swirlMat.current) {
      swirlMat.current.opacity = hm * 0.7;
      if (hoverActive) swirlMat.current.color.set(INTERESTS[hovered!].color);
    }

    // 7) hover card bridge
    if (hoverActive) {
      _ndc.copy(npos.current[hovered!]).project(camera);
      uranusBridge.index = hovered!;
      uranusBridge.color = INTERESTS[hovered!].color;
      uranusBridge.px = (_ndc.x * 0.5 + 0.5) * size.width;
      uranusBridge.py = (-_ndc.y * 0.5 + 0.5) * size.height;
      uranusBridge.env = hm;
      uranusBridge.active = _ndc.z < 1;
    } else {
      uranusBridge.env = hm;
      uranusBridge.active = false;
    }
  });

  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (uranusFocus() < 0.4) return;
    e.stopPropagation();
    useUranusUI.getState().setHovered(i);
    document.body.style.cursor = 'pointer';
  };
  const onOut = (i: number) => () => {
    if (useUranusUI.getState().hovered === i) useUranusUI.getState().setHovered(null);
    document.body.style.cursor = '';
  };
  // Touch: tap toggles the satellite's card (persisted); tap-empty clears it.
  const onTap = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    if (uranusFocus() < 0.4) return;
    e.stopPropagation();
    const cur = useUranusUI.getState().hovered;
    useUranusUI.getState().setHovered(cur === i ? null : i);
  };
  const hitR = radius * 0.3;

  return (
    <group>
      {/* atmospheric rim glow (behind the planet, so it reads as a halo) */}
      <sprite ref={rimSp} position={center} visible={false} scale={[radius * 1.9, radius * 1.9, 1]}>
        <spriteMaterial
          ref={(m) => { rimMat.current = m; }}
          map={glowTex}
          color="#6fb6d8"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* aurora veil across the pole */}
      {[0, 1].map((k) => (
        <sprite
          key={k}
          ref={(el) => { auroraSp.current[k] = el; }}
          visible={false}
          scale={[radius * (1.9 - k * 0.3), radius * (0.42 + k * 0.1), 1]}
        >
          <spriteMaterial
            ref={(m) => { auroraMat.current[k] = m; }}
            map={glowTex}
            color={k === 0 ? '#7fe6c8' : '#8fd0ff'}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}

      {/* ice motes */}
      <points ref={iceRef} geometry={iceGeo} position={center} visible={false} frustumCulled={false}>
        <pointsMaterial
          ref={(m) => { iceMat.current = m; }}
          size={radius * 0.06}
          map={glowTex}
          color="#cfe6f2"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* faint orbit ring */}
      <lineLoop ref={(el) => { ringRef.current = el; }} geometry={ringGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial
          ref={(m) => { ringMat.current = m; }}
          color="#8dcdd8"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>

      {/* hover swirl */}
      <points ref={swirlRef} geometry={swirlGeo} visible={false} frustumCulled={false}>
        <pointsMaterial
          ref={(m) => { swirlMat.current = m; }}
          size={radius * 0.05}
          map={glowTex}
          color="#a9d4da"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* interest satellites: soft glow backing + line icon + hit target */}
      {INTERESTS.map((it, i) => (
        <group key={it.name}>
          <sprite ref={(el) => { glowSp.current[i] = el; }} visible={false} scale={[radius * 0.6, radius * 0.6, 1]}>
            <spriteMaterial
              ref={(m) => { glowMat.current[i] = m; if (m) m.color.set(it.color); }}
              map={glowTex}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <sprite ref={(el) => { iconSp.current[i] = el; }} visible={false} scale={[radius * 0.32, radius * 0.32, 1]}>
            <spriteMaterial
              ref={(m) => { iconMat.current[i] = m; if (m) m.color.set(it.color); }}
              map={iconTex[i]}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <mesh
            ref={(el) => { hits.current[i] = el; }}
            visible={false}
            onPointerOver={IS_TOUCH ? undefined : onOver(i)}
            onPointerOut={IS_TOUCH ? undefined : onOut(i)}
            onClick={IS_TOUCH ? onTap(i) : undefined}
          >
            <sphereGeometry args={[hitR, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
