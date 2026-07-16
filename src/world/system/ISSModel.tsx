'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ISSModel — a recognizable, near-photoreal International Space Station, matched
 * to real NASA photography: a long lattice truss running horizontally, FOUR
 * PAIRS of large copper/gold solar arrays clustered as two 2x2 blocks at the
 * truss ends, a compact central knot of white cylindrical pressurized modules
 * with nodes and a cupola, white radiators, the Canadarm2 and small antennas.
 *
 * Tuned for authenticity at a cinematic distance, not bolt-accuracy. Arrays are
 * unlit segmented PV (copper cells) so the scene's decay-free sun can't wash
 * them; everything else is PBR (white thermal / brushed aluminium / grey truss /
 * gold). Arrays track the Sun and sway a hair.
 */

const _wp = new THREE.Vector3();
const _wq = new THREE.Quaternion();
const _ws = new THREE.Vector3();
const _sun = new THREE.Vector3();

// two masts per side => a 2x2 array block at each end; wide clear central span.
const MASTS = [-3.5, -2.6, 2.6, 3.5];
const PANEL_L = 2.5; // array length (along Z, fore-aft)
const PANEL_W = 0.8; // array width (along X)
const PANEL_OFF = PANEL_L * 0.5 + 0.14; // fore/aft offset of each array

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
  const pvGlint = useMemo(() => new THREE.Color('#ffe6b0'), []);

  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef0f4', metalness: 0.15, roughness: 0.48 }), []);
  const alu = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9cdd4', metalness: 0.72, roughness: 0.36 }), []);
  const truss = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b8f97', metalness: 0.62, roughness: 0.5 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8a24a', metalness: 0.75, roughness: 0.38 }), []);
  const rad = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f4f7', metalness: 0.16, roughness: 0.52, side: THREE.DoubleSide }), []);
  const dish = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7ebf1', metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }), []);

  // truss lattice zig-zag diagonals (front & back faces)
  const diagonals = useMemo(() => {
    const out: { x: number; z: number; rz: number }[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = -3.3 + (i / (n - 1)) * 6.6;
      const rz = (i % 2 === 0 ? 1 : -1) * 0.5;
      out.push({ x, z: 0.11, rz });
      out.push({ x, z: -0.11, rz: -rz });
    }
    return out;
  }, []);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    g.matrixWorld.decompose(_wp, _wq, _ws);
    if (!(_ws.x > 1e-4)) return; // pre-arrival scale 0 -> NaN quaternion; skip

    _sun.copy(_wp).multiplyScalar(-1).normalize();
    _sun.applyQuaternion(_wq.invert());
    const target = THREE.MathUtils.clamp(Math.atan2(-_sun.y, _sun.z), -0.4, 0.4);
    let d = target - sunAngle.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    sunAngle.current += d * (1 - Math.exp(-1.4 * delta));
    const a = sunAngle.current + Math.sin(state.clock.elapsedTime * 0.25) * 0.015;
    if (solar.current) solar.current.rotation.x = a;
    const face = Math.max(0, -Math.sin(a) * _sun.y + Math.cos(a) * _sun.z);
    glint.current = THREE.MathUtils.damp(glint.current, face, 4, delta);
    pvMat.color.copy(pvBase).lerp(pvGlint, 0.16 * glint.current);

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
      {/* ---------------- lattice truss (local X) ---------------- */}
      {/* four corner longerons */}
      {[[0.12, 0.12], [0.12, -0.12], [-0.12, 0.12], [-0.12, -0.12]].map(([y, z], i) => (
        <mesh key={i} material={truss} position={[0, y, z]}>
          <boxGeometry args={[7.0, 0.035, 0.035]} />
        </mesh>
      ))}
      {/* bay ribs */}
      {Array.from({ length: 12 }).map((_, i) => {
        const x = -3.3 + (i / 11) * 6.6;
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh material={truss} position={[0, 0.12, 0]}><boxGeometry args={[0.03, 0.03, 0.28]} /></mesh>
            <mesh material={truss} position={[0, -0.12, 0]}><boxGeometry args={[0.03, 0.03, 0.28]} /></mesh>
            <mesh material={truss} position={[0, 0, 0.12]}><boxGeometry args={[0.03, 0.28, 0.03]} /></mesh>
            <mesh material={truss} position={[0, 0, -0.12]}><boxGeometry args={[0.03, 0.28, 0.03]} /></mesh>
          </group>
        );
      })}
      {/* zig-zag diagonals */}
      {diagonals.map((dg, i) => (
        <mesh key={i} material={truss} position={[dg.x, 0, dg.z]} rotation={[0, 0, dg.rz]}>
          <boxGeometry args={[0.02, 0.62, 0.02]} />
        </mesh>
      ))}

      {/* ---------------- solar arrays: two 2x2 copper blocks ------------- */}
      <group ref={solar}>
        {MASTS.map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh material={alu}>
              <boxGeometry args={[0.06, 0.06, PANEL_OFF * 2 + 0.2]} />
            </mesh>
            {[1, -1].map((s) => (
              <group key={s} position={[0, 0, s * PANEL_OFF]}>
                <mesh material={pvMat}>
                  <boxGeometry args={[PANEL_W, 0.016, PANEL_L]} />
                </mesh>
                {/* brushed-aluminium frame rails */}
                <mesh material={alu} position={[PANEL_W * 0.5 + 0.015, 0, 0]}>
                  <boxGeometry args={[0.03, 0.035, PANEL_L + 0.05]} />
                </mesh>
                <mesh material={alu} position={[-PANEL_W * 0.5 - 0.015, 0, 0]}>
                  <boxGeometry args={[0.03, 0.035, PANEL_L + 0.05]} />
                </mesh>
                <mesh material={alu} position={[0, 0, s * (PANEL_L * 0.5 + 0.02)]}>
                  <boxGeometry args={[PANEL_W + 0.06, 0.035, 0.035]} />
                </mesh>
                {/* mast-blanket box at the base */}
                <mesh material={alu} position={[0, 0, -s * (PANEL_L * 0.5 + 0.02)]}>
                  <boxGeometry args={[0.16, 0.1, 0.14]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* ---------------- white radiator panels (near center) ------------- */}
      {[-0.85, 0.05, 0.95].map((x, i) => (
        <mesh key={i} material={rad} position={[x, 0.62, 0]} rotation={[0.14, 0, 0]}>
          <boxGeometry args={[0.8, 0.86, 0.02]} />
        </mesh>
      ))}

      {/* ---------------- central pressurized module knot ---------------- */}
      <group position={[0, -0.36, 0]}>
        {/* core lab + fore/aft labs along Z */}
        <mesh material={white} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 1.5, 20]} />
        </mesh>
        <mesh material={white} position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 1.1, 20]} />
        </mesh>
        <mesh material={white} position={[0, 0, -1.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 1.1, 20]} />
        </mesh>
        {/* fore & aft nodes + docking adapters */}
        <mesh material={white} position={[0, 0, 1.98]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.46, 16]} />
        </mesh>
        <mesh material={alu} position={[0, 0, 2.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.2, 0.22, 14]} />
        </mesh>
        <mesh material={white} position={[0, 0, -1.98]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.46, 16]} />
        </mesh>
        {/* cross module along X (port/starboard) at the mid node */}
        <mesh material={white} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 1.7, 20]} />
        </mesh>
        <mesh material={white} position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 0.5, 16]} />
        </mesh>
        <mesh material={white} position={[-1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 0.5, 16]} />
        </mesh>
        {/* cupola on the nadir side */}
        <mesh material={alu} position={[0, -0.34, 0.25]}>
          <cylinderGeometry args={[0.16, 0.2, 0.16, 12]} />
        </mesh>
        <mesh material={white} position={[0, -0.44, 0.25]}>
          <sphereGeometry args={[0.15, 14, 10]} />
        </mesh>
        {/* gold thermal-blanket accents */}
        <mesh material={gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.405, 0.405, 0.12, 20]} />
        </mesh>
        <mesh material={gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.6]}>
          <cylinderGeometry args={[0.405, 0.405, 0.12, 20]} />
        </mesh>
        <mesh material={gold} rotation={[0, 0, Math.PI / 2]} position={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.305, 0.305, 0.1, 20]} />
        </mesh>
      </group>
      {/* strut connecting the module knot up to the truss */}
      <mesh material={alu} position={[0, -0.06, 0]}>
        <boxGeometry args={[0.4, 0.36, 0.3]} />
      </mesh>

      {/* ---------------- Canadarm2 (segmented) ---------------- */}
      <group position={[0.7, 0.02, 0.3]}>
        <mesh material={white}><boxGeometry args={[0.09, 0.09, 0.09]} /></mesh>
        <mesh material={white} position={[0.18, 0.2, 0.06]} rotation={[0, 0.4, 1.0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.72, 10]} />
        </mesh>
        <mesh material={white} position={[0.5, 0.34, 0.26]} rotation={[0, 1.0, 0.5]}>
          <cylinderGeometry args={[0.034, 0.034, 0.6, 10]} />
        </mesh>
        <mesh material={alu} position={[0.74, 0.42, 0.46]}>
          <boxGeometry args={[0.07, 0.07, 0.09]} />
        </mesh>
      </group>

      {/* ---------------- antennas / dishes ---------------- */}
      <group position={[-0.8, 0.3, 0.25]} rotation={[0.7, 0.3, 0]}>
        <mesh material={dish}>
          <cylinderGeometry args={[0.22, 0.05, 0.13, 16, 1, true]} />
        </mesh>
        <mesh material={alu} position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
        </mesh>
      </group>
      <mesh material={alu} position={[1.1, 0.26, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.44, 6]} />
      </mesh>

      {/* ---------------- blinking nav lights ---------------- */}
      <mesh position={[0, -0.36, 2.4]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[0] = m; }} color="#ffffff" transparent opacity={1} />
      </mesh>
      <mesh position={[-4.05, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[1] = m; }} color="#ff5a52" transparent opacity={1} />
      </mesh>
      <mesh position={[4.05, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial ref={(m) => { nav.current[2] = m; }} color="#5affa0" transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Segmented ISS photovoltaic texture: dark blue-black cells with copper/gold
 *  gridlines and busbars — reads warm copper/amber at distance, like the real
 *  arrays in NASA photography. */
function makePVTex(): THREE.CanvasTexture {
  const w = 48, h = 200;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#1c150c');
  grad.addColorStop(0.5, '#2a2011');
  grad.addColorStop(1, '#1c150c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // fine horizontal cell segmentation — bright copper edges
  ctx.strokeStyle = 'rgba(206,150,80,0.85)';
  ctx.lineWidth = 1;
  const rows = 44;
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // vertical busbars (brighter gold)
  ctx.strokeStyle = 'rgba(224,176,96,0.9)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= 4; i++) {
    const x = (i / 4) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
