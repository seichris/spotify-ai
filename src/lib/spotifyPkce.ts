import { SPOTIFY_SCOPE_STRING } from "@/lib/spotifyScopes";

const PKCE_STORAGE_KEY = "spotify_pkce_auth_v1";
const PKCE_VERIFIER_KEY = "spotify_pkce_verifier_v1";
const PKCE_STATE_KEY = "spotify_pkce_state_v1";
const PKCE_CLIENT_ID_KEY = "spotify_pkce_client_id";
const PKCE_CALLBACK_PATH = "/pkce/callback";

export type SpotifyPkceAuth = {
    access_token: string;
    refresh_token?: string;
    expires_at: number;
    scope?: string;
    token_type?: string;
};

export const getPkceClientId = () => {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem(PKCE_CLIENT_ID_KEY);
        if (stored) return stored;
    }
    return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
};

export const setPkceClientId = (clientId: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PKCE_CLIENT_ID_KEY, clientId);
};

export const isPkceEnabled = () => Boolean(getPkceClientId());

export const getPkceRedirectUri = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${PKCE_CALLBACK_PATH}`;
};

const base64UrlEncode = (value: ArrayBuffer | Uint8Array) => {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    let binary = "";
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const generateCodeVerifier = () => {
    const randomBytes = new Uint8Array(96);
    crypto.getRandomValues(randomBytes);
    return base64UrlEncode(randomBytes);
};

const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(digest);
};

const getStoredState = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PKCE_STATE_KEY);
};

export const getPkceAuth = (): SpotifyPkceAuth | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(PKCE_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as SpotifyPkceAuth;
    } catch (error) {
        console.error("Failed to parse PKCE auth", error);
        return null;
    }
};

export const savePkceAuth = (auth: SpotifyPkceAuth) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(auth));
};

export const clearPkceAuth = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(PKCE_STORAGE_KEY);
    localStorage.removeItem(PKCE_VERIFIER_KEY);
    localStorage.removeItem(PKCE_STATE_KEY);
};

export const isPkceTokenExpired = (auth: SpotifyPkceAuth, bufferMs = 60000) => {
    return Date.now() >= auth.expires_at - bufferMs;
};

export const startPkceLogin = async (clientIdOverride?: string) => {
    const clientId = clientIdOverride ?? getPkceClientId();
    if (!clientId) {
        throw new Error("Missing Spotify client ID for PKCE login");
    }
    setPkceClientId(clientId);
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(PKCE_STATE_KEY, state);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: getPkceRedirectUri(),
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
        scope: SPOTIFY_SCOPE_STRING,
    });

    window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
};

export const exchangePkceCode = async (code: string, state: string | null) => {
    const clientId = getPkceClientId();
    if (!clientId) {
        throw new Error("Missing Spotify client ID for PKCE login");
    }

    const storedState = getStoredState();
    if (state && storedState && state !== storedState) {
        throw new Error("Invalid Spotify auth state");
    }

    const verifier = typeof window !== "undefined" ? localStorage.getItem(PKCE_VERIFIER_KEY) : null;
    if (!verifier) {
        throw new Error("Missing PKCE verifier");
    }

    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: getPkceRedirectUri(),
        code_verifier: verifier,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to exchange code");
    }

    const payload = await res.json();
    const auth: SpotifyPkceAuth = {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: Date.now() + payload.expires_in * 1000,
        scope: payload.scope,
        token_type: payload.token_type,
    };

    savePkceAuth(auth);
    localStorage.removeItem(PKCE_VERIFIER_KEY);
    localStorage.removeItem(PKCE_STATE_KEY);

    return auth;
};

export const refreshPkceAuth = async (existing: SpotifyPkceAuth) => {
    if (!existing.refresh_token) return null;
    const clientId = getPkceClientId();
    if (!clientId) {
        throw new Error("Missing Spotify client ID for PKCE login");
    }

    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: existing.refresh_token,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("Failed to refresh PKCE token", text);
        return null;
    }

    const payload = await res.json();
    const auth: SpotifyPkceAuth = {
        ...existing,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token ?? existing.refresh_token,
        expires_at: Date.now() + payload.expires_in * 1000,
        scope: payload.scope ?? existing.scope,
        token_type: payload.token_type ?? existing.token_type,
    };

    savePkceAuth(auth);
    return auth;
};
