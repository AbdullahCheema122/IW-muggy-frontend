import type { TranscriptionSegment } from "livekit-client";

export interface CombinedTranscription extends TranscriptionSegment {
  role: "assistant" | "user";
  receivedAtMediaTimestamp: number;
  receivedAt: number;
}

export interface VisemeData {
  time: number;
  blend: {
    [blendShape: string]: number;
  };
}

export type ThemeMode = "dark" | "light" | "system";
export type ChatRole = "user" | "assistant";

export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;
  supportsChatInput: boolean;

  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  // ✅ Add the properties you are actually using
  serverUrl: string;
  agentUrl: string;
  tokenEndpoint: string;

  logo: string;
  logoDark?: string;
  accent?: string;
  accentDark?: string;
  startButtonText: string;

  sandboxId?: string;
  agentName?: string;
}

export type Conversation = {
  id: string;
  userId: string;
  title: string; // first user message or custom title
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  messagesCount: number;
  lastMessage?: string;
};

export type ConversationMessage = {
  id: string;
  role: ChatRole; // 'user' | 'assistant'
  text: string;
  at: number; // epoch ms
};

export interface SandboxConfig {
  [key: string]:
    | { type: "string"; value: string }
    | { type: "number"; value: number }
    | { type: "boolean"; value: boolean }
    | null;
}
