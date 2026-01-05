"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { exchangePkceCode } from "@/lib/spotifyPkce";

export default function PkceCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const error = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    const [message, setMessage] = useState(() => {
        if (error) {
            return `Spotify login failed: ${error}`;
        }
        if (!code) {
            return "Missing Spotify authorization code.";
        }
        return "Completing Spotify login...";
    });

    useEffect(() => {
        if (error || !code) return;

        exchangePkceCode(code, state)
            .then(() => {
                setMessage("Spotify connected. Redirecting...");
                router.replace("/");
            })
            .catch((err) => {
                const text = err instanceof Error ? err.message : "Failed to connect Spotify";
                setMessage(text);
            });
    }, [code, error, router, state]);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
            <p className="mt-4 text-zinc-400">{message}</p>
        </div>
    );
}
