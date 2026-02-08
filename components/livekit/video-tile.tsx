// components/livekit/video-tile.tsx
"use client";

import * as React from "react";
import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { cn } from "@/lib/utils";

type Props = {
  trackRef: TrackReference;
  /** Optional extra classes for the outer container */
  className?: string;
};

/**
 * A very simple centered camera tile.
 * - Centers the video both horizontally & vertically
 * - Makes it big (but not full screen), responsive
 * - No framer-motion, no extra logic
 */
export const VideoTile = React.forwardRef<HTMLDivElement, Props>(
  ({ trackRef, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Full screen “stage” area, but allow the control bar at the bottom
          "pointer-events-none fixed inset-x-0 top-5 bottom-98 z-30",
          "flex items-center justify-center",
          "bg-transparent", // keep your page bg
          className,
        )}
      >
        {/* The video element itself */}
        <VideoTrack
          trackRef={trackRef}
          // Size the <video>; “object-cover” will crop gracefully to fill
          className={cn(
            "pointer-events-auto", // allow context menu if you need it
            "rounded-2xl shadow-2xl",
            "object-cover",
            // Large but responsive:
           "w-[65vw] max-w-[520px]",
           "h-[40vh] max-h-[280px]"
          )}
        />
      </div>
    );
  },
);

VideoTile.displayName = "VideoTile";
