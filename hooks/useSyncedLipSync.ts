import { useEffect, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";

const LERP_SPEED = 0.5; // How fast to correct drift (0.1 = slow/gummy, 0.9 = snappy)

// Tuning for your Cat Character
const GAINS = {
  jawOpen: 2.5,        // Cats need BIG jaw movement to be seen
  mouthFunnel: 1.8,    // "Ooh" sounds
  mouthPucker: 1.8,
  mouthSmile: 1.2,
  default: 1.4         // Global multiplier
};

type VisemePacket = {
  utteranceId: string;
  audioOffset: number; // ms from start of this utterance
  frames: number[][];  // The 52 blendshapes
  fps: number;
};

export function useSyncedLipSync({
  audioElRef, // Pass the ref to your <audio> element
}: {
  audioElRef: React.MutableRefObject<HTMLAudioElement | null>;
}) {
  const weightsRef = useRef<Record<string, number>>({});
  
  // We store "tracks" of animation based on utterance ID
  const bufferRef = useRef<VisemePacket[]>([]);
  const currentUtteranceRef = useRef<string | null>(null);
  const utteranceStartTimeRef = useRef<number>(0);

  // Mapping array (same as your AZURE_ARKIT_52)
  const ARKIT_NAMES = [
    "eyeBlinkLeft","eyeLookDownLeft","eyeLookInLeft","eyeLookOutLeft","eyeLookUpLeft","eyeSquintLeft","eyeWideLeft",
    "eyeBlinkRight","eyeLookDownRight","eyeLookInRight","eyeLookOutRight","eyeLookUpRight","eyeSquintRight","eyeWideRight",
    "jawForward","jawLeft","jawRight","jawOpen","mouthClose","mouthFunnel","mouthPucker","mouthLeft","mouthRight",
    "mouthSmileLeft","mouthSmileRight","mouthFrownLeft","mouthFrownRight","mouthDimpleLeft","mouthDimpleRight",
    "mouthStretchLeft","mouthStretchRight","mouthRollLower","mouthRollUpper","mouthShrugLower","mouthShrugUpper",
    "mouthPressLeft","mouthPressRight","mouthLowerDownLeft","mouthLowerDownRight","mouthUpperUpLeft","mouthUpperUpRight",
    "browDownLeft","browDownRight","browInnerUp","browOuterUpLeft","browOuterUpRight","cheekPuff","cheekSquintLeft",
    "cheekSquintRight","noseSneerLeft","noseSneerRight","tongueOut"
  ];

  // 1. Receive Data
  const pushPacket = useCallback((packet: any) => {
    // Detect new utterance to reset timing
    if (packet.utteranceId !== currentUtteranceRef.current) {
      currentUtteranceRef.current = packet.utteranceId;
      // We assume the audio for this utterance starts NOW (minus a tiny buffer)
      // In a perfect world, we'd get the absolute timestamp from the audio track,
      // but syncing "Packet Arrival" to "Audio.currentTime" is usually close enough for WebRTC.
      if (audioElRef.current) {
        utteranceStartTimeRef.current = audioElRef.current.currentTime * 1000; 
      }
    }
    bufferRef.current.push(packet);
    
    // Clean old buffer (keep last 3 seconds)
    if (bufferRef.current.length > 50) bufferRef.current.shift();
  }, [audioElRef]);

  // 2. Render Loop (The Sync Logic)
  // We don't use useFrame here because this logic needs to run even if the canvas isn't rendering 
  // strictly (though usually it is). We can actually put this IN the component calling this hook 
  // or use a requestAnimationFrame inside.
  // For simplicity with R3F, we return a function to call inside useFrame.
  
  const update = useCallback(() => {
    if (!audioElRef.current || !bufferRef.current.length) return;

    const audioTimeMs = audioElRef.current.currentTime * 1000;
    const relativeTime = audioTimeMs - utteranceStartTimeRef.current;

    // Find the packet that covers our current time
    // This is a simplified search. For best results, find the two frames surrounding 'relativeTime' and Lerp.
    
    let activeFrame: number[] | null = null;
    
    // Search backwards from newest to find the match
    for (let i = bufferRef.current.length - 1; i >= 0; i--) {
      const packet = bufferRef.current[i];
      
      // Calculate start and end time of this specific packet
      const packetDuration = (packet.frames.length / packet.fps) * 1000;
      const packetStart = packet.audioOffset;
      const packetEnd = packetStart + packetDuration;

      // Add a small "latency offset" constant. 
      // WebRTC audio usually plays ~200ms after the data packet arrives.
      // Adjust this number until it looks perfect:
      const LATENCY_COMPENSATION = 150; 

      if (relativeTime >= (packetStart - LATENCY_COMPENSATION) && relativeTime <= (packetEnd + 500)) {
        // We found the packet. Now find the exact frame index.
        const timeIntoPacket = relativeTime - (packetStart - LATENCY_COMPENSATION);
        const frameIndex = Math.floor((timeIntoPacket / 1000) * packet.fps);
        
        if (frameIndex >= 0 && frameIndex < packet.frames.length) {
          activeFrame = packet.frames[frameIndex];
          break;
        }
      }
    }

    if (!activeFrame) {
      // Decay to zero if no data (smoothly close mouth)
      for (const k of ARKIT_NAMES) {
         weightsRef.current[k] = (weightsRef.current[k] || 0) * 0.9;
      }
      return;
    }

    // Apply Weights with Smoothing + Boosting
    const targetWeights: Record<string, number> = {};
    activeFrame.forEach((val, idx) => {
      const name = ARKIT_NAMES[idx];
      let v = val;
      
      // Apply Gains
      if (name === "jawOpen") v *= GAINS.jawOpen;
      else if (name.startsWith("mouthFunnel")) v *= GAINS.mouthFunnel;
      else if (name.startsWith("mouthPucker")) v *= GAINS.mouthPucker;
      else if (name.includes("Smile")) v *= GAINS.mouthSmile;
      else v *= GAINS.default;

      targetWeights[name] = Math.min(1, Math.max(0, v));
    });

    // Interpolate current weights towards target (removes jitter)
    for (const k of ARKIT_NAMES) {
      const current = weightsRef.current[k] || 0;
      const target = targetWeights[k] || 0;
      weightsRef.current[k] = current + (target - current) * LERP_SPEED;
    }

  }, [audioElRef]);

  return { weightsRef, pushPacket, update };
}