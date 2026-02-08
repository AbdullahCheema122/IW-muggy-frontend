/* ============================================================
   SessionView.tsx (UPDATED FULL FILE)
   - Stars ONLY increment from backend "stars-awarded" event (awardId)
   - NO Firestore increment from spoken text (prevents double/triple awards)
   - NEW: Detects [[IMG: ...]] tags in Muggy messages
          Calls /api/images/generate and shows image in chat
   - Keeps: Azure ARKit frames + audio jaw + equip-item send
============================================================ */
"use client";

import React, { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRoomContext } from "@livekit/components-react";
import type { RemoteTrack, RemoteTrackPublication, Room as LKRoom } from "livekit-client";
import { useRouter } from "next/navigation";

import { AgentControlBar } from "@/components/livekit/agent-control-bar/agent-control-bar";
import { ChatEntry } from "@/components/livekit/chat/chat-entry";
import useChatAndTranscription from "@/hooks/useChatAndTranscription";
import type { AppConfig, Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useConversations } from "@/hooks/useConversations";
import { useChatPersistence } from "@/hooks/useChatPersistence";

import { doc, updateDoc, increment, serverTimestamp, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Trophy, Star, Home, Image as ImageIcon } from "lucide-react";
import AvatarBubble, { type MorphMap } from "@/components/AvatarBubble";

const FEEDBACK_DONE_RX = /\[\[FEEDBACK_COMPLETE\]\]/;

// Spoken reward text can exist, but we do NOT increment Firestore from it anymore.
const REWARD_SPOKEN_RX =
  /\b(?:you\s*(?:got|get|earned|win|won|receive|received)|i'?m\s*(?:adding|giving)|adding|giving|awarding|awarded|here\s*(?:are|is))\s*(\d+)\s*(?:star|stars)\b/i;

// NEW: image tag e.g. [[IMG: a blue bird on a branch]]
const IMG_TAG_RX = /\[\[IMG:\s*([^\]]+?)\s*\]\]/i;

type SessionViewProps = {
  appConfig: AppConfig;
  disabled: boolean;
  sessionStarted: boolean;
  className?: string;
};

type EquippedVisuals = {
  head?: string;
  body?: string;
  effect?: string;
};

const AZURE_ARKIT_52 = [
  "eyeBlinkLeft",
  "eyeLookDownLeft",
  "eyeLookInLeft",
  "eyeLookOutLeft",
  "eyeLookUpLeft",
  "eyeSquintLeft",
  "eyeWideLeft",
  "eyeBlinkRight",
  "eyeLookDownRight",
  "eyeLookInRight",
  "eyeLookOutRight",
  "eyeLookUpRight",
  "eyeSquintRight",
  "eyeWideRight",
  "jawForward",
  "jawLeft",
  "jawRight",
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthLeft",
  "mouthRight",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "cheekPuff",
  "cheekSquintLeft",
  "cheekSquintRight",
  "noseSneerLeft",
  "noseSneerRight",
  "tongueOut",
] as const;

function buildArkitMorphMap(): MorphMap {
  const mm: MorphMap = {};
  for (const k of AZURE_ARKIT_52) (mm as any)[k] = [k];
  return mm;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/* --- Audio/Viseme Hooks --- */
function useAzureArkitFramesPlayer(args: { audioJawRef: React.MutableRefObject<number> }) {
  const weightsRef = useRef<Record<string, number>>({});
  const smoothRef = useRef<Record<string, number>>({});
  const queueRef = useRef<number[][]>([]);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    let raf = 0;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);

      if (queueRef.current.length > 0 && t - lastFrameRef.current >= 16) {
        const frame = queueRef.current.shift()!;
        const next: Record<string, number> = {};

        for (let i = 0; i < AZURE_ARKIT_52.length; i++) {
          const k = AZURE_ARKIT_52[i];
          if (k === "mouthClose") continue;

          let v = clamp01(frame[i] ?? 0);
          if (k === "jawOpen") v = Math.max(v, args.audioJawRef.current);
          next[k] = v;
        }

        const out: Record<string, number> = {};
        for (const k of AZURE_ARKIT_52) {
          if (k === "mouthClose") continue;
          const prev = smoothRef.current[k] || 0;
          const y = prev * 0.35 + next[k] * 0.65;
          smoothRef.current[k] = y;
          out[k] = y;
        }

        weightsRef.current = out;
        lastFrameRef.current = t;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [args.audioJawRef]);

  return {
    weightsRef,
    handleAzureArkitMessage: (msg: any) => {
      if (msg?.frames && Array.isArray(msg.frames)) queueRef.current.push(...msg.frames);
    },
  };
}

