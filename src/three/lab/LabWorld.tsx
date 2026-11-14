"use client";
// src/three/lab/LabWorld.tsx: the chemistry building you walk through between questions.
// A floor plan of 4 rooms around a cross-shaped hallway, seen from above at an angle (dollhouse cut-away: only the
// outer back walls are full height). WASD / arrows walk; the coach's next question lights up one room; walking into
// it (or Enter) calls onArrive, and the game zooms into that room's bench.
import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector3, type Group, type Mesh, type MeshStandardMaterial } from "three";
import {
  Bench, BigScale, Bookshelf, CH4, CO2, Desk, FumeHood, Glassware, LabWindow, MoleculeModel, PeriodicPoster, Plant, Poster,
  ReagentShelf, Sink, Stool, TitrationStand, WATER, Whiteboard,
} from "./LabProps";
import { signTexture } from "./textures";

export type RoomId = "mix" | "titration" | "balance" | "study";
type Rect = { x0: number; x1: number; z0: number; z1: number };
export type Room = Rect & { id: RoomId; name: string; sub: string; accent: string; floor: string; doorX: number; doorZ: number };

const H = 2.6; // full wall height
const LOW = 0.5; // cut-away wall height
const T = 0.15; // wall thickness
const DOOR = 2.0;

export const ROOMS: Room[] = [
  { id: "mix", name: "Mixing Lab", sub: "precipitates & gases", accent: "#E879F9", floor: "#E7E1F0", x0: -10, x1: -1.2, z0: -8, z1: -1.2, doorX: -5.6, doorZ: -1.2 },
  { id: "titration", name: "Titration Lab", sub: "acids & bases", accent: "#F472B6", floor: "#F3E3EA", x0: 1.2, x1: 10, z0: -8, z1: -1.2, doorX: 5.6, doorZ: -1.2 },
  { id: "balance", name: "Balance Lab", sub: "balancing equations", accent: "#22D3EE", floor: "#DDEDF2", x0: -10, x1: -1.2, z0: 1.2, z1: 8, doorX: -5.6, doorZ: 1.2 },
  { id: "study", name: "Study Room", sub: "number problems", accent: "#A3E635", floor: "#EEF2E3", x0: 1.2, x1: 10, z0: 1.2, z1: 8, doorX: 5.6, doorZ: 1.2 },
];
export const roomOf = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
const inside = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** Wall boxes (for drawing + collisions). Doors are gaps on the hallway side. */
function buildWalls() {
  const walls: { r: Rect; h: number }[] = [];
  const hx = (z: number, x0: number, x1: number, h: number, gapX?: number) => {
    if (gapX === undefined) return walls.push({ r: { x0, x1, z0: z - T / 2, z1: z + T / 2 }, h });
    walls.push({ r: { x0, x1: gapX - DOOR / 2, z0: z - T / 2, z1: z + T / 2 }, h });
    walls.push({ r: { x0: gapX + DOOR / 2, x1, z0: z - T / 2, z1: z + T / 2 }, h });
  };
  const vz = (x: number, z0: number, z1: number, h: number) => walls.push({ r: { x0: x - T / 2, x1: x + T / 2, z0, z1 }, h });
  for (const r of ROOMS) {
    const north = r.z0 < 0; // rooms above the hallway
    // Back (north) and left (west) outer walls are full height; everything else is a low cut-away wall.
    hx(r.z0, r.x0, r.x1, r.z0 === -8 ? H : LOW, north ? undefined : r.doorX);
    hx(r.z1, r.x0, r.x1, LOW, north ? r.doorX : undefined);
    vz(r.x0, r.z0, r.z1, r.x0 === -10 ? H : LOW);
    vz(r.x1, r.z0, r.z1, LOW);
  }
  // Hallway ends.
  hx(-8, -1.2, 1.2, H);
  hx(8, -1.2, 1.2, LOW);
  vz(-10, -1.2, 1.2, H);
  vz(10, -1.2, 1.2, LOW);
  return walls;
}
const WALLS = buildWalls();

