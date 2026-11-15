"use client";
// src/three/lab/LabWorld.tsx: the chemistry building you walk through between questions.
// A floor plan of 4 rooms around a cross-shaped hallway, seen from above at an angle (dollhouse cut-away: only the
// outer back walls are full height). Furniture = the Meshy models in public/models/lab; glassware, liquids and
// molecules stay in code (they change colour live). WASD / arrows walk; the coach's next question lights up one
// room; walking into it (or Enter) calls onArrive, and the game zooms into that room's bench.
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector3, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { CH4, CO2, Glass, LabWindow, MoleculeModel, PeriodicPoster, Poster, WATER, Whiteboard } from "./LabProps";
import { Model, preloadLabModels } from "./Model";
import { WorldAnchor } from "../WorldLabels";
import { plankTexture, signTexture, tileTexture } from "./textures";

export type RoomId = "mix" | "titration" | "balance" | "study";
type Rect = { x0: number; x1: number; z0: number; z1: number };
export type Room = Rect & { id: RoomId; name: string; sub: string; accent: string; tile: [string, string]; doorX: number; doorZ: number };

const H = 2.8; // full wall height
const LOW = 0.45; // cut-away wall height
const T = 0.18; // wall thickness
const DOOR = 2.0;

export const ROOMS: Room[] = [
  { id: "mix", name: "Inorganic Chemistry", sub: "water · salts · reactions", accent: "#E879F9", tile: ["#E4DAF0", "#B9A8D3"], x0: -10, x1: -1.2, z0: -8, z1: -1.2, doorX: -5.6, doorZ: -1.2 },
  { id: "titration", name: "Acids & Bases", sub: "pH · indicators · fizz", accent: "#F472B6", tile: ["#F3DCE6", "#D9A9BF"], x0: 1.2, x1: 10, z0: -8, z1: -1.2, doorX: 5.6, doorZ: -1.2 },
  { id: "balance", name: "Organic Chemistry", sub: "carbon molecules", accent: "#22D3EE", tile: ["#D6EBF1", "#9FC8D6"], x0: -10, x1: -1.2, z0: 1.2, z1: 8, doorX: -5.6, doorZ: 1.2 },
  { id: "study", name: "Experiments Lab", sub: "volcano · fizz · foam", accent: "#A3E635", tile: ["#E8EDD3", "#BFC99A"], x0: 1.2, x1: 10, z0: 1.2, z1: 8, doorX: 5.6, doorZ: 1.2 },
];
export const roomOf = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
const inside = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

if (typeof window !== "undefined") preloadLabModels();

/** Wall boxes (drawing + collisions). Doors are gaps on the hallway side. */
function buildWalls() {
  const walls: { r: Rect; h: number }[] = [];
  const hx = (z: number, x0: number, x1: number, h: number, gapX?: number) => {
    if (gapX === undefined) return walls.push({ r: { x0, x1, z0: z - T / 2, z1: z + T / 2 }, h });
    walls.push({ r: { x0, x1: gapX - DOOR / 2, z0: z - T / 2, z1: z + T / 2 }, h });
    walls.push({ r: { x0: gapX + DOOR / 2, x1, z0: z - T / 2, z1: z + T / 2 }, h });
  };
  const vz = (x: number, z0: number, z1: number, h: number) => walls.push({ r: { x0: x - T / 2, x1: x + T / 2, z0, z1 }, h });
  for (const r of ROOMS) {
    const north = r.z0 < 0;
    hx(r.z0, r.x0, r.x1, r.z0 === -8 ? H : LOW, north ? undefined : r.doorX);
    hx(r.z1, r.x0, r.x1, LOW, north ? r.doorX : undefined);
    vz(r.x0, r.z0, r.z1, r.x0 === -10 ? H : LOW);
    vz(r.x1, r.z0, r.z1, LOW);
  }
  hx(-8, -1.2, 1.2, H);
  hx(8, -1.2, 1.2, LOW);
  vz(-10, -1.2, 1.2, H);
  vz(10, -1.2, 1.2, LOW);
  return walls;
}
const WALLS = buildWalls();

