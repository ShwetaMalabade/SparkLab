"use client";
// src/three/lab/StationBackdrop.tsx: the room you see behind the bench once you walk in (replaces the neon grid).
// Built from the same props as the building, scaled up so it reads from the Arena camera at (0, 1.6, 7).
import { createContext, useContext } from "react";
import type { RoomId } from "./LabWorld";
import { Bookshelf, FumeHood, LabWindow, PeriodicPoster, Plant, Poster, ReagentShelf, TitrationStand, BigScale, MoleculeModel, WATER, CH4, Whiteboard } from "./LabProps";

const WALL_Z = -6;

/** Room context for 3D template parts (e.g. Mix Lab draws a real lab bench when inside the lab world). */
export const StationRoom = createContext<RoomId | null>(null);
export const useStationRoom = () => useContext(StationRoom);

/** The floor sits this far below the bench top, so you stand at a bench instead of glassware on the floor. */
export const BENCH_DROP = 0.95;

export function StationBackdrop({ room }: { room: RoomId }) {
  return (
    <group position={[0, -BENCH_DROP, 0]}>
      {/* Floor: pale lab tiles */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.003, -2]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#D9D3E6" roughness={0.6} />
      </mesh>
      <gridHelper args={[40, 50, "#BFB8CF", "#BFB8CF"]} position={[0, 0.001, -2]} />
      {/* Back wall + side walls */}
      <mesh position={[0, 3, WALL_Z]}>
        <planeGeometry args={[40, 6]} />
        <meshStandardMaterial color="#E9E3D7" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.15, WALL_Z + 0.01]}>
        <planeGeometry args={[40, 0.3]} />
        <meshStandardMaterial color="#9C8E7A" />
      </mesh>
      <mesh position={[-11, 3, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#DED7C9" roughness={0.95} />
      </mesh>
      <mesh position={[11, 3, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#DED7C9" roughness={0.95} />
      </mesh>
      <group position={[0, 0, WALL_Z + 0.25]} scale={1.35}>{room === "mix" ? <MixWall /> : room === "balance" ? <BalanceWall /> : room === "titration" ? <TitrationWall /> : <StudyWall />}</group>
      {/* Warm ceiling lights */}
      <pointLight position={[-4, 4.5, -2]} intensity={6} distance={12} color="#FFE7C2" />
      <pointLight position={[4, 4.5, -2]} intensity={6} distance={12} color="#FFE7C2" />
    </group>
  );
}

function MixWall() {
  return (
    <>
      <ReagentShelf position={[-5.2, 0, 0]} width={2.4} seed={4} />
      <FumeHood position={[-2.3, 0, 0.1]} />
      <PeriodicPoster position={[1.2, 2.1, -0.15]} w={2.2} />
      <ReagentShelf position={[4.6, 0, 0]} width={2.4} seed={9} />
      <LabWindow position={[1.2, 3.6, -0.14]} />
      <Plant position={[7, 0, 0.2]} size={1.3} />
    </>
  );
}

function BalanceWall() {
  return (
    <>
      <PeriodicPoster position={[0, 2.3, -0.15]} w={2.6} />
      <MoleculeModel position={[-4.2, 0, 0.3]} atoms={WATER} />
      <MoleculeModel position={[4.2, 0, 0.3]} atoms={CH4} />
      <BigScale position={[-6.6, 0, 0.3]} />
      <Bookshelf position={[6.8, 0, 0]} />
      <Plant position={[-2.2, 0, 0.3]} />
    </>
  );
}

function TitrationWall() {
  return (
    <>
      <ReagentShelf position={[-5, 0, 0]} width={2.4} seed={6} />
      <TitrationStand position={[-1.8, -0.9, 0.2]} scale={1.4} />
      <Poster position={[1, 2.2, -0.15]} title="pH" lines={["acid  0–6", "neutral  7", "base  8–14"]} band="#DB2777" />
      <ReagentShelf position={[4.6, 0, 0]} width={2.4} seed={12} />
    </>
  );
}

function StudyWall() {
  return (
    <>
      <Whiteboard position={[0, 2.2, -0.15]} lines={["n = m ÷ M", "M(H₂O) = 2×1 + 16 = 18 g/mol", "Show your units!"]} />
      <Bookshelf position={[-5, 0, 0]} />
      <Bookshelf position={[5, 0, 0]} />
      <PeriodicPoster position={[-2.6, 3.4, -0.15]} w={1.2} />
      <Plant position={[3, 0, 0.3]} size={1.2} />
    </>
  );
}
