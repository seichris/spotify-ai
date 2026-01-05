import { auth } from "@/auth";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

async function getAccessToken() {
    const session = await auth();
    if (!session?.access_token) {
        throw new Error("No access token found");
    }
    // console.log("Token Scopes:", session.scope); // NextAuth might not expose scope easily in session without config
    return session.access_token;
}

export async function fetchSpotify(
    endpoint: string,
    options: RequestInit = {},
    accessToken?: string
) {
    const token = accessToken ?? await getAccessToken();
    const url = `${SPOTIFY_API_BASE}${endpoint}`;
    console.log(`Fetching Spotify: ${url}`);
    const res = await fetch(url, {
        cache: "no-store",
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        if (res.status === 429) {
            const retryAfter = res.headers.get("Retry-After");
            console.warn(`Rate limited. Retrying after ${retryAfter} seconds...`);
            // If we are rate limited, we should probably throw specific error or handle it
            // For now, let's just throw to be caught by the caller, but maybe we can add a delay in the loop
        }

        const errorText = await res.text();
        let errorJson;
        try {
            errorJson = JSON.parse(errorText);
        } catch (e) {
            // Not JSON
        }

        console.error(`Spotify API Error (${res.status}):`, errorText);
        console.error("Response Headers:", Object.fromEntries(res.headers.entries()));
        throw new Error(errorJson?.error?.message || `Spotify API Error: ${res.status} - ${errorText}`);
    }

    return res.json();
}

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: { name: string; images: { url: string }[] };
    duration_ms: number;
    uri: string;
    is_local: boolean;
    type: string;
}

export interface AudioFeatures {
    id: string;
    danceability: number;
    energy: number;
    key: number;
    loudness: number;
    mode: number;
    speechiness: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    valence: number;
    tempo: number;
}

export async function getLikedSongs(limit = 50, offset = 0, accessToken?: string) {
    return fetchSpotify(`/me/tracks?limit=${limit}&offset=${offset}`, {}, accessToken);
}

export async function getAudioFeatures(ids: string[], accessToken?: string) {
    return fetchSpotify(`/audio-features?ids=${ids.join(",")}`, {}, accessToken);
}

export async function searchSpotify(
    query: string,
    type: string = 'track',
    limit: number = 1,
    accessToken?: string
) {
    const params = new URLSearchParams({
        q: query,
        type,
        limit: limit.toString()
    });
    return fetchSpotify(`/search?${params.toString()}`, {}, accessToken);
}

export async function createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPublic = false,
    accessToken?: string
) {
    return fetchSpotify(`/users/${userId}/playlists`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            description,
            public: isPublic,
        }),
    }, accessToken);
}

export async function addTracksToPlaylist(playlistId: string, uris: string[], accessToken?: string) {
    return fetchSpotify(`/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris }),
    }, accessToken);
}

export async function replacePlaylistTracks(playlistId: string, uris: string[], accessToken?: string) {
    return fetchSpotify(`/playlists/${playlistId}/tracks`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris }),
    }, accessToken);
}

export async function getArtistTopTracks(artistId: string, market: string, accessToken?: string) {
    const params = new URLSearchParams({ market });
    return fetchSpotify(`/artists/${artistId}/top-tracks?${params.toString()}`, {}, accessToken);
}
