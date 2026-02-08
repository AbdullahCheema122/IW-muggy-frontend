import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * AvatarModel (JSX)
 * - Avatar mesh GLB
 * - Idle animation from IdleAnim.glb
 * - Bone-based idle
 * - Morph-based lipsync + blink
 */
export default function AvatarModel({
  avatarUrl,
  idleAnimUrl = "/IdleAnim.glb",
}) {
  const group = useRef(null);

  // Avatar mesh
  const avatarGLTF = useGLTF(avatarUrl);
  const scene = avatarGLTF.scene;

  // Idle animation only
  const idleGLTF = useGLTF(idleAnimUrl);

  const mixerRef = useRef(null);

  /* -----------------------------------------
     Collect skinned meshes with morphs
  ----------------------------------------- */
  const skinnedMeshes = useMemo(() => {
    const list = [];
    scene.traverse((o) => {
      if (o.isSkinnedMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
        o.frustumCulled = false;
        list.push(o);
      }
    });
    return list;
  }, [scene]);

  /* -----------------------------------------
     Merge morph dictionaries
  ----------------------------------------- */
  const morphDict = useMemo(() => {
    const dict = {};
    skinnedMeshes.forEach((m) =>
      Object.assign(dict, m.morphTargetDictionary)
    );
    return dict;
  }, [skinnedMeshes]);

  /* -----------------------------------------
     Play idle animation (bone-based)
  ----------------------------------------- */
  useEffect(() => {
    if (!idleGLTF.animations || idleGLTF.animations.length === 0) return;

    mixerRef.current = new THREE.AnimationMixer(scene);
    const clip = idleGLTF.animations[0];
    const action = mixerRef.current.clipAction(clip);

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.fadeIn(0.4);
    action.play();

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [idleGLTF.animations, scene]);

  /* -----------------------------------------
     Update animation mixer
  ----------------------------------------- */
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
  });

  /* -----------------------------------------
     Blink logic (morph-based)
  ----------------------------------------- */
  const blinkTimer = useRef(0);
  const blinkOpen = useRef(1);

  useFrame((_, delta) => {
    blinkTimer.current += delta;

    if (blinkTimer.current > 3 + Math.random() * 2) {
      blinkTimer.current = 0;
      blinkOpen.current = 0;
      setTimeout(() => (blinkOpen.current = 1), 120);
    }

    setMorph("eyeBlinkLeft", 1 - blinkOpen.current);
    setMorph("eyeBlinkRight", 1 - blinkOpen.current);
  });

  /* -----------------------------------------
     Morph helper
  ----------------------------------------- */
  function setMorph(name, weight) {
    const idx = morphDict[name];
    if (idx === undefined) return;
    skinnedMeshes.forEach((m) => {
      m.morphTargetInfluences[idx] = weight;
    });
  }

  /* -----------------------------------------
     Simple viseme map (example)
  ----------------------------------------- */
  const VISEME_MAP = {
    AA: ["viseme_aa", "jawOpen"],
    AE: ["viseme_aa"],
    AO: ["viseme_oh"],
    EE: ["viseme_ee"],
    FV: ["viseme_fv"],
    M: ["viseme_m", "mouthClose"],
    B: ["viseme_m", "mouthClose"],
    P: ["viseme_m", "mouthClose"],
  };

  /* -----------------------------------------
     Expose lipsync API
  ----------------------------------------- */
  useEffect(() => {
    if (!group.current) return;

    group.current.setViseme = (phoneme, weight) => {
      const names = VISEME_MAP[phoneme] || [];
      names.forEach((n) => setMorph(n, weight));
    };

    group.current.resetMouth = () => {
      Object.keys(morphDict).forEach((name) => {
        if (
          name.startsWith("viseme_") ||
          name === "jawOpen" ||
          name === "mouthClose"
        ) {
          setMorph(name, 0);
        }
      });
    };
  }, [morphDict]);

  return (
    <primitive
      ref={group}
      object={scene}
      position={[0, -1.2, 0]}
      rotation={[0, Math.PI, 0]}
      scale={1.15}
    />
  );
}

/* -----------------------------------------
   Preload
----------------------------------------- */
useGLTF.preload("/IdleAnim.glb");
