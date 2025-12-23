"use client";

import { PRIMARY } from "../constants";

export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[5, 3, 5]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[-5, -2, -5]} intensity={0.3} color="#4a90d9" />
      <pointLight position={[0, 0, 6]} intensity={0.4} color={PRIMARY} distance={20} />
    </>
  );
}
