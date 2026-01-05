"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearPkceAuth, getPkceAuth, isPkceTokenExpired, refreshPkceAuth, type SpotifyPkceAuth } from "@/lib/spotifyPkce";
import { signOutAction } from "@/app/actions";

export type SpotifyAuthMode = "nextauth" | "pkce" | "none";

interface SpotifyAuthContextValue {
    mode: SpotifyAuthMode;
    accessToken: string | null;
    isReady: boolean;
    nextAuthEnabled: boolean;
    pkceEnabled: boolean;
    ensureValidToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
}

const SpotifyAuthContext = createContext<SpotifyAuthContextValue | null>(null);

interface SpotifyAuthProviderProps {
    children: ReactNode;
    serverAccessToken: string | null;
    nextAuthEnabled: boolean;
    pkceEnabled: boolean;
}

const resolvePkceAuth = async (stored: SpotifyPkceAuth | null) => {
    if (!stored) return null;
    if (!isPkceTokenExpired(stored)) return stored;
    if (!stored.refresh_token) return null;
    return refreshPkceAuth(stored);
};

export function SpotifyAuthProvider({
    children,
    serverAccessToken,
    nextAuthEnabled,
    pkceEnabled,
}: SpotifyAuthProviderProps) {
    const initialPkce = (() => {
        if (!pkceEnabled) return null;
        const stored = getPkceAuth();
        if (!stored || isPkceTokenExpired(stored)) return null;
        return stored;
    })();

    const [mode, setMode] = useState<SpotifyAuthMode>(() => {
        if (serverAccessToken) return "nextauth";
        if (initialPkce) return "pkce";
        return "none";
    });
    const [accessToken, setAccessToken] = useState<string | null>(() => {
        if (serverAccessToken) return serverAccessToken;
        if (initialPkce) return initialPkce.access_token;
        return null;
    });
    const [isReady, setIsReady] = useState<boolean>(() => {
        if (serverAccessToken) return true;
        if (!pkceEnabled) return true;
        if (initialPkce) return true;
        const stored = getPkceAuth();
        if (!stored) return true;
        return !isPkceTokenExpired(stored);
    });

    useEffect(() => {
        if (serverAccessToken || !pkceEnabled) return;
        const stored = getPkceAuth();
        if (!stored || !isPkceTokenExpired(stored)) return;

        resolvePkceAuth(stored)
            .then((resolved) => {
                if (!resolved) {
                    clearPkceAuth();
                    setMode("none");
                    setAccessToken(null);
                    return;
                }
                setMode("pkce");
                setAccessToken(resolved.access_token);
            })
            .finally(() => {
                setIsReady(true);
            });
    }, [serverAccessToken, pkceEnabled]);

    const ensureValidToken = useCallback(async () => {
        if (mode === "nextauth") return accessToken;
        if (mode !== "pkce") return null;

        const stored = getPkceAuth();
        const resolved = await resolvePkceAuth(stored);
        if (!resolved) {
            clearPkceAuth();
            setMode("none");
            setAccessToken(null);
            return null;
        }

        if (resolved.access_token !== accessToken) {
            setAccessToken(resolved.access_token);
        }

        return resolved.access_token;
    }, [mode, accessToken]);

    const signOut = useCallback(async () => {
        clearPkceAuth();
        setMode("none");
        setAccessToken(null);
        setIsReady(true);
        if (nextAuthEnabled) {
            await signOutAction();
        }
    }, [nextAuthEnabled]);

    const value = useMemo(
        () => ({
            mode,
            accessToken,
            isReady,
            nextAuthEnabled,
            pkceEnabled,
            ensureValidToken,
            signOut,
        }),
        [mode, accessToken, isReady, nextAuthEnabled, pkceEnabled, ensureValidToken, signOut]
    );

    return <SpotifyAuthContext.Provider value={value}>{children}</SpotifyAuthContext.Provider>;
}

export function useSpotifyAuth() {
    const context = useContext(SpotifyAuthContext);
    if (!context) {
        throw new Error("useSpotifyAuth must be used within SpotifyAuthProvider");
    }
    return context;
}
