"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

export interface SongMapProps {
  libraryProgress: number;
  onCandidateSaved?: (track: EnrichedTrack) => void;
  onDiscoveryBusyChange?: (isBusy: boolean) => void;
  onPlaySong?: (track: EnrichedTrack) => boolean | Promise<boolean>;
  songs: EnrichedTrack[];
}

export default function SongMap(props: SongMapProps) {
  const [MapClient, setMapClient] = useState<ComponentType<SongMapProps> | null>(
    null,
  );
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    import("@/components/network/SongMapClient")
      .then((module) => {
        if (active) setMapClient(() => module.default);
      })
      .catch((error) => {
        console.error("Failed to load the WebGL song map", error);
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <div role="alert" className="flex h-dvh items-center justify-center bg-zinc-950 px-6 text-center text-sm text-red-300">
        This browser could not start the WebGL song map. Try enabling hardware
        acceleration or opening the app in a current browser.
      </div>
    );
  }

  if (!MapClient) {
    const normalizedProgress = Math.max(
      0,
      Math.min(100, Math.round(props.libraryProgress)),
    );

    return (
      <div role="status" className="flex h-dvh items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Starting WebGL map… {normalizedProgress}%
      </div>
    );
  }

  return <MapClient {...props} />;
}