function useAudioJaw(audioElRef: React.MutableRefObject<HTMLAudioElement | null>, audioReadyTick: number) {
  const jawRef = useRef(0);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AudioCtx();
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(ctx.destination);

    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);

      if (audio.paused || audio.ended || audio.muted) {
        jawRef.current = 0;
        return;
      }

      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      const target = rms < 0.012 ? 0 : Math.min(1, rms * 2.5);
      jawRef.current = jawRef.current * 0.8 + target * 0.2;
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
    };
  }, [audioElRef, audioReadyTick]);

  return jawRef;
}

/* ---------------------------
   Star Burst + Coin Shower
--------------------------- */
function StarBurst({ add }: { add: number }) {
  const stars = [
    { x: -70, y: -55, r: -18, s: 1.0 },
    { x: 70, y: -55, r: 16, s: 0.95 },
    { x: -75, y: 55, r: 12, s: 0.9 },
    { x: 75, y: 55, r: -10, s: 0.92 },
  ];

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-[999]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute top-8 right-8 bg-yellow-300 text-yellow-900 border-4 border-white rounded-full px-4 py-2 font-black shadow-lg"
        initial={{ scale: 0.4, y: -10, opacity: 0 }}
        animate={{ scale: 1.05, y: 0, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 18 }}
      >
        +{add} STARS!
      </motion.div>

      {stars.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2"
          initial={{ x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: p.s, rotate: p.r, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.02 * i }}
        >
          <motion.div initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
            <Star size={64} className="text-yellow-400" fill="currentColor" />
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function CoinShower({ add }: { add: number }) {
  const count = Math.max(12, Math.min(34, 14 + Math.floor(add / 2)));
  const [h, setH] = useState<number>(900);

  useEffect(() => {
    setH(window.innerHeight || 900);
  }, []);

  const coins = useMemo(() => {
    const arr: any[] = [];
    for (let i = 0; i < count; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.25;
      const duration = 1.0 + Math.random() * 0.9;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720);
      const drift = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 60);
      const size = 10 + Math.random() * 16;
      const opacity = 0.85 + Math.random() * 0.15;
      arr.push({ left, delay, duration, spin, drift, size, opacity, key: i });
    }
    return arr;
  }, [count]);

  return (
    <motion.div className="fixed inset-0 pointer-events-none z-[998]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {coins.map((c) => (
        <motion.div
          key={c.key}
          className="absolute top-0"
          style={{ left: `${c.left}%`, opacity: c.opacity }}
          initial={{ y: -50, x: 0, rotate: 0, scale: 0.8 }}
          animate={{ y: h + 80, x: c.drift, rotate: c.spin, scale: 1 }}
          transition={{ delay: c.delay, duration: c.duration, ease: "easeIn" }}
        >
          <div
            className="rounded-full border-2 border-white shadow-[0_8px_0_rgba(0,0,0,0.08)]"
            style={{
              width: c.size,
              height: c.size,
              background: "radial-gradient(circle at 30% 30%, #FFF6A5 0%, #FFD54A 35%, #F6A700 75%, #C77800 100%)",
            }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ---------------------------
   Firestore: ensure user doc exists
--------------------------- */
async function ensureUserDoc(u: any) {
  if (!u?.uid) return;
  const userRef = doc(db, "users", u.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;

  await setDoc(
    userRef,
    {
      uid: u.uid,
      displayName: u.displayName || "Hero",
      email: u.email || "",
      photoURL: u.photoURL || "",
      stars: 0,
      lessons: 0,
      trophies: 0,
      equipped: { head: "", body: "", effect: "" },
      inventory: {},
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    },
    { merge: true }
  );
}

type ImgState = {
  status: "idle" | "loading" | "ready" | "error";
  prompt: string;
  url?: string;
  error?: string;
};

function stripImgTag(text: string) {
  return text.replace(IMG_TAG_RX, "").replace(/\n{3,}/g, "\n\n").trim();
}

export const SessionView = forwardRef<HTMLDivElement, SessionViewProps>(({ appConfig, disabled, sessionStarted, className }, ref) => {
  const router = useRouter();
  const { user } = useAuth();
  const room = useRoomContext();

  const { messages, send } = useChatAndTranscription();

  const [liveStars, setLiveStars] = useState(0);
  const [equipped, setEquipped] = useState<EquippedVisuals>({});
  const lastSentEquipRef = useRef<EquippedVisuals>({ head: "", body: "", effect: "" });

  const [starBurst, setStarBurst] = useState<{ key: number; add: number } | null>(null);
  const [coinShower, setCoinShower] = useState<{ key: number; add: number } | null>(null);

  const seenAwardIdsRef = useRef<Set<string>>(new Set());

  const agentAudioElRef = useRef<HTMLAudioElement | null>(null);
  const audioMountRef = useRef<HTMLDivElement | null>(null);

  const [audioReadyTick, setAudioReadyTick] = useState(0);

  const audioJawRef = useAudioJaw(agentAudioElRef, audioReadyTick);
  const { weightsRef: visemeWeightsRef, handleAzureArkitMessage } = useAzureArkitFramesPlayer({ audioJawRef });

  const { items: convs } = useConversations(user?.uid);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  useChatPersistence({ userId: user?.uid, messages, sessionStarted, activeConversation, setActiveConversation });

  const MJ_MODEL_URL = "/models/IW-Cup.glb";
  const MJ_MORPH_MAP: MorphMap = useMemo(() => buildArkitMorphMap(), []);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // NEW: image generation state per message id
  const [imgByMsgId, setImgByMsgId] = useState<Record<string, ImgState>>({});

  const handleSendMessage = async (message: string) => {
    await send(message);
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  // Firestore: live stars + equipped
  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, "users", user.uid);

    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.exists() ? (snap.data() as any) : {};
      setLiveStars(Number(data?.stars || 0));

      const eq = (data?.equipped || {}) as EquippedVisuals;
      setEquipped({
        head: eq.head || "",
        body: eq.body || "",
        effect: eq.effect || "",
      });
    });

    return () => unsub();
  }, [user?.uid]);

  // Send equip changes to Muggy
  useEffect(() => {
    const r = room as LKRoom | undefined;
    if (!r) return;

    const sendEquip = (slot: keyof EquippedVisuals, itemId: string) => {
      if (!itemId) return;
      const payload = new TextEncoder().encode(JSON.stringify({ type: "equip-item", slot, itemId }));

      try {
        (r.localParticipant as any).publishData(payload, { reliable: true });
        return;
      } catch {}
      try {
        (r.localParticipant as any).publishData(payload, true);
        return;
      } catch {}
      try {
        (r.localParticipant as any).publishData(payload);
      } catch {}
    };

    const prev = lastSentEquipRef.current;

    (["head", "body", "effect"] as (keyof EquippedVisuals)[]).forEach((slot) => {
      const nextVal = equipped?.[slot] || "";
      const prevVal = prev?.[slot] || "";
      if (nextVal !== prevVal && nextVal) sendEquip(slot, nextVal);
    });

    lastSentEquipRef.current = { ...equipped };
  }, [equipped, room]);

  // Apply stars ONCE (only from stars-awarded event)
  const applyAwardOnce = async (awardId: string, pts: number) => {
    if (!user?.uid) return;
    if (!pts) return;

    if (seenAwardIdsRef.current.has(awardId)) return;
    seenAwardIdsRef.current.add(awardId);

    const k = Date.now();
    setStarBurst({ key: k, add: pts });
    setCoinShower({ key: k + 1, add: pts });
    window.setTimeout(() => setStarBurst(null), 1500);
    window.setTimeout(() => setCoinShower(null), 1700);

    await ensureUserDoc(user);
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { stars: increment(pts), lastActive: serverTimestamp() });
  };

  // OPTIONAL: spoken reward detection (NO Firestore update)
  useEffect(() => {
    if (!messages?.length) return;
    const last = messages[messages.length - 1] as any;
    const isFromMuggy = !last?.from?.isLocal;
    if (!isFromMuggy) return;

    const text = typeof last?.message === "string" ? last.message : last?.message?.text || "";
    if (!text) return;

    const m = text.match(REWARD_SPOKEN_RX);
    if (!m) return;

    // no-op (kept only as a detector if you ever want FX fallback)
  }, [messages]);

  // NEW: detect [[IMG: ...]] and generate image once per message
  useEffect(() => {
    if (!messages?.length) return;

    const last = messages[messages.length - 1] as any;
    const isFromMuggy = !last?.from?.isLocal;
    if (!isFromMuggy) return;

    const msgId = String(last?.id || "");
    if (!msgId) return;

    const rawText = typeof last?.message === "string" ? last.message : last?.message?.text || "";
    if (!rawText) return;

    const m = rawText.match(IMG_TAG_RX);
    if (!m) return;

    const prompt = String(m[1] || "").trim();
    if (!prompt) return;

    // already started?
    if (imgByMsgId[msgId]?.status === "loading" || imgByMsgId[msgId]?.status === "ready") return;

    setImgByMsgId((prev) => ({
      ...prev,
      [msgId]: { status: "loading", prompt },
    }));

    (async () => {
      try {
        const res = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: `Kid-friendly, bright, simple, educational illustration. ${prompt}. No scary elements. High clarity.`,
            size: "1024x1024",
            style: "kids_kawaii_sticker", // 👈 this forces cute anime sticker look
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.ok || !data?.image) {
          throw new Error(data?.error || "Image generation failed");
        }

        setImgByMsgId((prev) => ({
          ...prev,
          [msgId]: { status: "ready", prompt, url: String(data.image) },
        }));
      } catch (e: any) {
        setImgByMsgId((prev) => ({
          ...prev,
          [msgId]: { status: "error", prompt, error: e?.message || "Failed" },
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const feedbackComplete = useMemo(() => {
    const text = messages.map((m: any) => (typeof m.message === "string" ? m.message : m.message?.text)).join("");
    return FEEDBACK_DONE_RX.test(text);
  }, [messages]);

  const handleRewardClick = async () => {
    if (!user?.uid) return;
    const userRef = doc(db, "users", user.uid);
    await ensureUserDoc(user);

    await updateDoc(userRef, {
      lessons: increment(1),
      trophies: increment(1),
      lastActive: serverTimestamp(),
    });

    router.push("/dashboard");
  };

  // Mount agent audio
  useEffect(() => {
    const r = room as LKRoom | undefined;
    if (!r) return;

    const onSub = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (track.kind === "audio" && (pub as any).trackName === "agent-tts") {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.muted = false;
        el.setAttribute("playsinline", "true");
        el.setAttribute("webkit-playsinline", "true");
        el.srcObject = new MediaStream([(track as any).mediaStreamTrack]);

        if (audioMountRef.current) {
          audioMountRef.current.innerHTML = "";
          audioMountRef.current.appendChild(el);
        }
        agentAudioElRef.current = el;

        setAudioReadyTick((n) => n + 1);
        el.play?.().catch(() => {});
      }
    };

    r.on("trackSubscribed", onSub as any);
    return () => {
      r.off("trackSubscribed", onSub as any);
    };
  }, [room]);

  // LiveKit data: visemes + stars-awarded + muggy-visual-update
  useEffect(() => {
    const r = room as LKRoom | undefined;
    if (!r) return;

    let alive = true;

    const onData = (payload: Uint8Array) => {
      try {
        const obj = JSON.parse(new TextDecoder().decode(payload));

        if (obj?.type === "azure-viseme") {
          handleAzureArkitMessage(obj);
          return;
        }

        if (obj?.type === "stars-awarded") {
          if (!alive) return;
          const awardId = String(obj?.awardId || "");
          const pts = Number(obj?.points || 0);
          if (!awardId || !pts) return;

          applyAwardOnce(awardId, pts);
          return;
        }

        if (obj?.type === "muggy-visual-update") {
          const v = obj?.visuals || {};
          setEquipped({
            head: v.head || "",
            body: v.body || "",
            effect: v.effect || "",
          });
          return;
        }
      } catch {
        // ignore
      }
    };

    const wrapped = (...args: any[]) => {
      const payload = args?.[0];
      if (payload instanceof Uint8Array) onData(payload);
    };

    r.on("dataReceived", wrapped as any);
    return () => {
      alive = false;
      r.off("dataReceived", wrapped as any);
    };
  }, [room, handleAzureArkitMessage]);

  // Auto scroll
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <main ref={ref} className={cn("relative min-h-screen bg-[#E0F7FA] font-[var(--font-comic-sans)]", className)}>
      <div ref={audioMountRef} className="hidden" />

      <AnimatePresence>{starBurst && <StarBurst key={starBurst.key} add={starBurst.add} />}</AnimatePresence>
      <AnimatePresence>{coinShower && <CoinShower key={coinShower.key} add={coinShower.add} />}</AnimatePresence>

      <header className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="mx-auto max-w-7xl flex justify-between items-center bg-white/90 rounded-full px-6 py-2 shadow-xl border-4 border-white">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-blue-600 font-black text-xl">
            <Home className="text-pink-500" /> MUGGY TALK
          </button>

          <div className="flex items-center gap-2 bg-yellow-100 px-4 py-1 rounded-full border-2 border-yellow-400 text-yellow-700 font-black">
            <Star size={18} fill="currentColor" /> {liveStars} STARS
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 pt-24 pb-44">
        <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-10 items-start">
          <div className="lg:sticky lg:top-28 self-start">
            <div className="flex justify-center lg:justify-start">
              <AvatarBubble modelUrl={MJ_MODEL_URL} size={420} visemeWeightsRef={visemeWeightsRef as any} morphMap={MJ_MORPH_MAP} visuals={equipped as any} />
            </div>

            <div className="hidden lg:block mt-6 rounded-[30px] border-4 border-white bg-white/60 p-4 shadow-lg">
              <div className="font-black text-blue-800 mb-3">Recent</div>
              <ul className="space-y-2">
                {convs.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => router.push(`/history/${c.id}`)}
                      className="w-full text-left p-3 rounded-2xl bg-white/80 border-b-4 border-blue-100 font-bold text-blue-800 text-xs truncate"
                    >
                      🎒 {c.title || "Quest"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="relative">
            <div
              ref={chatScrollRef}
              className={cn(
                "w-full rounded-[34px] border-4 border-white bg-white/55 shadow-xl",
                "p-5 md:p-6",
                "h-[calc(100vh-26rem)]",
                "overflow-y-auto overscroll-contain"
              )}
            >
              <div className="space-y-4">
                <AnimatePresence>
                  {messages.map((msg: any) => {
                    const isUser = !!msg.from?.isLocal;
                    const msgId = String(msg.id || "");
                    const rawText = typeof msg?.message === "string" ? msg.message : msg.message?.text || "";
                    const cleanedText = isUser ? rawText : stripImgTag(rawText);

                    const imgState = msgId ? imgByMsgId[msgId] : undefined;
                    const showImgBlock = !!imgState && !isUser;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] md:max-w-[75%]",
                            "px-6 py-5",
                            "rounded-[32px]",
                            "border-4 shadow-lg",
                            "font-bold text-[18px] leading-relaxed",
                            isUser
                              ? [
                                  "text-white border-white/70",
                                  "bg-gradient-to-br from-[#2B7BFF] via-[#6B5CFF] to-[#FF4FD8]",
                                  "shadow-[0_18px_40px_rgba(59,130,246,0.22)]",
                                ].join(" ")
                              : ["bg-white text-blue-900 border-blue-100", "shadow-[0_18px_40px_rgba(0,0,0,0.08)]"].join(" ")
                          )}
                        >
                          {/* Render cleaned text (without IMG tag) */}
                          <ChatEntry hideName entry={{ ...msg, message: cleanedText }} />

                          {/* Image block */}
                          {showImgBlock && (
                            <div className="mt-4">
                              <div className="flex items-center gap-2 text-blue-800 font-black mb-2">
                                <ImageIcon size={18} /> Picture time!
                              </div>

                              {imgState.status === "loading" && (
                                <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4">
                                  Generating an image…
                                  <div className="text-xs opacity-70 mt-1">{imgState.prompt}</div>
                                </div>
                              )}

                              {imgState.status === "error" && (
                                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-700">
                                  Image failed: {imgState.error || "Unknown error"}
                                </div>
                              )}

                              {imgState.status === "ready" && imgState.url && (
                                <div className="rounded-2xl overflow-hidden border-2 border-blue-100 bg-white">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={imgState.url} alt={imgState.prompt} className="w-full h-auto block" />
                                  <div className="p-3 text-xs opacity-70">{imgState.prompt}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>
      </div>

      {feedbackComplete && (
        <div className="fixed inset-x-0 bottom-36 z-50 px-6">
          <div className="max-w-md mx-auto bg-yellow-400 p-1 rounded-[35px] shadow-lg">
            <div className="bg-white rounded-[30px] p-5 flex items-center justify-between border-4 border-yellow-200">
              <div className="flex items-center gap-4">
                <Trophy className="text-yellow-600 h-8 w-8" />
                <span className="font-black text-blue-900 text-xl italic uppercase">Quest Done!</span>
              </div>
              <button onClick={handleRewardClick} className="bg-green-500 text-white font-black px-8 py-3 rounded-2xl">
                Reward
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 p-6">
        <div className="max-w-4xl mx-auto rounded-[50px] bg-white border-[10px] border-white shadow-2xl overflow-hidden">
          <AgentControlBar
            capabilities={{
              supportsChatInput: appConfig.supportsChatInput,
              supportsVideoInput: appConfig.supportsVideoInput,
              supportsScreenShare: appConfig.supportsScreenShare,
            }}
            onChatOpenChange={() => {}}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>
    </main>
  );
});

SessionView.displayName = "SessionView";
