// hooks/useChatAndTranscription.ts
import { useMemo } from "react";
import {
  type ReceivedChatMessage,
  type TextStreamData,
  useChat,
  useRoomContext,
  useTranscriptions,
} from "@livekit/components-react";
import { transcriptionToChatMessage } from "@/lib/utils";

/** Safely extract text from any ReceivedChatMessage shape */
function getText(m: ReceivedChatMessage): string {
  const raw: any = (m as any).message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const t = raw.text ?? raw.content ?? raw.msg;
    if (typeof t === "string") return t;
  }
  return "";
}

/** Return a shallow clone with its `message` replaced by plain text */
function withText(m: ReceivedChatMessage, text: string): ReceivedChatMessage {
  return { ...(m as any), message: text } as unknown as ReceivedChatMessage;
}

/**
 * Collate adjacent messages from the same origin that arrive within a time window.
 * This turns token/fragment streams into natural, single bubbles.
 */
function collate(
  items: ReceivedChatMessage[],
  windowMs = 1500, // tune as you like (1.5s works well)
): ReceivedChatMessage[] {
  const out: ReceivedChatMessage[] = [];
  for (const m of items) {
    const text = getText(m).trim();
    if (!text) continue;

    const last = out[out.length - 1];
    const sameSpeaker =
      last &&
      !!last.from === !!m.from && // both have from
      (last.from?.identity ?? last.from?.sid) ===
        (m.from?.identity ?? m.from?.sid) &&
      (last.from?.isLocal ?? false) === (m.from?.isLocal ?? false);

    const closeInTime = last
      ? Math.abs((m.timestamp as number) - (last.timestamp as number)) <=
        windowMs
      : false;

    if (last && sameSpeaker && closeInTime) {
      // merge into the last bubble
      const merged = `${getText(last)} ${text}`.replace(/\s+/g, " ").trim();
      out[out.length - 1] = withText(
        {
          ...(last as any),
          id: `${(last as any).id}+${(m as any).id}`,
          timestamp: m.timestamp,
        } as any,
        merged,
      );
    } else {
      out.push(withText(m, text));
    }
  }
  return out;
}

export default function useChatAndTranscription() {
  const transcriptions: TextStreamData[] = useTranscriptions();
  const chat = useChat();
  const room = useRoomContext();

  const mergedCollated = useMemo(() => {
    // convert transcriptions to chat-shaped messages + include data-channel chat
    const raw: ReceivedChatMessage[] = [
      ...transcriptions.map((t) => transcriptionToChatMessage(t, room)),
      ...chat.chatMessages,
    ];

    // sort by time, then collate adjacent fragments
    const sorted = raw.sort(
      (a, b) => (a.timestamp as number) - (b.timestamp as number),
    );
    return collate(sorted, 1500);
  }, [transcriptions, chat.chatMessages, room]);

  return { messages: mergedCollated, send: chat.send };
}
