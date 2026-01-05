"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSpotifyPlayer, SpotifyTrackInfo, SpotifyWebPlaybackPlayer } from "@/hooks/useSpotifyPlayer";

interface PlayerContextType {
    player: SpotifyWebPlaybackPlayer | null;
    isPaused: boolean;
    isActive: boolean;
    currentTrack: SpotifyTrackInfo | null;
    playTrack: (uri: string) => Promise<void>;
    deviceId: string | null;
    togglePlay: () => void;
    nextTrack: () => void;
    previousTrack: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children, token }: { children: ReactNode; token: string }) {
    const playerState = useSpotifyPlayer(token);

    return (
        <PlayerContext.Provider value={playerState}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("usePlayer must be used within a PlayerProvider");
    return context;
}
