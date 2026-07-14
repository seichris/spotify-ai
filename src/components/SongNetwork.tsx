"use client";

import SongMap from "@/components/network/SongMap";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

interface SongNetworkProps {
  onCandidateSaved?: (track: EnrichedTrack) => void;
  onPlaySong?: (track: EnrichedTrack) => boolean | Promise<boolean>;
  songs: EnrichedTrack[];
}

export default function SongNetwork({
  onCandidateSaved,
  onPlaySong,
  songs,
}: SongNetworkProps) {
  return (
    <SongMap
      onCandidateSaved={onCandidateSaved}
      onPlaySong={onPlaySong}
      songs={songs}
    />
  );
}
