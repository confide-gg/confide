import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
  HueSaturation,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

export function Effects() {
  return (
    <EffectComposer multisampling={8}>
      <Bloom
        intensity={0.7}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.7}
        mipmapBlur
        radius={0.4}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0006, 0.0006)}
        radialModulation
        modulationOffset={0.3}
      />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.1} />
      <HueSaturation saturation={0.05} />
      <BrightnessContrast brightness={0.0} contrast={0.15} />
      <Vignette darkness={0.5} offset={0.2} />
    </EffectComposer>
  );
}
