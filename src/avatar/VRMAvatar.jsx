import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { ExpressionController } from './ExpressionController';

export function VRMAvatar({
  url = '/avatar.vrm',
  activeExpression,
  activeAnimation,
  customArmPose,
  lipSyncController,
  actionRecorder,
  onVrmLoaded,
  onError,
  shirtColor = '#e84393' // Vibrant stylish berry/coral pink
}) {
  const avatarGroupRef = useRef();
  const vrmRef = useRef(null);
  const controllerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const applyShirtColor = (vrm, colorHex) => {
    if (!vrm || !colorHex) return;
    try {
      const color = new THREE.Color(colorHex);
      const shade = color.clone().multiplyScalar(0.72);

      vrm.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            const name = (m.name || '').toLowerCase();
            if (
              name.includes('top') ||
              name.includes('shirt') ||
              name.includes('cloth') ||
              name.includes('t_shirt') ||
              name.includes('costume') ||
              name.includes('body_cloth')
            ) {
              if (m.color) {
                if (typeof m.color.set === 'function') {
                  m.color.set(color);
                } else {
                  m.color = color;
                }
              }
              if (m.shadeColor && typeof m.shadeColor.set === 'function') {
                m.shadeColor.set(shade);
              }
              if (m.shadeColorFactor) {
                m.shadeColorFactor = [shade.r, shade.g, shade.b];
              }
              if (m.uniforms) {
                if (m.uniforms.litFactor && m.uniforms.litFactor.value) {
                  m.uniforms.litFactor.value.set(color);
                }
                if (m.uniforms.shadeFactor && m.uniforms.shadeFactor.value) {
                  m.uniforms.shadeFactor.value.set(shade);
                }
              }
              m.needsUpdate = true;
            }
          });
        }
      });
      console.log(`Applied shirt color '${colorHex}' to VRM materials.`);
    } catch (e) {
      console.warn("Failed to apply shirt color:", e);
    }
  };

  // Re-apply shirtColor whenever shirtColor prop changes or updates asynchronously
  useEffect(() => {
    if (vrmRef.current && shirtColor) {
      applyShirtColor(vrmRef.current, shirtColor);
    }
  }, [shirtColor]);

  // Load VRM model
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        if (!isMounted) return;

        const vrm = gltf.userData.vrm;
        if (!vrm) {
          const err = "GLTF loaded but contains no VRM instance.";
          console.error(err);
          setErrorMsg(err);
          if (onError) onError(err);
          setLoading(false);
          return;
        }

        console.log("VRM model successfully loaded:", vrm);

        // Optimization joint cleanup & VRM0 rotation adjustment
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        VRMUtils.rotateVRM0(vrm);

        // Apply colorful tint to white shirt / top materials
        if (shirtColor) {
          applyShirtColor(vrm, shirtColor);
        }

        // Position avatar centered
        vrm.scene.position.set(0, 0, 0);

        vrmRef.current = vrm;

        // Create ExpressionController
        const controller = new ExpressionController(vrm);
        controllerRef.current = controller;

        const available = controller.getAvailableExpressions();

        if (onVrmLoaded) {
          onVrmLoaded({
            vrm,
            expressions: available,
            controller
          });
        }

        setLoading(false);
      },
      (progress) => {},
      (err) => {
        if (!isMounted) return;
        console.error("Error loading VRM:", err);
        const msg = `Failed to load VRM model from "${url}". ${err.message || ''}`;
        setErrorMsg(msg);
        if (onError) onError(msg);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }
    };
  }, [url]);

  // Handle active facial expression updates from UI buttons
  useEffect(() => {
    if (!controllerRef.current) return;

    if (activeExpression === null || activeExpression === undefined || activeExpression === 'reset') {
      controllerRef.current.resetExpressions();
    } else {
      controllerRef.current.setExpression(activeExpression, 1.0, true);
    }
  }, [activeExpression]);

  // Handle active body animation updates (wave, nod, standing)
  useEffect(() => {
    if (!controllerRef.current || !activeAnimation) return;
    controllerRef.current.playAnimation(activeAnimation);
  }, [activeAnimation]);

  // Handle frame updates (physics + pose + studio overrides + smooth expression lerping + audio mouth drive)
  useFrame((state, delta) => {
    if (!vrmRef.current || !controllerRef.current) return;

    const vrm = vrmRef.current;
    const controller = controllerRef.current;

    // Update VRM internal components (springbones, lookAt, etc.)
    vrm.update(delta);

    const isPlayingMotion = actionRecorder && actionRecorder.isPlaying;

    if (customArmPose && customArmPose.enabled && vrm.humanoid) {
      // Live studio pose sliders override
      const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      const rightHand = vrm.humanoid.getNormalizedBoneNode('rightHand');
      const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');

      if (leftUpperArm) leftUpperArm.rotation.set(-0.05, 0, -Math.PI / 2.35);
      if (leftLowerArm) leftLowerArm.rotation.set(0, -0.15, 0);

      if (rightUpperArm) rightUpperArm.rotation.set(...customArmPose.rightUpperArm);
      if (rightLowerArm) rightLowerArm.rotation.set(...customArmPose.rightLowerArm);
      if (rightHand) rightHand.rotation.set(...customArmPose.rightHand);
    } else if (!isPlayingMotion) {
      // Apply natural standing posture & procedural animations (breathing, wave, nod)
      controller.updatePose(state.clock.getElapsedTime());
    }

    // Record motion frame if recording is active
    if (actionRecorder && actionRecorder.isRecording) {
      actionRecorder.recordFrame(vrm, controller);
    }

    // Smoothly update facial expression weights (eyes, eyebrows, emotions)
    if (!isPlayingMotion) {
      controller.update(delta, 28);
    }

    // MAXIMUM PRIORITY OVERRIDE: Audio Lip-Sync Speech Drive
    // When audio is actively playing, override mouth vowel blendshapes directly on top of any active expression/animation
    if (lipSyncController && lipSyncController.isPlaying && vrm.expressionManager) {
      // Clamp active emotion expressions (happy, joy, angry, etc.) to 0.35 during speech
      // so their built-in mouth morphs do NOT lock the mouth wide open!
      const emotionKeys = ['happy', 'joy', 'fun', 'angry', 'sad', 'sorrow', 'surprised'];
      emotionKeys.forEach(emo => {
        const matchingExp = controller.availableExpressions.find(e => e.toLowerCase() === emo);
        if (matchingExp) {
          const currentVal = vrm.expressionManager.getValue(matchingExp);
          if (currentVal > 0.35) {
            vrm.expressionManager.setValue(matchingExp, 0.35);
          }
        }
      });

      const vowels = lipSyncController.getVowelWeights();
      const vowelKeys = ['aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'];

      vowelKeys.forEach(key => {
        const matchingExp = controller.availableExpressions.find(e => e.toLowerCase() === key);
        if (matchingExp) {
          const weight = vowels[key] || 0;
          vrm.expressionManager.setValue(matchingExp, weight);
        }
      });

      // Update VRM expression manager to apply top-priority mouth movement to Three.js meshes
      vrm.expressionManager.update();
    }
  });

  if (errorMsg) {
    return null;
  }

  return (
    <group ref={avatarGroupRef}>
      {vrmRef.current && <primitive object={vrmRef.current.scene} />}
    </group>
  );
}
