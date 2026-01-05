"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Music2, ShieldCheck, Sparkles } from "lucide-react";
import { startPkceLogin } from "@/lib/spotifyPkce";

interface LoginPanelProps {
    nextAuthEnabled: boolean;
    pkceEnabled: boolean;
    pkceClientId?: string | null;
}

export default function LoginPanel({ nextAuthEnabled, pkceEnabled, pkceClientId }: LoginPanelProps) {
    const [pkceError, setPkceError] = useState<string | null>(null);

    const handlePkceLogin = async () => {
        setPkceError(null);
        try {
            await startPkceLogin(pkceClientId ?? undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to start PKCE login";
            setPkceError(message);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 text-center">
                <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-4 bg-green-500 rounded-full">
                        <Music2 className="h-12 w-12 text-black" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Spotify Analyzer</h1>
                    <p className="text-zinc-400">
                        Unlock insights from your music library. Sort by vibe, energy, and more.
                    </p>
                </div>

                <div className="space-y-3">
                    <Button
                        size="lg"
                        className="w-full text-lg"
                        onClick={() => signIn("spotify", { callbackUrl: "/" })}
                        disabled={!nextAuthEnabled}
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Connect with Spotify (Server)
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="w-full text-lg"
                        onClick={handlePkceLogin}
                        disabled={!pkceEnabled}
                    >
                        <Sparkles className="mr-2 h-5 w-5" />
                        Connect with Spotify (Browser Only)
                    </Button>
                </div>

                {pkceError ? (
                    <p className="text-xs text-rose-400">{pkceError}</p>
                ) : null}

                {!nextAuthEnabled || !pkceEnabled ? (
                    <div className="text-xs text-zinc-500 space-y-1">
                        {!nextAuthEnabled ? (
                            <p>Server login requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET.</p>
                        ) : null}
                        {!pkceEnabled ? (
                            <p>Browser login requires a Spotify client ID (SPOTIFY_CLIENT_ID or NEXT_PUBLIC_SPOTIFY_CLIENT_ID).</p>
                        ) : null}
                    </div>
                ) : (
                    <p className="text-xs text-zinc-500">
                        If you are already logged into Spotify in this browser, the consent step is quick.
                    </p>
                )}

                <p className="text-xs text-zinc-500">
                    Spotify Premium required for playback.
                </p>
            </div>
        </div>
    );
}
