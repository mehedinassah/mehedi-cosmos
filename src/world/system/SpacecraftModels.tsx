'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { ISSModel } from '@/world/system/ISSModel';
import type { Kind } from '@/state/earthHoverStore';

/**
 * Low-poly spacecraft for Earth's orbital ecosystem. Each kind has a distinct,
 * recognizable silhouette. Bodies are lit white/metal (MeshStandard); solar
 * panels are UNLIT deep blue (MeshBasic + toneMapped:false) because the scene's
 * decay-free sun would otherwise wash any lit panel to white — same lesson as
 * the ISS. Authored in unit space; the ecosystem scales each to size.
 */

function makePanelTex(): THREE.CanvasTexture {
  const w = 80, h = 56;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#22447f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(10,20,44,0.6)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo((i / 10) * w, 0); ctx.lineTo((i / 10) * w, h); ctx.stroke(); }
  for (let j = 1; j < 3; j++) { ctx.beginPath(); ctx.moveTo(0, (j / 3) * h); ctx.lineTo(w, (j / 3) * h); ctx.stroke(); }
  ctx.fillStyle = 'rgba(150,120,55,0.45)';
  ctx.fillRect(0, h / 2 - 1, w, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function useKit() {
  return useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: '#d3d7df', metalness: 0.35, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: '#8b929c', metalness: 0.5, roughness: 0.45 });
    const gold = new THREE.MeshStandardMaterial({ color: '#c7a24d', metalness: 0.6, roughness: 0.42 });
    const worn = new THREE.MeshStandardMaterial({ color: '#b7bcc4', metalness: 0.3, roughness: 0.68 });
    // real photovoltaic-cell look, unlit so the intense sun can't wash it white
    const panel = new THREE.MeshBasicMaterial({ map: makePanelTex(), toneMapped: false, side: THREE.DoubleSide });
    const dishMat = new THREE.MeshStandardMaterial({ color: '#e7ebf1', metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide });
    return { body, dark, gold, worn, panel, dishMat };
  }, []);
}

/** A boxy comms-satellite bus with two solar wings and one or two dishes. */
function CommSat({ dishes = 1 }: { dishes?: number }) {
  const k = useKit();
  return (
    <group>
      <mesh material={k.body}>
        <boxGeometry args={[0.36, 0.4, 0.52]} />
      </mesh>
      <mesh material={k.gold} position={[0, 0, 0.27]}>
        <boxGeometry args={[0.3, 0.34, 0.04]} />
      </mesh>
      {/* wings */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.55, 0, 0]}>
          <mesh material={k.dark}>
            <boxGeometry args={[0.5, 0.02, 0.02]} />
          </mesh>
          <mesh material={k.panel} position={[s * 0.55, 0, 0]}>
            <boxGeometry args={[0.72, 0.5, 0.014]} />
          </mesh>
        </group>
      ))}
      {/* dish(es) on the nadir/forward face */}
      {Array.from({ length: dishes }).map((_, i) => (
        <group key={i} position={[dishes === 1 ? 0 : (i === 0 ? -0.12 : 0.12), -0.26, 0.06]} rotation={[Math.PI * 0.5, 0, 0]}>
          <mesh material={k.dishMat}>
            <cylinderGeometry args={[0.16, 0.05, 0.12, 16, 1, true]} />
          </mesh>
          <mesh material={k.dark} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.16, 6]} />
          </mesh>
        </group>
      ))}
      {/* antenna whip */}
      <mesh material={k.dark} position={[0, 0.32, -0.1]}>
        <cylinderGeometry args={[0.008, 0.008, 0.34, 6]} />
      </mesh>
      <mesh position={[0, 0.5, -0.1]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#ff6a60" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A tiny CubeSat with two small deployed panels and a whip antenna. */
function CubeSat() {
  const k = useKit();
  return (
    <group>
      <mesh material={k.body}>
        <boxGeometry args={[0.26, 0.26, 0.38]} />
      </mesh>
      <mesh material={k.gold} position={[0, 0.135, 0]}>
        <boxGeometry args={[0.2, 0.02, 0.3]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={k.panel} position={[s * 0.33, 0, 0]} rotation={[0, 0, s * 0.12]}>
          <boxGeometry args={[0.38, 0.24, 0.01]} />
        </mesh>
      ))}
      <mesh material={k.dark} position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.34, 6]} />
      </mesh>
    </group>
  );
}

