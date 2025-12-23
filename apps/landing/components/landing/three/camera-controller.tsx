"use client";

import { useFrame, useThree } from "@react-three/fiber";

interface CameraControllerProps {
  scrollProgress: number;
}

export function CameraController({ scrollProgress }: CameraControllerProps) {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.setY(scrollProgress * -8);
    camera.position.setZ(6 + scrollProgress * 2);
  });

  return null;
}
