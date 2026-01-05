"use client";

import { Loader2 } from "lucide-react";
import Dashboard from "@/components/Dashboard";
import LoginPanel from "@/components/LoginPanel";
import { PlayerProvider } from "@/components/PlayerProvider";
import { SpotifyAuthProvider, useSpotifyAuth } from "@/hooks/useSpotifyAuth";

interface HomeGateProps {
    serverAccessToken: string | null;
    nextAuthEnabled: boolean;
    pkceEnabled: boolean;
    pkceClientId?: string | null;
}

function HomeGateContent({ nextAuthEnabled, pkceEnabled, pkceClientId }: Omit<HomeGateProps, "serverAccessToken">) {
    const { accessToken, isReady } = useSpotifyAuth();

    if (!isReady) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
                <Loader2 className="h-10 w-10 animate-spin text-green-500" />
                <p className="mt-4 text-zinc-400">Checking Spotify session...</p>
            </div>
        );
    }

    if (!accessToken) {
        return (
            <LoginPanel
                nextAuthEnabled={nextAuthEnabled}
                pkceEnabled={pkceEnabled}
                pkceClientId={pkceClientId}
            />
        );
    }

    return (
        <PlayerProvider token={accessToken}>
            <Dashboard />
        </PlayerProvider>
    );
}

export default function HomeGate({ serverAccessToken, nextAuthEnabled, pkceEnabled, pkceClientId }: HomeGateProps) {
    return (
        <SpotifyAuthProvider
            serverAccessToken={serverAccessToken}
            nextAuthEnabled={nextAuthEnabled}
            pkceEnabled={pkceEnabled}
        >
            <HomeGateContent
                nextAuthEnabled={nextAuthEnabled}
                pkceEnabled={pkceEnabled}
                pkceClientId={pkceClientId}
            />
        </SpotifyAuthProvider>
    );
}
