// src/config/appConfig.ts
import type { AppConfig } from "@/lib/types";

export const appConfig: AppConfig = {
  // --- Branding / UI ---
  pageTitle: "ArgueMentor",
  pageDescription: "Multi-agent debate coach & judge.",
  companyName: "Intelcode",
  logo: "/logo.svg", // update to your asset path
  startButtonText: "Start Session", // customize as needed

  // --- Input / Features ---
  supportsChatInput: true,
  supportsVideoInput: false, // set true if you use camera
  supportsScreenShare: false, // set true if you allow screenshare
  isPreConnectBufferEnabled: true, // you’re using preConnectBuffer in code

  // --- Agent / Backend ---
  // keep these only if AppConfig actually has them in your types;
  // if not, REMOVE them here and from where they’re referenced.
  serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL ?? "",
  tokenEndpoint: "/api/connection-details",

  // --- Optional extras used in your hook ---
  sandboxId: process.env.NEXT_PUBLIC_SANDBOX_ID,
  agentName: process.env.NEXT_PUBLIC_AGENT_NAME,
};
