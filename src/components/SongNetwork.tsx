"use client";

import SongMap from "@/components/network/SongMap";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

interface SongNetworkProps {
  libraryProgress: number;
  onCandidateSaved?: (track: EnrichedTrack) => void;
  onDiscoveryBusyChange?: (isBusy: boolean) => void;
  onPlaySong?: (track: EnrichedTrack) => boolean | Promise<boolean>;
  songs: EnrichedTrack[];
}

export default function SongNetwork({
  libraryProgress,
  onCandidateSaved,
  onDiscoveryBusyChange,
  onPlaySong,
  songs,
}: SongNetworkProps) {
  return (
    <SongMap
      libraryProgress={libraryProgress}
      onCandidateSaved={onCandidateSaved}
      onDiscoveryBusyChange={onDiscoveryBusyChange}
      onPlaySong={onPlaySong}
      songs={songs}
    />
  );
}
