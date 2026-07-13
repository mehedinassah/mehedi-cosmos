'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDescentStore } from '@/state/descentStore';

/**
 * LoopWarpField — the star-dust the ship flies THROUGH during the loop home.
 *
 * Crossing 100k+ units of empty black void has no visual payoff on its own: the
 * background starfield is a far static dome, so there is zero parallax and the
 * motion is invisible. This paints a near field of dust FIXED in world space,
 * so the camera passing through it parallaxes correctly and the speed is felt.
 * A small pool is enough: any particle that falls behind the camera recycles to
 * a fresh spot ahead, so it draws an endless tunnel. Invisible unless the camera
 * is genuinely moving during the LOOPING stage — it never touches any other
 * chapter.
 */

const COUNT = 1400;
const RADIUS = 5200; // lateral spread of the tunnel around the flight axis
const AHEAD = 15000; // how far ahead of the camera particles spawn
const BEHIND = 2600; // recycle once a particle is this far behind the camera

function softSprite(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function LoopWarpField() {
  const camera = useThree((s) => s.camera);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const prevPos = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3(0, 0, -1));
  const seeded = useRef(false);
  const opacity = useRef(0);

  const sprite = useMemo(softSprite, []);
  const { geometry, positions } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // Never frustum-cull: the field follows the camera across the whole flight.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    return { geometry, positions };
  }, []);

  const _rel = useMemo(() => new THREE.Vector3(), []);
  const _s1 = useMemo(() => new THREE.Vector3(), []);
  const _s2 = useMemo(() => new THREE.Vector3(), []);
  const _spawn = useMemo(() => new THREE.Vector3(), []);

  // Drop one particle at a fresh spot ahead of the camera: a random depth
  // within a disc of RADIUS around the travel axis.
  const respawn = (i: number, camPos: THREE.Vector3, d: THREE.Vector3) => {
    _s1.set(0, 1, 0);
    if (Math.abs(d.y) > 0.9) _s1.set(1, 0, 0);
    _s1.crossVectors(d, _s1).normalize();
    _s2.crossVectors(d, _s1).normalize();
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * RADIUS;
    const depth = Math.random() * AHEAD;
    _spawn
      .copy(camPos)
      .addScaledVector(d, depth)
      .addScaledVector(_s1, Math.cos(ang) * rad)
      .addScaledVector(_s2, Math.sin(ang) * rad);
    positions[i * 3] = _spawn.x;
    positions[i * 3 + 1] = _spawn.y;
    positions[i * 3 + 2] = _spawn.z;
  };

  useFrame((_, delta) => {
    const stage = useDescentStore.getState().stage;
    const camPos = camera.position;

    // Velocity from real camera motion — exact whether receding or approaching,
    // so the dust always streams the correct way through the turnaround.
    _rel.copy(camPos).sub(prevPos.current);
    const speed = _rel.length() / Math.max(delta, 1e-4);
    if (_rel.lengthSq() > 1e-6) dir.current.copy(_rel).normalize();
    prevPos.current.copy(camPos);

    const looping = stage === 'LOOPING';
    const target = looping && speed > 400 ? 1 : 0;
    opacity.current += (target - opacity.current) * (1 - Math.exp(-6 * delta));
    if (matRef.current) matRef.current.opacity = opacity.current * 0.9;

    if (opacity.current < 0.002) {
      seeded.current = false; // reseed fresh next time the loop begins
      return;
    }

    const d = dir.current;
    if (!seeded.current) {
      for (let i = 0; i < COUNT; i++) respawn(i, camPos, d);
      seeded.current = true;
      geometry.attributes.position.needsUpdate = true;
      return;
    }

    // Recycle whatever has fallen behind (or drifted too far ahead through the
    // turnaround) to a fresh spot in the tunnel ahead.
    for (let i = 0; i < COUNT; i++) {
      _rel.set(
        positions[i * 3] - camPos.x,
        positions[i * 3 + 1] - camPos.y,
        positions[i * 3 + 2] - camPos.z,
      );
      const along = _rel.dot(d);
      if (along < -BEHIND || along > AHEAD * 1.3) respawn(i, camPos, d);
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        map={sprite}
        size={95}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#cfe0ff"
      />
    </points>
  );
}
