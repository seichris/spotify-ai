"use client";

import SongMap from "@/components/network/SongMap";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

interface SongNetworkProps {
  libraryProgress: number;
  onCandidateSaved?: (track: EnrichedTrack) => void;
  onPlaySong?: (track: EnrichedTrack) => boolean | Promise<boolean>;
  songs: EnrichedTrack[];
}

export default function SongNetwork({
  libraryProgress,
  onCandidateSaved,
  onPlaySong,
  songs,
}: SongNetworkProps) {
  return (
    <SongMap
      libraryProgress={libraryProgress}
      onCandidateSaved={onCandidateSaved}
      onPlaySong={onPlaySong}
      songs={songs}
    />
  );
}
