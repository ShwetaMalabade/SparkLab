"use client";
// src/three/lab/Model.tsx: the Meshy-made lab models in public/models/lab (plain GLB, PNG textures → offline-safe).
// Every file is normalised to ~1 unit, so each name has its real-world height here; <Model> scales it and puts its
// base on y = 0 (or on top of whatever `position` says).
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Mesh, Vector3, type Object3D } from "three";

export const MODELS = {
  BrassBalanceScale: 0.55,
  BunsenBurner: 0.32,
  ChemicalBottleShelf: 2.1,
  ClassroomDoor: 2.2,
  DropperBottlesSet: 0.16,
  FumeHoodCabinet: 2.3,
  LabSinkCounter: 1.3,
  MagneticStirrerHotPlate: 0.12,
  PottedMonsteraPlant: 1.3,
  RetortStand: 0.8,
  RoundLabStool: 0.75,
  SchoolMicroscope: 0.42,
  ScienceBookshelf: 2.0,
  SquareIslandLabTable: 0.92,
  StudentDeskAndChair: 1.0,
  TestTubeRack: 0.2,
  WallClock: 0.5,
} as const;
export type ModelName = keyof typeof MODELS;

const url = (n: ModelName) => `/models/lab/${n}.glb`;

export type ModelProps = {
  name: ModelName;
  position?: [number, number, number];
  /** Rotation around Y, radians. */
  rotation?: number;
  /** Override the real-world height (metres). */
  height?: number;
  shadows?: boolean;
};

export function Model({ name, position = [0, 0, 0], rotation = 0, height, shadows = true }: ModelProps) {
  const { scene } = useGLTF(url(name));
  const { obj, s, lift } = useMemo(() => {
    const obj = scene.clone(true);
    obj.traverse((o: Object3D) => {
      if (o instanceof Mesh) {
        o.castShadow = shadows;
        o.receiveShadow = shadows;
      }
    });
    const box = new Box3().setFromObject(obj);
    const size = box.getSize(new Vector3());
    const s = (height ?? MODELS[name]) / Math.max(1e-6, size.y);
    return { obj, s, lift: -box.min.y * s };
  }, [scene, name, height, shadows]);
  return (
    <group position={[position[0], position[1] + lift, position[2]]} rotation-y={rotation} scale={s}>
      <primitive object={obj} />
    </group>
  );
}

/** Start downloading every model as soon as the lab code loads. */
export function preloadLabModels() {
  (Object.keys(MODELS) as ModelName[]).forEach((n) => useGLTF.preload(url(n)));
}
