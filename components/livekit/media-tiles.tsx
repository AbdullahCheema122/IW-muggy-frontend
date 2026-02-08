// components/livekit/media-tiles.tsx
"use client";

import * as React from "react";
import { useMemo } from "react";
import { Track } from "livekit-client";
import {
  useLocalParticipant,
  useVoiceAssistant,
  type TrackReference,
} from "@livekit/components-react";
import { VideoTile } from "./video-tile";

// Minimal helper to get local camera track
function useLocalTrackRef(source: Track.Source): TrackReference | undefined {
  const { localParticipant } = useLocalParticipant();
  const pub = localParticipant.getTrackPublication(source);
  return useMemo(
    () =>
      pub
        ? { source, participant: localParticipant, publication: pub }
        : undefined,
    [pub, localParticipant, source],
  );
}

type Props = { chatOpen: boolean };

export function MediaTiles(_: Props) {
  const cameraTrack = useLocalTrackRef(Track.Source.Camera);
  const { videoTrack: agentVideoTrack } = useVoiceAssistant();

  // Prefer camera; if not available, optionally show agent video in center.
  const centerTrack = cameraTrack ?? agentVideoTrack;

  if (!centerTrack) return null;

  return <VideoTile trackRef={centerTrack} />;
}
