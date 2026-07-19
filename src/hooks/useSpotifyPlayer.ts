"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface SpotifyImage {
    url: string;
    height?: number;
    width?: number;
}

export interface SpotifyArtist {
    id?: string;
    name: string;
    uri?: string;
}

export interface SpotifyAlbum {
    images: SpotifyImage[];
    name?: string;
    uri?: string;
}

export interface SpotifyTrackInfo {
    id: string;
    uri: string;
    name: string;
    artists: SpotifyArtist[];
    album: SpotifyAlbum;
}

export interface SpotifyPlaybackState {
    paused: boolean;
    track_window: {
        current_track: SpotifyTrackInfo;
    };
}

export interface SpotifyWebPlaybackPlayer {
    connect: () => Promise<boolean>;
    disconnect: () => void;
    addListener: (event: string, callback: (payload: unknown) => void) => boolean;
    getCurrentState: () => Promise<SpotifyPlaybackState | null>;
    togglePlay: () => Promise<void>;
    nextTrack: () => Promise<void>;
    previousTrack: () => Promise<void>;
}

interface SpotifyWebPlaybackSDK {
    Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
    }) => SpotifyWebPlaybackPlayer;
}

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady: () => void;
        Spotify: SpotifyWebPlaybackSDK;
    }
}

export const addTrackToSpotifyQueue = async ({
    token,
    uri,
}: {
    token: string;
    uri: string;
}) => {
    const query = new URLSearchParams({ uri });

    const response = await fetch(
        `https://api.spotify.com/v1/me/player/queue?${query.toString()}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );
    if (!response.ok) {
        throw new Error(`Spotify queue update failed (${response.status})`);
    }
};

export function useSpotifyPlayer(token: string) {
    const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);
    const [player, setPlayer] = useState<SpotifyWebPlaybackPlayer | null>(null);
    const [isPaused, setIsPaused] = useState(true);
    const [isActive, setIsActive] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<SpotifyTrackInfo | null>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const sdkPlayer = new window.Spotify.Player({
                name: "Gemini Spotify Analyzer",
                getOAuthToken: (cb) => { cb(token); },
                volume: 0.5
            });

            sdkPlayer.addListener("ready", (payload) => {
                const { device_id } = payload as { device_id: string };
                console.log("Ready with Device ID", device_id);
                setDeviceId(device_id);
            });

            sdkPlayer.addListener("not_ready", (payload) => {
                const { device_id } = payload as { device_id: string };
                console.log("Device ID has gone offline", device_id);
            });

            sdkPlayer.addListener("initialization_error", (payload) => {
                const { message } = payload as { message: string };
                console.error("Failed to initialize", message);
            });

            sdkPlayer.addListener("authentication_error", (payload) => {
                const { message } = payload as { message: string };
                console.error("Failed to authenticate", message);
            });

            sdkPlayer.addListener("player_state_changed", (payload) => {
                const state = payload as SpotifyPlaybackState | null;
                if (!state) return;
                setCurrentTrack(state.track_window.current_track);
                setIsPaused(state.paused);
                sdkPlayer.getCurrentState().then((currentState) => {
                    setIsActive(!!currentState);
                });
            });

            sdkPlayer.connect();
            playerRef.current = sdkPlayer;
            setPlayer(sdkPlayer);
        };

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
        };
    }, [token]);

    const playTrack = useCallback(async (uri: string, queuedUris: string[] = []) => {
        if (!deviceId) throw new Error("No Spotify playback device is ready");
        const uris = Array.from(new Set([uri, ...queuedUris]));
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
        if (!response.ok) {
            throw new Error(`Spotify playback failed (${response.status})`);
        }
    }, [deviceId, token]);

    const queueTrack = useCallback(
        async (uri: string) => {
            await addTrackToSpotifyQueue({ token, uri });
        },
        [token],
    );

    const togglePlay = useCallback(() => {
        if (!player) return;
        player.togglePlay();
    }, [player]);

    const nextTrack = useCallback(() => {
        if (!player) return;
        player.nextTrack();
    }, [player]);

    const previousTrack = useCallback(() => {
        if (!player) return;
        player.previousTrack();
    }, [player]);

    return {
        player,
        isPaused,
        isActive,
        currentTrack,
        playTrack,
        queueTrack,
        deviceId,
        togglePlay,
        nextTrack,
        previousTrack,
    };
}