/** Furniture footprints (world coordinates) the student can't walk through. */
const box = (x: number, z: number, w: number, d: number): Rect => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const SOLIDS: Rect[] = [
  // Mixing Lab: 2 islands, back-wall row, sink
  box(-7.6, -4.6, 2.05, 2.05), box(-3.6, -4.6, 2.05, 2.05), { x0: -10, x1: -1.2, z0: -8, z1: -6.95 },
  // Titration Lab
  box(3.6, -4.6, 2.05, 2.05), box(7.6, -4.6, 2.05, 2.05), { x0: 1.2, x1: 10, z0: -8, z1: -6.95 },
  // Balance Lab
  box(-5.6, 4.9, 2.05, 2.05), box(-9.6, 4.6, 0.6, 1.5), box(-8.4, 2.9, 0.5, 0.5), box(-8.4, 6.7, 0.5, 0.5), box(-2.7, 6.7, 0.5, 0.5),
  // Study Room desks + shelf
  box(3.4, 4.0, 1.3, 1.0), box(6.4, 4.0, 1.3, 1.0), box(3.4, 6.4, 1.3, 1.0), box(6.4, 6.4, 1.3, 1.0), box(9.6, 4.6, 0.6, 1.5),
];
const R = 0.3;
function blocked(x: number, z: number) {
  if (x < -9.8 || x > 9.8 || z < -7.8 || z > 7.8) return true;
  const hit = (r: Rect) => x + R > r.x0 && x - R < r.x1 && z + R > r.z0 && z - R < r.z1;
  return WALLS.some((w) => hit(w.r)) || SOLIDS.some(hit);
}

// ---------------------------------------------------------------- canvas

export type LabWorldProps = {
  target: RoomId | null;
  done: RoomId[];
  locked?: RoomId[];
  onArrive: (room: RoomId) => void;
  /** Walk there by himself (no keys needed): hallway → doorway → inside the room. */
  autoWalk?: boolean;
};

/** Where the student stands; kept between visits. */
const PLAYER = { x: 0, z: 0, heading: Math.PI };

export function LabWorld(props: LabWorldProps) {
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, #3A3160 0%, #1A1530 75%)" }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [8, 10, 10], fov: 34, near: 0.1, far: 80 }} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={["#FFF4E0", "#5B4B7A", 0.45]} />
        <directionalLight
          castShadow
          position={[7, 14, 6]}
          intensity={2.6}
          color="#FFF1DA"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
        />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={1.6} position={[0, 8, 6]} scale={[18, 6, 1]} color="#FFF1DA" />
          <Lightformer form="rect" intensity={0.8} position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[12, 4, 1]} color="#C4B5FD" />
          <Lightformer form="rect" intensity={0.8} position={[10, 4, 0]} rotation-y={-Math.PI / 2} scale={[12, 4, 1]} color="#FBCFE8" />
        </Environment>
        <Suspense fallback={null}>
          <Building {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Building({ target, done, locked = [], onArrive, autoWalk = false }: LabWorldProps) {
  return (
    <group>
      <Floors />
      {WALLS.map((w, i) => (
        <WallBox key={i} r={w.r} h={w.h} />
      ))}
      <Doors />
      <MixRoom />
      <TitrationRoom />
      <BalanceRoom />
      <StudyRoom />
      <Hallway />
      {ROOMS.map((r) => (
        <DoorSign key={r.id} room={r} active={target === r.id} done={done.includes(r.id)} locked={locked.includes(r.id)} />
      ))}
      {target && <Guide room={roomOf(target)} />}
      <Player target={target} onArrive={onArrive} autoWalk={autoWalk} />
    </group>
  );
}

function Floors() {
  const planks = useMemo(() => {
    const t = plankTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(6, 5);
    return t;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial map={planks} roughness={0.75} />
      </mesh>
      {ROOMS.map((r) => (
        <RoomFloor key={r.id} r={r} />
      ))}
      {/* Base slab, so the building floats like a diorama */}
      <mesh position={[0, -0.26, 0]} receiveShadow>
        <boxGeometry args={[20.4, 0.5, 16.4]} />
        <meshStandardMaterial color="#4A3F66" roughness={0.9} />
      </mesh>
    </group>
  );
}

function RoomFloor({ r }: { r: Room }) {
  const map = useMemo(() => {
    const t = tileTexture(r.tile[0], r.tile[1]).clone();
    t.needsUpdate = true;
    t.repeat.set((r.x1 - r.x0) / 2.4, (r.z1 - r.z0) / 2.4);
    return t;
  }, [r]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(r.x0 + r.x1) / 2, 0.005, (r.z0 + r.z1) / 2]} receiveShadow>
      <planeGeometry args={[r.x1 - r.x0, r.z1 - r.z0]} />
      <meshStandardMaterial map={map} roughness={0.5} />
    </mesh>
  );
}

