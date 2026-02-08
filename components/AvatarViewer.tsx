"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";

type AvatarViewerProps = {
  avatarUrl: string;
  height?: number;      // px height of the canvas (width is 100%)
  fov?: number;         // camera field of view
  autoRotate?: boolean; // slow auto-rotation
};

function AvatarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  const model = useMemo(() => {
    const root = scene.clone();
    root.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    return root;
  }, [scene]);

  return <primitive object={model} />;
}

export default function AvatarViewer({
  avatarUrl,
  height = 140,
  fov = 35,
  autoRotate = true,
}: AvatarViewerProps) {
  return (
    <div style={{ width: "100%", height }}>
      <Canvas
        shadows={false}
        dpr={[1, 2]}
        camera={{ position: [0, 1.45, 1.4], fov }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={0.7} />

        <Suspense fallback={null}>
          <Center disableY>
            <AvatarModel url={avatarUrl} />
          </Center>
          <Environment preset="city" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.0}
        />
      </Canvas>
    </div>
  );
}