/** Furniture footprints the player can't walk through (world coordinates). */
const SOLIDS: Rect[] = [
  // Mixing Lab
  { x0: -8.6, x1: -3.6, z0: -5.0, z1: -4.0 }, { x0: -9.9, x1: -9.3, z0: -6.8, z1: -2.2 }, { x0: -8.4, x1: -4.4, z0: -7.9, z1: -7.3 },
  // Titration Lab
  { x0: 2.8, x1: 7.8, z0: -5.0, z1: -4.0 }, { x0: 2.4, x1: 8.6, z0: -7.9, z1: -7.3 },
  // Balance Lab
  { x0: -6.3, x1: -4.9, z0: 3.9, z1: 5.1 }, { x0: -9.9, x1: -9.3, z0: 2.4, z1: 6.6 },
  // Study Room
  { x0: 2.6, x1: 4.0, z0: 3.2, z1: 4.5 }, { x0: 5.6, x1: 7.0, z0: 3.2, z1: 4.5 }, { x0: 2.6, x1: 4.0, z0: 5.6, z1: 6.9 }, { x0: 5.6, x1: 7.0, z0: 5.6, z1: 6.9 },
];

const R = 0.28; // player radius
function blocked(x: number, z: number) {
  if (x < -9.85 || x > 9.85 || z < -7.85 || z > 7.85) return true;
  const hit = (r: Rect) => x + R > r.x0 && x - R < r.x1 && z + R > r.z0 && z - R < r.z1;
  return WALLS.some((w) => hit(w.r)) || SOLIDS.some(hit);
}

// ---------------------------------------------------------------- the canvas

export type LabWorldProps = {
  /** The room the coach picked for the next question (lit up). */
  target: RoomId | null;
  done: RoomId[];
  locked?: RoomId[];
  onArrive: (room: RoomId) => void;
  coachLine?: string;
};

/** Where the player stands; kept between visits so you come back out where you went in. */
const PLAYER = { x: 0, z: 0, heading: Math.PI };

export function LabWorld(props: LabWorldProps) {
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ position: [9, 12, 11], fov: 38, near: 0.1, far: 80 }} gl={{ antialias: true }}>
        <color attach="background" args={["#141B33"]} />
        <hemisphereLight args={["#FFF7E6", "#3B2F4A", 0.75]} />
        <directionalLight position={[6, 14, 8]} intensity={1.3} color="#FFF4DD" />
        <ambientLight intensity={0.25} />
        <Building {...props} />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={24} blur={2.2} far={3} resolution={512} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.45} luminanceThreshold={0.6} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function Building({ target, done, locked = [], onArrive }: LabWorldProps) {
  return (
    <group>
      <Floors />
      {WALLS.map((w, i) => (
        <WallBox key={i} r={w.r} h={w.h} />
      ))}
      <MixRoom />
      <TitrationRoom />
      <BalanceRoom />
      <StudyRoom />
      <Hallway />
      {ROOMS.map((r) => (
        <DoorSign key={r.id} room={r} active={target === r.id} done={done.includes(r.id)} locked={locked.includes(r.id)} />
      ))}
      {target && <Guide room={roomOf(target)} />}
      <Player target={target} onArrive={onArrive} />
    </group>
  );
}

