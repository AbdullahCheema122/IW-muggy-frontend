// lib/client-config.ts
import type { AppConfig } from "@/lib/types";

const DEFAULTS: AppConfig = {
  // --- Branding / UI ---
  pageTitle: "Debate Coach AI",
  pageDescription: "Practice debates with Coach Dan + Judge Diane",
  companyName: "Debate Coach",
  logo: "/lk-logo.svg",
  logoDark: "/lk-logo-dark.svg",
  accent: "#22d3ee",
  accentDark: "#06b6d4",

  // --- Session / feature flags ---
  startButtonText: "Start Call",
  isPreConnectBufferEnabled: true,
  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,

  // --- Backend endpoints (required by AppConfig) ---
  // If you don’t want to hardcode these, set NEXT_PUBLIC_* env vars.
  serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL ?? "",
  tokenEndpoint:
    process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",

  // Optional fields your hook might read:
  // sandboxId: process.env.NEXT_PUBLIC_SANDBOX_ID,
  // agentName: process.env.NEXT_PUBLIC_AGENT_NAME,
};

export function getClientAppConfig(): AppConfig {
  return DEFAULTS;
}