function WallBox({ r, h }: { r: Rect; h: number }) {
  const full = h > 1;
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  return (
    <group position={[(r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={full ? "#F3EBDD" : "#E7DCC9"} roughness={0.95} />
      </mesh>
      {/* wooden cap on low walls, skirting on full walls */}
      <mesh position={[0, full ? 0.07 : h + 0.02, 0]}>
        <boxGeometry args={[w + 0.02, full ? 0.14 : 0.05, d + 0.02]} />
        <meshStandardMaterial color="#B07A4C" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** An open classroom door beside each doorway (swung into the room). */
function Doors() {
  return (
    <>
      {ROOMS.map((r) => {
        const north = r.z0 < 0;
        return <Model key={r.id} name="ClassroomDoor" position={[r.doorX - DOOR / 2 + 0.1, 0, r.doorZ + (north ? -0.55 : 0.55)]} rotation={Math.PI / 2} />;
      })}
    </>
  );
}

// ---------------------------------------------------------------- rooms

/** A few code-drawn beakers/flasks on a table top (their colours can change live). */
function TableGlass({ at, colors, y = 0.93 }: { at: [number, number]; colors: string[]; y?: number }) {
  return (
    <>
      {colors.map((c, i) => (
        <Glass key={i} kind={i % 3 === 1 ? "flask" : "beaker"} color={c} position={[at[0] - 0.5 + i * 0.35, y, at[1] + (i % 2 ? 0.25 : -0.2)]} />
      ))}
    </>
  );
}

function MixRoom() {
  return (
    <group>
      {/* Back wall row */}
      <Model name="FumeHoodCabinet" position={[-8.9, 0, -7.45]} />
      <Model name="ChemicalBottleShelf" position={[-7.5, 0, -7.65]} />
      <Model name="ChemicalBottleShelf" position={[-6.45, 0, -7.65]} />
      <Model name="LabSinkCounter" position={[-5.0, 0, -7.55]} />
      <Model name="FumeHoodCabinet" position={[-3.4, 0, -7.45]} />
      <Model name="WallClock" position={[-5.0, 2.05, -7.88]} />
      <PeriodicPoster position={[-2.0, 1.8, -7.88]} w={1.1} />
      <LabWindow position={[-9.88, 1.65, -4.6]} rotation={Math.PI / 2} />
      {/* Islands */}
      <Model name="SquareIslandLabTable" position={[-7.6, 0, -4.6]} />
      <Model name="SquareIslandLabTable" position={[-3.6, 0, -4.6]} />
      <Model name="BunsenBurner" position={[-7.9, 0.92, -4.9]} />
      <Model name="TestTubeRack" position={[-7.2, 0.92, -4.1]} />
      <Model name="DropperBottlesSet" position={[-3.1, 0.92, -4.2]} />
      <Model name="SchoolMicroscope" position={[-4.1, 0.92, -5.1]} />
      <TableGlass at={[-3.6, -4.5]} colors={["#FFD21F", "#60A5FA", "#F8FAFC"]} />
      <TableGlass at={[-7.5, -5.2]} colors={["#7EB8D8", "#F472B6"]} />
      {/* Stools */}
      {[-8.2, -7.0, -4.2, -3.0].map((x) => (
        <Model key={x} name="RoundLabStool" position={[x, 0, -3.15]} />
      ))}
      <Model name="PottedMonsteraPlant" position={[-9.3, 0, -1.9]} />
    </group>
  );
}

function TitrationRoom() {
  return (
    <group>
      <Model name="ChemicalBottleShelf" position={[1.9, 0, -7.65]} />
      <Model name="FumeHoodCabinet" position={[3.5, 0, -7.45]} />
      <Model name="LabSinkCounter" position={[5.3, 0, -7.55]} />
      <Model name="ChemicalBottleShelf" position={[6.6, 0, -7.65]} />
      <Model name="ScienceBookshelf" position={[8.4, 0, -7.6]} />
      <Poster position={[5.3, 2.05, -7.88]} title="pH" lines={["acid  0–6", "neutral  7", "base  8–14"]} band="#DB2777" />
      {[3.6, 7.6].map((x) => (
        <group key={x}>
          <Model name="SquareIslandLabTable" position={[x, 0, -4.6]} />
          <Model name="RetortStand" position={[x - 0.3, 0.92, -4.75]} />
          <Model name="MagneticStirrerHotPlate" position={[x - 0.15, 0.92, -4.6]} />
          <Glass kind="flask" color="#F472B6" position={[x - 0.15, 1.04, -4.6]} />
          <Model name="DropperBottlesSet" position={[x + 0.55, 0.92, -4.1]} />
        </group>
      ))}
      {[3.0, 4.2, 7.0, 8.2].map((x) => (
        <Model key={x} name="RoundLabStool" position={[x, 0, -3.15]} />
      ))}
      <Model name="PottedMonsteraPlant" position={[9.3, 0, -1.9]} />
    </group>
  );
}

function BalanceRoom() {
  return (
    <group>
      <Model name="SquareIslandLabTable" position={[-5.6, 0, 4.9]} />
      <Model name="BrassBalanceScale" position={[-5.6, 0.92, 4.9]} height={0.85} />
      <MoleculeModel position={[-8.4, 0, 2.9]} atoms={WATER} />
      <MoleculeModel position={[-8.4, 0, 6.7]} atoms={CO2} />
      <MoleculeModel position={[-2.7, 0, 6.7]} atoms={CH4} />
      <Model name="ScienceBookshelf" position={[-9.6, 0, 4.6]} rotation={Math.PI / 2} />
      <PeriodicPoster position={[-9.88, 1.9, 2.4]} rotation={Math.PI / 2} w={1.2} />
      <Model name="PottedMonsteraPlant" position={[-2.0, 0, 2.0]} />
    </group>
  );
}

function StudyRoom() {
  return (
    <group>
      {[[3.4, 4.0], [6.4, 4.0], [3.4, 6.4], [6.4, 6.4]].map(([x, z]) => (
        <Model key={`${x}${z}`} name="StudentDeskAndChair" position={[x, 0, z]} rotation={-Math.PI / 2} />
      ))}
      <Model name="SchoolMicroscope" position={[3.1, 0.72, 3.9]} height={0.32} />
      <Model name="ScienceBookshelf" position={[9.6, 0, 4.6]} rotation={-Math.PI / 2} />
      <Model name="PottedMonsteraPlant" position={[9.2, 0, 7.3]} />
    </group>
  );
}

function Hallway() {
  return (
    <group>
      <Whiteboard position={[0, 1.65, -7.88]} lines={["Today:", "Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃", "CH₄ + 2O₂ → CO₂ + 2H₂O"]} />
      <Model name="WallClock" position={[0, 2.45, -7.88]} height={0.4} />
      <Poster position={[-9.88, 1.7, 0]} rotation={Math.PI / 2} title="Safety" lines={["Goggles on", "No food", "Virtual only!"]} band="#F59E0B" />
      <Model name="PottedMonsteraPlant" position={[-0.6, 0, -7.3]} height={1.1} />
    </group>
  );
}

// ---------------------------------------------------------------- signs, guide, student

function DoorSign({ room, active, done, locked }: { room: Room; active: boolean; done: boolean; locked: boolean }) {
  const map = useMemo(
    () => signTexture(`${done ? "✓ " : ""}${room.name}`, locked ? "opening soon" : room.sub, done ? "#A3E635" : room.accent),
    [room, done, locked],
  );
  const ref = useRef<Mesh>(null);
  useFrame(({ clock, camera }) => {
    if (!ref.current) return;
    const m = ref.current.material as MeshStandardMaterial;
    m.emissiveIntensity = active ? 0.6 + Math.sin(clock.elapsedTime * 4) * 0.25 : 0.3;
    ref.current.position.y = 2.6 + (active ? Math.sin(clock.elapsedTime * 2) * 0.07 : 0);
    ref.current.quaternion.copy(camera.quaternion); // always faces you, however the lab is rotated
  });
  return (
    <mesh ref={ref} position={[room.doorX, 2.6, room.doorZ]}>
      <planeGeometry args={[2.3, 0.58]} />
      <meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.3} transparent opacity={locked ? 0.65 : 1} />
    </mesh>
  );
}

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
        <ringGeometry args={[0.55, 0.78, 48]} />
        <meshBasicMaterial color={room.accent} toneMapped={false} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 2.6, 40, 1, true]} />
        <meshBasicMaterial color={room.accent} transparent opacity={0.13} side={2} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color={room.accent} intensity={6} distance={5} />
    </group>
  );
}