function Floors() {
  return (
    <group>
      {/* Hallway: warm wood planks */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color="#C08A5B" roughness={0.8} />
      </mesh>
      {Array.from({ length: 40 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-10 + i * 0.5, 0.003, 0]}>
          <planeGeometry args={[0.012, 16]} />
          <meshBasicMaterial color="#9C6B45" />
        </mesh>
      ))}
      {/* Room floors: pale lab tiles with a grid */}
      {ROOMS.map((r) => (
        <group key={r.id}>
          <mesh rotation-x={-Math.PI / 2} position={[(r.x0 + r.x1) / 2, 0.004, (r.z0 + r.z1) / 2]}>
            <planeGeometry args={[r.x1 - r.x0, r.z1 - r.z0]} />
            <meshStandardMaterial color={r.floor} roughness={0.55} />
          </mesh>
          <gridHelper args={[Math.max(r.x1 - r.x0, r.z1 - r.z0), Math.round(Math.max(r.x1 - r.x0, r.z1 - r.z0) / 0.6), "#C9C3D6", "#C9C3D6"]}
            position={[(r.x0 + r.x1) / 2, 0.006, (r.z0 + r.z1) / 2]} scale={[(r.x1 - r.x0) / Math.max(r.x1 - r.x0, r.z1 - r.z0), 1, (r.z1 - r.z0) / Math.max(r.x1 - r.x0, r.z1 - r.z0)]} />
        </group>
      ))}
      {/* Base slab edge */}
      <mesh position={[0, -0.17, 0]}>
        <boxGeometry args={[20.3, 0.3, 16.3]} />
        <meshStandardMaterial color="#2A2440" />
      </mesh>
    </group>
  );
}

function WallBox({ r, h }: { r: Rect; h: number }) {
  const full = h > 1;
  return (
    <mesh position={[(r.x0 + r.x1) / 2, h / 2, (r.z0 + r.z1) / 2]}>
      <boxGeometry args={[r.x1 - r.x0, h, r.z1 - r.z0]} />
      <meshStandardMaterial color={full ? "#E8E2D6" : "#D9CFBF"} roughness={0.9} />
    </mesh>
  );
}

// ---------------------------------------------------------------- rooms

function MixRoom() {
  return (
    <group>
      {/* Island bench with glassware, stools in front */}
      <Bench position={[-6.1, 0, -4.5]} length={5} depth={1} />
      <Glassware position={[-6.1, 0, -4.5]} width={4.4} seed={5} />
      {[-7.8, -6.6, -5.4, -4.2].map((x) => (
        <Stool key={x} position={[x, 0, -3.4]} />
      ))}
      {/* Back wall: reagent shelves + fume hood + periodic table */}
      <ReagentShelf position={[-7.4, 0, -7.6]} width={2.2} seed={2} />
      <FumeHood position={[-4.9, 0, -7.45]} />
      <PeriodicPoster position={[-2.8, 1.75, -7.9]} w={1.5} />
      {/* Left wall: window + sink */}
      <LabWindow position={[-9.9, 1.6, -5.6]} rotation={Math.PI / 2} />
      <Sink position={[-9.55, 0, -3.3]} rotation={Math.PI / 2} />
      <Plant position={[-9.4, 0, -7.4]} size={1.2} />
    </group>
  );
}

function TitrationRoom() {
  return (
    <group>
      <Bench position={[5.3, 0, -4.5]} length={5} depth={1} />
      <TitrationStand position={[4.0, 0, -4.5]} />
      <TitrationStand position={[6.6, 0, -4.5]} />
      <Glassware position={[5.3, 0, -4.4]} width={1.2} seed={11} />
      {[3.5, 4.7, 5.9, 7.1].map((x) => (
        <Stool key={x} position={[x, 0, -3.4]} />
      ))}
      <ReagentShelf position={[3.6, 0, -7.6]} width={2.2} seed={8} />
      <ReagentShelf position={[7.4, 0, -7.6]} width={2.2} seed={13} />
      <Poster position={[5.5, 1.8, -7.9]} title="pH" lines={["acid  0–6", "neutral  7", "base  8–14"]} band="#DB2777" />
      <Plant position={[9.4, 0, -7.4]} />
    </group>
  );
}

