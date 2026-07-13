'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assembleShader } from '@/shaders/assemble';
import sunVert from '@/shaders/materials/sun_plasma/sun.vert';
import sunFrag from '@/shaders/materials/sun_plasma/sun.frag';
import coronaVert from '@/shaders/materials/corona/corona.vert';
import coronaFrag from '@/shaders/materials/corona/corona.frag';
import { useQualityStore } from '@/state/qualityStore';
import { useUiStore } from '@/state/uiStore';
import { useSunRefStore } from '@/state/sunRefStore';
import { bodyById } from '@/content/universe';
import { Prominences } from './Prominences';

function coronaHaloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.0, 'rgba(255, 226, 180, 0.55)');
  g.addColorStop(0.3, 'rgba(255, 190, 120, 0.22)');
  g.addColorStop(0.6, 'rgba(255, 150, 80, 0.06)');
  g.addColorStop(1.0, 'rgba(255, 130, 60, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/**
 * The Sun — a LIVING star, not a glowing ball. Layered from the inside out:
 *   photosphere    boiling procedural granulation, differential rotation,
 *                  evolving sunspot groups, HDR cells that catch bloom
 *   chromosphere   thin reddish-pink rim hugging the limb
 *   inner corona   bright gold streamers just off the limb
 *   outer corona   huge, faint, irregular wisps out to ~2.4 radii — its
 *                  silhouette is never a circle and never still
 *   prominences    magnetic ropes that grow, writhe, collapse, re-seed
 *   ejecta         a continuous drizzle of tiny plasma sparks, plus a small
 *                  flare every 15-30s (grow, brighten, fade, leave haze)
 *   halo sprite    distance impression only; fades out on approach
 */

/** One corona-family shell with its own look parameters. */
function useShellMaterial(params: {
  col1: string; col2: string; alpha: number; freq: number;
  speed: number; rimPow: number; base: number; muHi?: number;
}) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coronaVert,
        fragmentShader: assembleShader(coronaFrag, { OCTAVES: 4 }),
        uniforms: {
          uTime: { value: 0 },
          uCameraPos: { value: new THREE.Vector3() },
          uIgnite: { value: 0 },
          uCol1: { value: new THREE.Color(params.col1) },
          uCol2: { value: new THREE.Color(params.col2) },
          uAlpha: { value: params.alpha },
          uFreq: { value: params.freq },
          uSpeed: { value: params.speed },
          uRimPow: { value: params.rimPow },
          uBase: { value: params.base },
          uMuHi: { value: params.muHi ?? 1.0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

/* ---------------- plasma ejecta + flares ---------------- */

const EJECTA_COUNT = 240;

function PlasmaEjecta({ radius }: { radius: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const flareRef = useRef<THREE.Sprite>(null);
  const data = useRef({
    pos: new Float32Array(EJECTA_COUNT * 3),
    vel: new Float32Array(EJECTA_COUNT * 3),
    life: new Float32Array(EJECTA_COUNT), // remaining seconds; <=0 waiting
    max: new Float32Array(EJECTA_COUNT),
    // flare event state
    nextFlare: 12,
    flareT: -1, // <0 idle, else seconds since eruption
    flareDir: new THREE.Vector3(1, 0, 0),
  });

  const [geometry, material] = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.current.pos, 3));
    const colors = new Float32Array(EJECTA_COUNT * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.PointsMaterial({
      size: 2.6,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    return [g, m] as const;
  }, []);

  const haloTex = useMemo(() => coronaHaloTexture(), []);

  const spawn = (i: number, dir?: THREE.Vector3, speedMul = 1) => {
    const d = data.current;
    let x: number, y: number, z: number;
    if (dir) {
      x = dir.x; y = dir.y; z = dir.z;
    } else {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      x = r * Math.cos(a); y = u; z = r * Math.sin(a);
    }
    // jitter so flare bursts spray a cone, not a line
    const j = 0.25;
    const jx = x + (Math.random() - 0.5) * j;
    const jy = y + (Math.random() - 0.5) * j;
    const jz = z + (Math.random() - 0.5) * j;
    const inv = 1 / Math.hypot(jx, jy, jz);
    d.pos[i * 3] = jx * inv * radius * 1.01;
    d.pos[i * 3 + 1] = jy * inv * radius * 1.01;
    d.pos[i * 3 + 2] = jz * inv * radius * 1.01;
    const sp = radius * (0.04 + Math.random() * 0.08) * speedMul;
    d.vel[i * 3] = jx * inv * sp;
    d.vel[i * 3 + 1] = jy * inv * sp;
    d.vel[i * 3 + 2] = jz * inv * sp;
    d.max[i] = d.life[i] = 1.2 + Math.random() * 2.2;
  };

  useFrame((state, delta) => {
    const d = data.current;
    const t = state.clock.elapsedTime;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    // ---- flare scheduler: one small eruption every 15-30 s ----
    if (d.flareT < 0) {
      d.nextFlare -= delta;
      if (d.nextFlare <= 0) {
        d.flareT = 0;
        const u = Math.random() * 1.2 - 0.6; // near the activity belts
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.max(0, 1 - u * u));
        d.flareDir.set(r * Math.cos(a), u, r * Math.sin(a));
        // a burst of fast ejecta from the flare site
        let burst = 26;
        for (let i = 0; i < EJECTA_COUNT && burst > 0; i++) {
          if (d.life[i] <= 0) { spawn(i, d.flareDir, 2.6); burst--; }
        }
      }
    } else {
      d.flareT += delta;
      if (d.flareT > 3.2) {
        d.flareT = -1;
        d.nextFlare = 15 + Math.random() * 15;
      }
    }
    // flare glow sprite: grow fast, fade slow, at the eruption site
    const fl = flareRef.current;
    if (fl) {
      if (d.flareT >= 0) {
        const grow = Math.min(d.flareT / 0.5, 1);
        const fade = 1 - THREE.MathUtils.smoothstep(d.flareT, 1.1, 3.2);
        const s = radius * (0.35 + grow * 0.55);
        fl.position.copy(d.flareDir).multiplyScalar(radius * 1.02);
        fl.scale.set(s, s, 1);
        (fl.material as THREE.SpriteMaterial).opacity = grow * fade * 0.85;
      } else {
        (fl.material as THREE.SpriteMaterial).opacity = 0;
      }
    }

    // ---- the continuous drizzle ----
    for (let i = 0; i < EJECTA_COUNT; i++) {
      if (d.life[i] <= 0) {
        // sparse steady respawn keeps ~40% of the pool active
        if (Math.random() < delta * 0.12) spawn(i);
        else { colAttr.setXYZ(i, 0, 0, 0); continue; }
      }
      d.life[i] -= delta;
      d.pos[i * 3] += d.vel[i * 3] * delta;
      d.pos[i * 3 + 1] += d.vel[i * 3 + 1] * delta;
      d.pos[i * 3 + 2] += d.vel[i * 3 + 2] * delta;
      // gravity-ish pullback: most sparks arc and fall home
      const px = d.pos[i * 3], py = d.pos[i * 3 + 1], pz = d.pos[i * 3 + 2];
      const inv = 1 / Math.hypot(px, py, pz);
      const g = radius * 0.02 * delta;
      d.vel[i * 3] -= px * inv * g;
      d.vel[i * 3 + 1] -= py * inv * g;
      d.vel[i * 3 + 2] -= pz * inv * g;
      const a = Math.max(0, d.life[i] / d.max[i]);
      colAttr.setXYZ(i, 1.0 * a, 0.62 * a, 0.3 * a);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    void t;
  });

  return (
    <group>
      <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
        <primitive object={material} attach="material" />
      </points>
      <sprite ref={flareRef}>
        <spriteMaterial
          map={haloTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>
    </group>
  );
}

export function CentralStar() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const igniteRef = useRef(0);
  const tier = useQualityStore((s) => s.tier);
  const setSunMesh = useSunRefStore((s) => s.setMesh);
  const body = bodyById.get('sun')!;

  const material = useMemo(() => {
    const octaves = tier >= 3 ? 5 : tier === 2 ? 4 : 3;
    // Real photosphere map (solarsystemscope.com, CC BY 4.0) is demoted to a
    // faint identity base under the fully procedural, boiling granulation
    const map = new THREE.TextureLoader().load('/textures/2k_sun.jpg');
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    return new THREE.ShaderMaterial({
      vertexShader: sunVert,
      fragmentShader: assembleShader(sunFrag, { OCTAVES: octaves }),
      uniforms: { uTime: { value: 0 }, uIgnite: { value: 0 }, uMap: { value: map } },
    });
  }, [tier]);

  // Three shells, one shader: chromosphere / inner corona / outer corona
  const chromoMat = useShellMaterial({
    col1: '#ff5a3c', col2: '#ffb090', alpha: 1.4, freq: 4.2, speed: 0.05, rimPow: 2.2, base: 0.35,
  });
  const innerMat = useShellMaterial({
    col1: '#ff9947', col2: '#ffe6b3', alpha: 1.6, freq: 1.8, speed: 0.025, rimPow: 1.3, base: 0.16,
  });
  // The photosphere edge seen through a shell of scale S sits at
  // mu = sqrt(1 - 1/S^2); for S = 2.1 that's ~0.88. The corona peaks there
  // and decays outward — light leaving the star.
  const outerMat = useShellMaterial({
    col1: '#ff8a3d', col2: '#ffd9a0', alpha: 0.55, freq: 1.1, speed: 0.014, rimPow: 2.6, base: 0.05,
    muHi: 0.88,
  });
  const shellMats = useMemo(
    () => [chromoMat, innerMat, outerMat],
    [chromoMat, innerMat, outerMat],
  );

  const halo = useMemo(() => coronaHaloTexture(), []);

  useEffect(() => {
    setSunMesh(meshRef.current);
    return () => setSunMesh(null);
  }, [setSunMesh]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    matRef.current!.uniforms.uTime.value = t;

    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' || phase === 'PARTICLE' ? 0 : phase === 'FORMATION' ? 0.35 : 1;
    igniteRef.current = THREE.MathUtils.damp(igniteRef.current, target, 1.2, delta + 1 / 60);
    matRef.current!.uniforms.uIgnite.value = igniteRef.current;

    for (const m of shellMats) {
      m.uniforms.uTime.value = t;
      m.uniforms.uCameraPos.value.copy(state.camera.position);
      m.uniforms.uIgnite.value = igniteRef.current;
    }

    if (spriteRef.current) {
      const breathe = 1 + 0.03 * Math.sin(t * 0.5);
      // The halo is a distance impression — up close it would wash the whole
      // frame to white and drown the photosphere detail, so it fades out as
      // the camera approaches (system-chapter close-ups start at ~440u).
      const camDist = state.camera.position.length();
      const nearFade = THREE.MathUtils.smoothstep(camDist, 420, 1600);
      const sc = body.scaleU * 8 * breathe * igniteRef.current * (0.35 + 0.65 * nearFade);
      spriteRef.current.scale.set(sc, sc, 1);
      (spriteRef.current.material as THREE.SpriteMaterial).opacity =
        0.75 * igniteRef.current * (0.1 + 0.9 * nearFade);
    }
  });

  return (
    <group name="sun" userData={{ bodyId: 'sun' }}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[body.scaleU, 128, 128]} />
        <primitive object={material} ref={matRef} attach="material" />
      </mesh>
      {/* chromosphere — thin colored rim hugging the photosphere */}
      <mesh scale={1.05}>
        <sphereGeometry args={[body.scaleU, 64, 64]} />
        <primitive object={chromoMat} attach="material" />
      </mesh>
      {/* inner corona — bright streamers just off the limb */}
      <mesh scale={1.16}>
        <sphereGeometry args={[body.scaleU, 64, 64]} />
        <primitive object={innerMat} attach="material" />
      </mesh>
      {/* outer corona — huge irregular wisps, never a circle */}
      <mesh scale={2.1}>
        <sphereGeometry args={[body.scaleU, 48, 48]} />
        <primitive object={outerMat} attach="material" />
      </mesh>
      <Prominences radius={body.scaleU} ignite={igniteRef.current} />
      <PlasmaEjecta radius={body.scaleU} />
      <sprite ref={spriteRef}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>
    </group>
  );
}
