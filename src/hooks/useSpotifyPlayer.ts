"use client";

import { useState, useEffect, useCallback } from "react";

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady: () => void;
        Spotify: any;
    }
}

export function useSpotifyPlayer(token: string) {
    const [player, setPlayer] = useState<any>(null);
    const [isPaused, setIsPaused] = useState(true);
    const [isActive, setIsActive] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'Gemini Spotify Analyzer',
                getOAuthToken: (cb: any) => { cb(token); },
                volume: 0.5
            });

            player.addListener('ready', ({ device_id }: any) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
            });

            player.addListener('not_ready', ({ device_id }: any) => {
                console.log('Device ID has gone offline', device_id);
            });

            player.addListener('initialization_error', ({ message }: any) => {
                console.error('Failed to initialize', message);
            });

            player.addListener('authentication_error', ({ message }: any) => {
                console.error('Failed to authenticate', message);
            });

            player.addListener('player_state_changed', (state: any) => {
                if (!state) return;
                setCurrentTrack(state.track_window.current_track);
                setIsPaused(state.paused);
                player.getCurrentState().then((state: any) => {
                    setIsActive(!!state);
                });
            });

            player.connect();
            setPlayer(player);
        };

        return () => {
            if (player) player.disconnect();
        };
    }, [token]);

    const playTrack = useCallback(async (uri: string) => {
        if (!deviceId) return;
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [uri] }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
    }, [deviceId, token]);

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

    return { player, isPaused, isActive, currentTrack, playTrack, deviceId, togglePlay, nextTrack, previousTrack };
}
