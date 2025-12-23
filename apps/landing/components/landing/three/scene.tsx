"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import { BG } from "../constants";
import { Stars } from "./stars";
import { FloatingObjects } from "./floating-objects";
import { Lighting } from "./lighting";
import { CameraController } from "./camera-controller";
import { Effects } from "./effects";

interface SceneProps {
  scrollProgress: number;
}

function SceneContent({ scrollProgress }: SceneProps) {
  const sceneRef = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 0.15;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 0.08;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(() => {
    if (sceneRef.current) {
      sceneRef.current.rotation.y += (mouse.current.x - sceneRef.current.rotation.y) * 0.03;
      sceneRef.current.rotation.x += (mouse.current.y - sceneRef.current.rotation.x) * 0.03;
    }
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 40, 100]} />
      <CameraController scrollProgress={scrollProgress} />
      <Lighting />

      <group ref={sceneRef}>
        <Stars scrollProgress={scrollProgress} />
        <Suspense fallback={null}>
          <FloatingObjects scrollProgress={scrollProgress} />
        </Suspense>
      </group>
    </>
  );
}

interface ThreeSceneProps {
  scrollProgress: number;
}

export function ThreeScene({ scrollProgress }: ThreeSceneProps) {
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
      setTimeout(() => setHasWebGL(false), 0);
    }
  }, []);

  if (!hasWebGL) return null;

  return (
    <div className="fixed inset-0 z-0" style={{ background: BG }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 2]}
        gl={{
          powerPreference: "high-performance",
          antialias: true,
          stencil: false,
          depth: true,
          alpha: false,
        }}
        style={{ background: BG }}
        onCreated={({ gl }) => {
          gl.setClearColor(BG, 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <SceneContent scrollProgress={scrollProgress} />
        <Effects />
        <Preload all />
      </Canvas>
    </div>
  );
}
