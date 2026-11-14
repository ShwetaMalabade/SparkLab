"use client";
// src/three/Arena.tsx: the "neon science arena" stage (docs/plan/07 §1, 05 §8).
// Navy #0B1020 background + fog, glowing floor grid, environment lighting, ContactShadows, ONE bloom pass.
// The environment is built from Lightformers (no HDR download), so the stage renders with Wi-Fi off.
import { ContactShadows, Environment, Grid, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useRef, type ReactNode } from "react";
import type { PerspectiveCamera } from "three";

export const NAVY = "#0B1020";
export const CAMERA_POS: [number, number, number] = [0, 1.6, 7];
export const CAMERA_TARGET: [number, number, number] = [0, 1.3, 0];
export const CAMERA_FOV = 50;

export type ArenaProps = {
  children?: ReactNode;
  accent?: string;
  /** Reduced motion: no camera sway. */
  still?: boolean;
  bloom?: number;
  className?: string;
};

export function Arena({ children, accent = "#22D3EE", still = false, bloom = 0.8, className = "" }: ArenaProps) {
  return (
    <div className={`absolute inset-0 h-full w-full ${className}`}>
      <Canvas
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: CAMERA_POS, fov: CAMERA_FOV, near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(...CAMERA_TARGET)}
      >
        <color attach="background" args={[NAVY]} />
        <fog attach="fog" args={[NAVY, 9, 28]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 6, 4]} intensity={0.8} />
        <CameraSway still={still} />
        <Floor accent={accent} />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={14} blur={2.4} far={4} resolution={512} color="#000000" />
        <Suspense fallback={null}>
          <StudioEnvironment accent={accent} />
        </Suspense>
        {children}
        <EffectComposer multisampling={0}>
          <Bloom intensity={bloom} luminanceThreshold={0.2} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function Floor({ accent }: { accent: string }) {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060a16" roughness={1} metalness={0} envMapIntensity={0.15} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#1f2a4a"
        sectionSize={2.5}
        sectionThickness={1.2}
        sectionColor={accent}
        fadeDistance={26}
        fadeStrength={1.5}
        infiniteGrid
      />
    </>
  );
}

/** Procedural studio lighting for reflections (replaces preset="city", which needs a network fetch). */
function StudioEnvironment({ accent }: { accent: string }) {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.2} position={[0, 5, -6]} scale={[12, 3, 1]} color="#ffffff" />
      <Lightformer form="rect" intensity={1.4} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color={accent} />
      <Lightformer form="rect" intensity={1.2} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color="#A78BFA" />
      <Lightformer form="ring" intensity={1.5} position={[0, 6, 4]} scale={3} color="#ffffff" />
    </Environment>
  );
}

/** Gentle camera sway (07 §1). Off with reduced motion. */
function CameraSway({ still }: { still: boolean }) {
  const t0 = useRef(0);
  useFrame(({ camera, clock }) => {
    const cam = camera as PerspectiveCamera;
    if (still) return;
    const t = clock.getElapsedTime() - t0.current;
    cam.position.x = CAMERA_POS[0] + Math.sin(t * 0.25) * 0.12;
    cam.position.y = CAMERA_POS[1] + Math.sin(t * 0.33) * 0.05;
    cam.lookAt(...CAMERA_TARGET);
  });
  return null;
}
