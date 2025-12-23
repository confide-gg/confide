"use client";

import { useRef } from "react";
import * as THREE from "three";
import { FloatingModel } from "./floating-model";

interface FloatingObjectsProps {
  scrollProgress: number;
}

export function FloatingObjects({ scrollProgress }: FloatingObjectsProps) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef}>
      <FloatingModel
        url="/models/Headphones.glb"
        position={[-2.8, 1.1, 0.3]}
        scale={0.0048}
        initialRotation={[3.1, 0.8, 0.15]}
        delay={0.3}
        scrollProgress={scrollProgress}
        rotationDirection={1}
      />
      <FloatingModel
        url="/models/Computer mouse.glb"
        position={[3.0, -0.6, 0.6]}
        scale={0.36}
        initialRotation={[0.45, -1.9, 0.05]}
        delay={0.5}
        scrollProgress={scrollProgress}
        rotationDirection={-1}
      />
      <FloatingModel
        url="/models/Low Poly Controller.glb"
        position={[-2.6, -1.2, 0.7]}
        scale={0.095}
        initialRotation={[0.15, 1.35, 1.05]}
        delay={0.7}
        scrollProgress={scrollProgress}
        rotationDirection={1}
      />
      <FloatingModel
        url="/models/Webcam.glb"
        position={[2.8, 1.3, 0.2]}
        scale={0.3}
        initialRotation={[0.05, -0.25, 0.02]}
        delay={0.9}
        scrollProgress={scrollProgress}
        rotationDirection={-1}
      />
    </group>
  );
}
