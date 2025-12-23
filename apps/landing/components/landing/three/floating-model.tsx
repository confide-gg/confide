"use client";

import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PRIMARY } from "../constants";

interface SpacePhysics {
  position: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  rotation: THREE.Euler;
  orbitRadius: number;
  orbitSpeed: number;
  orbitOffset: number;
}

interface FloatingModelProps {
  url: string;
  position: [number, number, number];
  scale?: number;
  initialRotation?: [number, number, number];
  delay?: number;
  scrollProgress?: number;
  rotationDirection?: number;
}

export function FloatingModel({
  url,
  position,
  scale = 1,
  initialRotation = [0, 0, 0],
  delay = 0,
  scrollProgress = 0,
  rotationDirection = 1,
}: FloatingModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const [animProgress, setAnimProgress] = useState(0);
  const animStartTime = useRef<number | null>(null);

  const physics = useRef<SpacePhysics | null>(null);

  if (!physics.current) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    physics.current = {
      position: new THREE.Vector3(...position),
      angularVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.07,
        (Math.random() - 0.5) * 0.03
      ),
      rotation: new THREE.Euler(
        initialRotation[0],
        initialRotation[1],
        initialRotation[2]
      ),
      orbitRadius: 0.12 + Math.random() * 0.08,
      orbitSpeed: 0.07 + Math.random() * 0.04,
      orbitOffset: Math.random() * Math.PI * 2,
    };
  }

  const styledScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.ShaderMaterial({
          transparent: true,
          uniforms: {
            time: { value: 0 },
            primaryColor: { value: new THREE.Color(PRIMARY) },
            darkColor: { value: new THREE.Color("#0a0a0c") },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            varying vec3 vViewDir;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 worldPos = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPos.xyz;
              vViewDir = normalize(cameraPosition - worldPos.xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            uniform vec3 primaryColor;
            uniform vec3 darkColor;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            varying vec3 vViewDir;

            void main() {
              vec3 normal = normalize(vNormal);
              vec3 viewDir = normalize(vViewDir);
              float NdotV = max(dot(normal, viewDir), 0.0);

              float fresnel = pow(1.0 - NdotV, 2.5);
              float sharpEdge = pow(1.0 - NdotV, 1.5);
              float softGlow = pow(1.0 - NdotV, 4.0);

              float edgeGlow = sharpEdge * 2.2;
              float outerGlow = softGlow * 1.4;
              float innerFill = pow(NdotV, 2.0) * 0.08;

              vec3 baseColor = darkColor * 0.04;
              vec3 edgeColor = primaryColor * edgeGlow;
              vec3 glowColor = primaryColor * outerGlow;
              vec3 fillColor = primaryColor * innerFill;

              vec3 finalColor = baseColor + edgeColor + glowColor + fillColor;
              finalColor = clamp(finalColor, 0.0, 2.0);

              gl_FragColor = vec4(finalColor, 1.0);
            }
          `,
          side: THREE.FrontSide,
          depthWrite: true,
        });
      }
    });
    return cloned;
  }, [scene]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      const p = physics.current;
      if (!p) return;

      const clampedDelta = Math.min(delta, 0.1);

      if (animStartTime.current === null) {
        animStartTime.current = t;
      }

      const elapsed = t - animStartTime.current - delay;
      if (elapsed > 0 && animProgress < 1) {
        const duration = 1.2;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setAnimProgress(eased);
      }

      const currentScale = scale * animProgress;
      const yOffset = (1 - animProgress) * 2;

      groupRef.current.scale.setScalar(currentScale);

      p.rotation.x += p.angularVelocity.x * clampedDelta;
      p.rotation.y += p.angularVelocity.y * clampedDelta;
      p.rotation.z += p.angularVelocity.z * clampedDelta;

      const orbitX = Math.cos(t * p.orbitSpeed + p.orbitOffset) * p.orbitRadius;
      const orbitY = Math.sin(t * p.orbitSpeed * 0.7 + p.orbitOffset) * p.orbitRadius * 0.6;
      const orbitZ = Math.sin(t * p.orbitSpeed * 0.5 + p.orbitOffset * 1.3) * p.orbitRadius * 0.3;

      groupRef.current.position.x = p.position.x + orbitX;
      groupRef.current.position.y = p.position.y + orbitY - yOffset;
      groupRef.current.position.z = p.position.z + orbitZ;

      const scrollRotation = scrollProgress * Math.PI * 0.8 * rotationDirection;
      const scrollY = scrollProgress * 8;

      groupRef.current.rotation.x = p.rotation.x + scrollRotation * 0.4;
      groupRef.current.rotation.y = p.rotation.y + scrollRotation;
      groupRef.current.rotation.z = p.rotation.z + scrollRotation * 0.25;

      groupRef.current.position.y += scrollY;

      p.angularVelocity.x += (Math.random() - 0.5) * 0.0007;
      p.angularVelocity.y += (Math.random() - 0.5) * 0.0007;
      p.angularVelocity.z += (Math.random() - 0.5) * 0.0004;

      p.angularVelocity.x *= 0.993;
      p.angularVelocity.y *= 0.993;
      p.angularVelocity.z *= 0.993;

      p.angularVelocity.clampLength(0.02, 0.14);

      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if ((mesh.material as THREE.ShaderMaterial).uniforms) {
            (mesh.material as THREE.ShaderMaterial).uniforms.time.value = t;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={position} scale={0}>
      <primitive object={styledScene} />
    </group>
  );
}
