// app-config.ts
import type { AppConfig } from "@/lib/types";

export const APP_CONFIG_DEFAULTS: AppConfig = {
  // --- Branding / UI ---
  companyName: "Debate Coach",
  pageTitle: "Debate Coach AI",
  pageDescription: "Practice debates with Coach Dan + Judge Diane",
  logo: "/lk-logo.svg",
  logoDark: "/lk-logo-dark.svg",
  accent: "#22d3ee",
  accentDark: "#06b6d4",
  startButtonText: "Start Call",

  // --- Feature flags ---
  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  // --- Required backend fields (fixes TS error) ---
  serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL ?? "",
  tokenEndpoint:
    process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",

  // --- Optional extras used elsewhere (ok if undefined) ---
  sandboxId: process.env.NEXT_PUBLIC_SANDBOX_ID,
  agentName: process.env.NEXT_PUBLIC_AGENT_NAME,
};
