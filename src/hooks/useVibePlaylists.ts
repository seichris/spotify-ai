"use client";

import { useCallback, useState } from "react";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import {
    addTracksToPlaylistAction,
    createPlaylistAction,
    getArtistTopTracksAction,
    getGeminiVibePlanAction,
    getUserProfileAction,
} from "@/app/actions";

const STATE_KEY = "vibe_playlist_state_v1";
const MAX_VIBES = 6;
const MIN_CLUSTER_SIZE = 6;
const NEW_SONGS_PER_VIBE = 10;

interface TrackSummary {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    genres: string[];
    uri: string;
}

interface VibeProfile {
    id: string;
    name: string;
    description: string;
    playlistId: string;
    playlistUrl?: string;
    genreCounts: Record<string, number>;
    artistCounts: Record<string, number>;
    suggestedTrackIds: string[];
    createdAt: number;
    updatedAt: number;
}

interface VibeState {
    version: 1;
    analyzedSongIds: string[];
    addedTrackIds: string[];
    vibes: Record<string, VibeProfile>;
    lastRunAt?: number;
}

interface VibeCluster {
    key: string;
    tracks: TrackSummary[];
    genreCounts: Record<string, number>;
    artistCounts: Record<string, number>;
    artistNames: Record<string, string>;
}

export interface PlaylistBuildResult {
    id: string;
    name: string;
    url?: string;
    addedLikedCount: number;
    addedNewCount: number;
}

const createEmptyState = (): VibeState => ({
    version: 1,
    analyzedSongIds: [],
    addedTrackIds: [],
    vibes: {},
    lastRunAt: undefined,
});

const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const loadState = (): VibeState => {
    if (typeof window === "undefined") return createEmptyState();
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return createEmptyState();
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1) return createEmptyState();
        return {
            ...createEmptyState(),
            ...parsed,
            vibes: parsed.vibes || {},
        } as VibeState;
    } catch (error) {
        console.error("Failed to parse vibe state", error);
        return createEmptyState();
    }
};

const saveState = (state: VibeState) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
};

const toTrackSummary = (track: EnrichedTrack): TrackSummary => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    genres: track.genres ?? [],
    uri: track.uri,
});

const getPrimaryGenre = (track: TrackSummary) => {
    if (!track.genres || track.genres.length === 0) return "mixed";
    return track.genres[0];
};

const increment = (counts: Record<string, number>, key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
};

const buildCounts = (tracks: TrackSummary[]) => {
    const genreCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};
    const artistNames: Record<string, string> = {};

    tracks.forEach(track => {
        track.genres.forEach(genre => increment(genreCounts, genre));
        track.artists.forEach(artist => {
            increment(artistCounts, artist.id);
            artistNames[artist.id] = artist.name;
        });
    });

    return { genreCounts, artistCounts, artistNames };
};

const getTopKeys = (counts: Record<string, number>, limit: number) =>
    Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key]) => key);

const buildClusters = (tracks: TrackSummary[]) => {
    if (tracks.length === 0) return [] as VibeCluster[];

    const buckets: Record<string, TrackSummary[]> = {};
    tracks.forEach(track => {
        const key = getPrimaryGenre(track).toLowerCase();
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(track);
    });

    const clusters = Object.entries(buckets)
        .map(([key, bucket]) => {
            const { genreCounts, artistCounts, artistNames } = buildCounts(bucket);
            return { key, tracks: bucket, genreCounts, artistCounts, artistNames } as VibeCluster;
        })
        .sort((a, b) => b.tracks.length - a.tracks.length);

    if (clusters.length <= MAX_VIBES) {
        return clusters;
    }

    const selected: VibeCluster[] = [];
    const mixedTracks: TrackSummary[] = [];

    clusters.forEach(cluster => {
        if (selected.length < MAX_VIBES - 1 && cluster.tracks.length >= MIN_CLUSTER_SIZE) {
            selected.push(cluster);
        } else {
            mixedTracks.push(...cluster.tracks);
        }
    });

    if (mixedTracks.length > 0) {
        const { genreCounts, artistCounts, artistNames } = buildCounts(mixedTracks);
        selected.push({
            key: "mixed",
            tracks: mixedTracks,
            genreCounts,
            artistCounts,
            artistNames,
        });
    }

    return selected;
};

