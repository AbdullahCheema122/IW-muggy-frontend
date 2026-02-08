"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Room, RoomEvent } from "livekit-client";
import { motion } from "framer-motion";
import {
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
} from "@livekit/components-react";

import { SessionView } from "@/components/session-view";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { toastAlert } from "@/components/alert-toast";
import useConnectionDetails from "@/hooks/useConnectionDetails";
import { getClientAppConfig } from "@/lib/client-config";

export default function AgentStartedPage() {
  const router = useRouter();
  const params = useSearchParams();
  const displayName = params.get("name") || "Guest";

  const appConfig = getClientAppConfig();

  // LiveKit room
  const room = useMemo(() => new Room(), []);
  const [sessionStarted] = useState(true); // auto-start on this route
  const { connectionDetails, refreshConnectionDetails } =
    useConnectionDetails(appConfig);

  // Header timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  // Room events
  useEffect(() => {
    const onDisconnected = () => {
      refreshConnectionDetails();
      // Optional: stay here or go home
      // router.push('/');
    };
    const onMediaDevicesError = (error: Error) => {
      toastAlert({
        title: "Media devices error",
        description: `${error.name}: ${error.message}`,
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room, refreshConnectionDetails /*, router */]);

  // Connect on mount
  useEffect(() => {
    let aborted = false;
    if (sessionStarted && room.state === "disconnected" && connectionDetails) {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        room.connect(
          connectionDetails.serverUrl,
          connectionDetails.participantToken,
        ),
      ]).catch((error) => {
        if (aborted) return;
        toastAlert({
          title: "Error connecting to agent",
          description: `${error.name}: ${error.message}`,
        });
      });
    }
    return () => {
      aborted = true;
      room.disconnect();
    };
  }, [
    room,
    sessionStarted,
    connectionDetails,
    appConfig.isPreConnectBufferEnabled,
  ]);

  return (
    <>
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/40" />
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Glass header */}
      <header className="fixed inset-x-0 top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
            >
              ← Back
            </Button>
            <div className="hidden text-sm text-muted-foreground md:block">
              Session active • Signed in as{" "}
              <span className="font-medium">{displayName}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {mm}:{ss}
            </span>
            <span className="hidden md:inline">
              Press <kbd className="rounded border bg-muted px-1 py-0.5">/</kbd>{" "}
              to focus chat
            </span>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
      </header>

      {/* Main session canvas */}
      <main className="pt-12">
        <RoomContext.Provider value={room}>
          <RoomAudioRenderer />
          <StartAudio label="Start Audio" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SessionView
              appConfig={appConfig}
              disabled={!sessionStarted}
              sessionStarted={sessionStarted}
            />
          </motion.div>
        </RoomContext.Provider>
      </main>

      <Toaster />
    </>
  );
}
