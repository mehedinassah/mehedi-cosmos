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
 * The Sun — rebuilt. Photosphere (granulation + limb darkening + active
 * regions), streamer corona shell, animated prominence loops, soft outer
 * halo sprite for bloom catch. Registers itself for GodRays anchoring.
 */
export function CentralStar() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const coronaMatRef = useRef<THREE.ShaderMaterial>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const igniteRef = useRef(0);
  const tier = useQualityStore((s) => s.tier);
  const setSunMesh = useSunRefStore((s) => s.setMesh);
  const body = bodyById.get('sun')!;

  const material = useMemo(() => {
    const octaves = tier >= 3 ? 5 : tier === 2 ? 4 : 3;
    return new THREE.ShaderMaterial({
      vertexShader: sunVert,
      fragmentShader: assembleShader(sunFrag, { OCTAVES: octaves }),
      uniforms: { uTime: { value: 0 }, uIgnite: { value: 0 } },
    });
  }, [tier]);

  const coronaMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coronaVert,
        fragmentShader: assembleShader(coronaFrag, { OCTAVES: 4 }),
        uniforms: {
          uTime: { value: 0 },
          uCameraPos: { value: new THREE.Vector3() },
          uIgnite: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const halo = useMemo(() => coronaHaloTexture(), []);

  useEffect(() => {
    setSunMesh(meshRef.current);
    return () => setSunMesh(null);
  }, [setSunMesh]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    matRef.current!.uniforms.uTime.value = t;
    coronaMatRef.current!.uniforms.uTime.value = t;
    coronaMatRef.current!.uniforms.uCameraPos.value.copy(state.camera.position);

    const phase = useUiStore.getState().introPhase;
    const target = phase === 'DARKNESS' || phase === 'PARTICLE' ? 0 : phase === 'FORMATION' ? 0.35 : 1;
    igniteRef.current = THREE.MathUtils.damp(igniteRef.current, target, 1.2, delta + 1 / 60);
    matRef.current!.uniforms.uIgnite.value = igniteRef.current;
    coronaMatRef.current!.uniforms.uIgnite.value = igniteRef.current;

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
      <mesh scale={1.14}>
        <sphereGeometry args={[body.scaleU, 64, 64]} />
        <primitive object={coronaMaterial} ref={coronaMatRef} attach="material" />
      </mesh>
      <Prominences radius={body.scaleU} ignite={igniteRef.current} />
      <sprite ref={spriteRef}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>
    </group>
  );
}
