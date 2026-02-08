"use client";

import React, { useRef, useState } from "react";
import AvatarBubble from "@/components/AvatarBubble";

// Morph targets for testing
const CGTRADER_MORPH_MAP = {
  eyeBlinkLeft: ["EyeBlink_L"],
  eyeBlinkRight: ["EyeBlink_R"],
  jawOpen: ["Jaw_Open"],
  mouthSmileLeft: ["MouthSmile_L"],
  mouthSmileRight: ["MouthSmile_R"],
};

export default function AvatarTestPage() {
  const [debug, setDebug] = useState(true);
  
  // Create a dummy ref so the component satisfies TypeScript
  const dummyVisemeWeights = useRef<Record<string, number>>({
    jawOpen: 0,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
  });

  const modelUrl = "/models/IWFinalAvatar.glb";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-10">
      <h1 className="text-white text-2xl mb-8 font-bold">Avatar System Test</h1>
      
      <div className="relative border-4 border-white/10 rounded-full p-2 bg-[#111]">
        <AvatarBubble
          modelUrl={modelUrl}
          size={420}
          debug={debug}
          morphMap={CGTRADER_MORPH_MAP}
          visemeWeightsRef={dummyVisemeWeights as any}
        />
      </div>

      <div className="mt-8 text-gray-400 text-sm max-w-md text-center">
        Testing stable Gemini 2.0 Flash integration and 5-frame lipsync buffer.
      </div>

      <button 
        onClick={() => setDebug(!debug)}
        className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
      >
        {debug ? "Disable Debugging" : "Enable Debugging"}
      </button>
    </div>
  );
}