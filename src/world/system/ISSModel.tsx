'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ISSModel — an optimized low-poly International Space Station.
 *
 * Laid out so its hero broadside is the local XY plane (panels' normal is +Z):
 * a long central truss (local X) with symmetrical blue solar arrays at both
 * ends, white pressurized modules clustered at the hub, small white radiators,
 * a stubby Canadarm, and a few blinking nav lights. When the station turns its
 * +Z face to the camera you read the full wingspan at once — the iconic ISS.
 *
 * Self-contained motion: the solar arrays slightly track the Sun (the system
 * origin) about the truss axis, so sunlight catches the panels now and then.
 * Nav lights blink on their own phases. Position / scale / heading come from
 * the parent (EarthProbe). NASA engineering aesthetic — no sci-fi.
 */

const _wp = new THREE.Vector3();
const _wq = new THREE.Quaternion();
const _ws = new THREE.Vector3();
const _sun = new THREE.Vector3();

const MASTS = [-1.68, -1.1, 1.1, 1.68]; // solar-array stations along the truss

export function ISSModel() {
  const root = useRef<THREE.Group>(null);
  const solar = useRef<THREE.Group>(null);
  const nav = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const sunAngle = useRef(0.2);

  const panelTex = useMemo(makeSolarTex, []);
  // Unlit + toneMapped:false so the blue renders exactly — the scene's sun is
  // decay-free and intense enough to wash any lit panel to white. The base blue
  // lives in `color`; a sun-facing glint brightens it a touch (see useFrame).
  const panelMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: panelTex, color: '#2c52a4', side: THREE.DoubleSide, toneMapped: false }),
    [panelTex],
  );
  const panelBase = useMemo(() => new THREE.Color('#2c52a4'), []);
  const _glintCol = useMemo(() => new THREE.Color('#9fc0ff'), []);
  const panelGlint = useRef(0);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d7dbe2', metalness: 0.28, roughness: 0.42 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b929c', metalness: 0.55, roughness: 0.4 }), []);
  const radMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7ebf1', metalness: 0.1, roughness: 0.62, side: THREE.DoubleSide }), []);
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c7a24d', metalness: 0.55, roughness: 0.45 }), []);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    g.updateWorldMatrix(true, false); // parent set our transform this frame
    g.matrixWorld.decompose(_wp, _wq, _ws);
    // Before arrival the parent scale is 0, so decompose yields a NaN quaternion
    // (divide-by-zero) that would poison sunAngle forever. Skip until scaled in.
    if (!(_ws.x > 1e-4)) return;

    // Direction to the Sun (system origin), brought into local space.
    _sun.copy(_wp).multiplyScalar(-1).normalize();
    _sun.applyQuaternion(_wq.invert());
    // Alpha joint rotates about the truss (local X); panel normal is +Z. Track
    // the Sun only SLIGHTLY (clamped) so the broad blue face keeps facing the
    // viewer — a gentle sway that lets sunlight glance off the array.
    const target = THREE.MathUtils.clamp(Math.atan2(-_sun.y, _sun.z), -0.32, 0.32);
    let d = target - sunAngle.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    sunAngle.current += d * (1 - Math.exp(-1.6 * delta)); // slow, weightless
    const a = sunAngle.current;
    if (solar.current) solar.current.rotation.x = a;
    // Glint: how squarely the tilted panel (normal rotates to (0,-sin a,cos a))
    // faces the Sun. Brighten the array a touch when it catches the light.
    const face = Math.max(0, -Math.sin(a) * _sun.y + Math.cos(a) * _sun.z);
    panelGlint.current = THREE.MathUtils.damp(panelGlint.current, face, 4, delta);
    panelMat.color.copy(panelBase).lerp(_glintCol, 0.16 * panelGlint.current);

    // Blinking nav lights on offset phases.
    const t = state.clock.elapsedTime;
    const m0 = nav.current[0];
    if (m0) m0.opacity = 0.2 + 0.8 * Math.pow(Math.max(0, Math.sin(t * 2.4)), 8);
    const m1 = nav.current[1];
    if (m1) m1.opacity = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * 1.3 + 1.2)), 6);
    const m2 = nav.current[2];
    if (m2) m2.opacity = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * 1.3 + 2.9)), 6);
  });

  return (
    <group ref={root}>
      {/* ---------- central truss (local X) ---------- */}
      <mesh material={darkMat}>
        <boxGeometry args={[3.35, 0.07, 0.07]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0, 0.05]}>
        <boxGeometry args={[3.35, 0.11, 0.015]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0, -0.05]}>
        <boxGeometry args={[3.35, 0.11, 0.015]} />
      </mesh>
      {[-0.95, -0.4, 0.4, 0.95].map((x) => (
        <mesh key={x} material={darkMat} position={[x, 0, 0]}>
          <boxGeometry args={[0.02, 0.12, 0.12]} />
        </mesh>
      ))}

      {/* ---------- solar arrays (broad face +Z, slight Sun tilt about X) ---------- */}
      <group ref={solar}>
        {MASTS.map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh material={darkMat}>
              <boxGeometry args={[0.025, 3.05, 0.02]} />
            </mesh>
            <mesh material={panelMat} position={[0, 0.8, 0]}>
              <boxGeometry args={[0.54, 1.44, 0.012]} />
            </mesh>
            <mesh material={panelMat} position={[0, -0.8, 0]}>
              <boxGeometry args={[0.54, 1.44, 0.012]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ---------- pressurized modules (compact hub) ---------- */}
      <mesh material={bodyMat} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.62, 14]} />
      </mesh>
      <mesh material={bodyMat} position={[0.34, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 14]} />
      </mesh>
      <mesh material={bodyMat} position={[-0.34, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 14]} />
      </mesh>
      {/* gold thermal blanket accents */}
      <mesh material={goldMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.153, 0.153, 0.07, 14]} />
      </mesh>
      <mesh material={goldMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.153, 0.153, 0.07, 14]} />
      </mesh>
      {/* node + cupola below, forward docking port toward camera */}
      <mesh material={bodyMat} position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.42, 12]} />
      </mesh>
      <mesh material={darkMat} position={[0, -0.56, 0]}>
        <sphereGeometry args={[0.08, 12, 8]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 12]} />
      </mesh>

      {/* ---------- small white radiators (mostly edge-on, subtle) ---------- */}
      <mesh material={radMat} position={[0.55, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.34, 0.01, 0.44]} />
      </mesh>
      <mesh material={radMat} position={[-0.55, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.34, 0.01, 0.44]} />
      </mesh>
      <mesh material={radMat} position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.3, 0.01, 0.4]} />
      </mesh>

      {/* ---------- Canadarm (one side, toward camera) ---------- */}
      <group position={[0.22, -0.14, 0.16]}>
        <mesh material={bodyMat}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
        </mesh>
        <mesh material={bodyMat} position={[0.16, -0.02, 0.06]} rotation={[0, 0.4, 1.1]}>
          <cylinderGeometry args={[0.02, 0.02, 0.42, 8]} />
        </mesh>
        <mesh material={bodyMat} position={[0.34, 0.02, 0.16]} rotation={[0, 1.0, 0.6]}>
          <cylinderGeometry args={[0.017, 0.017, 0.36, 8]} />
        </mesh>
        <mesh material={darkMat} position={[0.46, 0.06, 0.28]}>
          <boxGeometry args={[0.04, 0.04, 0.05]} />
        </mesh>
      </group>

      {/* ---------- blinking nav lights ---------- */}
      <mesh position={[0, 0, 0.5]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[0] = m; }} color="#ffffff" transparent opacity={1} />
      </mesh>
      <mesh position={[-1.92, 0, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[1] = m; }} color="#ff5a52" transparent opacity={1} />
      </mesh>
      <mesh position={[1.92, 0, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[2] = m; }} color="#5affa0" transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Solar-cell texture: a medium blue base (reads as blue once lit) with a cell
 *  grid and a gold blanket seam. The blue lives here, not in the material. */
function makeSolarTex(): THREE.CanvasTexture {
  const w = 128, h = 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  // Light base so it multiplies against the material's blue as grid detail
  // rather than darkening the color.
  ctx.fillStyle = '#cdd8ec';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(40,58,96,0.55)';
  ctx.lineWidth = 1;
  const cols = 16, rows = 4;
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo((i / cols) * w, 0);
    ctx.lineTo((i / cols) * w, h);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, (j / rows) * h);
    ctx.lineTo(w, (j / rows) * h);
    ctx.stroke();
  }
  // gold blanket spine down the middle of each wing
  ctx.fillStyle = 'rgba(196,158,80,0.7)';
  ctx.fillRect(0, h / 2 - 2, w, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