const createSummary = (cluster: VibeCluster) => {
    const topGenres = getTopKeys(cluster.genreCounts, 6);
    const topArtistIds = getTopKeys(cluster.artistCounts, 6);
    const topArtists = topArtistIds.map(id => cluster.artistNames[id] || id);
    const sampleSongs = cluster.tracks
        .slice(0, 12)
        .map(track => `${track.name} - ${track.artists.map(artist => artist.name).join(", ")}`)
        .join("; ");

    return {
        summaryText: `Top genres: ${topGenres.join(", ") || "unknown"}\nTop artists: ${topArtists.join(", ") || "unknown"}\nSample liked songs: ${sampleSongs}`,
        topGenres,
        topArtistIds,
    };
};

const getVibeTopGenres = (vibe: VibeProfile, limit = 6) => getTopKeys(vibe.genreCounts, limit);

const getVibeTopArtists = (vibe: VibeProfile, limit = 6) => getTopKeys(vibe.artistCounts, limit);

const scoreTrackForVibe = (track: TrackSummary, vibe: VibeProfile) => {
    const vibeGenres = new Set(getVibeTopGenres(vibe));
    const vibeArtists = new Set(getVibeTopArtists(vibe));
    const genreMatches = track.genres.filter(genre => vibeGenres.has(genre));
    const artistMatches = track.artists.filter(artist => vibeArtists.has(artist.id));
    const score = genreMatches.length * 2 + artistMatches.length * 2;
    return { score, genreMatches, artistMatches };
};

const pickVibeMatches = (track: TrackSummary, vibes: Record<string, VibeProfile>) => {
    const scored = Object.entries(vibes)
        .map(([id, vibe]) => ({ id, ...scoreTrackForVibe(track, vibe) }))
        .filter(result => result.score >= 2)
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return [] as string[];
    const bestScore = scored[0].score;
    return scored.filter(item => item.score >= bestScore - 1).map(item => item.id);
};

const updateVibeCounts = (vibe: VibeProfile, tracks: TrackSummary[]) => {
    tracks.forEach(track => {
        track.genres.forEach(genre => increment(vibe.genreCounts, genre));
        track.artists.forEach(artist => increment(vibe.artistCounts, artist.id));
    });
};