function BalanceRoom() {
  return (
    <group>
      <BigScale position={[-5.6, 0, 4.5]} />
      <MoleculeModel position={[-8.2, 0, 3.0]} atoms={WATER} />
      <MoleculeModel position={[-8.2, 0, 6.2]} atoms={CO2} />
      <MoleculeModel position={[-3.0, 0, 6.6]} atoms={CH4} />
      <Bench position={[-9.6, 0, 4.5]} rotation={Math.PI / 2} length={4} depth={0.6} />
      <Glassware position={[-9.6, 0, 4.5]} rotation={Math.PI / 2} width={3.4} seed={21} />
      <Plant position={[-2, 0, 7.4]} size={1.1} />
    </group>
  );
}

function StudyRoom() {
  return (
    <group>
      <Desk position={[3.3, 0, 3.7]} />
      <Desk position={[6.3, 0, 3.7]} />
      <Desk position={[3.3, 0, 6.1]} />
      <Desk position={[6.3, 0, 6.1]} />
      <Bookshelf position={[9.6, 0, 4.6]} rotation={-Math.PI / 2} />
      <Plant position={[9.3, 0, 7.4]} size={1.3} />
    </group>
  );
}

function Hallway() {
  return (
    <group>
      <Whiteboard position={[0, 1.6, -7.9]} lines={["Today:", "Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃", "CH₄ + 2O₂ → CO₂ + 2H₂O"]} />
      <Plant position={[-9.4, 0, 0]} size={1.3} />
      <Plant position={[0.7, 0, -7.4]} />
      <Poster position={[-9.9, 1.7, 0]} rotation={Math.PI / 2} title="Safety" lines={["Goggles on", "No food", "Virtual only!"]} band="#F59E0B" />
    </group>
  );
}

// ---------------------------------------------------------------- signs, guide, player

function DoorSign({ room, active, done, locked }: { room: Room; active: boolean; done: boolean; locked: boolean }) {
  const map = useMemo(
    () => signTexture(`${done ? "✓ " : ""}${room.name}`, locked ? "opening soon" : room.sub, done ? "#A3E635" : room.accent),
    [room, done, locked],
  );
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = ref.current.material as MeshStandardMaterial;
    m.emissiveIntensity = active ? 0.55 + Math.sin(clock.elapsedTime * 4) * 0.25 : 0.25;
    ref.current.position.y = 2.15 + (active ? Math.sin(clock.elapsedTime * 2) * 0.06 : 0);
  });
  // Faces the camera direction (camera sits at +x +z).
  return (
    <mesh ref={ref} position={[room.doorX, 2.15, room.doorZ]} rotation={[-0.35, Math.PI / 4, 0]}>
      <planeGeometry args={[2.2, 0.55]} />
      <meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.3} transparent opacity={locked ? 0.6 : 1} />
    </mesh>
  );
}

/** Glowing ring in the target doorway + a light beam. */
function Guide({ room }: { room: Room }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
    ring.current.scale.set(s, s, 1);
  });
  return (
    <group position={[room.doorX, 0, room.doorZ]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.55, 0.75, 40]} />
        <meshBasicMaterial color={room.accent} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 2.4, 32, 1, true]} />
        <meshBasicMaterial color={room.accent} transparent opacity={0.12} side={2} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} color={room.accent} intensity={4} distance={4} />
    </group>
  );
}

const KEYS: Record<string, [number, number]> = {
  w: [-1, -1], arrowup: [-1, -1], s: [1, 1], arrowdown: [1, 1], a: [-1, 1], arrowleft: [-1, 1], d: [1, -1], arrowright: [1, -1],
};

