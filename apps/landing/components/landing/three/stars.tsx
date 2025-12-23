"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { PRIMARY } from "../constants";

interface StarsProps {
  scrollProgress: number;
}

export function Stars({ scrollProgress }: StarsProps) {
  const ref = useRef<THREE.Points>(null);
  const count = 5000;

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const white = new THREE.Color("#ffffff");
    const blue = new THREE.Color("#aaccff");
    const primary = new THREE.Color(PRIMARY);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 30 + Math.random() * 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const rand = Math.random();
      const color = rand > 0.98 ? primary : rand > 0.9 ? blue : white;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    return [positions, colors];
     
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.003;
      ref.current.rotation.x = scrollProgress * 0.5;
    }
  });

  return (
    <Points ref={ref} positions={positions} colors={colors}>
      <PointMaterial
        transparent
        vertexColors
        size={0.12}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.9}
      />
    </Points>
  );
}
