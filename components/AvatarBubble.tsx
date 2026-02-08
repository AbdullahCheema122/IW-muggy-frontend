/* ============================================================
   AvatarBubble.tsx (FULL FILE)
   - Pulls camera back (Ms. Muggy less close)
   - Keeps same lipsync + visuals logic
============================================================ */
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

export type VisemeWeights = Record<string, number>;
export type VisemeWeightsRef = React.MutableRefObject<VisemeWeights>;
export type MorphMap = Record<string, string[]>;

type EquippedVisuals = {
  head?: string;
  body?: string;
  effect?: string;
};

const STEAM_PARTICLE_COUNT = 8;

function Steam() {
  const group = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    return Array.from({ length: STEAM_PARTICLE_COUNT }, () => ({
      speed: 0.2 + Math.random() * 0.3,
      x: (Math.random() - 0.5) * 0.25,
      z: (Math.random() - 0.5) * 0.25,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const p = particles[i];
      const y = ((t * p.speed + p.offset) % 1.5) - 0.2;
      child.position.set(p.x + Math.sin(t + i) * 0.05, y, p.z + Math.cos(t + i) * 0.05);
      const opacity = Math.sin((Math.PI * (y + 0.2)) / 1.5);
      (child as any).scale.setScalar(opacity * 0.12);
    });
  });

  return (
    <group ref={group} position={[0, 0.4, 0]}>
      {particles.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function applyVisualsToMaterials(scene: THREE.Object3D, visuals?: EquippedVisuals) {
  // Reset defaults (safe)
  scene.traverse((o: any) => {
    const m = o?.material;
    if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    for (const mat of mats) {
      if (mat && "emissive" in mat) {
        (mat as any).emissive = new THREE.Color("#000000");
        (mat as any).emissiveIntensity = 0.0;
        mat.needsUpdate = true;
      }
    }
  });

  if (visuals?.head === "wizard_hat") {
    scene.traverse((o: any) => {
      const m = o?.material;
      if (!m) return;
      const mats = Array.isArray(m) ? m : [m];
      for (const mat of mats) {
        if (mat && "emissive" in mat) {
          (mat as any).emissive = new THREE.Color("#7C3AED");
          (mat as any).emissiveIntensity = 0.35;
          mat.needsUpdate = true;
        }
      }
    });
  }

  if (visuals?.effect === "sparkle_glow") {
    scene.traverse((o: any) => {
      const m = o?.material;
      if (!m) return;
      const mats = Array.isArray(m) ? m : [m];
      for (const mat of mats) {
        if (mat && "emissive" in mat) {
          (mat as any).emissive = new THREE.Color("#FFD54A");
          (mat as any).emissiveIntensity = 0.5;
          mat.needsUpdate = true;
        }
      }
    });
  }
}

/**
 * IMPORTANT:
 * - weights keys must match morphMap keys.
 * - morphMap maps those keys -> morph target names in your GLB.
 */
function AvatarModel({
  url,
  visemeWeightsRef,
  morphMap,
  visuals,
  onLoaded,
}: {
  url: string;
  visemeWeightsRef: VisemeWeightsRef;
  morphMap: MorphMap;
  visuals?: EquippedVisuals;
  onLoaded?: () => void;
}) {
  const gltf = useGLTF(url) as any;
  const rootRef = useRef<THREE.Group>(null);
  const camRef = useRef<THREE.PerspectiveCamera>(null!);
  const meshesRef = useRef<{ dict: Record<string, number>; infl: number[] }[]>([]);

  // Decay tuning
  const DECAY = 0.62; // 0.55–0.75

  useEffect(() => {
    const list: any[] = [];
    gltf.scene.traverse((o: any) => {
      if (o?.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
        list.push({ dict: o.morphTargetDictionary, infl: o.morphTargetInfluences });
      }
    });
    meshesRef.current = list;
    onLoaded?.();
  }, [gltf.scene, onLoaded]);

  useEffect(() => {
    const cam = camRef.current;
    const root = rootRef.current;
    if (!cam || !root) return;

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const TARGET_SIZE = 1.15;
    const scale = TARGET_SIZE / (maxDim || 1);
    root.scale.setScalar(scale);

    cam.fov = 72;
    cam.updateProjectionMatrix();

    const fovRad = (cam.fov * Math.PI) / 180;
    const dist = TARGET_SIZE / 2 / Math.tan(fovRad / 2);

    // ✅ PULL BACK CAMERA (this fixes "too near")
    const FACE_Y = 0.42; // was ~0.48
    const ZOOM = 1.55; // was ~1.1 (bigger => farther)
    cam.position.set(0, FACE_Y, dist * ZOOM);
    cam.lookAt(0, FACE_Y, 0);
  }, [gltf.scene]);

  useEffect(() => {
    applyVisualsToMaterials(gltf.scene, visuals);
  }, [gltf.scene, visuals?.head, visuals?.body, visuals?.effect]);

  useFrame((state) => {
    // Friendly idle
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.035;
      rootRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
    }

    const weights = visemeWeightsRef.current;
    if (!weights) return;

    for (const mesh of meshesRef.current) {
      // decay (no snapping)
      for (let i = 0; i < mesh.infl.length; i++) mesh.infl[i] *= DECAY;

      for (const [key, value] of Object.entries(weights)) {
        const targets = morphMap[key];
        if (!targets) continue;

        const v = Math.max(0, Math.min(1, value));
        if (v <= 0.0001) continue;

        for (const name of targets) {
          const idx = mesh.dict[name];
          if (idx !== undefined) {
            mesh.infl[idx] = Math.max(mesh.infl[idx], v / targets.length);
          }
        }
      }
    }
  });

  return (
    <>
      <PerspectiveCamera ref={camRef as any} makeDefault />
      <group ref={rootRef}>
        <primitive object={gltf.scene} />
        <Steam />
      </group>
    </>
  );
}

export default function AvatarBubble({
  modelUrl,
  size = 490,
  visemeWeightsRef,
  morphMap,
  visuals,
}: {
  modelUrl: string;
  size?: number;
  visemeWeightsRef: VisemeWeightsRef;
  morphMap: MorphMap;
  visuals?: EquippedVisuals;
}) {
  const [loaded, setLoaded] = useState(false);

  const portalGlow =
    visuals?.effect === "sparkle_glow"
      ? "radial-gradient(circle, rgba(255,213,74,0.28) 0%, transparent 70%)"
      : "radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 70%)";

  const portalBg =
    visuals?.effect === "sparkle_glow"
      ? "radial-gradient(circle, #2a1a00 0%, #120a00 70%, #000000 100%)"
      : "radial-gradient(circle, #1a1a1a 0%, #0a0a0a 70%, #000000 100%)";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "12px solid white",
        background: portalBg,
        boxShadow: `
          0 20px 60px rgba(0,0,0,0.3),
          inset 0 0 50px rgba(255,255,255,0.1),
          0 0 0 6px rgba(255,255,255,0.2)
        `,
      }}
    >
      <div className="absolute inset-0" style={{ background: portalGlow }} />

      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-12 h-12 border-4 border-white border-t-blue-400 rounded-full animate-spin mb-4" />
          <span className="font-black text-white text-sm italic uppercase tracking-widest">Brewing Magic...</span>
        </div>
      )}

      <Canvas dpr={[1, 2]} shadows gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.2} />
          <spotLight position={[5, 10, 5]} angle={0.25} penumbra={1} intensity={4} castShadow color="#ffffff" />
          <pointLight position={[0, 2, -5]} intensity={5} color="#ffffff" />
          <pointLight position={[-5, 2, -5]} intensity={2} color="#818CF8" />
          <pointLight position={[0, -2, 2]} intensity={1.5} color="#FFD700" />

          <Environment preset="forest" />
          <ContactShadows position={[0, -0.6, 0]} opacity={0.6} scale={5} blur={2.5} far={1} />

          <AvatarModel url={modelUrl} visemeWeightsRef={visemeWeightsRef} morphMap={morphMap} visuals={visuals} onLoaded={() => setLoaded(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