/** Screen-relative moves: [forward, right]. Turned into world directions with the camera's yaw. */
const KEYS: Record<string, [number, number]> = {
  w: [1, 0], arrowup: [1, 0], s: [-1, 0], arrowdown: [-1, 0], a: [0, -1], arrowleft: [0, -1], d: [0, 1], arrowright: [0, 1],
};
/** Orbit camera: yaw (radians, 0 = looking from +z), distance. Drag / Q,E / wheel change it. */
const VIEW = { yaw: Math.atan2(8, 11), dist: 13.6, height: 11 };

/** Waypoints from where he stands to the middle of a room (hallway centre line → doorway → inside). */
function pathTo(r: Room): [number, number][] {
  const north = r.z0 < 0;
  const inZ = north ? r.doorZ - 2.2 : r.doorZ + 2.2;
  const pts: [number, number][] = [];
  if (Math.abs(PLAYER.z) > 0.6 && !inside(r, PLAYER.x, PLAYER.z)) pts.push([PLAYER.x, 0]); // back to the hallway line
  pts.push([r.doorX, 0], [r.doorX, r.doorZ], [r.doorX, inZ]);
  return pts;
}

function Player({ target, onArrive, autoWalk }: { target: RoomId | null; onArrive: (room: RoomId) => void; autoWalk: boolean }) {
  const body = useRef<Group>(null);
  const limbs = useRef<{ legs: (Group | null)[]; arms: (Group | null)[] }>({ legs: [], arms: [] });
  const shadow = useRef<Mesh>(null);
  const held = useRef(new Set<string>());
  const arrived = useRef(false);
  const inTarget = useRef(0);
  const { camera } = useThree();
  const tmp = useMemo(() => ({ pos: new Vector3(), look: new Vector3(PLAYER.x, 0.6, PLAYER.z) }), []);
  const live = useRef({ target, onArrive });
  const path = useRef<[number, number][]>([]);
  useEffect(() => {
    live.current = { target, onArrive };
    arrived.current = false;
    inTarget.current = 0;
    path.current = autoWalk && target ? pathTo(roomOf(target)) : [];
  }, [target, onArrive, autoWalk]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (KEYS[k]) {
        held.current.add(k);
        e.preventDefault();
      }
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
    // Rotate the building: drag with the mouse, Q/E keys; zoom with the wheel.
    let drag: number | null = null;
    const pd = (e: PointerEvent) => void (drag = e.clientX);
    const pm = (e: PointerEvent) => {
      if (drag === null) return;
      VIEW.yaw -= (e.clientX - drag) * 0.006;
      drag = e.clientX;
    };
    const pu = () => void (drag = null);
    const wheel = (e: WheelEvent) => {
      VIEW.dist = MathUtils.clamp(VIEW.dist + e.deltaY * 0.01, 7, 22);
      VIEW.height = VIEW.dist * 0.8;
    };
    const rot = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "q") VIEW.yaw += 0.12;
      if (k === "e") VIEW.yaw -= 0.12;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keydown", rot);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keydown", rot);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      window.removeEventListener("wheel", wheel);
    };
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    // Forward = away from the camera on the floor; right = screen right.
    const fx = -Math.sin(VIEW.yaw), fz = -Math.cos(VIEW.yaw);
    let dx = 0, dz = 0;
    held.current.forEach((k) => {
      const [f, r] = KEYS[k];
      dx += f * fx + r * -fz;
      dz += f * fz + r * fx;
    });
    // Auto-walk along the waypoints (keys ignored while he walks by himself).
    const wp = path.current[0];
    if (wp) {
      dx = wp[0] - PLAYER.x;
      dz = wp[1] - PLAYER.z;
      if (Math.hypot(dx, dz) < 0.15) {
        path.current.shift();
        dx = dz = 0;
        if (!path.current.length && live.current.target && !arrived.current) {
          arrived.current = true;
          live.current.onArrive(live.current.target);
        }
      }
    }
    const len = Math.hypot(dx, dz);
    const moving = len > 0;
    if (moving) {
      const step = 3.2 * dt;
      const nx = PLAYER.x + (dx / len) * step;
      const nz = PLAYER.z + (dz / len) * step;
      if (wp || !blocked(nx, PLAYER.z)) PLAYER.x = nx;
      if (wp || !blocked(PLAYER.x, nz)) PLAYER.z = nz;
      let d = Math.atan2(dx, dz) - PLAYER.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      PLAYER.heading += d * Math.min(1, dt * 12);
    }
    const t = clock.elapsedTime;
    const b = body.current;
    if (b) {
      b.position.set(PLAYER.x, moving ? Math.abs(Math.sin(t * 11)) * 0.06 : Math.sin(t * 2) * 0.01, PLAYER.z);
      b.rotation.y = PLAYER.heading;
      const swing = moving ? Math.sin(t * 11) * 0.6 : 0;
      limbs.current.legs.forEach((l, i) => l && (l.rotation.x = i ? -swing : swing));
      limbs.current.arms.forEach((a, i) => a && (a.rotation.x = i ? swing * 0.8 : -swing * 0.8));
    }
    if (shadow.current) shadow.current.position.set(PLAYER.x, 0.02, PLAYER.z);
    // Camera: smooth follow from above at an angle, framed on the student.
    const cx = MathUtils.clamp(PLAYER.x, -6, 6), cz = MathUtils.clamp(PLAYER.z, -5, 5);
    camera.position.lerp(tmp.pos.set(cx + Math.sin(VIEW.yaw) * VIEW.dist * 0.8, VIEW.height, cz + Math.cos(VIEW.yaw) * VIEW.dist * 0.8), Math.min(1, dt * 3));
    tmp.look.lerp(new Vector3(cx, 0.6, cz), Math.min(1, dt * 3));
    camera.lookAt(tmp.look);

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

  const skin = "#C98E64";
  return (
    <>
      {/* soft blob shadow that follows the student */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.38, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* legs */}
        {[-0.11, 0.11].map((x, i) => (
          <group key={x} position={[x, 0.62, 0]} ref={(el) => void (limbs.current.legs[i] = el)}>
            <mesh position={[0, -0.28, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.38, 6, 12]} />
              <meshStandardMaterial color="#2B4C8C" roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.56, 0.05]} castShadow>
              <capsuleGeometry args={[0.07, 0.1, 6, 12]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.6} />
            </mesh>
          </group>
        ))}
        {/* lab coat body */}
        <mesh position={[0, 0.98, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.42, 8, 20]} />
          <meshStandardMaterial color="#FBFBFD" roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.08, 0.2]}>
          <boxGeometry args={[0.16, 0.3, 0.04]} />
          <meshStandardMaterial color="#7C3AED" roughness={0.7} />
        </mesh>
        {/* arms */}
        {[-0.3, 0.3].map((x, i) => (
          <group key={x} position={[x, 1.18, 0]} ref={(el) => void (limbs.current.arms[i] = el)}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.065, 0.32, 6, 12]} />
              <meshStandardMaterial color="#F1F5F9" roughness={0.65} />
            </mesh>
            <mesh position={[0, -0.45, 0]}>
              <sphereGeometry args={[0.065, 12, 10]} />
              <meshStandardMaterial color={skin} roughness={0.6} />
            </mesh>
          </group>
        ))}
        {/* anchor for the speech bubble above his head (drawn in the DOM by the page) */}
        <WorldAnchor id="player:head" position={[0, 2.25, 0]} />
        {/* head */}
        <mesh position={[0, 1.6, 0]} castShadow>
          <sphereGeometry args={[0.27, 28, 22]} />
          <meshStandardMaterial color={skin} roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.7, -0.04]} scale={[1.05, 0.85, 1.05]}>
          <sphereGeometry args={[0.28, 28, 22, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
          <meshStandardMaterial color="#2A1D17" roughness={0.85} />
        </mesh>
        {/* eyes + goggles strap on forehead */}
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, 1.6, 0.25]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color="#1F2937" />
          </mesh>
        ))}
        <mesh position={[0, 1.79, 0.15]} rotation-x={-0.5}>
          <torusGeometry args={[0.2, 0.025, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.25} />
        </mesh>
      </group>
    </>
  );
}
