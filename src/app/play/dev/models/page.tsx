"use client";
// /play/dev/models: every Meshy lab model in a row, seen from the front (+z), to check scale + facing.
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Model, MODELS, type ModelName } from "@/three/lab/Model";

const names = Object.keys(MODELS) as ModelName[];

export default function ModelsDev() {
  return (
    <div className="fixed inset-0 bg-[#2A2440]">
      <Canvas camera={{ position: [0, 2.2, 9], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 6, 5]} intensity={1.6} />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2} position={[0, 5, 5]} scale={[10, 4, 1]} />
        </Environment>
        <Suspense fallback={null}>
          {names.map((n, i) => (
            <Model key={n} name={n} position={[((i % 9) - 4) * 1.15, i < 9 ? 0 : -2.6, 0]} height={Math.min(MODELS[n], 1.8)} />
          ))}
        </Suspense>
        <OrbitControls target={[0, 0, 0]} />
      </Canvas>
      <ol className="pointer-events-none absolute left-2 top-2 text-xs text-muted">
        {names.map((n, i) => (
          <li key={n}>{i + 1}. {n}</li>
        ))}
      </ol>
    </div>
  );
}
