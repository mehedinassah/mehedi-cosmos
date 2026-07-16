'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ISSModel — a recognizable, near-photoreal International Space Station.
 *
 * Tuned for visual authenticity at a cinematic distance, not bolt-level
 * accuracy: an accurate silhouette and proportions, the eight big blue-black
 * solar arrays on a long segmented truss, a stack of white pressurized modules
 * with nodes, white radiator panels, a Canadarm and a couple of dishes. PBR
 * white thermal / brushed-aluminium / dark truss materials; the arrays are unlit
 * segmented PV (so the scene's decay-free sun can't wash them white) framed by
 * lit metallic edges that catch the light. Arrays track the Sun and sway a hair.
 */

const _wp = new THREE.Vector3();
const _wq = new THREE.Quaternion();
const _ws = new THREE.Vector3();
const _sun = new THREE.Vector3();

// four alpha-joint masts along the truss; each carries a fore (+Z) and aft (-Z)
// array, giving the classic eight-panel butterfly.
const MASTS = [-3.3, -2.25, 2.25, 3.3];
const PANEL_L = 2.55; // array length (along Z)
const PANEL_W = 0.82; // array width (along X)

export function ISSModel() {
  const root = useRef<THREE.Group>(null);
  const solar = useRef<THREE.Group>(null);
  const nav = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const sunAngle = useRef(0.2);
  const glint = useRef(0);

  const pvTex = useMemo(makePVTex, []);
  const pvMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: pvTex, toneMapped: false, side: THREE.DoubleSide }),
    [pvTex],
  );
  const pvBase = useMemo(() => new THREE.Color('#ffffff'), []);
  const pvGlint = useMemo(() => new THREE.Color('#cfe0ff'), []);

  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef0f4', metalness: 0.12, roughness: 0.5 }), []);
  const alu = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9cdd4', metalness: 0.7, roughness: 0.38 }), []);
  const truss = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6c727b', metalness: 0.6, roughness: 0.5 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8a24a', metalness: 0.72, roughness: 0.4 }), []);
  const rad = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f4f7', metalness: 0.14, roughness: 0.55, side: THREE.DoubleSide }), []);
  const dish = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7ebf1', metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }), []);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    g.matrixWorld.decompose(_wp, _wq, _ws);
    if (!(_ws.x > 1e-4)) return; // pre-arrival scale 0 -> NaN quaternion; skip

    // Sun sits at the system origin; bring its direction into local space.
    _sun.copy(_wp).multiplyScalar(-1).normalize();
    _sun.applyQuaternion(_wq.invert());
    // Alpha joint rotates the arrays about the truss (local X); array normal is
    // +Y. Track slightly (clamped) so the broad blue face keeps facing outward.
    const target = THREE.MathUtils.clamp(Math.atan2(-_sun.y, _sun.z), -0.4, 0.4);
    let d = target - sunAngle.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    sunAngle.current += d * (1 - Math.exp(-1.4 * delta));
    const a = sunAngle.current + Math.sin(state.clock.elapsedTime * 0.25) * 0.015; // tiny sway
    if (solar.current) solar.current.rotation.x = a;
    // subtle sun glint on the arrays as they line up with the light
    const face = Math.max(0, -Math.sin(a) * _sun.y + Math.cos(a) * _sun.z);
    glint.current = THREE.MathUtils.damp(glint.current, face, 4, delta);
    pvMat.color.copy(pvBase).lerp(pvGlint, 0.18 * glint.current);

    const t = state.clock.elapsedTime;
    const m0 = nav.current[0];
    if (m0) m0.opacity = 0.2 + 0.8 * Math.pow(Math.max(0, Math.sin(t * 2.3)), 8);
    const m1 = nav.current[1];
    if (m1) m1.opacity = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 1.3 + 1.4)), 6);
    const m2 = nav.current[2];
    if (m2) m2.opacity = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 1.3 + 3.0)), 6);
  });

  return (
    <group ref={root}>
      {/* ---------------- central truss (local X) ---------------- */}
      <mesh material={truss}>
        <boxGeometry args={[7.0, 0.16, 0.26]} />
      </mesh>
      <mesh material={alu} position={[0, 0.1, 0]}>
        <boxGeometry args={[7.0, 0.03, 0.34]} />
      </mesh>
      <mesh material={alu} position={[0, -0.1, 0]}>
        <boxGeometry args={[7.0, 0.03, 0.34]} />
      </mesh>
      {/* truss bay frames — girder segmentation */}
      {[-3, -2.4, -1.8, -1.2, 1.2, 1.8, 2.4, 3].map((x) => (
        <mesh key={x} material={truss} position={[x, 0, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.34]} />
        </mesh>
      ))}

      {/* ---------------- solar arrays (sun-tracking) ---------------- */}
      <group ref={solar}>
        {MASTS.map((x) => (
          <group key={x} position={[x, 0, 0]}>
            {/* array mast (runs fore-aft in Z) */}
            <mesh material={alu}>
              <boxGeometry args={[0.05, 0.05, PANEL_L * 2 + 0.3]} />
            </mesh>
            {[1, -1].map((s) => (
              <group key={s} position={[0, 0, s * (PANEL_L * 0.5 + 0.12)]}>
                {/* segmented photovoltaic blanket — blue both sides */}
                <mesh material={pvMat}>
                  <boxGeometry args={[PANEL_W, 0.016, PANEL_L]} />
                </mesh>
                {/* brushed-aluminium frame rails along the long edges */}
                <mesh material={alu} position={[PANEL_W * 0.5 + 0.015, 0, 0]}>
                  <boxGeometry args={[0.035, 0.035, PANEL_L + 0.04]} />
                </mesh>
                <mesh material={alu} position={[-PANEL_W * 0.5 - 0.015, 0, 0]}>
                  <boxGeometry args={[0.035, 0.035, PANEL_L + 0.04]} />
                </mesh>
                {/* end batten */}
                <mesh material={alu} position={[0, 0, s * (PANEL_L * 0.5 + 0.02)]}>
                  <boxGeometry args={[PANEL_W + 0.06, 0.035, 0.04]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* ---------------- white radiator panels (fore-aft normal) --------------- */}
      {[-0.95, 0, 0.95].map((x) => (
        <mesh key={x} material={rad} position={[x, 0.72, 0]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.86, 0.9, 0.02]} />
        </mesh>
      ))}

      {/* ---------------- pressurized module stack (nadir, runs in Z) ---------- */}
      {/* connecting strut down from the truss */}
      <mesh material={alu} position={[0, -0.42, 0]}>
        <boxGeometry args={[0.34, 0.5, 0.34]} />
      </mesh>
      <group position={[0, -0.86, 0]}>
        {/* core lab + fore/aft labs */}
        <mesh material={white} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 1.35, 18]} />
        </mesh>
        <mesh material={white} position={[0, 0, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 1.1, 18]} />
        </mesh>
        <mesh material={white} position={[0, 0, -1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 1.1, 18]} />
        </mesh>
        {/* fore & aft nodes + docking adapters */}
        <mesh material={white} position={[0, 0, 1.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.44, 16]} />
        </mesh>
        <mesh material={alu} position={[0, 0, 2.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.2, 0.22, 14]} />
        </mesh>
        <mesh material={white} position={[0, 0, -1.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.44, 16]} />
        </mesh>
        {/* radial modules (port/starboard) at the mid node */}
        <mesh material={white} position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 0.5, 16]} />
        </mesh>
        <mesh material={white} position={[-0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 0.5, 16]} />
        </mesh>
        {/* cupola bump on the nadir side */}
        <mesh material={alu} position={[0, -0.34, 0.2]}>
          <cylinderGeometry args={[0.16, 0.2, 0.16, 12]} />
        </mesh>
        <mesh material={white} position={[0, -0.44, 0.2]}>
          <sphereGeometry args={[0.15, 14, 10]} />
        </mesh>
        {/* gold thermal-blanket accents */}
        <mesh material={gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.55]}>
          <cylinderGeometry args={[0.405, 0.405, 0.12, 18]} />
        </mesh>
        <mesh material={gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.55]}>
          <cylinderGeometry args={[0.405, 0.405, 0.12, 18]} />
        </mesh>
      </group>

      {/* ---------------- Canadarm (segmented) ---------------- */}
      <group position={[0.6, -0.1, 0.34]}>
        <mesh material={white}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
        </mesh>
        <mesh material={white} position={[0.14, 0.16, 0.06]} rotation={[0, 0.4, 1.0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.6, 10]} />
        </mesh>
        <mesh material={white} position={[0.42, 0.28, 0.24]} rotation={[0, 1.0, 0.5]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 10]} />
        </mesh>
        <mesh material={alu} position={[0.62, 0.34, 0.42]}>
          <boxGeometry args={[0.06, 0.06, 0.08]} />
        </mesh>
      </group>

      {/* ---------------- antennas / dishes ---------------- */}
      <group position={[-0.7, 0.28, 0.2]} rotation={[0.7, 0.3, 0]}>
        <mesh material={dish}>
          <cylinderGeometry args={[0.2, 0.05, 0.12, 16, 1, true]} />
        </mesh>
        <mesh material={alu} position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
        </mesh>
      </group>
      <mesh material={alu} position={[1.0, 0.24, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
      </mesh>

      {/* ---------------- blinking nav lights ---------------- */}
      <mesh position={[0, -0.86, 2.28]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[0] = m; }} color="#ffffff" transparent opacity={1} />
      </mesh>
      <mesh position={[-3.85, 0, 0]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[1] = m; }} color="#ff5a52" transparent opacity={1} />
      </mesh>
      <mesh position={[3.85, 0, 0]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[2] = m; }} color="#5affa0" transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Segmented ISS photovoltaic texture: dark blue-black cells with fine
 *  horizontal segmentation, vertical busbars and a warm blanket seam. */
function makePVTex(): THREE.CanvasTexture {
  const w = 48, h = 200;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#0e1830');
  grad.addColorStop(0.5, '#16233f');
  grad.addColorStop(1, '#0e1830');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // fine horizontal cell segmentation (many rows)
  ctx.strokeStyle = 'rgba(90,120,180,0.28)';
  ctx.lineWidth = 1;
  const rows = 40;
  for (let j = 1; j < rows; j++) {
    const y = (j / rows) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // vertical busbars
  ctx.strokeStyle = 'rgba(20,32,58,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    const x = (i / 4) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  // warm central blanket seam
  ctx.fillStyle = 'rgba(150,120,60,0.4)';
  ctx.fillRect(w / 2 - 1, 0, 2, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