const dedupeTracks = (tracks: TrackSummary[]) => {
    const seen = new Set<string>();
    return tracks.filter(track => {
        if (seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
    });
};

export function useVibePlaylists() {
    const [isBuilding, setIsBuilding] = useState(false);
    const [steps, setSteps] = useState<string[]>([]);
    const [results, setResults] = useState<PlaylistBuildResult[]>([]);
    const [error, setError] = useState<string | null>(null);

    const logStep = (message: string) => {
        setSteps(prev => [...prev, message]);
    };

    const resetState = useCallback(() => {
        if (typeof window === "undefined") return;
        localStorage.removeItem(STATE_KEY);
        setSteps([]);
        setResults([]);
        setError(null);
    }, []);

    const buildVibePlaylists = useCallback(async (songs: EnrichedTrack[]) => {
        setIsBuilding(true);
        setSteps([]);
        setResults([]);
        setError(null);

        try {
            const likedSongs = songs
                .filter(track => track.id && track.type === "track" && !track.is_local)
                .map(toTrackSummary);
            const likedIds = new Set(likedSongs.map(track => track.id));

            if (likedSongs.length === 0) {
                setError("No liked songs available. Load your library first.");
                return;
            }

            const state = loadState();
            const analyzedSet = new Set(state.analyzedSongIds);
            const persistedAddedSet = new Set(state.addedTrackIds);
            const runAddedSet = new Set<string>();
            const syncStateSets = () => {
                state.analyzedSongIds = Array.from(analyzedSet);
                state.addedTrackIds = Array.from(new Set([...persistedAddedSet, ...runAddedSet]));
            };
            const hasVibes = Object.keys(state.vibes).length > 0;

            const newLikedSongs = hasVibes
                ? likedSongs.filter(track => !analyzedSet.has(track.id))
                : likedSongs;

            logStep(`Loaded ${Object.keys(state.vibes).length} vibe playlists.`);
            logStep(`Found ${newLikedSongs.length} new liked songs to analyze.`);

            if (newLikedSongs.length === 0 && hasVibes) {
                logStep("No new songs to process.");
                return;
            }

            const profileResult = await getUserProfileAction();
            if (!profileResult.success || !profileResult.data) {
                setError("Failed to load Spotify profile.");
                return;
            }

            const userId = profileResult.data.id;
            const market = profileResult.data.country || "US";

            const assignments = new Map<string, TrackSummary[]>();
            const unassigned: TrackSummary[] = [];

            if (hasVibes) {
                newLikedSongs.forEach(track => {
                    const matches = pickVibeMatches(track, state.vibes);
                    if (matches.length === 0) {
                        unassigned.push(track);
                        return;
                    }
                    matches.forEach(vibeId => {
                        const existing = assignments.get(vibeId) || [];
                        existing.push(track);
                        assignments.set(vibeId, existing);
                    });
                });
            }

            const clusters = hasVibes ? buildClusters(unassigned) : buildClusters(newLikedSongs);
            if (clusters.length > 0) {
                logStep(`Creating ${clusters.length} new vibe playlist${clusters.length === 1 ? "" : "s"}.`);
            }

            const buildResults: PlaylistBuildResult[] = [];

            for (const [vibeId, tracks] of assignments.entries()) {
                const vibe = state.vibes[vibeId];
                if (!vibe || tracks.length === 0) continue;

                const uniqueTracks = dedupeTracks(tracks);
                const urisToAdd = uniqueTracks
                    .filter(track => !persistedAddedSet.has(track.id))
                    .map(track => track.uri);

                if (urisToAdd.length === 0) {
                    uniqueTracks.forEach(track => analyzedSet.add(track.id));
                    continue;
                }

                logStep(`Updating ${vibe.name} with ${urisToAdd.length} liked songs.`);

                const addResult = await addTracksToPlaylistAction(vibe.playlistId, urisToAdd);
                if (!addResult.success) {
                    logStep(`Failed to update ${vibe.name}.`);
                    continue;
                }

                updateVibeCounts(vibe, uniqueTracks);
                vibe.updatedAt = Date.now();

                uniqueTracks.forEach(track => {
                    analyzedSet.add(track.id);
                    runAddedSet.add(track.id);
                });

                buildResults.push({
                    id: vibe.playlistId,
                    name: vibe.name,
                    url: vibe.playlistUrl,
                    addedLikedCount: urisToAdd.length,
                    addedNewCount: 0,
                });

                syncStateSets();
                saveState(state);
            }

            for (const cluster of clusters) {
                if (cluster.tracks.length === 0) continue;

                const alreadyAdded = cluster.tracks.filter(track => persistedAddedSet.has(track.id));
                const freshTracks = cluster.tracks.filter(track => !persistedAddedSet.has(track.id));

                alreadyAdded.forEach(track => analyzedSet.add(track.id));

                if (freshTracks.length === 0) {
                    logStep(`Skipping ${cluster.key} cluster (songs already in playlists).`);
                    continue;
                }

                const { genreCounts, artistCounts, artistNames } = buildCounts(freshTracks);
                const activeCluster: VibeCluster = {
                    key: cluster.key,
                    tracks: freshTracks,
                    genreCounts,
                    artistCounts,
                    artistNames,
                };

                const summary = createSummary(activeCluster);
                const geminiResult = await getGeminiVibePlanAction(summary.summaryText);

                const rawVibeName = geminiResult.success && geminiResult.vibeName
                    ? geminiResult.vibeName
                    : `${summary.topGenres[0] || "Mixed"} Vibes`;
                const vibeDescription = geminiResult.success && geminiResult.vibeDescription
                    ? geminiResult.vibeDescription
                    : `Inspired by ${summary.topGenres.slice(0, 3).join(", ") || "your liked songs"}.`;

                const trimmedVibeName = rawVibeName.trim();
                const safeVibeName = trimmedVibeName.length > 60
                    ? `${trimmedVibeName.slice(0, 57)}...`
                    : trimmedVibeName;
                const playlistName = `Gemini Vibe - ${safeVibeName}`.slice(0, 100);
                logStep(`Creating playlist "${playlistName}".`);

                const playlistResult = await createPlaylistAction(userId, playlistName, vibeDescription, false);
                if (!playlistResult.success || !playlistResult.data) {
                    logStep(`Failed to create playlist for ${vibeName}.`);
                    continue;
                }

                const playlistId = playlistResult.data.id as string;
                const playlistUrl = playlistResult.data.external_urls?.spotify as string | undefined;

                const likedUris = activeCluster.tracks
                    .filter(track => !persistedAddedSet.has(track.id))
                    .map(track => track.uri);

                let suggestedTracks: TrackSummary[] = [];
                if (geminiResult.success && Array.isArray(geminiResult.suggestions)) {
                    suggestedTracks = geminiResult.suggestions.map((track: any) => ({
                        id: track.id,
                        name: track.name,
                        artists: track.artists,
                        genres: [],
                        uri: track.uri,
                    }));
                }

                suggestedTracks = dedupeTracks(suggestedTracks)
                    .filter(track => !likedIds.has(track.id))
                    .filter(track => !persistedAddedSet.has(track.id));

                if (suggestedTracks.length < NEW_SONGS_PER_VIBE && summary.topArtistIds.length > 0) {
                    for (const artistId of summary.topArtistIds) {
                        const topTracksResult = await getArtistTopTracksAction(artistId, market);
                        if (!topTracksResult.success || !topTracksResult.data) continue;
                        const topTracks = topTracksResult.data.tracks || [];
                        topTracks.forEach((track: any) => {
                            if (suggestedTracks.length >= NEW_SONGS_PER_VIBE) return;
                            if (likedIds.has(track.id) || persistedAddedSet.has(track.id)) return;
                            if (suggestedTracks.find(item => item.id === track.id)) return;
                            suggestedTracks.push({
                                id: track.id,
                                name: track.name,
                                artists: track.artists,
                                genres: [],
                                uri: track.uri,
                            });
                        });
                        if (suggestedTracks.length >= NEW_SONGS_PER_VIBE) break;
                    }
                }

                const newTracks = suggestedTracks.slice(0, NEW_SONGS_PER_VIBE);
                const newUris = newTracks.map(track => track.uri);

                const allUris = Array.from(new Set([...likedUris, ...newUris]));
                logStep(`Adding ${likedUris.length} liked + ${newTracks.length} new songs to ${playlistName}.`);

                const addResult = await addTracksToPlaylistAction(playlistId, allUris);
                if (!addResult.success) {
                    logStep(`Failed to add tracks to ${playlistName}.`);
                    continue;
                }

                const vibeId = createId();
                const newVibe: VibeProfile = {
                    id: vibeId,
                    name: playlistName,
                    description: vibeDescription,
                    playlistId,
                    playlistUrl,
                    genreCounts: { ...activeCluster.genreCounts },
                    artistCounts: { ...activeCluster.artistCounts },
                    suggestedTrackIds: newTracks.map(track => track.id),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };

                state.vibes[vibeId] = newVibe;

                activeCluster.tracks.forEach(track => {
                    analyzedSet.add(track.id);
                    runAddedSet.add(track.id);
                });

                newTracks.forEach(track => {
                    runAddedSet.add(track.id);
                });

                buildResults.push({
                    id: playlistId,
                    name: playlistName,
                    url: playlistUrl,
                    addedLikedCount: likedUris.length,
                    addedNewCount: newTracks.length,
                });

                syncStateSets();
                saveState(state);
            }

            syncStateSets();
            state.lastRunAt = Date.now();
            saveState(state);

            setResults(buildResults);
        } catch (err: any) {
            console.error("Error building vibe playlists", err);
            setError(err?.message || "Failed to build playlists.");
        } finally {
            setIsBuilding(false);
        }
    }, []);

    return {
        isBuilding,
        steps,
        results,
        error,
        buildVibePlaylists,
        resetState,
    };
}