function Player({ target, onArrive }: { target: RoomId | null; onArrive: (room: RoomId) => void }) {
  const body = useRef<Group>(null);
  const legs = useRef<[Group | null, Group | null]>([null, null]);
  const held = useRef(new Set<string>());
  const arrived = useRef(false);
  const inTarget = useRef(0);
  const { camera } = useThree();
  const look = useMemo(() => new Vector3(), []);
  const live = useRef({ target, onArrive });
  useEffect(() => {
    live.current = { target, onArrive };
    arrived.current = false;
    inTarget.current = 0;
  }, [target, onArrive]);

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.tagName === "INPUT";
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (KEYS[k]) {
        held.current.add(k);
        e.preventDefault();
      }
      // Enter: walk straight in (demo speed).
      if (k === "enter" && live.current.target && !arrived.current) {
        const r = roomOf(live.current.target);
        PLAYER.x = r.doorX;
        PLAYER.z = r.doorZ + (r.z0 < 0 ? -1.2 : 1.2);
        arrived.current = true;
        live.current.onArrive(live.current.target);
      }
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase());
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    let dx = 0, dz = 0;
    held.current.forEach((k) => {
      dx += KEYS[k][0];
      dz += KEYS[k][1];
    });
    const len = Math.hypot(dx, dz);
    const moving = len > 0;
    if (moving) {
      const speed = 3.4 * dt;
      const nx = PLAYER.x + (dx / len) * speed;
      const nz = PLAYER.z + (dz / len) * speed;
      if (!blocked(nx, PLAYER.z)) PLAYER.x = nx;
      if (!blocked(PLAYER.x, nz)) PLAYER.z = nz;
      const want = Math.atan2(dx, dz);
      let d = want - PLAYER.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      PLAYER.heading += d * Math.min(1, dt * 12);
    }
    const b = body.current;
    if (b) {
      b.position.set(PLAYER.x, moving ? Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.05 : 0, PLAYER.z);
      b.rotation.y = PLAYER.heading;
      const swing = moving ? Math.sin(clock.elapsedTime * 10) * 0.5 : 0;
      if (legs.current[0]) legs.current[0].rotation.x = swing;
      if (legs.current[1]) legs.current[1].rotation.x = -swing;
    }
    // Camera follows from above at an angle (stays inside the building's view).
    const cx = MathUtils.clamp(PLAYER.x, -5, 5), cz = MathUtils.clamp(PLAYER.z, -4, 4);
    camera.position.lerp(look.set(cx + 8, 11, cz + 10), Math.min(1, dt * 3));
    camera.lookAt(cx * 0.9, 0, cz * 0.9);

    // Arrive: inside the target room for 0.3 s.
    const L = live.current;
    if (!L.target || arrived.current) return;
    if (inside(roomOf(L.target), PLAYER.x, PLAYER.z)) {
      inTarget.current += dt;
      if (inTarget.current > 0.3) {
        arrived.current = true;
        L.onArrive(L.target);
      }
    } else inTarget.current = 0;
  });

  // A student in a lab coat (big friendly proportions so it reads from far away).
  return (
    <group ref={body}>
      {[-0.1, 0.1].map((x, i) => (
        <group key={x} position={[x, 0.55, 0]} ref={(el) => void (legs.current[i] = el)}>
          <mesh position={[0, -0.27, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.55, 10]} />
            <meshStandardMaterial color="#1E3A8A" />
          </mesh>
          <mesh position={[0, -0.55, 0.05]}>
            <boxGeometry args={[0.13, 0.08, 0.22]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.2, 0.28, 0.85, 16]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.6} />
      </mesh>
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} position={[x, 0.98, 0]} rotation-z={x > 0 ? 0.15 : -0.15}>
          <cylinderGeometry args={[0.06, 0.06, 0.6, 10]} />
          <meshStandardMaterial color="#F1F5F9" />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.22, 20, 16]} />
        <meshStandardMaterial color="#C68B59" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.65, -0.03]}>
        <sphereGeometry args={[0.23, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1F1A17" roughness={0.8} />
      </mesh>
      {/* safety goggles */}
      <mesh position={[0, 1.58, 0.19]}>
        <boxGeometry args={[0.3, 0.08, 0.06]} />
        <meshStandardMaterial color="#38BDF8" transparent opacity={0.7} emissive="#38BDF8" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