/** An Earth-observation / weather bird: one big asymmetric wing + a scan drum. */
function WeatherSat() {
  const k = useKit();
  return (
    <group>
      <mesh material={k.body}>
        <boxGeometry args={[0.36, 0.42, 0.6]} />
      </mesh>
      <mesh material={k.gold} position={[0, 0, 0.31]}>
        <boxGeometry args={[0.3, 0.34, 0.03]} />
      </mesh>
      {/* single long solar wing (one side only, like real EO sats) */}
      <mesh material={k.dark} position={[0.5, 0, 0]}>
        <boxGeometry args={[0.7, 0.02, 0.02]} />
      </mesh>
      <mesh material={k.panel} position={[1.05, 0, 0]}>
        <boxGeometry args={[0.66, 0.56, 0.014]} />
      </mesh>
      {/* nadir scanning drum */}
      <mesh material={k.worn} position={[0, -0.3, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.18, 16]} />
      </mesh>
      <mesh material={k.dark} position={[0, -0.42, 0.1]}>
        <sphereGeometry args={[0.06, 12, 8]} />
      </mesh>
      {/* boom radiator */}
      <mesh material={k.worn} position={[-0.34, 0.18, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.28, 0.34, 0.01]} />
      </mesh>
    </group>
  );
}

/** A plain navigation satellite (GPS-style): boxy bus, two panels, nadir array. */
function GpsSat() {
  const k = useKit();
  return (
    <group>
      <mesh material={k.worn}>
        <boxGeometry args={[0.34, 0.34, 0.44]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={k.panel} position={[s * 0.62, 0, 0]}>
          <boxGeometry args={[0.66, 0.4, 0.012]} />
        </mesh>
      ))}
      <mesh material={k.dark} position={[0, -0.24, 0]}>
        <boxGeometry args={[0.26, 0.08, 0.32]} />
      </mesh>
    </group>
  );
}

/** A Starlink-style flat-pack: one flat blue panel with a small bus edge. */
function Starlink() {
  const k = useKit();
  return (
    <group>
      <mesh material={k.panel}>
        <boxGeometry args={[0.5, 0.9, 0.012]} />
      </mesh>
      <mesh material={k.dark} position={[0, -0.5, 0]}>
        <boxGeometry args={[0.42, 0.12, 0.08]} />
      </mesh>
    </group>
  );
}

/** A space telescope: a tube with an aperture, a sunshade and small panels. */
function Telescope() {
  const k = useKit();
  return (
    <group>
      <mesh material={k.worn} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.66, 18]} />
      </mesh>
      {/* aperture ring at the front */}
      <mesh material={k.dark} position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 18, 1, true]} />
      </mesh>
      <mesh material={k.dark} position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.15, 18]} />
      </mesh>
      {/* gold sunshade underneath */}
      <mesh material={k.gold} position={[0, -0.22, 0]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.5, 0.01, 0.6]} />
      </mesh>
      {/* two small panels */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={k.panel} position={[s * 0.34, 0, -0.06]}>
          <boxGeometry args={[0.3, 0.34, 0.01]} />
        </mesh>
      ))}
      {/* high-gain antenna */}
      <mesh material={k.dishMat} position={[0.16, 0.2, -0.2]} rotation={[1.1, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.03, 0.08, 14, 1, true]} />
      </mesh>
    </group>
  );
}

/** A small, distant moon. */
function Moon() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#bdb9af', roughness: 0.96, metalness: 0.02 }), []);
  return (
    <mesh material={mat}>
      <sphereGeometry args={[0.5, 24, 20]} />
    </mesh>
  );
}

/** A little tumbling debris fragment — a torn panel piece on a bent strut. */
function DebrisChunk() {
  const k = useKit();
  return (
    <group rotation={[0.5, 0.9, 0.2]}>
      {/* torn solar-panel shard */}
      <mesh material={k.panel} rotation={[0.2, 0.4, 0.15]}>
        <boxGeometry args={[0.34, 0.22, 0.01]} />
      </mesh>
      {/* bent strut */}
      <mesh material={k.dark} position={[-0.18, 0.02, 0.04]} rotation={[0, 0, 0.7]}>
        <cylinderGeometry args={[0.02, 0.02, 0.34, 6]} />
      </mesh>
      {/* small crumpled node */}
      <mesh material={k.worn} position={[-0.28, -0.1, 0.02]}>
        <icosahedronGeometry args={[0.08, 0]} />
      </mesh>
    </group>
  );
}

/** Dispatcher: render the right model for a craft kind. */
export function Spacecraft({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'iss': return <ISSModel />;
    case 'commsat': return <CommSat dishes={1} />;
    case 'freelancer': return <CommSat dishes={2} />;
    case 'cubesat': return <CubeSat />;
    case 'weathersat': return <WeatherSat />;
    case 'telescope': return <Telescope />;
    case 'gps': return <GpsSat />;
    case 'moon': return <Moon />;
    case 'shootingsat': return <CubeSat />;
    case 'debris': return <DebrisChunk />;
    default: return null;
  }
}
