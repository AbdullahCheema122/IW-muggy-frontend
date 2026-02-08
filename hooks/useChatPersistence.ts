// hooks/useChatPersistence.ts
"use client";

import * as React from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Conversation } from "@/lib/types";
import type { ReceivedChatMessage } from "@livekit/components-react";

function textOf(m: ReceivedChatMessage) {
  const raw: any = (m as any).message;
  if (typeof raw === "string") return raw;
  return raw?.text ?? raw?.content ?? (raw == null ? "" : String(raw));
}

// Broader “final-ish” detection for streamed payloads
function isFinalMessage(m: ReceivedChatMessage) {
  const raw: any = (m as any).message;
  return Boolean(
    raw?.final ||
      raw?.isFinal ||
      raw?.status === "final" ||
      raw?.type === "final" ||
      raw?.is_final_transcript === true,
  );
}

// Heuristic: treat as complete if it ends with sentence punctuation or is long
function looksComplete(text: string) {
  return /[.!?…]$/.test(text.trim()) || text.trim().length >= 80;
}

function sanitize(text: string) {
  let t = text;
  t = t.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");                       // word repeats
  t = t.replace(/(\b\w+\s+\w+\b)(?:\s+\1\b)+/gi, "$1");             // bigram repeats
  t = t.replace(/(\b\w+\s+\w+\s+\w+\b)(?:\s+\1\b)+/gi, "$1");       // trigram repeats
  t = t.replace(/\s+([,.!?;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return t;
}

export function useChatPersistence(opts: {
  userId?: string | null;
  userDisplayName?: string | null;
  messages: ReceivedChatMessage[];
  sessionStarted: boolean;
  activeConversation: Conversation | null;
  setActiveConversation: (c: Conversation) => void;
}) {
  const {
    userId,
    userDisplayName,
    messages,
    sessionStarted,
    activeConversation,
    setActiveConversation,
  } = opts;

  const savedLastId = React.useRef<string | null>(null);
  const lastSaved = React.useRef<{ role: "user" | "assistant"; text: string; t: number } | null>(null);
  const creatingRef = React.useRef(false);

  React.useEffect(() => {
    if (!sessionStarted || !userId || activeConversation || messages.length === 0 || creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      try {
        const nowMs = Date.now();
        const ref = await addDoc(collection(db, "conversations"), {
          userId,
          title: "New conversation",
          lastMessage: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setActiveConversation({
          id: ref.id,
          userId,
          title: "New conversation",
          lastMessage: "",
          createdAt: nowMs,
          updatedAt: nowMs,
        } as Conversation);
      } catch (err) {
        console.error("[useChatPersistence] create conversation failed:", err);
      } finally {
        creatingRef.current = false;
      }
    })();
  }, [userId, sessionStarted, messages.length, activeConversation, setActiveConversation]);

  React.useEffect(() => {
    if (!userId || !activeConversation || messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (!last || savedLastId.current === last.id) return;

    (async () => {
      try {
        const role: "user" | "assistant" = last.from?.isLocal ? "user" : "assistant";
        const raw = (textOf(last) || "").trim();
        const text = sanitize(raw);
        if (!text) { savedLastId.current = last.id; return; }

        // Gate saves:
        // - Always save user lines (typed/sent)
        // - For assistant, save if marked final OR looks complete (punctuation/length)
        const finalish = role === "user" || isFinalMessage(last) || looksComplete(text);
        if (!finalish) return;

        // De-dupe same text within 2s
        const now = Date.now();
        if (lastSaved.current && lastSaved.current.role === role && lastSaved.current.text === text && now - lastSaved.current.t < 2000) {
          savedLastId.current = last.id;
          return;
        }

        const author =
          role === "user"
            ? (userDisplayName?.trim() || "You")
            : (last.from?.name?.trim() || "Coach");

        await addDoc(collection(db, "conversations", activeConversation.id, "messages"), {
          role,
          author,
          text,
          at: now,
        });

        await updateDoc(doc(db, "conversations", activeConversation.id), {
          updatedAt: serverTimestamp(),
          lastMessage: text.slice(0, 120),
        });

        if (activeConversation.title === "New conversation" && role === "user") {
          const firstLine = text.split("\n").find(Boolean) ?? "New conversation";
          await updateDoc(doc(db, "conversations", activeConversation.id), {
            title: firstLine.slice(0, 60),
          });
        }

        savedLastId.current = last.id;
        lastSaved.current = { role, text, t: now };
      } catch (err) {
        console.error("[useChatPersistence] append message failed:", err);
      }
    })();
  }, [messages, userId, activeConversation, userDisplayName]);
}
